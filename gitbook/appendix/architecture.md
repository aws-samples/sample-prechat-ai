---
description: PreChat의 시스템 아키텍처와 데이터 흐름 레퍼런스
icon: sitemap
---

# 아키텍처 레퍼런스

워크샵 진행 후 시스템 구조를 더 깊이 이해하려는 독자를 위한 레퍼런스입니다.

## 전체 구성도

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│   React SPA     │     │   API Gateway    │     │   Lambda Functions       │
│  (CloudFront)   │◄───►│   (REST + WS)    │◄───►│   (Python 3.13)          │
│  Cloudscape UI  │     │                  │     │   도메인별 격리          │
└─────────────────┘     └──────────────────┘     └──────────┬───────────────┘
                                                            │
┌─────────────────┐     ┌──────────────────┐     ┌──────────▼───────────────┐
│  Cognito        │     │   DynamoDB       │     │  Bedrock AgentCore       │
│  (관리자)        │     │  (KMS Encrypted) │     │  ┌─────────────────────┐ │
└─────────────────┘     │  Sessions        │     │  │ Consultation Agent  │ │
                        │  Messages        │     │  │ Summary Agent       │ │
┌─────────────────┐     │  Campaigns       │     │  │                     │ │
│  S3 + CloudFront│     └──────────────────┘     │  └─────────────────────┘ │
│  (정적 + 업로드) │                             │  Strands SDK + MCP       │
└─────────────────┘                              └──────────────────────────┘
```

## 배포 단위

PreChat은 세 가지 독립 배포 단위로 구성됩니다.

### 1. Strands Agents on Bedrock AgentCore

AI 에이전트가 Docker 컨테이너로 AgentCore Runtime에 배포됩니다. 상담 에이전트와 요약 에이전트 두 역할을 제공하며, 이를 상속해 목적에 맞는 구현체를 자유롭게 정의합니다.

### 2. Backend (SAM)

API Gateway + Lambda + DynamoDB + Cognito + CloudFront가 CloudFormation 스택 하나로 관리됩니다. `template.yaml`에 전체 리소스가 정의되어 있습니다.

### 3. Frontend (React SPA)

Vite로 빌드한 정적 파일을 S3에 업로드하고 CloudFront로 서빙합니다. API 엔드포인트는 환경 변수로 주입됩니다.

## 도메인 모델 (DDD)

**Session**이 Aggregate Root입니다. Pre-Consultation의 모든 활동이 Session을 중심으로 구성됩니다.

```
Campaign (캠페인)
  └─ Session (세션) [0..*]                    ← Aggregate Root
      ├─ Message (대화) [1..*]
      ├─ AI Summary (BANT 요약)
      ├─ Meeting Plan (미팅 플랜)
      │   ├─ References [0..*]
      │   └─ Comments [0..*]
      └─ Meeting Log (미팅 기록)
```

## 백엔드 도메인 격리

Lambda 함수는 도메인별로 디렉토리 격리됩니다. 공통 코드는 `shared/` Lambda Layer로 제공됩니다.

| 디렉토리 | 담당 도메인 |
|---------|-----------|
| `session/` | 세션 CRUD, PIN 인증, 메시지 |
| `campaign/` | 캠페인 CRUD, 분석 |
| `admin/` | 관리자 API, 파일, 커스터마이징 |
| `auth/` | 인증, Cognito 관리 |
| `agent/` | Agent 관리/설정 |
| `trigger/` | 이벤트 트리거 (Slack/SNS) |
| `file/` | 파일 업로드 (S3) |
| `stream/` | DynamoDB Streams 처리 |
| `websocket/` | WebSocket 처리 |
| `meeting/` | 미팅 플랜 |
| `migration/` | 마이그레이션 유틸 |

### 도메인 간 통신 원칙

- **동기**: RESTful API (API Gateway → Lambda)
- **비동기**: DynamoDB Streams → Stream Handler Lambda
- **Lambda 간 직접 호출 금지**: 강결합 방지

## DynamoDB 스키마

### SessionsTable

```
PK: SESSION#{sessionId}
SK: METADATA

GSI1 (by Campaign):
  GSI1PK: CAMPAIGN#{campaignId}
  GSI1SK: CREATED_AT#{timestamp}

GSI2 (by Status):
  GSI2PK: STATUS#{status}
  GSI2SK: CREATED_AT#{timestamp}

GSI3 (Inbound dedup):
  GSI3PK: INBOUND#{campaignId}#PHONE#{phone}
  GSI3SK: SESSION#{sessionId}
```

### MessagesTable

```
PK: SESSION#{sessionId}
SK: MESSAGE#{messageId}   # messageId는 ULID로 시간순 정렬 가능
```

### CampaignsTable

```
PK: CAMPAIGN#{campaignId}
SK: METADATA

CampaignCodeIndex:
  campaignCode → campaignId
