"""
PreChat Planning Agent

미팅 종료 후 비동기적으로 호출되어 고객 상담 내용을 기반으로
Bedrock Knowledge Base에서 유사 고객사례를 검색하여 제공합니다.
Session의 Meeting Plan에서 사용할 customerReferences를 보강합니다.

Structured Output:
  - Pydantic 모델(PlanningOutput)로 응답 스키마를 정의
  - Strands SDK의 structured_output_model + tools=[retrieve] 조합
  - 백엔드 MeetingPlan 도메인 모델과 1:1 매핑

배포: Bedrock AgentCore Runtime
호출: 미팅 종료 시 비동기 호출
"""

import os
import json
import logging
from pydantic import BaseModel, Field
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters
from strands_tools import retrieve, http_request
from strands.types.exceptions import StructuredOutputException
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
# Pydantic 모델: 백엔드 MeetingPlan 도메인 모델과 매핑
# ──────────────────────────────────────────────

class CustomerReference(BaseModel):
    """유사 고객 사례 레퍼런스"""
    summary: str = Field(description="Customer case summary")
    source: str = Field(description="Source of the reference (e.g. KB document title, URL)")
    relevance: str = Field(description="Why this case is relevant to the customer")


class PlanningOutput(BaseModel):
    """PreChat 플래닝 에이전트의 구조화된 출력 모델.

    백엔드 MeetingPlan 도메인 모델과 매핑됩니다.
    """
    agenda: list[str] = Field(
        description="Meeting agenda items in order"
    )
    topics: list[str] = Field(
        description="Key discussion topics extracted from the consultation"
    )
    recommended_services: list[str] = Field(
        description="Recommended AWS service names relevant to the customer's needs"
    )
    customer_references: list[CustomerReference] = Field(
        default_factory=list,
        description="Similar customer cases retrieved from Knowledge Base. Use the retrieve tool to search."
    )
    ai_suggestions: list[str] = Field(
        description="AI-generated suggestions for meeting preparation"
    )
    next_steps: list[str] = Field(
        description="Actionable next step items after the meeting"
    )
    preparation_notes: str = Field(
        description="Additional preparation notes for the meeting team"
    )


# ──────────────────────────────────────────────
# 에이전트 설정
# ──────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = f"""You are an AWS PreChat Planning AI assistant.
Analyze customer consultation content to generate a structured meeting plan and search for similar customer cases.

## Role
1. Analyze the consultation summary to extract key topics
2. Use the `retrieve` tool to search Bedrock Knowledge Base for similar customer cases. Call `retrieve(text="search keywords")` with Knowledge Base ID: {_kb_id}
3. Generate a structured meeting plan

## Rules
- You MUST use the `retrieve` tool to search for similar cases before generating the plan
- Provide specific, actionable agenda items and next steps
- Recommend AWS services that are directly relevant to the customer's stated needs
- If no relevant customer cases are found via retrieve, return an empty customer_references list
"""

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatPlanningAgent"


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


def create_planning_agent(
    system_prompt: str | None = None,
    model_id: str | None = None,
    agent_name: str | None = None,
    locale: str = 'ko',
) -> Agent:
    """Planning Agent를 생성합니다."""
    effective_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
    locale_instruction = _get_locale_instruction(locale)
    effective_prompt = f"{effective_prompt}\n\n{locale_instruction}"

    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=effective_prompt,
        name=agent_name or DEFAULT_AGENT_NAME,
        tools=[retrieve, aws_docs_mcp_client],
    )


@app.entrypoint
def invoke(payload: dict) -> dict:
    """AgentCore Runtime 호출 엔트리포인트

    Strands Structured Output + retrieve 도구를 조합하여
    PlanningOutput Pydantic 모델로 타입 안전한 응답을 반환합니다.

    payload 구조:
      {
        "session_summary": "세션 요약 텍스트",
        "config": {
          "system_prompt": "...",
          "model_id": "...",
          "agent_name": "...",
          "locale": "ko"
        }
      }
    """
    session_summary = payload.get("session_summary", "")
    if not session_summary:
        return {"error": "No session_summary provided"}

    config = payload.get("config", {})
    locale = config.get("locale", "ko")

    agent = create_planning_agent(
        system_prompt=config.get("system_prompt"),
        model_id=config.get("model_id"),
        agent_name=config.get("agent_name"),
        locale=locale,
    )

    prompt = (
        "Generate a meeting plan based on the following pre-consultation summary:\n\n"
        f"{session_summary}"
    )

    try:
        result = agent(prompt, structured_output_model=PlanningOutput)
        output: PlanningOutput = result.structured_output
        return {"result": output.model_dump()}

    except StructuredOutputException as e:
        logging.error(f"Structured output validation failed: {e}")
        fallback_result = agent(prompt)
        return {
            "result": {
                "agenda": [],
                "topics": [],
                "recommended_services": [],
                "customer_references": [],
                "ai_suggestions": [],
                "next_steps": [],
                "preparation_notes": str(fallback_result.message),
            }
        }


# ──────────────────────────────────────────────
# 스트리밍 채팅용 에이전트 및 엔트리포인트
# ──────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = f"""You are an AWS PreChat Planning AI assistant for Sales Reps.
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
- Provide specific, actionable recommendations
- Be concise and focused on sales motion support
"""

CHAT_AGENT_NAME = "prechatPlanningChatAgent"


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
    prompt = CHAT_SYSTEM_PROMPT

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

    기존 create_planning_agent()는 구조화된 출력(PlanningOutput)용으로 유지하고,
    이 함수는 Sales Rep과의 실시간 대화용 에이전트를 생성합니다.
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
        name=CHAT_AGENT_NAME,
        tools=[retrieve, http_request, aws_docs_mcp_client],
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
