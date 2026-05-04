---
description: 상담 에이전트의 시스템 프롬프트, 모델, 도구를 구성
icon: robot
---

# 에이전트 생성과 프롬프트 작성

관리자 대시보드에서 상담에 사용할 에이전트를 생성합니다. 에이전트는 캠페인에 연결되어 고객 대화를 담당합니다.

## 에이전트란

**PreChat Agent**는 Consultation Agent(AgentCore에 배포된 런타임) 위에서 실행되는 **구성 객체**입니다. 같은 런타임에 여러 에이전트 구성을 만들어 캠페인마다 다른 프롬프트와 도구 조합으로 운영할 수 있습니다.

| 구성 요소 | 설명 |
|---------|------|
| **이름 (Name)** | 관리자 식별용 이름 |
| **시스템 프롬프트 (System Prompt)** | 에이전트의 페르소나와 행동 지침 |
| **모델 ID (Model)** | 사용할 Bedrock 파운데이션 모델 |
| **도구 (Tools)** | retrieve (KB RAG), render_form, aws_docs_mcp, http_request 등 |

## 생성 절차

{% stepper %}
{% step %}
### 에이전트 페이지로 이동한다

대시보드 좌측 메뉴 → **Agents** → **Create Agent** 버튼

**[사진첨부]** Agents 리스트 화면
{% endstep %}

{% step %}
### 이름을 정한다

예: `workshop-consultation-ko`, `enterprise-migration-agent`

에이전트 이름은 관리자만 보는 식별자입니다.
{% endstep %}

{% step %}
### 모델을 선택한다

드롭다운에서 Bedrock 모델을 고릅니다. 권장:

- **Anthropic Claude 3.5 Sonnet** — 범용, 높은 품질
- **Amazon Nova Pro** — 한국어 품질이 좋고 응답 속도가 빠름
- **Amazon Nova Lite** — 비용 절감용

Bedrock 모델 액세스에서 승인된 모델만 표시됩니다.

**[사진첨부]** 모델 선택 드롭다운
{% endstep %}

{% step %}
### 시스템 프롬프트를 작성한다

고객과 대화할 때의 역할, 톤, 수집할 정보를 지정합니다. 아래는 워크샵 예시입니다.

```
당신은 ACME 솔루션즈의 AI 사전상담 어시스턴트입니다.

역할:
- 잠재 고객이 ACME 제품 도입을 검토할 수 있도록 필요한 정보를 수집합니다.
- 친근하면서도 전문적인 톤을 유지합니다.

반드시 파악할 정보:
1. 고객 회사의 업종과 규모
2. 현재 사용 중인 솔루션 또는 도구
3. 도입을 고려하는 배경과 비즈니스 목표
4. 예상 도입 시기와 예산 규모
5. 의사결정 프로세스와 주요 이해관계자

대화 가이드:
- 한 번에 하나의 주제에만 집중합니다.
- 고객이 모호하게 답하면 구체적인 질문으로 follow-up합니다.
- 기술 질문이 나오면 AWS 공식 문서 검색 도구를 활용합니다.
- 대화 종료 전 파악한 내용을 간단히 요약하고 고객의 확인을 받습니다.
```

**[사진첨부]** 시스템 프롬프트 입력 영역

{% hint style="info" %}
프롬프트는 한국어/영어 모두 가능합니다. 고객이 사용할 언어에 맞춰 작성합니다.
{% endhint %}
{% endstep %}

{% step %}
### 도구를 선택한다

| 도구 | 용도 | 권장 |
|------|------|------|
| `retrieve` | Bedrock Knowledge Base RAG 검색. `kb_id` 속성 필요 | 유사 사례/문서 제공 시 |
| `render_form` | 구조화된 정보 수집 폼을 채팅에 렌더링 | 항상 권장 |
| `aws_docs_mcp` | AWS 공식 문서 실시간 검색 | 기술 상담에 권장 |
| `current_time` | 현재 시간 조회 | 일정 논의에 권장 |
| `http_request` | 외부 API 호출 | 고급 통합 |

워크샵에서는 **`render_form` + `aws_docs_mcp`** 두 가지로 시작하는 것을 권장합니다.

**[사진첨부]** 도구 선택 체크리스트
{% endstep %}

{% step %}
### Knowledge Base를 연결한다 (선택)

`retrieve` 도구를 선택했다면 Knowledge Base ID를 지정합니다. Knowledge Base가 없다면 다음 경로로 미리 생성합니다.

- AWS Console → **Amazon Bedrock** → **Knowledge bases** → **Create knowledge base**
- 데이터 소스로 S3 버킷(고객 사례, 제품 문서, FAQ 등) 지정
- Vector database로 OpenSearch Serverless 또는 Pinecone 선택

**[사진첨부]** KB ID 입력 필드
{% endstep %}

{% step %}
### Agent를 저장하고 Prepare를 실행한다

**Save** 버튼으로 구성을 저장한 뒤 **Prepare** 버튼을 누릅니다. AgentCore Memory 리소스가 준비되고 에이전트가 호출 가능한 상태가 됩니다.

Status가 `PREPARED`로 바뀌면 완료입니다.

**[사진첨부]** Prepare 버튼 및 Status 표시
{% endstep %}
{% endstepper %}

## 에이전트 관리 팁

### 프롬프트 이터레이션

실제 테스트 세션을 수행한 뒤 대화 로그를 보고 프롬프트를 개선합니다. 에이전트 상세 페이지에서 시스템 프롬프트를 편집하면 기존 캠페인에도 즉시 반영됩니다.

### 여러 에이전트 운영

업종별, 제품별로 별도 에이전트를 만들면 관리가 편합니다.

| 에이전트 | 용도 |
|---------|-----|
| `kr-enterprise-ko` | 한국 엔터프라이즈 신규 도입 |
| `kr-migration-ko` | 한국 마이그레이션 상담 |
| `global-partner-en` | 글로벌 파트너 영문 상담 |

### 도구 속성 동적 주입

`retrieve` 도구는 에이전트 구성 시점에 `kb_id`를 지정합니다. 캠페인마다 다른 KB를 쓰고 싶다면 에이전트를 복제해 `kb_id`만 바꾸면 됩니다.

## 다음 단계

에이전트 준비가 끝났으면 [캠페인 만들기](create-campaign.md)로 이동합니다.
