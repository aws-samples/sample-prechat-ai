"""
SHIP Agent - SHIP Assessment 전용 Strands SDK 기반 AI 에이전트

고객과 대화하며 A2T 로그 작성에 필요한 현황 정보를 수집하고,
SHIP Assessment 프로세스를 안내합니다.

배포: Bedrock AgentCore Runtime
호출: bedrock-agentcore 클라이언트의 invoke_agent_runtime
"""

import os
import json
import logging
from strands import Agent
from strands.tools import tool
from strands_tools import current_time
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = 'prechatShipAgent'

# AgentCore Memory ID: deploy 시 env_vars로 컨테이너에 주입됨
MEMORY_ID = os.environ.get('BEDROCK_AGENTCORE_MEMORY_ID', '')


@tool
def render_form(form_title: str, fields: str) -> str:
    """고객이 정보를 기입할 수 있는 HTML Form을 생성합니다 (Div Return).

    프론트엔드에서 동적으로 렌더링되는 HTML을 반환합니다.
    고객이 Form에 정보를 기입하면 messages로 취급 & 저장됩니다.

    Args:
        form_title: 폼 제목
        fields: JSON 형식의 필드 정의 (예: '[{"name":"company","label":"회사명","type":"text"}]')

    Returns:
        렌더링 가능한 HTML Form 문자열
    """
    try:
        field_list = json.loads(fields)
    except json.JSONDecodeError:
        return '<div><p>폼 필드 정의가 올바르지 않습니다.</p></div>'

    form_html = '<div class="prechat-form" data-form-type="div-return">'
    form_html += f'<h3>{form_title}</h3>'
    form_html += '<form>'

    for field in field_list:
        name = field.get('name', '')
        label = field.get('label', name)
        field_type = field.get('type', 'text')
        required = field.get('required', False)
        options = field.get('options', [])

        form_html += '<div class="form-field">'
        form_html += f'<label for="{name}">{label}</label>'

        if field_type == 'textarea':
            form_html += f'<textarea name="{name}" id="{name}" {"required" if required else ""}></textarea>'
        elif field_type == 'select':
            form_html += f'<select name="{name}" id="{name}" {"required" if required else ""}>'
            for opt in options:
                form_html += f'<option value="{opt}">{opt}</option>'
            form_html += '</select>'
        else:
            form_html += f'<input type="{field_type}" name="{name}" id="{name}" {"required" if required else ""} />'

        form_html += '</div>'

    form_html += '<button type="submit" data-i18n="submit">Submit</button>'
    form_html += '</form></div>'

    return form_html




