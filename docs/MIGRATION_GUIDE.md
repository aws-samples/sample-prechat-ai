# PreChat API Migration Guide

## 레거시 → 도메인 기반 API 마이그레이션

### 변경 사항

| 기존 | 신규 | 비고 |
|------|------|------|
| `POST /api/chat/message` | `POST /api/sessions/{sessionId}/messages` | sessionId가 path parameter로 이동 |
| `POST /api/chat/stream` | `POST /api/sessions/{sessionId}/messages/stream` | 동일 |
| `GET /api/chat/session/{sessionId}` | `GET /api/sessions/{sessionId}` | 경로 단순화 |
| `POST /api/chat/session/{sessionId}/verify-pin` | `POST /api/sessions/{sessionId}/verify-pin` | 경로 단순화 |
| `POST /api/chat/session/{sessionId}/feedback` | `POST /api/sessions/{sessionId}/feedback` | 경로 단순화 |
| `PUT /api/chat/session/{sessionId}/purposes` | `PUT /api/sessions/{sessionId}/consultation-purposes` | 경로명 명확화 |

### 마이그레이션 절차

1. 프론트엔드 API 클라이언트를 새 엔드포인트로 업데이트
2. 레거시 엔드포인트 호출이 없는지 확인 (X-Deprecated 헤더 모니터링)
3. 충분한 기간 후 레거시 엔드포인트 제거

### 롤백 계획

레거시 엔드포인트는 내부적으로 새 핸들러를 호출하므로, 프론트엔드만 이전 버전으로 롤백하면 됩니다.
