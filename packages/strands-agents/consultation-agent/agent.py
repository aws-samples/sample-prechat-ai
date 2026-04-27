"""
PreChat Consultation Agent

미팅 전 고객의 사전 요구사항을 청취하는 상담 에이전트입니다.
Session 도메인의 대화 이력의 주축이 됩니다.

구성 주입 방식:
  - 환경변수 기반 고정 구성 (X) → 폐기
  - payload 기반 동적 구성 (O) → 호출 시마다 AgentConfiguration 주입
  - 백엔드 Lambda가 DynamoDB에서 AgentConfiguration을 조회하여 payload.config에 포함

부가 능력:
  - STM (AgentCore Memory; 기간 30일) - 세션 대화 보전
  - Bedrock KB retrieve - 유사 고객사례 문의 대응 (strands_tools.retrieve)
  - Div Return - 프론트엔드에서 동적 렌더링되는 HTML Form 응답

배포: Bedrock AgentCore Runtime (bedrock-agentcore SDK)
호출: bedrock-agentcore 클라이언트의 invoke_agent_runtime
"""

import os
import json
import logging
from strands import Agent
from strands_tools import retrieve, current_time
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from config_parser import parse_config
from tool_registry import render_form, aws_docs_mcp_client

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)

# AgentCore Memory ID: deploy 시 env_vars로 컨테이너에 주입됨
MEMORY_ID = os.environ.get('BEDROCK_AGENTCORE_MEMORY_ID', '')


# 기본 시스템 프롬프트 (PreChat User가 오버라이드 가능)
def _default_system_prompt() -> str:
    return """당신은 AWS PreChat 사전 상담 AI 어시스턴트입니다.
## 역할

AWS 미팅 전 고객정보 수집 대화형 AI

## 금지사항

- AWS 솔루션/서비스 추천 금지
- 기술 해결책 제시 금지
- 담당자의 행동을 확정적으로 약속 금지 (예: "반드시 ~해드립니다", "~일 내 확정됩니다")
  - [O] "담당자가 미팅을 준비하여 안내드릴 예정입니다"
  - [O] "유사 사례, 레퍼런스 아키텍처, 벤치마크 데이터 등을 준비해드릴 수 있습니다"
  - [X] "1-2일내 미팅 확정메일 발송예정입니다"
  - [X] "벤치마크 데이터를 제공해드리겠습니다"

## 대화흐름 (8회 제한)

**1단계:** "회사명과 주요 사업분야를 알려주세요"

**2단계:** "현재 AWS 사용중인가요, 도입검토중인가요?"

**3단계:** "미팅에서 가장 논의하고 싶은 기술적 문의사항은?"
*예: 마이그레이션 전략, 아키텍처 설계, 보안/컴플라이언스*

**4단계:** "미팅 참석자 정보(이름/직책/연락처)를 알려주세요"

**5단계:** "희망 미팅 일정이 있나요?"

**6-7단계:** 개발팀 구성, 인프라 현황 등 추가정보

**8단계:** "정리해드리겠습니다:

- 회사: [입력내용]
- AWS현황: [입력내용]
- 문의사항: [입력내용]
- 참석자: [입력내용]
- 희망일정: [입력내용]

수정할 내용 있나요?"

## 특수상황 대응

**유사 고객사례 문의:** 고객이 "다른 회사는 어떻게 했나요?", "비슷한 사례가 있나요?" 등 유사사례를 물으면 `retrieve` 도구를 사용하여 지식베이스에서 관련 사례를 검색하세요. 검색 결과를 자연스럽게 요약하여 고객에게 전달하되, 구체적인 고객사명은 익명 처리하세요.

**일정확정 문의:** "사전상담 완료 후 담당자가 금번 대화에서 제공해주신 데이터를 기반으로 미팅을 준비하여 이메일로 안내드릴 예정입니다"

**일정변경 요청:** "담당자에게 전달하여 연락드리도록 하겠습니다"

**form 렌더링시:** **중요: render_form 도구를 호출한 후, 도구가 반환한 HTML을 반드시 섀도잉하여 상대방에게 그대로 전달해주세요. 예: "아래 폼에 정보를 입력해주세요!\n\n<div class=..."**

**대화 8회 초과, 담당자 정보 요청시:**
"담당자 정보:
- {{sales_rep.name}}
- {{sales_rep.phone}}
- {{sales_rep.email}}

금번 대화에서 제공해주신 내용을 기반으로 담당자가 미팅을 준비하여 안내드릴 예정입니다.
필요시 유사 사례나 레퍼런스 아키텍처 등도 함께 준비해드릴 수 있습니다."

**대화 종료시**
EOF 토큰 반드시 출력하기

## 페르소나 및 톤

- 당신은 ISTJ 성향의 체계적이고 신뢰감 있는 상담 전문가입니다.
- 명료하고 간결한 문장을 사용하세요. 불필요한 수식어나 감탄사를 자제하세요.
- 이모지(emoji), 이모티콘, 특수 장식 문자를 절대 사용하지 마세요.
- 과도한 감정 표현("정말 대단하시네요!", "와~ 좋습니다!") 대신 사실 기반의 담백한 응대를 하세요.
- 공감은 하되 절제된 표현으로: "말씀 감사합니다", "확인했습니다", "좋은 정보입니다"
- 질문은 목적이 분명해야 합니다. 한 턴에 1~2개, 구체적으로 물어보세요.

## 응답 형식

- 자연스러운 대화체 문장으로 응답하세요. 친구에게 설명하듯 내러티브하게 이어 쓰세요.
- 문단 분리(\n\n)는 화제가 전환될 때만 사용하세요. 같은 맥락의 내용은 하나의 문단으로 이어 쓰세요.
- 한 문단은 2~4문장이 적절합니다. 한 문장짜리 문단을 남발하지 마세요.

## 능동적인 에이전트가 되세요

- 단계별 인터뷰에서 구체적 예시를 제공하세요.
- 단계별 인터뷰의 대화 예시는 예시일 뿐입니다. 능동적이되 절제된 톤으로 인터뷰를 진행하세요.
- 담당자 정보를 요구할 경우 플레이스 홀더로 표시하세요: {{sales_rep.name}} {{sales_rep.phone}} {{sales_rep.email}}
- 대화 종료시 반드시(MUST) "EOF" 토큰을 넣어주셔야 합니다.

**핵심: 8회내 필수정보 수집, 단계별 세분화, 정확한 담당자 정보 제공**
"""

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatConsultationAgent"


