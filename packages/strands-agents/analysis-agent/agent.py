"""
PreChat Analysis Agent

세션 종료 후 비동기적으로 호출되어 고객 상담 내용을 BANT 프레임워크로 요약합니다.
Session 도메인의 AI Summary를 보강합니다.

Structured Output:
  - Pydantic 모델(AnalysisOutput)로 응답 스키마를 정의
  - Strands SDK의 structured_output_model 파라미터로 타입 안전한 응답 보장
  - 프론트엔드 AnalysisResults 타입과 1:1 매핑

배포: Bedrock AgentCore Runtime
호출: 세션 완료 시 DynamoDB Streams → SQS → Lambda에서 invoke_agent_runtime
"""

import os
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field
from strands import Agent
from strands.types.exceptions import StructuredOutputException
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)


# ──────────────────────────────────────────────
# Pydantic 모델: 프론트엔드 AnalysisResults와 1:1 매핑
# ──────────────────────────────────────────────

class BANTAnalysis(BaseModel):
    """BANT 프레임워크 분석 결과"""
    budget: str = Field(description="Budget analysis - estimated range, current spending, and notes combined into a concise summary")
    authority: str = Field(description="Authority analysis - decision makers, approval process, and notes combined into a concise summary")
    need: str = Field(description="Need analysis - business challenges, technical requirements, and desired outcomes combined into a concise summary")
    timeline: str = Field(description="Timeline analysis - expected timeline, key milestones, urgency, and notes combined into a concise summary")


class AWSService(BaseModel):
    """추천 AWS 서비스"""
    service: str = Field(description="AWS service name (e.g. Amazon Bedrock)")
    reason: str = Field(description="Why this service is recommended for the customer's use case")
    implementation: str = Field(description="Brief implementation guidance or approach")


class CustomerCase(BaseModel):
    """유사 고객 사례"""
    title: str = Field(description="Customer case title")
    description: str = Field(description="Brief description of the case")
    relevance: str = Field(description="Why this case is relevant to the customer")


class AnalysisOutput(BaseModel):
    """PreChat 분석 에이전트의 구조화된 출력 모델.

    프론트엔드 AnalysisResults 타입과 정확히 매핑됩니다:
      - markdownSummary: executive summary (2-3 sentences)
      - bantAnalysis: BANT framework analysis
      - awsServices: recommended AWS services list
      - customerCases: similar customer cases (can be empty)
    """
    markdownSummary: str = Field(
        description="Executive summary of the pre-consultation in 2-3 sentences"
    )
    bantAnalysis: BANTAnalysis = Field(
        description="BANT (Budget, Authority, Need, Timeline) framework analysis"
    )
    awsServices: list[AWSService] = Field(
        default_factory=list,
        description="List of recommended AWS services with reasons and implementation guidance"
    )
    customerCases: list[CustomerCase] = Field(
        default_factory=list,
        description="List of similar customer cases. Empty list if no relevant cases found."
    )


# ──────────────────────────────────────────────
# 에이전트 설정
# ──────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are an AWS PreChat Analysis AI assistant.
Analyze pre-consultation conversation content and generate a structured summary using the BANT framework.

## Rules
- If the customer provided company information, analyze the industry context
- For items not explicitly mentioned in the conversation, write "No information provided"
- Do not speculate - base your analysis strictly on the conversation content
- Each BANT field should be a concise paragraph summarizing all relevant details
- For awsServices, recommend specific AWS services relevant to the customer's needs with clear reasons
- For customerCases, include similar cases if identifiable from context; otherwise return an empty list
"""

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatAnalysisAgent"


def _get_locale_instruction(locale: str) -> str:
    """locale 코드에 따른 언어 지시를 반환합니다."""
    if locale == 'en':
        return (
            "## Language Instruction\n"
            "IMPORTANT: You MUST respond in English. "
            "All analysis results, field values, and summaries must be written in English."
        )
    return (
        "## Language Instruction\n"
        "IMPORTANT: You MUST respond in Korean (한국어). "
        "All analysis results, field values, and summaries must be written in Korean."
    )


def create_analysis_agent(
    system_prompt: str | None = None,
    model_id: str | None = None,
    agent_name: str | None = None,
    locale: str = 'ko',
) -> Agent:
    """Analysis Agent를 생성합니다.

    Args:
        system_prompt: 사용자 정의 시스템 프롬프트 (None이면 DEFAULT 사용)
        model_id: 사용자 정의 모델 ID (None이면 DEFAULT 사용)
        agent_name: 사용자 정의 에이전트 이름 (None이면 DEFAULT 사용)
        locale: 응답 언어 코드 ('ko' 또는 'en')

    Returns:
        구성된 Strands Agent 인스턴스
    """
    effective_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
    locale_instruction = _get_locale_instruction(locale)
    effective_prompt = f"{effective_prompt}\n\n{locale_instruction}"

    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=effective_prompt,
        name=agent_name or DEFAULT_AGENT_NAME,
        tools=[],
    )


@app.entrypoint
def invoke(payload: dict) -> dict:
    """AgentCore Runtime 호출 엔트리포인트

    Strands Structured Output을 사용하여 AnalysisOutput Pydantic 모델로
    타입 안전한 응답을 반환합니다.

    payload 구조:
      {
        "conversation_history": "대화 내용 텍스트",
        "config": {
          "system_prompt": "...",
          "model_id": "...",
          "agent_name": "...",
          "locale": "ko"
        }
      }
    """
    conversation_history = payload.get("conversation_history", "")
    if not conversation_history:
        return {"error": "No conversation_history provided"}

    config = payload.get("config", {})
    locale = config.get("locale", "ko")

    agent = create_analysis_agent(
        system_prompt=config.get("system_prompt"),
        model_id=config.get("model_id"),
        agent_name=config.get("agent_name"),
        locale=locale,
    )

    prompt = (
        "Analyze the following pre-consultation conversation using the BANT framework:\n\n"
        f"{conversation_history}"
    )

    try:
        result = agent(prompt, structured_output_model=AnalysisOutput)
        output: AnalysisOutput = result.structured_output

        # Pydantic 모델을 프론트엔드 호환 dict로 변환
        return {"result": output.model_dump()}

    except StructuredOutputException as e:
        logging.error(f"Structured output validation failed: {e}")
        # 폴백: 일반 텍스트 응답
        fallback_result = agent(prompt)
        return {
            "result": {
                "markdownSummary": str(fallback_result.message),
                "bantAnalysis": {
                    "budget": "Analysis parsing failed - see markdownSummary",
                    "authority": "Analysis parsing failed - see markdownSummary",
                    "need": "Analysis parsing failed - see markdownSummary",
                    "timeline": "Analysis parsing failed - see markdownSummary",
                },
                "awsServices": [],
                "customerCases": [],
            }
        }


if __name__ == "__main__":
    app.run()
