"""
PreChat Planning Agent

미팅 종료 후 비동기적으로 호출되어 고객 상담 내용을 기반으로
Bedrock Knowledge Base에서 유사 고객사례를 검색하여 제공합니다.
Session의 Meeting Plan에서 사용할 customerReferences를 보강합니다.

배포: Bedrock AgentCore Runtime
호출: 미팅 종료 시 비동기 호출
"""

import os
import json
import logging
from pydantic import BaseModel, Field
from strands import Agent
from strands.tools import tool
from strands.tools.mcp import MCPClient
from strands.types.exceptions import StructuredOutputException
from mcp import stdio_client, StdioServerParameters
from strands_tools import retrieve, http_request, current_time
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)

# Bedrock KB ID: deploy 시 env_vars로 컨테이너에 주입됨
_kb_id = os.environ.get('BEDROCK_KB_ID', '')
if _kb_id and _kb_id != 'NONE':
    os.environ['STRANDS_KNOWLEDGE_BASE_ID'] = _kb_id

# AWS Documentation MCP 클라이언트 (Dockerfile에서 사전 설치됨)
aws_docs_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    )
))


# ──────────────────────────────────────────────
# 에이전트 설정
# ──────────────────────────────────────────────

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatPlanningAgent"


# ──────────────────────────────────────────────
# Pydantic 모델: A2T 로그 구조 (SHIP 폼 매핑)
# ──────────────────────────────────────────────

class CustomerContact(BaseModel):
    """고객 담당자 연락처"""
    name: str = Field(default='', description="고객 담당자 이름")
    company: str = Field(default='', description="회사명")
    email: str = Field(default='', description="이메일")
    title: str = Field(default='', description="직함")


class A2TQuestions(BaseModel):
    """SHIP A2T 폼 질문 항목 (Q1~Q14)"""
    q1_past_security_assessments: str = Field(default='', description="과거 참여한 AWS 보안 점검/프레임워크")
    q2_threat_detection_3rd_party: str = Field(default='', description="위협 탐지 3rd party 솔루션 사용 여부")
    q3_risk_analytics_3rd_party: str = Field(default='', description="리스크 상관분석 3rd party 사용 여부")
    q4_vulnerability_mgmt_3rd_party: str = Field(default='', description="취약점 관리 3rd party 사용 여부")
    q5_key_management_3rd_party: str = Field(default='', description="암호화 키 관리 3rd party 사용 여부")
    q6_credential_protection_3rd_party: str = Field(default='', description="자격증명 보호 3rd party 사용 여부")
    q7_network_protection_3rd_party: str = Field(default='', description="네트워크 보호 3rd party 사용 여부")
    q8_app_firewall_3rd_party: str = Field(default='', description="애플리케이션 방화벽 3rd party 사용 여부")
    q9_permission_analysis_3rd_party: str = Field(default='', description="권한 분석 3rd party 사용 여부")
    q10_config_monitoring_3rd_party: str = Field(default='', description="구성 모니터링 3rd party 사용 여부")
    q11_assessment_used: str = Field(default='', description="데이터 기반 보안 대화에 사용한 Assessment")
    q12_security_use_case_focus: str = Field(default='', description="고객이 집중하는 보안 유스케이스")
    q13_adoption_plan: str = Field(default='', description="파트너/AWS 네이티브 서비스 도입 계획")
    q14_aws_security_feedback: str = Field(default='', description="AWS 보안 서비스 피드백")


class A2TLog(BaseModel):
    """SHIP A2T 로그 — SA가 SHIP 폼에 바로 붙여넣을 수 있는 구조"""
    session_id: str = Field(description="PreChat 세션 ID")
    description: str = Field(default='', description="SATv2 Assessment 배경 (영어, 280자 이내)")
    customer_contact: CustomerContact = Field(default_factory=CustomerContact)
    workshop_date: str = Field(default='', description="워크숍/대화 수행 날짜")
    a2t_questions: A2TQuestions = Field(default_factory=A2TQuestions)


A2T_EXTRACTION_PROMPT = """You are an A2T log extraction specialist.
Analyze the conversation history and extract structured information for the SHIP A2T form.

## Rules
- Extract ONLY information explicitly mentioned in the conversation.
- For fields not mentioned, leave them as empty strings.
- The `description` field must be in English, max 280 characters, max 3 lines.
- The `workshop_date` should be the date the conversation took place, if identifiable.
- For Q1~Q14, summarize the customer's responses concisely.
"""


