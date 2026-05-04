---
description: PreChat 워크샵 진행 중 자주 묻는 질문과 답변
icon: circle-question
---

# 자주 묻는 질문

## 일반

### 이 워크샵을 진행하는 데 AWS 비용이 얼마나 드나요?

Bedrock 모델 호출이 대부분의 비용을 차지합니다. 워크샵 체험(1~2 시간, 10개 미만 세션) 기준 약 1~5 USD 수준입니다. 상세는 [비용 고려사항](../appendix/security-and-cost.md)을 참고하세요.

### prsworkshop 브랜치는 언제 main에 병합되나요?

`prsworkshop`은 워크샵 전용 브랜치로, VPC 격리가 제거되어 있습니다. 프로덕션 환경에는 main 브랜치를 쓰는 것을 권장하므로, `prsworkshop`은 main에 병합되지 않습니다.

### 에이전트 프롬프트를 변경하면 재배포해야 하나요?

아닙니다. 에이전트 프롬프트, 모델 ID, 도구 구성은 **관리자 대시보드에서 실시간으로 수정**되며 재배포가 필요하지 않습니다. 에이전트 컨테이너 코드(`agent.py` 등)를 변경한 경우에만 `deploy-agents.sh`를 다시 실행합니다.

### 한 AWS 계정에 여러 스테이지를 배포할 수 있나요?

예. `STAGE` 파라미터를 다르게 지정하면 리소스 이름에 스테이지 접미사가 붙어 충돌 없이 공존합니다.

```bash
./deploy-full.sh workshop dev ap-northeast-2 ap-northeast-2 mte-prechat-dev
./deploy-full.sh workshop prod ap-northeast-2 ap-northeast-2 mte-prechat-prod
```

## 배포

### `sam deploy`가 "changeset has no changes"로 실패해요

이전 배포와 비교해 변경 사항이 없다는 의미입니다. 정상 상황이며 배포 자체는 성공으로 간주됩니다. `deploy-full.sh`는 이 경우에도 계속 진행합니다.

### CloudFront URL이 열리지 않아요

- 배포 직후 CloudFront 배포 생성에 10~15분이 걸릴 수 있습니다.
- 캐시 무효화 후 브라우저 하드 리프레시(⌘+Shift+R)를 시도합니다.
- CloudFormation 스택이 `CREATE_COMPLETE` 상태인지 확인합니다.

### 에이전트 배포가 `CodeBuild timeout`으로 실패해요

첫 빌드는 Docker 레이어 캐시가 없어 오래 걸립니다. `deploy-agents.sh`를 한 번 더 실행하면 캐시가 사용되어 성공하는 경우가 많습니다.

### 다른 리전으로 옮기려면?

기존 스택을 삭제하고 새 리전으로 전체 재배포합니다.

```bash
# 기존 정리
aws cloudformation delete-stack --stack-name mte-prechat-workshop --region ap-northeast-2

# 새 리전 배포
./deploy-full.sh default dev us-west-2 us-west-2 mte-prechat-workshop
```

## 기능

### 인바운드 캠페인 PIN을 분실했어요

PIN은 HMAC-SHA256 해시로만 저장되므로 조회가 불가능합니다. 관리자가 캠페인을 편집하여 **새 PIN으로 교체**하고 재공유하세요. 기존 진행 중 세션에는 영향이 없습니다.

### 세션 PIN을 여러 번 틀렸어요. 잠기나요?

현재 빌드에는 rate limit이 완화되어 있습니다. 프로덕션 운영 시에는 WAF 또는 Cognito Advanced Security로 추가 보호를 검토하세요.

### 고객이 대화 중간에 나갔다가 다시 들어올 수 있나요?

예. 세션 URL과 PIN만 있으면 같은 세션에 다시 진입합니다. 대화 히스토리가 유지됩니다.

### 대화를 종료하지 않으면 AI 리포트는 언제 생성되나요?

세션이 `Completed` 상태로 전환되어야 리포트 파이프라인이 시작됩니다. 고객이 `End conversation`을 누르거나, 관리자가 **Inactivate**를 눌러 수동 종료하면 됩니다.

### Knowledge Base 없이도 에이전트가 동작하나요?

예. `retrieve` 도구를 활성화하지 않으면 KB 없이 작동합니다. 이 경우 에이전트는 모델 자체 지식과 `aws_docs_mcp`(활성화 시)에만 의존합니다.

## 운영

### 로그는 어디서 보나요?

| 로그 | 위치 |
|------|------|
| Lambda | CloudWatch Logs `/aws/lambda/mte-prechat-*` |
| AgentCore 에이전트 | Bedrock 콘솔 → AgentCore → Runtime → Logs 탭 |
| API Gateway | CloudWatch Logs (CloudWatch 로깅 활성화 시) |
| WebSocket | Lambda 로그와 동일 |

### 세션 데이터는 언제 자동 삭제되나요?

DynamoDB TTL 기본 30일 후 자동 삭제됩니다. `shared/utils.py`에서 TTL 계산 로직을 확인할 수 있습니다.

### 수동으로 데이터를 내보내려면?

DynamoDB 콘솔에서 `Export to S3`를 사용하거나, Lambda에서 직접 Scan API로 CSV/JSON을 생성합니다. 대량이라면 DynamoDB Streams → Kinesis Firehose → S3 파이프라인을 구성하세요.

## 개발

### 프론트엔드 로컬 개발 서버를 띄우려면?

```bash
cd packages/web-app
npm run dev
```

포트 5173에서 열립니다. 백엔드는 배포된 API Gateway를 가리킵니다.

### 백엔드 Lambda를 로컬에서 디버깅하려면?

```bash
sam local invoke SessionHandlerFunction -e events/create-session.json
sam local start-api
```

로컬 실행은 Docker가 필요합니다. AgentCore 호출은 실제 AWS 리소스를 사용합니다.

### 언어 번역을 수정하려면?

```bash
cd packages/web-app
# public/i18n/locales/locale.ko.json 편집
npm run validate-translations
npm run build:optimized
```

배포는 `deploy-website.sh` 한 줄이면 충분합니다.

## 그 외

### 워크샵을 팀 내부에 공유해도 되나요?

예. 레포지토리는 MIT-0 라이선스이므로 저작자 표시 없이 자유롭게 사용/수정/배포 가능합니다.

### 이 gitbook 문서의 오타나 잘못된 스크린샷을 어떻게 제보하나요?

레포지토리 이슈 또는 PR로 제안해주세요. 스크린샷이 `[사진첨부]` 자리표시자로 남아 있는 부분은 실제 환경에서 추가로 캡처가 필요한 항목입니다.
