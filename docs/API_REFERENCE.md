# PreChat API Reference

## 엔드포인트 설계 원칙

- RESTful 리소스 중심 설계
- 도메인별 경로 분리 (Session, Campaign, Agent, Analytics, Trigger)
- CRUD 의미론에 맞는 HTTP Method 사용 (GET/POST/PUT/PATCH/DELETE)
- 부분 업데이트는 PATCH, 전체 교체는 PUT
- 읽기 작업은 GET (body 없음), 쓰기/명령은 POST

---

## Session Domain (Public - 인증 불필요)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions/{sessionId}` | 세션 조회 |
| POST | `/api/sessions/{sessionId}/verify-pin` | PIN 인증 |
| POST | `/api/sessions/{sessionId}/messages` | 메시지 전송 |
| PUT | `/api/sessions/{sessionId}/consultation-purposes` | 상담 목적 업데이트 |
| POST | `/api/sessions/{sessionId}/feedback` | 피드백 제출 |
| POST | `/api/sessions/{sessionId}/files/upload-url` | 파일 업로드 URL 생성 |
| GET | `/api/sessions/{sessionId}/files` | 파일 목록 조회 |
| DELETE | `/api/sessions/{sessionId}/files/{fileKey+}` | 파일 삭제 |

## Campaign Domain (Public - 인증 불필요)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/code/{campaignCode}` | 캠페인 코드로 조회 |

## Auth Domain (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/confirm` | 회원가입 확인 |
| POST | `/api/auth/signin` | 로그인 |
| GET | `/api/auth/verify` | 토큰 검증 |
| POST | `/api/auth/confirm-phone` | 전화번호 확인 |

## Admin - Session Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions` | 세션 생성 |
| GET | `/api/admin/sessions` | 세션 목록 |
| GET | `/api/admin/sessions/{sessionId}/details` | 세션 상세 |
| GET | `/api/admin/sessions/{sessionId}/report` | AI 리포트 |
| PATCH | `/api/admin/sessions/{sessionId}` | 세션 부분 업데이트 (상태 변경, 캠페인 연결) |
| DELETE | `/api/admin/sessions/{sessionId}` | 세션 삭제 |

### PATCH /api/admin/sessions/{sessionId}

통합 부분 업데이트 엔드포인트. 지원 필드:

```json
{
  "status": "inactive",       // 세션 비활성화
  "campaignId": "camp-123"    // 캠페인 연결 (빈 문자열로 해제)
}
```

## Admin - AI Analysis (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions/{sessionId}/analysis` | 분석 요청 (초기 분석 + 재분석 통합) |
| GET | `/api/admin/sessions/{sessionId}/analysis-status` | 분석 상태 조회 |

### POST /api/admin/sessions/{sessionId}/analysis

```json
{
  "modelId": "anthropic.claude-3-sonnet",
  "includeMeetingLog": false    // true면 미팅 로그 포함 재분석
}
```

## Admin - Meeting Plan (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 생성 (AI) |
| GET | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 조회 |
| PUT | `/api/admin/sessions/{sessionId}/meeting-plan` | 미팅 플랜 수정 |
| POST | `/api/admin/sessions/{sessionId}/meeting-plan/comments` | 코멘트 추가 |

## Admin - Meeting Log (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/admin/sessions/{sessionId}/meeting-log` | 미팅 로그 저장 |

## Admin - Discussion (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/sessions/{sessionId}/discussions` | 토론 목록 |
| POST | `/api/admin/sessions/{sessionId}/discussions` | 토론 생성 |
| PUT | `/api/admin/sessions/{sessionId}/discussions/{discussionId}` | 토론 수정 |
| DELETE | `/api/admin/sessions/{sessionId}/discussions/{discussionId}` | 토론 삭제 |

## Admin - Feedback (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/sessions/{sessionId}/feedback` | 세션 피드백 조회 |

## Admin - File Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/sessions/{sessionId}/files` | 파일 목록 (Admin) |
| DELETE | `/api/admin/sessions/{sessionId}/files/{fileKey+}` | 파일 삭제 (Admin) |
| POST | `/api/admin/sessions/{sessionId}/files/presigned-url/{fileKey+}` | Presigned URL 생성 |

## Admin - Campaign Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/campaigns` | 캠페인 생성 |
| GET | `/api/admin/campaigns` | 캠페인 목록 |
| GET | `/api/admin/campaigns/{campaignId}` | 캠페인 조회 |
| PUT | `/api/admin/campaigns/{campaignId}` | 캠페인 수정 |
| DELETE | `/api/admin/campaigns/{campaignId}` | 캠페인 삭제 |
| GET | `/api/admin/campaigns/{campaignId}/sessions` | 캠페인 세션 목록 |
| GET | `/api/admin/campaigns/{campaignId}/analytics` | 캠페인 분석 |

## Admin - Analytics (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/analytics/summary` | 캠페인 요약 분석 |
| GET | `/api/admin/analytics/comparison?campaignIds=id1,id2` | 캠페인 비교 분석 |

## Admin - Agent Configuration (Cognito Auth)

PreChat User가 배포된 3개 시스템 에이전트(prechat/summary/planning)에 구성을 주입합니다.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/agent-configs` | 에이전트 설정 생성 |
| GET | `/api/admin/agent-configs` | 에이전트 설정 목록 |
| GET | `/api/admin/agent-configs/{configId}` | 에이전트 설정 조회 |
| PUT | `/api/admin/agent-configs/{configId}` | 에이전트 설정 수정 |
| DELETE | `/api/admin/agent-configs/{configId}` | 에이전트 설정 삭제 |

### 구성 가능한 요소

- `agentRole`: prechat | summary | planning
- `modelId`: Bedrock Foundation Model ID
- `systemPrompt`: 에이전트 시스템 프롬프트
- `agentName`: 에이전트 표시 이름
- `campaignId`: 연결된 캠페인

## Admin - Trigger Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/triggers` | 트리거 생성 |
| GET | `/api/admin/triggers` | 트리거 목록 |
| GET | `/api/admin/triggers/templates` | 기본 템플릿 조회 |
| GET | `/api/admin/triggers/{triggerId}` | 트리거 조회 |
| PUT | `/api/admin/triggers/{triggerId}` | 트리거 수정 |
| DELETE | `/api/admin/triggers/{triggerId}` | 트리거 삭제 |

## Admin - User Management (Cognito Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | 사용자 목록 |
| GET | `/api/admin/users/{userId}` | 사용자 조회 |

## Admin - Migration (Cognito Auth, 임시)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/migrate/campaigns` | 캠페인 마이그레이션 |
| GET | `/api/admin/migrate/campaigns/verify` | 마이그레이션 검증 |

## Internal

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bedrock/aws-docs-action` | AWS 문서 Action Group |

## Event-Driven (API Gateway 외)

| Trigger | Description | Handler |
|---------|-------------|---------|
| DynamoDB Streams | 세션 테이블 변경 이벤트 처리 | `stream_handler.handle_session_stream` |
| SQS | AI 분석 비동기 처리 | `admin_handler.process_analysis` |