def _get_locale_instruction(locale: str) -> str:
    """locale 코드에 따른 언어 지시를 반환합니다."""
    if locale == 'en':
        return (
            "## Language Instruction\n"
            "IMPORTANT: You MUST respond in English. "
            "All your messages, questions, summaries, and form labels must be written in English. "
            "Do not use Korean in your responses."
        )
    # 기본값(ko)이면 추가 지시 불필요 (기본 프롬프트가 한국어)
    return ""


def _build_session_manager(session_id: str):
    """AgentCore Memory STM 세션 매니저를 생성합니다.

    Args:
        session_id: PreChat 세션 ID (STM 메모리 및 actor 식별에 사용)

    Returns:
        AgentCoreMemorySessionManager 또는 None
    """
    if not MEMORY_ID:
        return None
    memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=session_id,
    )
    return AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
    )


def create_consultation_agent(
    session_id: str,
    config: dict | None = None,
) -> Agent:
    """PreChat User의 구성을 주입하여 Consultation Agent를 생성합니다.

    config에 tools가 있으면 Config Parser로 도구를 해석하고,
    없으면 기존 기본 도구 세트로 폴백합니다.

    Args:
        session_id: PreChat 세션 ID (STM 메모리 및 actor 식별에 사용)
        config: AgentConfig payload dict (None이면 기본값 사용)
            - system_prompt (str): 시스템 프롬프트
            - model_id (str): Bedrock 모델 ID
            - agent_name (str): 에이전트 이름
            - locale (str): 언어 코드 ('ko' 또는 'en')
            - tools (str|list): 도구 구성 JSON 문자열 또는 리스트

    Returns:
        구성된 Strands Agent 인스턴스
    """
    session_manager = _build_session_manager(session_id)

    # config에 tools가 있으면 Config Parser로 도구 해석
    if config and config.get('tools'):
        parsed = parse_config(config)
        effective_prompt = (
            parsed['system_prompt']
            or _default_system_prompt()
        )
        locale = parsed.get('locale', 'ko')
        locale_instruction = _get_locale_instruction(locale)
        if locale_instruction:
            effective_prompt = (
                f"{effective_prompt}\n\n{locale_instruction}"
            )
        return Agent(
            model=parsed['model_id'] or DEFAULT_MODEL_ID,
            system_prompt=effective_prompt,
            name=parsed['agent_name'] or DEFAULT_AGENT_NAME,
            tools=parsed['tools'],
            session_manager=session_manager,
        )

    # 폴백: 기존 기본 도구 세트
    effective_prompt = (
        config.get('system_prompt')
        if config
        else None
    ) or _default_system_prompt()
    locale = (
        config.get('locale', 'ko') if config else 'ko'
    )
    locale_instruction = _get_locale_instruction(locale)
    if locale_instruction:
        effective_prompt = (
            f"{effective_prompt}\n\n{locale_instruction}"
        )
    return Agent(
        model=(
            config.get('model_id') if config
            else None
        ) or DEFAULT_MODEL_ID,
        system_prompt=effective_prompt,
        name=(
            config.get('agent_name') if config
            else None
        ) or DEFAULT_AGENT_NAME,
        tools=[
            retrieve, current_time,
            render_form, aws_docs_mcp_client,
        ],
        session_manager=session_manager,
    )