def _default_system_prompt() -> str:
    """SHIP Agent 기본 시스템 프롬프트 — SA SHIP 폼 항목 준수"""
    return """당신은 AWS SHIP(Security Health Improvement Program) 보안 점검 전문 상담 에이전트입니다.

## 역할
- 고객의 AWS 계정 보안 현황을 파악하고 SHIP Assessment 프로세스를 안내합니다.
- SA가 SHIP A2T 폼에 입력할 정보를 대화를 통해 수집합니다.
- 고객이 셀프서비스로 보안 점검을 수행할 수 있도록 친절하게 가이드합니다.

## SHIP Assessment 프로세스 안내
1. **법적 규약 동의**: 보안 점검 범위, 데이터 처리 방침, 면책 조항을 확인하고 동의합니다.
2. **AssumeRole 정보 입력**: Prowler가 보안 점검을 수행할 수 있도록 IAM Role ARN을 입력합니다.
3. **보안 스캔 실행**: Prowler가 13개 핵심 보안 항목을 자동으로 점검합니다 (약 5분 소요).
4. **레포트 다운로드**: 점검 결과 레포트를 다운로드합니다.

## A2T 로그 수집 목표

대화를 통해 아래 항목들을 자연스럽게 파악하세요. SA가 SHIP 폼에 바로 입력할 수 있도록 정리합니다.

### 상단 필드
- **Description**: 고객이 SATv2 Assessment를 수행하려는 배경 (영어 내러티브, 280자 이내, 최대 3줄)
- **Customer Contact**: 고객 담당자 이름, 회사명, 이메일, 직함
- **Workshop Date**: 대화가 수행된 날짜

### SHIP 폼 질문 (Q1~Q14) — 대화에서 자연스럽게 파악

- **Q1**: 과거 참여한 AWS 보안 점검/프레임워크는? (WAFR, ESSR, SIP 등)
- **Q2**: 위협 탐지에 3rd party 솔루션을 사용하나요? (GuardDuty 대신)
- **Q3**: 리스크 상관분석/통합 보안 분석에 3rd party를 사용하나요? (Security Hub 대신)
- **Q4**: 취약점 관리에 3rd party를 사용하나요? (Inspector 대신)
- **Q5**: 암호화 키 관리에 3rd party를 사용하나요? (KMS 대신)
- **Q6**: 자격증명 보호에 3rd party를 사용하나요? (Secrets Manager 대신)
- **Q7**: 네트워크 보호에 3rd party를 사용하나요? (Network Firewall 대신)
- **Q8**: 애플리케이션 방화벽에 3rd party를 사용하나요? (WAF 대신)
- **Q9**: 권한 분석에 3rd party를 사용하나요? (IAM Access Analyzer 대신)
- **Q10**: 구성 모니터링에 3rd party를 사용하나요? (Config 대신)
- **Q11**: 데이터 기반 보안 대화를 시작하기 위해 어떤 Assessment를 사용했나요?
- **Q12**: 고객이 집중하는 보안 유스케이스는 무엇인가요?
- **Q13**: 파트너 또는 AWS 네이티브 서비스 도입 계획이 있나요?
- **Q14**: AWS 보안 서비스에 대한 피드백이 있나요? (긍정적 피드백, 기능 요청, 불편사항)

## 대화 전략 (한꺼번에 묻지 말고 자연스러운 흐름으로)

### 1단계: 인사 및 목적 확인
- 고객 이름, 회사명, 직함, 이메일을 파악합니다.
- 보안 점검을 진행하게 된 배경/동기를 파악합니다. (→ Description 필드)
- "안녕하세요! AWS 보안 점검에 관심을 가져주셔서 감사합니다. 어떤 계기로 보안 점검을 진행하시게 되었나요?"

### 2단계: 보안 경험 탐색
- 과거 AWS 보안 점검 참여 이력을 파악합니다. (→ Q1)
- "혹시 이전에 AWS Well-Architected Review나 SIP 같은 보안 점검을 받아보신 적이 있으신가요?"

### 3단계: 현재 보안 솔루션 현황 파악
- 9개 보안 영역별로 AWS Native / 3rd Party / 미사용 여부를 파악합니다. (→ Q2~Q10)
- 한 번에 9개를 다 묻지 마세요. 2~3개씩 자연스럽게 나눠서 물어보세요.
- "현재 위협 탐지는 어떻게 하고 계신가요? GuardDuty를 사용하시나요, 아니면 다른 솔루션을 쓰시나요?"

### 4단계: 스캔 결과 리뷰 및 보안 포커스
- 스캔 결과를 확인했는지, 어떤 보안 유스케이스에 집중하는지 파악합니다. (→ Q11, Q12)
- "보안 점검 결과를 보시고 가장 우선적으로 개선하고 싶은 영역이 있으신가요?"

### 5단계: 향후 계획 및 피드백
- 서비스 도입 계획과 AWS 보안 서비스 피드백을 수집합니다. (→ Q13, Q14)
- "앞으로 AWS 보안 서비스나 파트너 솔루션 도입을 계획하고 계신 부분이 있나요?"

### 6단계: 마무리
- 수집된 정보를 요약하고 후속 기술 지원 연락 희망 여부를 확인합니다.

## 법적 규약 고지 내용
- 본 보안 점검은 AWS 계정의 기본 보안 설정을 자동으로 검사합니다.
- 점검 과정에서 수집되는 데이터는 레포트 생성 목적으로만 사용됩니다.
- AssumeRole 세션 정보는 점검 완료 후 즉시 삭제됩니다.
- 본 점검은 완전한 보안 감사를 대체하지 않습니다.

## 페르소나 및 톤

- 당신은 ISTJ 성향의 체계적이고 신뢰감 있는 보안 점검 전문가입니다.
- 명료하고 간결한 문장을 사용하세요. 불필요한 수식어나 감탄사를 자제하세요.
- 이모지(emoji), 이모티콘, 특수 장식 문자를 절대 사용하지 마세요.
- 과도한 감정 표현("정말 대단하시네요!", "와~ 좋습니다!") 대신 사실 기반의 담백한 응대를 하세요.
- 공감은 하되 절제된 표현으로: "말씀 감사합니다", "확인했습니다", "좋은 정보입니다"

## 응답 지침
- 전문적이고 절제된 톤으로 응답하세요.
- 한 번에 너무 많은 질문을 하지 마세요. 한 턴에 1~2개 질문이 적절합니다.
- 고객의 답변을 확인하고, 관련 AWS 보안 서비스를 자연스럽게 소개하세요.
- 보안 관련 질문에는 SHIP Assessment 범위 내에서 답변하세요.
- 스캔 진행 중에는 고객에게 진행 상태를 안내하고, 대화를 계속 이어가세요.
- Description 필드는 반드시 영어로, 280자 이내, 최대 3줄 내러티브로 작성하세요.
- 담당자 정보를 요구할 경우 플레이스홀더로 표시하세요: {{{{sales_rep.name}}}} {{{{sales_rep.phone}}}} {{{{sales_rep.email}}}}

## 응답 형식

- 자연스러운 대화체 문장으로 응답하세요. 친구에게 설명하듯 내러티브하게 이어 쓰세요.
- 문단 분리(\n\n)는 화제가 전환될 때만 사용하세요. 같은 맥락의 내용은 하나의 문단으로 이어 쓰세요.
- 한 문단은 2~4문장이 적절합니다. 한 문장짜리 문단을 남발하지 마세요.

## EOF 프로토콜
- 대화 종료 시 반드시(MUST) "EOF" 토큰을 응답 끝에 넣어주셔야 합니다.
- 고객이 더 이상 질문이 없다고 하면 대화를 마무리하고 EOF를 출력하세요.

## Div Return 프로토콜 (render_form)
- 고객에게 구조화된 정보를 수집해야 할 때 `render_form` 도구를 사용하여 HTML Form을 생성하세요.
- **중요: render_form 도구를 호출한 후, 도구가 반환한 HTML을 반드시 그대로 전달해주세요.**
- 예: "아래 폼에 정보를 입력해주세요!\n\n<div class=..."
- 보안 솔루션 현황(Q2~Q10)을 한꺼번에 수집할 때 Form이 유용합니다.

## 사용 가능한 도구
1. `current_time`: 현재 시간을 조회합니다.
2. `render_form`: 고객이 구조화된 정보를 입력해야 할 때 HTML Form을 생성합니다.
"""


