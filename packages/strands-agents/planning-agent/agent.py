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
import logging
from pydantic import BaseModel, Field
from strands import Agent
from strands_tools import retrieve
from strands.types.exceptions import StructuredOutputException
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)

# Bedrock KB ID: deploy 시 env_vars로 컨테이너에 주입됨
_kb_id = os.environ.get('BEDROCK_KB_ID', '')
if _kb_id and _kb_id != 'NONE':
    os.environ['STRANDS_KNOWLEDGE_BASE_ID'] = _kb_id


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

DEFAULT_SYSTEM_PROMPT = """You are an AWS PreChat Planning AI assistant.
Analyze customer consultation content to generate a structured meeting plan and search for similar customer cases.

## Role
1. Analyze the consultation summary to extract key topics
2. Use the `retrieve` tool to search Bedrock Knowledge Base for similar customer cases. Call `retrieve(text="search keywords")`.
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
        tools=[retrieve],
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


if __name__ == "__main__":
    app.run()