@app.entrypoint
async def stream(payload: dict):
    """스트리밍 엔트리포인트 - AgentCore Runtime이 SSE text/event-stream으로 변환합니다.

    Strands Agent의 stream_async()를 활용하여 이벤트를 비동기 제너레이터로 yield합니다.
    각 yield는 AgentCore Runtime에 의해 SSE data: 라인으로 변환됩니다.

    이벤트 유형:
      - chunk: {"type": "chunk", "content": "텍스트 조각"} - 모델의 텍스트 출력
      - tool:  {"type": "tool", "toolName": "...", "toolUseId": "...", "status": "running", "input": {...}}
               {"type": "tool", "toolName": "...", "toolUseId": "...", "status": "complete"}
      - result: {"type": "result", "message": "전체 응답 텍스트"} - 최종 결과
      - error: {"type": "error", "message": "에러 메시지"} - 에러 발생 시

    payload 구조:
      {
        "prompt": "고객 메시지",
        "session_id": "PreChat 세션 ID",
        "config": {
          "system_prompt": "...", "model_id": "...",
          "agent_name": "...", "locale": "ko",
          "tools": "[{\"tool_name\": \"retrieve\", ...}]"
        }
      }
    """
    prompt = payload.get("prompt", "")
    if not prompt:
        yield json.dumps({"type": "error", "message": "No prompt provided"}, ensure_ascii=False)
        return

    session_id = payload.get("session_id", "anonymous")
    config = payload.get("config", {})

    agent = create_consultation_agent(
        session_id=session_id,
        config=config,
    )

    # 현재 진행 중인 도구 사용을 추적 (중복 이벤트 방지)
    active_tool_use_id = None
    # 의미론적 말풍선(semantic bubble) 버퍼: \n\n 경계에서 boundary 이벤트 발행
    text_buffer = ""

    try:
        async for event in agent.stream_async(prompt):
            # 텍스트 청크 이벤트: 모델이 생성하는 텍스트 조각
            if "data" in event:
                text_buffer += event["data"]

                # 문단 경계(\n\n) 감지 시 버퍼를 flush하고 boundary 이벤트 발행
                while "\n\n" in text_buffer:
                    paragraph, text_buffer = text_buffer.split("\n\n", 1)
                    if paragraph.strip():
                        yield json.dumps({"type": "chunk", "content": paragraph}, ensure_ascii=False)
                        yield json.dumps({"type": "boundary"}, ensure_ascii=False)

            # 도구 사용 이벤트: 에이전트가 도구를 호출할 때
            if "current_tool_use" in event:
                # 도구 호출 전 버퍼 잔여분 flush
                if text_buffer.strip():
                    yield json.dumps({"type": "chunk", "content": text_buffer}, ensure_ascii=False)
                    text_buffer = ""

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
                # 버퍼 잔여분 flush
                if text_buffer.strip():
                    yield json.dumps({"type": "chunk", "content": text_buffer}, ensure_ascii=False)
                    text_buffer = ""

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
        logging.error(f"스트리밍 중 에러 발생: {e}")
        yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)



if __name__ == "__main__":
    app.run()
