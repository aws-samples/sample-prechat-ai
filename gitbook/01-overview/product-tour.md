---
description: PreChat의 핵심 가치와 시스템 구성, 주요 화면을 한눈에 소개
icon: compass
---

# PreChat 한눈에 보기

PreChat은 고객과의 **대화**만으로 사전상담 정보를 수집하고, AI가 BANT 분석 리포트와 미팅 플랜을 자동 생성하는 시스템입니다.

## 전체 흐름

{% stepper %}
{% step %}
### 관리자가 캠페인을 만든다

상담 목적이 정해진 캠페인(예: "FY26 신규 도입 상담")을 생성하고 에이전트를 연결합니다.
{% endstep %}

{% step %}
### 고객이 챗봇과 대화한다

세션 URL로 접속한 고객이 PIN 인증 후 AI와 자연어로 대화하며 자신의 요구사항을 전달합니다.
{% endstep %}

{% step %}
### AI가 세션을 정리한다

세션이 종료되면 Summary Agent가 BANT 분석을, Planning Agent가 미팅 플랜을 자동 생성합니다.
{% endstep %}

{% step %}
### 영업/CS 팀이 미팅을 준비한다

생성된 리포트와 플랜을 검토하고 고객과의 본 미팅을 준비합니다.
{% endstep %}
{% endstepper %}

## 주요 화면

| 화면 | 역할 |
|------|------|
| **고객 챗 인터페이스** | 캠페인 URL + PIN으로 입장, AI와 실시간 대화, 대화 종료 후 피드백 제출 |
| **관리자 대시보드** | 캠페인/에이전트/세션 관리, 대화 로그 조회, AI 리포트 확인 |
| **캠페인 분석** | 캠페인별 세션 수, 상담 목적 분포, CSAT, 시간별 트렌드 |

## 구성 요소

{% tabs %}
{% tab title="프론트엔드" %}
- **React + Vite** SPA
- **AWS Cloudscape** 디자인 시스템
- CloudFront + S3 호스팅
- 한국어/영어 i18n 지원
{% endtab %}

{% tab title="백엔드" %}
- **Python 3.13 Lambda** (도메인별 격리)
- API Gateway (REST + WebSocket)
- **DynamoDB** + DynamoDB Streams
- Cognito User Pool (관리자)
- PIN 기반 인증 (고객)
{% endtab %}

{% tab title="AI 에이전트" %}
- **Strands SDK** 기반
- **Bedrock AgentCore Runtime** (Docker)
- Consultation Agent, Summary Agent, Planning Agent
- AWS Documentation MCP 연동
{% endtab %}
{% endtabs %}

## 캠페인 유형

PreChat은 두 가지 캠페인 유형을 지원합니다. 고객 도달 방식에 따라 선택하면 됩니다.

{% columns %}
{% column %}
### 아웃바운드 (Outbound)

관리자가 세션을 **사전 생성**하고 고객별 URL + PIN을 개별 전달합니다.

- 개인 맞춤 상담에 적합
- 고객마다 고유 URL 발급
- 세션 상태를 관리자가 통제
{% endcolumn %}

{% column %}
### 인바운드 (Inbound)

고객이 **캠페인 URL**로 직접 접근하여 PII 입력 후 세션을 스스로 생성합니다.

- 대규모 상담 접수에 적합
- 캠페인 단위 PIN 공유
- 전화번호 기준 중복 방지
{% endcolumn %}
{% endcolumns %}

## AI 에이전트 역할

| 에이전트 | 시점 | 하는 일 |
|---------|-----|--------|
| Consultation Agent | 세션 중 | 고객과 대화, 질문 유도, 양식 렌더링, AWS 문서 검색 |
| Summary Agent | 세션 종료 후 | 대화 로그를 BANT 프레임워크로 요약 |
| Planning Agent | 세션 종료 후 | 유사 사례 검색, 미팅 플랜 초안 작성 |

## 다음 단계

시스템이 누구를 위한 것인지 더 자세히 보려면 [유스케이스와 참여자](personas-and-scenarios.md)로 이동합니다. 워크샵을 바로 시작하고 싶다면 [워크샵 체크리스트](workshop-checklist.md)를 확인합니다.
