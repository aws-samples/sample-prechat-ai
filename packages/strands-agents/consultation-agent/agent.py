"""
PreChat Consultation Agent

미팅 전 고객의 사전 요구사항을 청취하는 상담 에이전트입니다.
Session 도메인의 대화 이력의 주축이 됩니다.

부가 능력:
  - STM (AgentCore Memory; 기간 30일) - 세션 대화 보전
  - Bedrock KB retrieve - 유사 고객사례 문의 대응
  - Div Return - 프론트엔드에서 동적 렌더링되는 HTML Form 응답

배포: Bedrock AgentCore Runtime (bedrock-agentcore SDK)
호출: bedrock-agentcore 클라이언트의 invoke_agent_runtime
"""

import os
import json
from strands import Agent
from strands.tools import tool
from strands.telemetry import StrandsTelemetry

# OTLP 트레이스 설정
os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
strands_telemetry = StrandsTelemetry()
strands_telemetry.setup_otlp_exporter()

# Bedrock KB 검색 도구
import boto3

kb_client = boto3.client('bedrock-agent-runtime', region_name=os.environ.get('AWS_REGION', 'ap-northeast-2'))
KB_ID = os.environ.get('BEDROCK_KB_ID', '')
if KB_ID == 'NONE':
    KB_ID = ''


@tool
def search_customer_references(query: str) -> str:
    """고객 문의와 관련된 유사 고객사례를 Bedrock Knowledge Base에서 검색합니다.

    Args:
        query: 검색할 고객 문의 내용

    Returns:
        관련 고객사례 요약 텍스트
    """
    if not KB_ID:
        return "Knowledge Base가 설정되지 않았습니다."

    try:
        resp = kb_client.retrieve(
            knowledgeBaseId=KB_ID,
            retrievalQuery={'text': query},
            retrievalConfiguration={
                'vectorSearchConfiguration': {'numberOfResults': 3}
            }
        )

        results = []
        for item in resp.get('retrievalResults', []):
            content = item.get('content', {}).get('text', '')
            if content:
                results.append(content[:500])

        if results:
            return "\n\n---\n\n".join(results)
        return "관련 고객사례를 찾지 못했습니다."

    except Exception as e:
        return f"검색 중 오류가 발생했습니다: {str(e)}"


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
        return f"<div><p>폼 필드 정의가 올바르지 않습니다.</p></div>"

    form_html = f'<div class="prechat-form" data-form-type="div-return">'
    form_html += f'<h3>{form_title}</h3>'
    form_html += '<form>'

    for field in field_list:
        name = field.get('name', '')
        label = field.get('label', name)
        field_type = field.get('type', 'text')
        required = field.get('required', False)
        options = field.get('options', [])

        form_html += f'<div class="form-field">'
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

    form_html += '<button type="submit">제출</button>'
    form_html += '</form></div>'

    return form_html


# 기본 시스템 프롬프트 (PreChat User가 오버라이드 가능)
DEFAULT_SYSTEM_PROMPT = """당신은 AWS PreChat 사전 상담 AI 어시스턴트입니다.
## 역할

AWS의 MSP 파트너인 NDS 미팅 전 고객정보 수집 대화형 AI

## 금지사항

- AWS 솔루션/서비스 추천 금지
- 기술 해결책 제시 금지

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

**일정확정 문의:** "사전상담 완료 후 1-2일내 담당자가 이메일로 일정 안내드립니다"

**일정변경 요청:** "담당자에게 우선 전달하여 빠른 연락받도록 하겠습니다"

**대화 8회 초과, 담당자 정보 요청시:**
"담당자 정보:
- {{sales_rep.name}}
- {{sales_rep.phone}}
- {{sales_rep.email}}

1-2일내 미팅 확정메일 발송예정입니다."

**대화 종료시**
EOF 토큰 반드시 출력하기

## 능동적인 에이전트가 되세요

- 단계별 인터뷰에서 구체적 예시 제공하시면 좋습니다.
- 단계별 인터뷰의 대화 예시는 예시일 뿐입니다. 능동적으로 친절하며 공감 위주의 톤으로 인터뷰를 진행하세요.
- 담당자 정보를 요구할 경우 플레이스 홀더로 표시하세요: {{sales_rep.name}} {{sales_rep.phone}} {{sales_rep.email}}
- 대화 종료시 반드시(MUST) "EOF" 토큰을 넣어주셔야 합니다.

**핵심: 8회내 필수정보 수집, 단계별 세분화, 정확한 담당자 정보 제공**
"""


def create_consultation_agent(
    system_prompt: str = "",
    model_id: str = "",
    agent_name: str = "",
) -> Agent:
    """PreChat User의 구성을 주입하여 Consultation Agent를 생성합니다.

    Args:
        system_prompt: 사용자 정의 시스템 프롬프트 (빈 문자열이면 기본값 사용)
        model_id: 사용자 정의 모델 ID (빈 문자열이면 기본값 사용)
        agent_name: 사용자 정의 에이전트 이름

    Returns:
        구성된 Strands Agent 인스턴스
    """
    return Agent(
        model=model_id or "us.anthropic.claude-sonnet-4-20250514-v1:0",
        system_prompt=system_prompt or DEFAULT_SYSTEM_PROMPT,
        name=agent_name or "prechat-consultation-agent",
        tools=[search_customer_references, render_form],
    )


# AgentCore Runtime 엔트리포인트
if __name__ == "__main__":
    from bedrock_agentcore.runtime import BedrockAgentCoreApp

    app = BedrockAgentCoreApp()

    # 환경 변수에서 PreChat User 구성 주입
    agent = create_consultation_agent(
        system_prompt=os.environ.get('AGENT_SYSTEM_PROMPT', ''),
        model_id=os.environ.get('AGENT_MODEL_ID', ''),
        agent_name=os.environ.get('AGENT_NAME', ''),
    )

    @app.entrypoint
    def invoke(payload: dict) -> dict:
        """AgentCore Runtime 호출 엔트리포인트"""
        prompt = payload.get("prompt", "")
        if not prompt:
            return {"error": "No prompt provided"}

        result = agent(prompt)
        return {"result": result.message}