```

## 에이전트 페이로드

### 상담 에이전트 (stream)

```json
{
  "prompt": "고객 메시지",
  "session_id": "PreChat 세션 ID",
  "config": {
    "system_prompt": "...",
    "model_id": "...",
    "tools": "[{\"tool_name\":\"retrieve\",\"tool_attributes\":{\"kb_id\":\"...\"}}]",
    "locale": "ko"
  }
}
```

응답은 SSE 이벤트로 스트리밍됩니다.

| 이벤트 | 설명 |
|--------|------|
| `chunk` | 모델 텍스트 출력 |
| `tool` | 도구 실행 상태 |
| `result` | 최종 결과 |
| `error` | 에러 발생 |

### 요약 에이전트 (invoke)

```json
{
  "conversation_history": "대화 로그 텍스트",
  "meeting_log": "미팅 로그 (선택)",
  "config": { "locale": "ko", "model_id": "..." }
}
```

응답은 `AnalysisOutput` Pydantic 모델을 따른 JSON 구조입니다.

## 이벤트 흐름

세션 종료부터 리포트 생성까지의 이벤트 흐름:

{% stepper %}
{% step %}
### 고객이 대화 종료 또는 관리자가 Inactivate

`SessionsTable`의 항목이 `status: Completed`로 업데이트됩니다.
{% endstep %}

{% step %}
### DynamoDB Streams가 `SessionStreamHandler` 호출

Stream Handler가 상태 변화를 감지하여 후속 작업을 트리거합니다.
{% endstep %}

{% step %}
### Stream Handler가 요약 에이전트를 호출

`bedrock-agentcore:InvokeAgentRuntime`로 에이전트를 동기 호출합니다.
{% endstep %}

{% step %}
### 생성된 리포트/플랜을 DynamoDB에 저장

관리자 대시보드의 해당 탭에서 즉시 조회 가능합니다.
{% endstep %}

{% step %}
### (선택) Slack/SNS 트리거 실행

`CampaignStreamHandler`가 캠페인/세션 생명주기 이벤트를 감지하여 외부 알림을 발송합니다.
{% endstep %}
{% endstepper %}

## API 엔드포인트 레이아웃

| 도메인 | 경로 | 인증 |
|--------|------|------|
| Session (고객) | `/api/sessions/{sessionId}/*` | PIN |
| Session (관리자) | `/api/admin/sessions/*` | Cognito |
| Campaign (공개) | `/api/campaigns/code/{code}` | 없음 |
| Campaign (관리자) | `/api/admin/campaigns/*` | Cognito |
| Agent (관리자) | `/api/admin/agents/*` | Cognito |
| Analytics (관리자) | `/api/admin/analytics/*` | Cognito |
| WebSocket | `wss://.../{stage}` | sessionId + PIN |

## WebSocket 아키텍처

실시간 대화 스트리밍은 WebSocket을 통해 이루어집니다.

```
Customer Browser
  ─── connect ─▶ WebSocketConnectFunction (세션 검증)
  ─── sendMessage ─▶ WebSocketSendMessageFunction
                     │
                     └─▶ AgentCore.InvokeAgentRuntime (streaming)
                     ◀─── SSE chunks
                     │
  ◀─── post_to_connection ── API Gateway Management API
  ─── disconnect ─▶ WebSocketDisconnectFunction
```

`WebSocketSendMessageFunction`은 300초 타임아웃으로 설정되어 있어 긴 응답도 처리 가능합니다.

## 보안 아키텍처 (prsworkshop 브랜치 기준)

| 레이어 | 보호 수단 |
|--------|---------|
| 전송 | HTTPS/WSS (TLS 1.2+), CloudFront 관리형 인증서 |
| 관리자 인증 | Cognito User Pool (JWT, 이메일 도메인 제한) |
| 고객 인증 | 6자리 PIN (HMAC-SHA256 해시 저장) |
| 데이터 | DynamoDB KMS 암호화 (전용 CMK), S3 SSE-S3 |
| Lambda 권한 | 도메인별 최소 권한 IAM 정책 |
| 네트워크 | **VPC 격리 제거** (워크샵 편의, 프로덕션은 main 브랜치 사용) |

## 프로덕션 강화 방향

main 브랜치에는 다음이 추가됩니다.

- Lambda가 VPC 내 Private Subnet에서 실행
- DynamoDB, S3를 Gateway VPC Endpoint로 접근
- Bedrock, AgentCore, Cognito, SQS, SNS, KMS를 Interface VPC Endpoint로 접근
- WebSocket `@connections` API 호출은 public endpoint 유지 (VPC Endpoint와 충돌 회피)

추가 검토할 요소:

- WAF 규칙 (OWASP Top 10, rate limiting, geo-blocking)
- GuardDuty, Security Hub 활성화
- CloudTrail 데이터 이벤트 활성화
- Cognito Advanced Security (risk-based 인증)
- Secrets Manager를 통한 비밀 관리 교체
- CloudFront 커스텀 도메인 + ACM 인증서

## 참고 자료

- [packages/strands-agents/README.md](https://github.com/aws-samples/sample-prechat-ai/blob/main/packages/strands-agents/README.md) — 에이전트 상세
- [template.yaml](https://github.com/aws-samples/sample-prechat-ai/blob/main/template.yaml) — SAM IaC
- [Amazon Bedrock AgentCore 문서](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Strands SDK](https://github.com/strands-agents/sdk-python)