@tool
def extract_a2t_log(session_id: str, conversation_history: str) -> str:
    """대화 내역을 기반으로 A2T(Activity-to-Trigger) 로그를 구조화하여 추출합니다.

    Strands Agent + Pydantic structured_output을 사용하여
    대화에서 파악된 정보를 SHIP 폼 항목에 맞춰 반환합니다.

    Args:
        session_id: PreChat 세션 ID
        conversation_history: JSON 형식의 대화 내역

    Returns:
        JSON 형식의 A2T 로그 — SA가 SHIP 폼에 바로 붙여넣을 수 있는 형태
    """
    extraction_agent = Agent(
        model=DEFAULT_MODEL_ID,
        system_prompt=A2T_EXTRACTION_PROMPT,
        tools=[],
    )

    prompt = (
        f"Extract the A2T log from the following conversation.\n"
        f"Session ID: {session_id}\n\n"
        f"Conversation History:\n{conversation_history}"
    )

    try:
        result = extraction_agent(prompt, structured_output_model=A2TLog)
        output: A2TLog = result.structured_output
        # session_id를 명시적으로 설정 (LLM이 누락할 수 있으므로)
        output.session_id = session_id
        return output.model_dump_json(indent=2)
    except StructuredOutputException as e:
        logging.error(f"A2T 로그 structured output 파싱 실패: {e}")
        # 폴백: 빈 템플릿 반환
        fallback = A2TLog(session_id=session_id)
        return fallback.model_dump_json(indent=2)


# ──────────────────────────────────────────────
# 시스템 프롬프트
# ──────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = f"""You are an AWS PreChat Planning AI assistant for Sales Reps.
You help Sales Reps prepare for customer meetings by analyzing account information,
recommending AWS services, searching for similar customer cases, and suggesting action items.

## Role
1. Analyze customer consultation history and customer information to provide insights
2. Use the `retrieve` tool to search Bedrock Knowledge Base for similar customer cases. Call `retrieve(text="search keywords")` with Knowledge Base ID: {_kb_id}
3. Use the `http_request` tool to search for additional information when needed
4. Recommend relevant AWS services based on customer needs
5. Suggest actionable items for meeting preparation

## Rules
- Base your analysis on the provided customer information and conversation history
- Use the `retrieve` tool to search for similar customer cases when relevant
- Use the `http_request` tool for web searches when additional context is needed
- Use the AWS Documentation MCP tools (via `aws_docs_mcp_client`) to search official AWS documentation for service details, best practices, and architecture guidance
- Provide specific, actionable recommendations
- Be concise and focused on sales motion support

