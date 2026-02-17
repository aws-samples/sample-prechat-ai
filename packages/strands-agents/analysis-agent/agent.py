"""
PreChat Analysis Agent

세션 종료 후 비동기적으로 호출되어 고객 상담 내용을 BANT 프레임워크로 요약합니다.
Session 도메인의 AI Summary를 보강합니다.

부가 능력:
  - BANT 위주 사전상담 내용 요약

배포: Bedrock AgentCore Runtime
호출: 세션 완료 시 DynamoDB Streams → SQS → Lambda에서 invoke_agent_runtime
"""

import os
from strands import Agent
from strands.telemetry import StrandsTelemetry

# OTLP 트레이스 설정
os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
strands_telemetry = StrandsTelemetry()
strands_telemetry.setup_otlp_exporter()


DEFAULT_SYSTEM_PROMPT = """당신은 AWS PreChat 분석 AI 어시스턴트입니다.
고객과의 사전 상담 대화 내용을 분석하여 BANT 프레임워크로 구조화된 요약을 생성합니다.

## 출력 형식 (JSON)

다음 JSON 형식으로 응답하세요:

{
  "budget": {
    "estimated_range": "예상 예산 범위",
    "current_spending": "현재 관련 서비스 지출",
    "notes": "예산 관련 추가 메모"
  },
  "authority": {
    "decision_makers": ["의사결정자 목록"],
    "approval_process": "승인 프로세스 설명",
    "notes": "권한 관련 추가 메모"
  },
  "need": {
    "business_challenges": ["비즈니스 과제 목록"],
    "technical_requirements": ["기술 요구사항 목록"],
    "desired_outcomes": ["원하는 결과 목록"],
    "notes": "필요성 관련 추가 메모"
  },
  "timeline": {
    "expected_timeline": "예상 타임라인",
    "key_milestones": ["주요 마일스톤"],
    "urgency": "긴급도 (high/medium/low)",
    "notes": "타임라인 관련 추가 메모"
  },
  "additional_insights": {
    "industry_context": "산업 맥락",
    "competitive_considerations": "경쟁 고려사항",
    "risk_factors": ["리스크 요인"],
    "recommended_aws_services": ["추천 AWS 서비스"]
  },
  "executive_summary": "전체 요약 (2-3문장)"
}

## 규칙
- 대화에서 명시적으로 언급되지 않은 항목은 "정보 없음"으로 표시
- 추측하지 말고 대화 내용에 근거하여 작성
- 한국어로 작성
"""


def create_analysis_agent(
    system_prompt: str = "",
    model_id: str = "",
    agent_name: str = "",
) -> Agent:
    """PreChat User의 구성을 주입하여 Analysis Agent를 생성합니다.

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
        name=agent_name or "prechat-analysis-agent",
        tools=[],  # 분석 에이전트는 도구 없이 텍스트 분석만 수행
    )


# AgentCore Runtime 엔트리포인트
if __name__ == "__main__":
    from bedrock_agentcore.runtime import BedrockAgentCoreApp

    app = BedrockAgentCoreApp()

    agent = create_analysis_agent(
        system_prompt=os.environ.get('AGENT_SYSTEM_PROMPT', ''),
        model_id=os.environ.get('AGENT_MODEL_ID', ''),
        agent_name=os.environ.get('AGENT_NAME', ''),
    )

    @app.entrypoint
    def invoke(payload: dict) -> dict:
        """AgentCore Runtime 호출 엔트리포인트"""
        conversation_history = payload.get("conversation_history", "")
        if not conversation_history:
            return {"error": "No conversation_history provided"}

        prompt = f"다음 사전 상담 대화 내용을 BANT 프레임워크로 분석해주세요:\n\n{conversation_history}"
        result = agent(prompt)
        return {"result": result.message}
