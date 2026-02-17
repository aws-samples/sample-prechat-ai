"""
PreChat Planning Agent

미팅 종료 후 비동기적으로 호출되어 고객 상담 내용을 기반으로
Bedrock Knowledge Base에서 유사 고객사례를 검색하여 제공합니다.
Session의 Meeting Plan에서 사용할 customerReferences를 보강합니다.

부가 능력:
  - Bedrock KB retrieve - 유사 고객사례 검색

배포: Bedrock AgentCore Runtime
호출: 미팅 종료 시 비동기 호출
"""

import os
import json
import boto3
from strands import Agent
from strands.tools import tool
from strands.telemetry import StrandsTelemetry

# OTLP 트레이스 설정
os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
strands_telemetry = StrandsTelemetry()
strands_telemetry.setup_otlp_exporter()

kb_client = boto3.client('bedrock-agent-runtime', region_name=os.environ.get('AWS_REGION', 'ap-northeast-2'))
KB_ID = os.environ.get('BEDROCK_KB_ID', '')
if KB_ID == 'NONE':
    KB_ID = ''


@tool
def retrieve_customer_references(query: str, max_results: int = 5) -> str:
    """Bedrock Knowledge Base에서 유사 고객사례를 검색합니다.

    Args:
        query: 검색 쿼리 (고객 산업, 사용 사례, 기술 요구사항 등)
        max_results: 최대 검색 결과 수 (기본값: 5)

    Returns:
        검색된 고객사례 JSON 문자열
    """
    if not KB_ID:
        return json.dumps({"error": "Knowledge Base가 설정되지 않았습니다.", "references": []})

    try:
        resp = kb_client.retrieve(
            knowledgeBaseId=KB_ID,
            retrievalQuery={'text': query},
            retrievalConfiguration={
                'vectorSearchConfiguration': {'numberOfResults': max_results}
            }
        )

        references = []
        for item in resp.get('retrievalResults', []):
            content = item.get('content', {}).get('text', '')
            location = item.get('location', {})
            score = item.get('score', 0)

            source = ''
            if location.get('type') == 'S3':
                source = location.get('s3Location', {}).get('uri', '')

            references.append({
                'content': content[:800],
                'source': source,
                'score': float(score) if score else 0,
            })

        return json.dumps({"references": references}, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": str(e), "references": []})


DEFAULT_SYSTEM_PROMPT = """당신은 AWS PreChat 플래닝 AI 어시스턴트입니다.
고객 상담 내용을 분석하여 미팅 플랜을 생성하고, 유사 고객사례를 검색하여 제공합니다.

## 역할
1. 상담 요약을 분석하여 핵심 토픽을 추출합니다
2. retrieve_customer_references 도구로 유사 고객사례를 검색합니다
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
- 반드시 retrieve_customer_references 도구를 사용하여 유사사례를 검색하세요
- 한국어로 작성
- 실행 가능한 구체적인 액션 아이템을 제시하세요
"""


def create_planning_agent(
    system_prompt: str = "",
    model_id: str = "",
    agent_name: str = "",
) -> Agent:
    """PreChat User의 구성을 주입하여 Planning Agent를 생성합니다.

    Args:
        system_prompt: 사용자 정의 시스템 프롬프트
        model_id: 사용자 정의 모델 ID
        agent_name: 사용자 정의 에이전트 이름

    Returns:
        구성된 Strands Agent 인스턴스
    """
    return Agent(
        model=model_id or "us.anthropic.claude-sonnet-4-20250514-v1:0",
        system_prompt=system_prompt or DEFAULT_SYSTEM_PROMPT,
        name=agent_name or "prechat-planning-agent",
        tools=[retrieve_customer_references],
    )


# AgentCore Runtime 엔트리포인트
if __name__ == "__main__":
    from bedrock_agentcore.runtime import BedrockAgentCoreApp

    app = BedrockAgentCoreApp()

    agent = create_planning_agent(
        system_prompt=os.environ.get('AGENT_SYSTEM_PROMPT', ''),
        model_id=os.environ.get('AGENT_MODEL_ID', ''),
        agent_name=os.environ.get('AGENT_NAME', ''),
    )

    @app.entrypoint
    def invoke(payload: dict) -> dict:
        """AgentCore Runtime 호출 엔트리포인트"""
        session_summary = payload.get("session_summary", "")
        if not session_summary:
            return {"error": "No session_summary provided"}

        prompt = f"다음 사전 상담 요약을 기반으로 미팅 플랜을 생성해주세요:\n\n{session_summary}"
        result = agent(prompt)
        return {"result": result.message}