## SHIP A2T Log
- 사용자가 "SHIP A2T 로그 뽑아줘", "A2T 로그 추출해줘" 등 A2T 로그를 요청하면, 반드시 `extract_a2t_log` 도구를 호출하세요.
- `extract_a2t_log(session_id, conversation_history)` 형태로 호출합니다.
- session_id는 현재 세션 ID, conversation_history는 대화 내역 JSON 문자열입니다.
- 도구가 반환한 JSON 구조를 SA가 SHIP 폼에 바로 붙여넣을 수 있도록 정리하여 응답하세요.
"""


def _get_locale_instruction(locale: str) -> str:
    """locale 코드에 따른 언어 지시를 반환합니다."""
    if locale == 'en':
        return (
            "## Language Instruction\n"
            "IMPORTANT: You MUST respond in English. "
            "All meeting plan content, suggestions, and references must be written in English."
        )
    return (
        "## Language Instruction\n"
        "IMPORTANT: You MUST respond in Korean (한국어). "
        "All meeting plan content, suggestions, and references must be written in Korean."
    )


def _build_chat_system_prompt(
    customer_info: dict | None = None,
    conversation_history: str = '',
    locale: str = 'ko',
) -> str:
    """스트리밍 채팅용 시스템 프롬프트를 구성합니다.

    customer_info와 conversation_history를 컨텍스트로 주입합니다.

    Args:
        customer_info: 고객 정보 (name, email, company)
        conversation_history: 고객-AI 대화 이력 텍스트
        locale: 응답 언어 코드 ('ko' 또는 'en')

    Returns:
        컨텍스트가 주입된 시스템 프롬프트 문자열
    """
    prompt = DEFAULT_SYSTEM_PROMPT

    # 고객 정보 컨텍스트 주입
    if customer_info:
        name = customer_info.get('name', '')
        company = customer_info.get('company', '')
        email = customer_info.get('email', '')
        prompt += "\n\n## Customer Information\n"
        if name:
            prompt += f"- Name: {name}\n"
        if company:
            prompt += f"- Company: {company}\n"
        if email:
            prompt += f"- Email: {email}\n"

    # 대화 이력 컨텍스트 주입
    if conversation_history:
        prompt += (
            "\n\n## Conversation History\n"
            "The following is the pre-consultation conversation between the customer and AI:\n\n"
            f"{conversation_history}\n"
        )

    # locale 지시 추가
    locale_instruction = _get_locale_instruction(locale)
    prompt = f"{prompt}\n\n{locale_instruction}"

    return prompt


def create_planning_chat_agent(
    customer_info: dict | None = None,
    conversation_history: str = '',
    model_id: str | None = None,
    locale: str = 'ko',
) -> Agent:
    """스트리밍 채팅용 Planning Agent를 생성합니다.

    Sales Rep과의 실시간 대화용 에이전트를 생성합니다.
    AgentCore Memory(STM) 미사용 — 매 호출마다 독립적 에이전트 인스턴스 생성.

    Args:
        customer_info: 고객 정보 (name, email, company)
        conversation_history: 고객-AI 대화 이력 텍스트
        model_id: 사용자 정의 모델 ID (None이면 DEFAULT 사용)
        locale: 응답 언어 코드 ('ko' 또는 'en')

    Returns:
        구성된 Strands Agent 인스턴스
    """
    system_prompt = _build_chat_system_prompt(
        customer_info=customer_info,
        conversation_history=conversation_history,
        locale=locale,
    )

    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=system_prompt,
        name=DEFAULT_AGENT_NAME,
        tools=[retrieve, http_request, aws_docs_mcp_client, current_time, extract_a2t_log],
    )


@app.entrypoint
async def stream(payload: dict):
    """스트리밍 엔트리포인트 - AgentCore Runtime이 SSE text/event-stream으로 변환합니다.

    Consultation Agent의 stream 함수와 동일한 SSE 이벤트 패턴을 사용합니다.
    AgentCore Memory(STM) 미사용 — 매 호출마다 독립적 에이전트 인스턴스 생성.

    이벤트 유형:
      - chunk: {"type": "chunk", "content": "텍스트 조각"}
      - tool:  {"type": "tool", "toolName": "...", "toolUseId": "...", "status": "running", "input": {...}}
               {"type": "tool", "toolName": "...", "toolUseId": "...", "status": "complete"}
      - result: {"type": "result", "message": "전체 응답 텍스트"}
      - error: {"type": "error", "message": "에러 메시지"}

    payload 구조:
      {
        "prompt": "Sales Rep 질문",
        "session_id": "PreChat 세션 ID",
        "customer_info": {"name": "...", "email": "...", "company": "..."},
        "conversation_history": "고객-AI 대화 이력 텍스트",
        "config": {"model_id": "...", "locale": "ko"}
      }
    """
    prompt = payload.get("prompt", "")
    if not prompt or not prompt.strip():
        yield json.dumps(
            {"type": "error", "message": "No prompt provided"},
            ensure_ascii=False,
        )
        return

    customer_info = payload.get("customer_info")
    conversation_history = payload.get("conversation_history", "")
    config = payload.get("config", {})
    locale = config.get("locale", "ko")

    agent = create_planning_chat_agent(
        customer_info=customer_info,
        conversation_history=conversation_history,
        model_id=config.get("model_id"),
        locale=locale,
    )

    # 현재 진행 중인 도구 사용을 추적 (중복 이벤트 방지)
    active_tool_use_id = None

    try:
        async for event in agent.stream_async(prompt):
            # 텍스트 청크 이벤트: 모델이 생성하는 텍스트 조각
            if "data" in event:
                yield json.dumps(
                    {"type": "chunk", "content": event["data"]},
                    ensure_ascii=False,
                )

            # 도구 사용 이벤트: 에이전트가 도구를 호출할 때
            if "current_tool_use" in event:
                tool_use = event["current_tool_use"]
                tool_name = tool_use.get("name")
                tool_use_id = tool_use.get("toolUseId")

                # 새로운 도구 사용이 시작된 경우에만 이벤트 발행 (중복 방지)
                if tool_name and tool_use_id and tool_use_id != active_tool_use_id:
                    active_tool_use_id = tool_use_id
                    yield json.dumps({
                        "type": "tool",
                        "toolName": tool_name,
                        "toolUseId": tool_use_id,
                        "status": "running",
                        "input": tool_use.get("input", {}),
                    }, ensure_ascii=False)

            # 최종 결과 이벤트: 에이전트 실행 완료
            if "result" in event:
                result = event["result"]
                # 이전 도구 사용이 있었다면 완료 이벤트 발행
                if active_tool_use_id:
                    yield json.dumps({
                        "type": "tool",
                        "toolName": "",
                        "toolUseId": active_tool_use_id,
                        "status": "complete",
                    }, ensure_ascii=False)
                    active_tool_use_id = None

                yield json.dumps({
                    "type": "result",
                    "message": result.message if hasattr(result, "message") else str(result),
                }, ensure_ascii=False)

    except Exception as e:
        logging.error(f"Planning Agent 스트리밍 중 에러 발생: {e}")
        yield json.dumps(
            {"type": "error", "message": str(e)},
            ensure_ascii=False,
        )


if __name__ == "__main__":
    app.run()
