"""
Tool Registry - Consultation Agent 도구 정의 및 레지스트리

지원되는 모든 도구를 이 모듈에서 정의/임포트하고
이름으로 조회할 수 있도록 레지스트리를 제공합니다.

책임:
  1. 외부 도구(strands_tools) 임포트: retrieve, current_time, http_request
  2. @tool로 정의되는 커스텀 도구 선언 (render_form, extract_a2t_log)
  3. MCP 클라이언트 생성 (aws_docs_mcp_client)
  4. 이름->객체 매핑을 통한 동적 조회

Requirements: 8.1, 8.2, 8.3, 8.4
"""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field
from strands import Agent
from strands.tools import tool
from strands.tools.mcp import MCPClient
from strands.types.exceptions import StructuredOutputException
from mcp import stdio_client, StdioServerParameters
from strands_tools import retrieve, current_time, http_request

logger = logging.getLogger(__name__)


# -- MCP 클라이언트 --------------------------------
# AWS Documentation MCP 서버는 Dockerfile에서 사전 설치됨.
aws_docs_mcp_client = MCPClient(
    lambda: stdio_client(
        StdioServerParameters(
            command="uvx",
            args=["awslabs.aws-documentation-mcp-server@latest"],
        )
    )
)


# -- render_form 커스텀 도구 ------------------------
@tool
def render_form(form_title: str, fields: str) -> str:
    """고객이 정보를 기입할 수 있는 HTML Form을 생성합니다 (Div Return).

    프론트엔드에서 동적으로 렌더링되는 HTML을 반환합니다.
    고객이 Form에 정보를 기입하면 messages로 취급 & 저장됩니다.

    CRITICAL - 에이전트 행동 지침 (반드시 지킬 것):
    이 도구가 반환하는 HTML 문자열은 프론트엔드가 직접 파싱/렌더링해야 하는
    UI 페이로드입니다. 따라서 에이전트는 도구의 반환값을 다음 규칙에 따라
    처리해야 합니다.

    1. 반환된 HTML(<div>...</div>)을 요약하거나 재서술하지 말고,
       그대로(verbatim) 최종 응답 메시지에 포함시켜 고객에게 전달한다.
    2. HTML 바로 앞에 1-2문장의 간단한 안내 텍스트(예: "아래 폼에 정보를
       입력해 주세요")를 덧붙일 수 있으나, HTML 자체는 변형하지 않는다.
    3. "폼을 생성했습니다" 같은 메타 설명만 전달하고 HTML을 생략하는 것은
       금지된다. HTML이 응답에 포함되지 않으면 고객은 폼을 볼 수 없다.
    4. HTML을 코드블록(```)으로 감싸지 않는다. 원본 그대로 전달한다.

    Args:
        form_title: 폼 제목
        fields: JSON 형식의 필드 정의
            예: '[{"name":"company","label":"회사명","type":"text"}]'

    Returns:
        렌더링 가능한 HTML Form 문자열 — 최종 응답에 그대로 포함되어야 함.
    """
    try:
        field_list = json.loads(fields)
    except json.JSONDecodeError:
        return "<div><p>폼 필드 정의가 올바르지 않습니다.</p></div>"

    form_html = '<div class="prechat-form" data-form-type="div-return">'
    form_html += f"<h3>{form_title}</h3>"
    form_html += "<form>"

    for field in field_list:
        name = field.get("name", "")
        label = field.get("label", name)
        field_type = field.get("type", "text")
        required = field.get("required", False)
        options = field.get("options", [])

        form_html += '<div class="form-field">'
        form_html += f'<label for="{name}">{label}</label>'

        req_attr = "required" if required else ""
        if field_type == "textarea":
            form_html += (
                f'<textarea name="{name}" id="{name}" {req_attr}>'
                "</textarea>"
            )
        elif field_type == "select":
            form_html += (
                f'<select name="{name}" id="{name}" {req_attr}>'
            )
            for opt in options:
                form_html += f'<option value="{opt}">{opt}</option>'
            form_html += "</select>"
        else:
            form_html += (
                f'<input type="{field_type}" '
                f'name="{name}" id="{name}" {req_attr} />'
            )

        form_html += "</div>"

    form_html += '<button type="submit" data-i18n="submit">Submit</button>'
    form_html += "</form></div>"

    return form_html


# -- A2T 로그 구조 (SHIP 폼 매핑) ------------------
# SHIP A2T: Activity-to-Trigger 로그
# Sales Rep가 Customer 상담 이후 SHIP 폼에 붙여넣기 위한 구조화 데이터
_A2T_EXTRACTOR_MODEL_ID = (
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
)

_A2T_EXTRACTION_PROMPT = """You are an A2T log extraction specialist.
Analyze the conversation history and extract structured information
for the SHIP A2T form.

## Rules
- Extract ONLY information explicitly mentioned in the conversation.
- For fields not mentioned, leave them as empty strings.
- The `description` field must be in English, max 280 characters, max 3 lines.
- The `workshop_date` should be the date the conversation took place, if identifiable.
- For Q1~Q14, summarize the customer's responses concisely.
"""


class CustomerContact(BaseModel):
    """고객 담당자 연락처."""

    name: str = Field(default="", description="고객 담당자 이름")
    company: str = Field(default="", description="회사명")
    email: str = Field(default="", description="이메일")
    title: str = Field(default="", description="직함")


