# PreChat API Reference

## Domain-Based API Endpoints

### Session Domain (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions/{sessionId}` | 세션 조회 |
| POST | `/api/sessions/{sessionId}/verify-pin` | PIN 인증 |
| POST | `/api/sessions/{sessionId}/messages` | 메시지 전송 |
| POST | `/api/sessions/{sessionId}/messages/stream` | 스트리밍 메시지 |
| PUT | `/api/sessions/{sessionId}/consultation-purposes` | 상담 목적 업데이트 |
| POST | `/api/sessions/{sessionId}/feedback` | 피드백 제출 |

### Campaign Domain (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/code/{campaignCode}` | 캠페인 코드로 조회 |

### Admin - Session Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions` | 세션 생성 |
| GET | `/api/admin/sessions` | 세션 목록 |
| GET | `/api/admin/sessions/{sessionId}/details` | 세션 상세 |
| GET | `/api/admin/sessions/{sessionId}/report` | AI 리포트 |
| PUT | `/api/admin/sessions/{sessionId}/inactivate` | 세션 비활성화 |
| DELETE | `/api/admin/sessions/{sessionId}` | 세션 삭제 |

### Admin - Meeting Plan (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 생성 (AI) |
| GET | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 조회 |
| PUT | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 수정 |
| POST | `/api/admin/sessions/{sessionId}/meeting-plan/comments` | 코멘트 추가 |

### Admin - Campaign Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/campaigns` | 캠페인 생성 |
| GET | `/api/admin/campaigns` | 캠페인 목록 |
| GET | `/api/admin/campaigns/{campaignId}` | 캠페인 조회 |
| PUT | `/api/admin/campaigns/{campaignId}` | 캠페인 수정 |
| DELETE | `/api/admin/campaigns/{campaignId}` | 캠페인 삭제 |
| GET | `/api/admin/campaigns/{campaignId}/analytics` | 캠페인 분석 |

### Admin - Trigger Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/triggers` | 트리거 생성 |
| GET | `/api/admin/triggers` | 트리거 목록 |
| GET | `/api/admin/triggers/templates` | 기본 템플릿 조회 |
| GET | `/api/admin/triggers/{triggerId}` | 트리거 조회 |
| PUT | `/api/admin/triggers/{triggerId}` | 트리거 수정 |
| DELETE | `/api/admin/triggers/{triggerId}` | 트리거 삭제 |

### Admin - Agent Configuration (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/agent-configs` | 에이전트 설정 생성 |
| GET | `/api/admin/agent-configs` | 에이전트 설정 목록 |
| GET | `/api/admin/agent-configs/{configId}` | 에이전트 설정 조회 |
| PUT | `/api/admin/agent-configs/{configId}` | 에이전트 설정 수정 |
| DELETE | `/api/admin/agent-configs/{configId}` | 에이전트 설정 삭제 |

### Admin - Agent Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/agents` | Agent 목록 |
| POST | `/api/admin/agents` | Agent 생성 |
| GET | `/api/admin/agents/{agentId}` | Agent 조회 |
| PUT | `/api/admin/agents/{agentId}` | Agent 업데이트 |
| DELETE | `/api/admin/agents/{agentId}` | Agent 삭제 |
| POST | `/api/admin/agents/{agentId}/prepare` | Agent 준비 |

## Legacy Endpoints (Deprecated)

다음 엔드포인트는 폐기 예정이며, 새 도메인 기반 엔드포인트로 마이그레이션해야 합니다.

| Legacy | New | Status |
|--------|-----|--------|
| `POST /api/chat/message` | `POST /api/sessions/{sessionId}/messages` | Deprecated |
| `POST /api/chat/stream` | `POST /api/sessions/{sessionId}/messages/stream` | Deprecated |
| `GET /api/chat/session/{sessionId}` | `GET /api/sessions/{sessionId}` | Deprecated |

레거시 엔드포인트 응답에는 다음 헤더가 포함됩니다:
- `X-Deprecated: true`
- `X-New-Endpoint: /api/sessions/{sessionId}/messages`