def _get_locale_instruction(locale: str) -> str:
    """locale에 따른 언어 지시를 반환합니다."""
    if locale == 'en':
        return "Please respond in English."
    return "한국어로 응답해주세요."


def create_ship_agent(
    session_id: str,
    system_prompt: str | None = None,
    model_id: str | None = None,
    locale: str = 'ko',
) -> Agent:
    """SHIP Agent를 생성합니다.

    Args:
        session_id: PreChat 세션 ID
        system_prompt: 사용자 정의 시스템 프롬프트
        model_id: 사용자 정의 모델 ID
        locale: 응답 언어 코드

    Returns:
        구성된 Strands Agent 인스턴스
    """
    # AgentCore Memory STM 설정 (고객은 익명이므로 actor_id = session_id)
    session_manager = None
    if MEMORY_ID:
        memory_config = AgentCoreMemoryConfig(
            memory_id=MEMORY_ID,
            session_id=session_id,
            actor_id=session_id,
        )
        session_manager = AgentCoreMemorySessionManager(
            agentcore_memory_config=memory_config,
        )

    effective_prompt = system_prompt or _default_system_prompt()
    locale_instruction = _get_locale_instruction(locale)
    if locale_instruction:
        effective_prompt = f"{effective_prompt}\n\n{locale_instruction}"

    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=effective_prompt,
        name=DEFAULT_AGENT_NAME,
        tools=[current_time, render_form],
        session_manager=session_manager,
    )


@app.entrypoint
async def stream(payload: dict):
    """스트리밍 엔트리포인트"""
    prompt = payload.get("prompt", "")
    if not prompt:
        yield json.dumps({"type": "error", "message": "No prompt provided"}, ensure_ascii=False)
        return

    session_id = payload.get("session_id", "unknown")
    config = payload.get("config", {})
    locale = payload.get("locale", "ko")

    agent = create_ship_agent(
        session_id=session_id,
        system_prompt=config.get("system_prompt"),
        model_id=config.get("model_id"),
        locale=locale,
    )

    active_tool_use_id = None
    # 의미론적 말풍선(semantic bubble) 버퍼: \n\n 경계에서 boundary 이벤트 발행
    text_buffer = ""

    try:
        async for event in agent.stream_async(prompt):
            # 텍스트 청크 이벤트
            if "data" in event:
                text_buffer += event["data"]

                # 문단 경계(\n\n) 감지 시 버퍼를 flush하고 boundary 이벤트 발행
                while "\n\n" in text_buffer:
                    paragraph, text_buffer = text_buffer.split("\n\n", 1)
                    if paragraph.strip():
                        yield json.dumps({"type": "chunk", "content": paragraph}, ensure_ascii=False)
                        yield json.dumps({"type": "boundary"}, ensure_ascii=False)

            # 도구 사용 이벤트
            if "current_tool_use" in event:
                # 도구 호출 전 버퍼 잔여분 flush
                if text_buffer.strip():
                    yield json.dumps({"type": "chunk", "content": text_buffer}, ensure_ascii=False)
                    text_buffer = ""

                tool_use = event["current_tool_use"]
                tool_name = tool_use.get("name")
                tool_use_id = tool_use.get("toolUseId")

                if tool_name and tool_use_id and tool_use_id != active_tool_use_id:
                    active_tool_use_id = tool_use_id
                    yield json.dumps({
                        "type": "tool",
                        "toolName": tool_name,
                        "toolUseId": tool_use_id,
                        "status": "running",
                        "input": tool_use.get("input", {}),
                    }, ensure_ascii=False)

            # 최종 결과 이벤트
            if "result" in event:
                # 버퍼 잔여분 flush
                if text_buffer.strip():
                    yield json.dumps({"type": "chunk", "content": text_buffer}, ensure_ascii=False)
                    text_buffer = ""

                result = event["result"]
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
        logging.error(f"SHIP Agent error: {e}")
        yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)

if __name__ == '__main__':
    app.run()
