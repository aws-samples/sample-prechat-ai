"""
PreChat Planning Agent

미팅 종료 후 비동기적으로 호출되어 고객 상담 내용을 기반으로
Bedrock Knowledge Base에서 유사 고객사례를 검색하여 제공합니다.
Session의 Meeting Plan에서 사용할 customerReferences를 보강합니다.

구성 주입 방식:
  - 환경변수 기반 고정 구성 (X) → 폐기
  - payload 기반 동적 구성 (O) → 호출 시마다 AgentConfiguration 주입
  - 백엔드 Lambda가 DynamoDB에서 AgentConfiguration을 조회하여 payload.config에 포함

부가 능력:
  - Bedrock KB retrieve - 유사 고객사례 검색

배포: Bedrock AgentCore Runtime
호출: 미팅 종료 시 비동기 호출
"""

import os
import logging
from strands import Agent
from strands_tools import retrieve
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)


# Bedrock KB ID: deploy 시 env_vars로 컨테이너에 주입됨
_kb_id = os.environ.get('BEDROCK_KB_ID', '')
if _kb_id and _kb_id != 'NONE':
    os.environ['STRANDS_KNOWLEDGE_BASE_ID'] = _kb_id


DEFAULT_SYSTEM_PROMPT = """당신은 AWS PreChat 플래닝 AI 어시스턴트입니다.
고객 상담 내용을 분석하여 미팅 플랜을 생성하고, 유사 고객사례를 검색하여 제공합니다.

## 역할
1. 상담 요약을 분석하여 핵심 토픽을 추출합니다
2. `retrieve` 도구로 Bedrock Knowledge Base에서 유사 고객사례를 검색합니다
3. 구조화된 미팅 플랜을 JSON 형식으로 생성합니다

## 출력 형식 (JSON)

{
  "agenda": ["미팅 안건 항목들"],
  "topics": ["주요 논의 토픽들"],
  "recommended_services": ["추천 AWS 서비스들"],
  "customer_references": [
    {
      "summary": "고객사례 요약",
      "source": "출처",
      "relevance": "관련성 설명"
    }
  ],
  "ai_suggestions": ["AI 추천 사항들"],
  "next_steps": ["다음 단계 액션 아이템들"],
  "preparation_notes": "미팅 준비 메모"
}

## 규칙
- 반드시 `retrieve` 도구를 사용하여 유사사례를 검색하세요. `retrieve(text="검색 키워드")` 형태로 호출합니다.
- 한국어로 작성
- 실행 가능한 구체적인 액션 아이템을 제시하세요
"""

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatPlanningAgent"


def create_planning_agent(
    system_prompt: str | None = None,
    model_id: str | None = None,
    agent_name: str | None = None,
) -> Agent:
    """PreChat User의 구성을 주입하여 Planning Agent를 생성합니다.

    Args:
        system_prompt: 사용자 정의 시스템 프롬프트 (None이면 DEFAULT 사용)
        model_id: 사용자 정의 모델 ID (None이면 DEFAULT 사용)
        agent_name: 사용자 정의 에이전트 이름 (None이면 DEFAULT 사용)

    Returns:
        구성된 Strands Agent 인스턴스
    """
    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=system_prompt or DEFAULT_SYSTEM_PROMPT,
        name=agent_name or DEFAULT_AGENT_NAME,
        tools=[retrieve],
    )


# AgentCore Runtime 엔트리포인트
@app.entrypoint
def invoke(payload: dict) -> dict:
    """AgentCore Runtime 호출 엔트리포인트

    payload 구조:
      {
        "session_summary": "세션 요약 텍스트",
        "config": {                          # 백엔드 Lambda가 DynamoDB에서 조회하여 주입
          "system_prompt": "...",
          "model_id": "...",
          "agent_name": "..."
        }
      }

    config가 없으면 기본값으로 폴백합니다.
    """
    session_summary = payload.get("session_summary", "")
    if not session_summary:
        return {"error": "No session_summary provided"}

    # payload.config에서 동적 구성 추출 (키가 없으면 None → DEFAULT 폴백)
    config = payload.get("config", {})
    agent = create_planning_agent(
        system_prompt=config.get("system_prompt"),
        model_id=config.get("model_id"),
        agent_name=config.get("agent_name"),
    )

    prompt = f"다음 사전 상담 요약을 기반으로 미팅 플랜을 생성해주세요:\n\n{session_summary}"
    result = agent(prompt)
    return {"result": result.message}
