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
from strands.tools import tool
from strands_tools import retrieve, current_time
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

app = BedrockAgentCoreApp()
logging.getLogger("strands").setLevel(logging.INFO)

# AgentCore Memory ID: deploy 시 env_vars로 컨테이너에 주입됨
MEMORY_ID = os.environ.get('BEDROCK_AGENTCORE_MEMORY_ID', '')

# Bedrock KB ID: deploy 시 launch(env_vars=...)로 컨테이너에 주입됨
kb_id = os.environ.get('BEDROCK_KB_ID', '')


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
def _default_system_prompt() -> str:
    return f"""당신은 AWS PreChat 사전 상담 AI 어시스턴트입니다.
## 역할

AWS 미팅 전 고객정보 수집 대화형 AI

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

**유사 고객사례 문의:** 고객이 "다른 회사는 어떻게 했나요?", "비슷한 사례가 있나요?" 등 유사사례를 물으면 `retrieve` 도구를 사용하여 지식베이스에서 관련 사례를 검색하세요. 검색 결과를 자연스럽게 요약하여 고객에게 전달하되, 구체적인 고객사명은 익명 처리하세요.

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

## 사용 가능한 도구

1. `retrieve`: Bedrock Knowledge Base에서 유사 고객사례를 검색합니다. 고객이 사례를 물으면 `retrieve(text="고객 질문 키워드", knowledgeBaseId="{kb_id}")` 형태로 호출하세요. knowledgeBaseId 파라미터는 반드시 포함해야 합니다.
2. `render_form`: 고객이 구조화된 정보를 입력해야 할 때 HTML Form을 생성합니다. 참석자 정보, 인프라 현황 등 여러 필드를 한번에 수집할 때 활용하세요.

**핵심: 8회내 필수정보 수집, 단계별 세분화, 정확한 담당자 정보 제공**
"""

DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_AGENT_NAME = "prechatConsultationAgent"


def create_consultation_agent(
    session_id: str,
    system_prompt: str | None = None,
    model_id: str | None = None,
    agent_name: str | None = None,
) -> Agent:
    """PreChat User의 구성을 주입하여 Consultation Agent를 생성합니다.

    Args:
        session_id: PreChat 세션 ID (STM 메모리 및 actor 식별에 사용)
        system_prompt: 사용자 정의 시스템 프롬프트 (None이면 DEFAULT 사용)
        model_id: 사용자 정의 모델 ID (None이면 DEFAULT 사용)
        agent_name: 사용자 정의 에이전트 이름 (None이면 DEFAULT 사용)

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

    # 시스템 프롬프트에 KB ID 주입
    effective_prompt = system_prompt or _default_system_prompt()

    return Agent(
        model=model_id or DEFAULT_MODEL_ID,
        system_prompt=effective_prompt,
        name=agent_name or DEFAULT_AGENT_NAME,
        tools=[retrieve, current_time, render_form],
        session_manager=session_manager,
    )


@app.entrypoint
def invoke(payload: dict) -> dict:
    """AgentCore Runtime 호출 엔트리포인트

    payload 구조:
      {
        "prompt": "고객 메시지",
        "session_id": "PreChat 세션 ID (STM 메모리 키 겸 actor ID)",
        "config": {                          # 백엔드 Lambda가 DynamoDB에서 조회하여 주입
          "system_prompt": "...",
          "model_id": "...",
          "agent_name": "..."
        }
      }

    config가 없으면 기본값으로 폴백합니다.
    """
    prompt = payload.get("prompt", "")
    if not prompt:
        return {"error": "No prompt provided"}

    session_id = payload.get("session_id", "anonymous")

    # payload.config에서 동적 구성 추출 (키가 없으면 None → DEFAULT 폴백)
    config = payload.get("config", {})
    agent = create_consultation_agent(
        session_id=session_id,
        system_prompt=config.get("system_prompt"),
        model_id=config.get("model_id"),
        agent_name=config.get("agent_name"),
    )

    result = agent(prompt)
    return {"result": result.message}

if __name__ == "__main__":
    app.run()