class A2TQuestions(BaseModel):
    """SHIP A2T 폼 질문 항목 (Q1~Q14)."""

    q1_past_security_assessments: str = Field(
        default="", description="과거 참여한 AWS 보안 점검/프레임워크"
    )
    q2_threat_detection_3rd_party: str = Field(
        default="", description="위협 탐지 3rd party 솔루션 사용 여부"
    )
    q3_risk_analytics_3rd_party: str = Field(
        default="", description="리스크 상관분석 3rd party 사용 여부"
    )
    q4_vulnerability_mgmt_3rd_party: str = Field(
        default="", description="취약점 관리 3rd party 사용 여부"
    )
    q5_key_management_3rd_party: str = Field(
        default="", description="암호화 키 관리 3rd party 사용 여부"
    )
    q6_credential_protection_3rd_party: str = Field(
        default="", description="자격증명 보호 3rd party 사용 여부"
    )
    q7_network_protection_3rd_party: str = Field(
        default="", description="네트워크 보호 3rd party 사용 여부"
    )
    q8_app_firewall_3rd_party: str = Field(
        default="", description="애플리케이션 방화벽 3rd party 사용 여부"
    )
    q9_permission_analysis_3rd_party: str = Field(
        default="", description="권한 분석 3rd party 사용 여부"
    )
    q10_config_monitoring_3rd_party: str = Field(
        default="", description="구성 모니터링 3rd party 사용 여부"
    )
    q11_assessment_used: str = Field(
        default="",
        description="데이터 기반 보안 대화에 사용한 Assessment",
    )
    q12_security_use_case_focus: str = Field(
        default="", description="고객이 집중하는 보안 유스케이스"
    )
    q13_adoption_plan: str = Field(
        default="",
        description="파트너/AWS 네이티브 서비스 도입 계획",
    )
    q14_aws_security_feedback: str = Field(
        default="", description="AWS 보안 서비스 피드백"
    )


class A2TLog(BaseModel):
    """SHIP A2T 로그 - SA가 SHIP 폼에 바로 붙여넣을 수 있는 구조.

    session_id 등 세션 메타데이터는 SHIP 폼 항목이 아니므로 포함하지 않는다.
    호출자가 필요하면 결과에 별도로 덧붙인다.
    """

    description: str = Field(
        default="",
        description="SATv2 Assessment 배경 (영어, 280자 이내)",
    )
    customer_contact: CustomerContact = Field(
        default_factory=CustomerContact
    )
    workshop_date: str = Field(
        default="", description="워크숍/대화 수행 날짜"
    )
    a2t_questions: A2TQuestions = Field(default_factory=A2TQuestions)


# -- extract_a2t_log 커스텀 도구 --------------------
@tool
def extract_a2t_log(conversation_history: str) -> str:
    """대화 내역을 기반으로 A2T(Activity-to-Trigger) 로그를 구조화하여 추출합니다.

    Strands Agent + Pydantic structured_output을 사용하여
    대화에서 파악된 정보를 SHIP 폼 항목에 맞춰 반환합니다.
    세션 ID 같은 메타데이터는 호출자가 결과에 덧붙입니다.

    Args:
        conversation_history: JSON 형식의 대화 내역

    Returns:
        JSON 형식의 A2T 로그 - SA가 SHIP 폼에 바로 붙여넣을 수 있는 형태
    """
    extraction_agent = Agent(
        model=_A2T_EXTRACTOR_MODEL_ID,
        system_prompt=_A2T_EXTRACTION_PROMPT,
        tools=[],
    )

    prompt = (
        "Extract the A2T log from the following conversation.\n\n"
        f"Conversation History:\n{conversation_history}"
    )

    try:
        result = extraction_agent(
            prompt, structured_output_model=A2TLog
        )
        output: A2TLog = result.structured_output
        return output.model_dump_json(indent=2)
    except StructuredOutputException as e:
        logger.error(f"A2T 로그 structured output 파싱 실패: {e}")
        # 폴백: 빈 템플릿 반환
        fallback = A2TLog()
        return fallback.model_dump_json(indent=2)


# -- 도구 레지스트리 -------------------------------
def _build_registry() -> dict[str, Any]:
    """임포트/정의에 성공한 도구만 레지스트리에 등록합니다."""
    return {
        "retrieve": retrieve,
        "current_time": current_time,
        "http_request": http_request,
        "render_form": render_form,
        "aws_docs_mcp": aws_docs_mcp_client,
        "extract_a2t_log": extract_a2t_log,
    }


TOOL_REGISTRY: dict[str, Any] = _build_registry()

# 항상 포함되는 도구 목록
ALWAYS_INCLUDED: list[str] = ["current_time"]


def resolve_tools(tool_configs: list[dict]) -> list:
    """AgentConfig의 tools 배열에서 실제 도구 객체를 반환합니다.

    tool_configs의 각 tool_name을 TOOL_REGISTRY에서 조회하고,
    ALWAYS_INCLUDED 도구를 자동으로 추가합니다.
    레지스트리에 없는 도구는 경고 로그 후 건너뜁니다.

    Args:
        tool_configs: AgentConfig의 tools 배열.
            각 요소는 {'tool_name': str, ...} 형태.

    Returns:
        해석된 도구 객체 리스트.
    """
    names = {t["tool_name"] for t in tool_configs}
    names.update(ALWAYS_INCLUDED)
    tools = []
    for name in names:
        if name in TOOL_REGISTRY:
            tools.append(TOOL_REGISTRY[name])
        else:
            logger.warning(
                "Unknown tool: %s -- 레지스트리에 없습니다.",
                name,
            )
    return tools
