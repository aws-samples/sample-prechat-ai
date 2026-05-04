---
description: 워크샵 진행 중 유의할 보안 포인트와 예상 AWS 비용
icon: shield-halved
---

# 보안과 비용 고려사항

## 보안 고려사항

### 워크샵 브랜치의 제약

`prsworkshop` 브랜치는 배포 편의를 위해 **VPC 격리를 제거**했습니다. 프로덕션 환경에는 적합하지 않습니다.

{% hint style="warning" %}
**프로덕션 도입 시 반드시 main 브랜치를 기반으로 배포하세요.** main 브랜치는 Lambda를 Private Subnet에 배치하고 주요 AWS 서비스에 VPC Endpoint를 연결합니다.
{% endhint %}

### 인증과 권한

| 항목 | 기본 동작 | 프로덕션 강화 권장 |
|------|---------|----------------|
| 관리자 인증 | Cognito User Pool (이메일 + 비밀번호) | MFA 강제, IdP 연동 (SAML/OIDC) |
| 고객 인증 | 6자리 PIN | rate limit, WAF rule, 실패 횟수 잠금 |
| API 접근 | Cognito JWT + PIN | WAF (rate, geo, bot) 추가 |
| IAM 정책 | 도메인별 최소 권한 | 리소스 태그 기반 세분화 |

### 데이터 보호

- **저장 데이터** — DynamoDB KMS 암호화 (전용 CMK), S3 SSE-S3
- **전송 데이터** — HTTPS/WSS (TLS 1.2+)
- **세션 TTL** — 기본 30일 후 자동 삭제
- **PII** — 고객 이름, 이메일, 전화번호, 회사는 DynamoDB에 저장됨. 필요 시 마스킹/토큰화 레이어 추가 검토
- **인바운드 PIN** — HMAC-SHA256 해시로 저장 (평문 미저장)

### 민감 정보 관리

- **PinHashSecret** — 프로덕션에서 반드시 SAM 파라미터로 지정
- **Slack Webhook** — `SlackWebhookUrls` 파라미터를 Secrets Manager로 이전 검토
- **모델 ID** — 하드코딩하지 않고 환경 변수/DB 값으로 관리

### 대화 콘텐츠 보안

AI 에이전트에 입력되는 데이터는 Bedrock 모델 공급자의 정책을 따릅니다. 고객에게 다음을 안내합니다.

- 개인정보(주민번호, 신용카드 번호 등) 입력 금지
- 기밀 기업 정보 공유 전 내부 승인 확인
- 약관과 개인정보 처리방침 링크 제공

### 감사와 모니터링

워크샵 외에 다음을 프로덕션에 추가합니다.

- **CloudTrail** 데이터 이벤트 활성화
- **GuardDuty** 위협 탐지
- **Security Hub** 보안 표준 준수 점검
- **Lambda 함수별 X-Ray** 분산 추적

## 비용 고려사항

### 비용 드라이버

PreChat의 비용은 크게 다음으로 구성됩니다.

| 항목 | 비용 특성 |
|------|---------|
| **Bedrock 모델 호출** | 가장 큰 비중. 세션당 몇 센트~수십 센트 |
| **Bedrock AgentCore Runtime** | 실행 시간 및 메모리 기반 |
| **Lambda 호출** | 호출 수 및 실행 시간 |
| **DynamoDB** | On-demand 모드. 읽기/쓰기 수 기반 |
| **API Gateway** | 요청 수 및 WebSocket 연결 시간 |
| **CloudFront** | 트래픽 아웃바운드 |
| **S3** | 저장 용량과 요청 수 |
| **KMS** | 키 사용량 및 관리 요금 |

### 워크샵 예상 비용 (1인 기준)

약 **1~5 USD** 범위입니다.

| 시나리오 | 예상 비용 |
|---------|---------|
| 배포 후 세션 5~10개 체험 | 1~2 USD |
| 하루 종일 대화 연속 테스트 | 3~5 USD |
| 정리 완료 후 추가 비용 | 거의 없음 (KMS, S3 저장 잔여분) |

### 월간 예상 비용 (운영)

월 500 세션 기준:

| 항목 | 예상 월 비용 |
|------|-----------|
| Bedrock (Claude 3.5 Sonnet, 평균 5k 토큰/세션) | 50~100 USD |
| AgentCore Runtime | 20~50 USD |
| Lambda | 5~10 USD |
| DynamoDB | 5~15 USD |
| API Gateway + WebSocket | 10~20 USD |
| CloudFront + S3 | 5~10 USD |
| KMS + 기타 | 3~5 USD |
| **합계** | **약 100~210 USD/월** |

세션당 토큰 사용량, 모델 선택, 지역 트래픽에 따라 크게 달라집니다.

### 비용 절감 가이드

| 최적화 | 효과 |
|--------|-----|
| 모델을 Claude Haiku 또는 Nova Lite/Micro로 교체 | Bedrock 비용 50~80% 감소 |
| Summary Agent 재생성 횟수 제한 | 재호출 비용 절감 |
| 세션 TTL을 14일로 단축 | DynamoDB 저장 비용 감소 |
| Lambda ReservedConcurrency 조정 | 콜드스타트 감수 시 비용 감소 |
| CloudWatch Logs Retention 7일 설정 | 로그 저장 비용 감소 |
| Knowledge Base 인덱스 주기 조정 | 임베딩 호출 비용 감소 |

### 비용 모니터링

{% stepper %}
{% step %}
### AWS Budgets 설정

계정 기본 경보: 월 50 USD 초과 시 알림
{% endstep %}

{% step %}
### Cost Explorer로 태그별 확인

스택의 모든 리소스에 공통 태그(예: `Project=PreChat`)를 추가하면 태그 기준 비용 분리가 가능합니다.
{% endstep %}

{% step %}
### Bedrock CloudWatch 지표 추적

`ModelInvocations`, `InputTokenCount`, `OutputTokenCount` 지표로 모델 호출 추세 관찰
{% endstep %}
{% endstepper %}

### 무료/크레딧 활용

- AWS Free Tier — Lambda, DynamoDB, CloudFront의 초기 무료 한도
- AWS Activate 크레딧 — 스타트업/파트너
- Bedrock Marketplace 프로모션 크레딧

AWS 담당자에게 크레딧 가능성을 문의해 워크샵과 초기 운영 비용을 줄일 수 있습니다.

## 정리 체크리스트

워크샵 후 리소스를 확실히 정리하려면 [Cleanup 가이드](../08-ops/cleanup.md)를 따릅니다.
