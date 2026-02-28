# PreChat Web App

Last Updated: 2026-02-28

React SPA — Vite + AWS Cloudscape Design System + TypeScript

## 개발

```bash
yarn install          # 의존성 설치
yarn dev              # 개발 서버 (포트 5173)
yarn build            # 프로덕션 빌드
yarn lint             # ESLint + Prettier
yarn test             # Vitest (단일 실행)
```

## 라우트

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/` | WelcomeScreen (캠페인 코드 입력) | 없음 |
| `/customer/:sessionId` | CustomerChat (고객 채팅) | PIN 6자리 |
| `/admin` | AdminDashboard (세션 목록) | Cognito JWT |
| `/admin/sessions/create` | CreateSession | Cognito JWT |
| `/admin/sessions/:sessionId` | AdminSessionDetails | Cognito JWT |
| `/admin/campaigns` | CampaignDashboard | Cognito JWT |
| `/admin/campaigns/create` | CreateCampaign | Cognito JWT |
| `/admin/campaigns/:campaignId` | CampaignDetails | Cognito JWT |
| `/admin/campaigns/:campaignId/edit` | EditCampaign | Cognito JWT |
| `/admin/agents` | AgentsDashboard | Cognito JWT |
| `/admin/agents/create` | CreateAgent | Cognito JWT |
| `/admin/agents/:agentId/edit` | EditAgent | Cognito JWT |
| `/admin/triggers` | TriggerDashboard | Cognito JWT |
| `/admin/customization` | CustomizationPanel | Cognito JWT |
| `/login` | Login (Cognito 인증) | 없음 |

## src/ 구조

```
src/
├── components/          # 재사용 UI 컴포넌트 (40+ 파일)
│   ├── ChatMessage.tsx           # 대화 메시지 렌더링
│   ├── StreamingChatMessage.tsx  # 스트리밍 응답 표시
│   ├── MultilineChatInput.tsx    # 메시지 입력
│   ├── FeedbackModal.tsx         # CSAT 피드백 (별점 + 텍스트)
│   ├── FileUpload.tsx            # 파일 업로드 모달
│   ├── ConsultationPurposeSelector.tsx  # 상담 목적 선택
│   ├── AIAnalysisReport.tsx      # BANT 분석 리포트
│   ├── PlanningChatTab.tsx       # Planning Agent 채팅 탭
│   ├── MeetingLogView.tsx        # 미팅 로그 뷰
│   ├── DivReturnRenderer.tsx     # 에이전트 HTML Form 렌더링
│   ├── CampaignMetricsCards.tsx  # 캠페인 지표 카드
│   ├── DiscussionTab.tsx         # 팀 디스커션 탭
│   └── ...
├── pages/
│   ├── admin/           # 관리자 페이지 (13 파일)
│   ├── auth/            # Login.tsx
│   └── customer/        # CustomerChat.tsx
├── hooks/               # 커스텀 훅
│   ├── useChat.ts              # WebSocket 기반 메시지 전송/스트리밍
│   ├── useSession.ts           # 세션 데이터 로드/상태 관리
│   ├── useWebSocket.ts         # WebSocket 연결 관리
│   ├── usePlanningWebSocket.ts # Planning Agent WebSocket
│   ├── useCustomization.ts     # UI 커스터마이징
│   └── useFormSubmission.ts    # Div Return 폼 제출
├── services/            # API 통신 (Axios)
├── contexts/            # React Context (Auth, I18n, Customization)
├── i18n/                # 다국어 시스템
├── types/               # 공유 타입 정의 (index.ts)
├── constants/           # 상수 (SESSION_STATUS 등)
├── utils/               # 순수 함수/헬퍼
├── config/              # API URL 등 설정
├── styles/              # 전역 CSS
├── assets/              # 정적 자산
└── test/                # 테스트 설정
```

## 주요 기능

### 고객 채팅 (CustomerChat)
- PIN 인증 → 상담 목적 선택 → AI 챗봇 대화
- WebSocket SSE 스트리밍 응답
- Div Return: 에이전트가 HTML Form을 동적 생성 → 고객이 입력 → 메시지로 전송
- 파일 첨부 (S3 presigned URL)
- 세션 완료 시: CSAT 피드백 모달 (X로 닫기 가능) + 추가 액션 패널 (대화 재개, 피드백 전송)

### 관리자 대시보드
- 세션/캠페인/에이전트 CRUD
- AI 분석 리포트 (BANT + AWS 서비스 추천)
- 미팅 로그 작성 + 재분석
- Planning Agent 채팅 (Sales Rep 미팅 준비)
- 캠페인 분석 (차트, 비교, CSAT)
- 이벤트 트리거 관리 (Slack/SNS)
- 팀 디스커션

## 다국어 (i18n)

번역 파일: `public/i18n/locales/`

| 파일 | 용도 |
|------|------|
| `locale.en.json` | 영어 (운영) |
| `locale.ko.json` | 한국어 (운영) |
| `en.json` / `ko.json` | 레거시 |

```bash
yarn extract-text           # 코드에서 번역 키 추출
yarn manage-translations    # 번역 파일 관리
yarn validate-translations  # 번역 검증
yarn build:optimized        # 번역 검증 후 빌드
```

## 환경 변수

| 파일 | 용도 |
|------|------|
| `.env.development` | 로컬 개발 |
| `.env.production` | 프로덕션 빌드 |

필수 키 (`VITE_` 접두사):
- `VITE_API_URL` — API Gateway URL
- `VITE_WS_URL` — WebSocket URL
- `VITE_REGION` — AWS 리전
- `VITE_USER_POOL_ID` — Cognito User Pool ID
- `VITE_USER_POOL_CLIENT_ID` — Cognito Client ID

## 코드 스타일

- Prettier: 세미콜론, 작은따옴표, 후행 쉼표 es5, 줄 너비 80, 2 spaces
- ESLint: `@typescript-eslint/no-unused-vars` error, `no-explicit-any` warn
- 컴포넌트: PascalCase `.tsx`, 훅: `use` 접두사 camelCase `.ts`
- barrel export: 각 디렉토리 `index.ts`에 re-export
- 테스트: `__tests__/` 하위에 co-locate
