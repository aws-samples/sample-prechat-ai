---
description: 배포와 운영 중 자주 만나는 문제와 해결 방법
icon: wrench
---

# 문제 해결 가이드

가장 흔히 발생하는 문제를 증상별로 정리했습니다. 해결이 어려우면 먼저 CloudWatch Logs에서 관련 함수의 에러 메시지를 확인하세요.

## 배포 단계

### `deploy-agents.sh`가 "CodeBuild: build timed out"

Docker 빌드가 처음 실행될 때 캐시가 없어 오래 걸립니다.

**해결**

1. CodeBuild 콘솔에서 이전 빌드 로그를 확인
2. 대부분 네트워크 지연 또는 의존성 설치 실패 — 한 번 더 실행하면 성공
3. 지속적으로 실패한다면 Dockerfile의 `pip install` 명령에 `--no-cache-dir` 추가

### SAM `resolve:ssm` 파라미터 에러

```
Parameter name: cannot find SSM parameter /prechat/dev/agents/consultation/runtime-arn
```

에이전트 배포가 먼저 완료되어야 SAM 배포가 파라미터를 resolve합니다.

**해결**

```bash
# 1. 에이전트 배포
./packages/strands-agents/deploy-agents.sh default dev ap-northeast-2

# 2. SSM 확인
aws ssm get-parameters-by-path --path /prechat/dev/agents --recursive --region ap-northeast-2

# 3. SAM 재배포
sam deploy
```

### CloudFront 배포가 "InProgress"에서 멈춰 있음

CloudFront 생성은 기본적으로 15~30분 걸립니다. 정상 동작이며 기다리면 됩니다.

### CloudFormation 스택이 `ROLLBACK_COMPLETE`

스택 생성 중 에러가 발생해 롤백된 상태입니다. 재배포 전에 **스택을 삭제**해야 합니다.

```bash
aws cloudformation delete-stack --stack-name mte-prechat-workshop --region ap-northeast-2
aws cloudformation wait stack-delete-complete --stack-name mte-prechat-workshop --region ap-northeast-2
```

삭제 후 다시 `./deploy-full.sh`를 실행합니다.

### "insufficient permissions to perform bedrock:InvokeModel"

Bedrock 모델 액세스가 승인되지 않았습니다.

**해결**

[Bedrock 모델 액세스 승인](../02-setup/bedrock-model-access.md)을 다시 진행하고, 배포 리전과 `BEDROCK_REGION`이 일치하는지 확인합니다.

## 관리자 로그인

### 인증 코드 이메일이 오지 않음

- 스팸/광고 함 확인
- Cognito가 SES 샌드박스를 사용하면 일일 발송 건수 제한이 있습니다
- 관리자 권한으로 Cognito 콘솔 → Users → 해당 사용자 → **Confirm account**로 우회 확인

### "UsernameExistsException"

이미 해당 이메일로 가입되어 있습니다. 로그인 화면에서 **Forgot password?**로 비밀번호를 재설정합니다.

### "Email domain not allowed"

`AllowedEmailDomains` 파라미터에 해당 도메인이 포함되지 않았습니다.

**해결**

```bash
sam deploy \
  --parameter-overrides "Stage=dev BedrockRegion=ap-northeast-2 AllowedEmailDomains=amazon.com,mycompany.com"
```

## 캠페인과 세션

### 캠페인 생성 후 "Agent not prepared" 에러

에이전트의 상태가 `PREPARED`가 아닙니다.

**해결**

대시보드 → Agents → 해당 에이전트 → **Prepare** 버튼. Status가 `PREPARED`로 바뀐 뒤 캠페인을 재시도합니다.

### 고객 URL 접속 시 404

- URL의 `campaignCode`나 `sessionId`가 유효한지 확인
- 캠페인이 `Active` 상태이고 기간이 유효한지 확인
- 세션 TTL이 지나지 않았는지 확인

### PIN 검증 실패가 반복

- 아웃바운드: 세션 상세에서 PIN 재확인
- 인바운드: 관리자에게 캠페인 PIN 재공유 요청. 해시되어 저장되므로 원문 조회 불가

## 대화

### 고객이 메시지를 보내도 응답이 없음

**1. WebSocket 연결 상태 확인**

브라우저 개발자 도구 → Network → WS 탭에서 연결이 열려 있는지 확인합니다.

**2. CloudWatch에서 `WebSocketSendMessageFunction` 로그 확인**

```bash
sam logs -n WebSocketSendMessageFunction --stack-name mte-prechat-workshop --tail
```

**3. AgentCore 런타임 상태 확인**

Bedrock 콘솔 → AgentCore → Runtime → 해당 에이전트 Status가 `READY`인지 확인.

**4. Bedrock 모델 액세스**

에이전트에서 사용하는 모델의 액세스가 여전히 `Access granted`인지 재확인.

### 응답이 중간에 끊김

Lambda 타임아웃(300초)에 도달했거나 WebSocket 연결이 끊긴 경우입니다. 브라우저에서 새로고침하면 대화가 복원됩니다.

### AI가 이상하거나 무관한 답변

- 시스템 프롬프트가 명확한지 점검
- 모델을 더 큰 모델(Claude Sonnet 4, Nova Pro)로 업그레이드
- 도구 선택을 점검 — 불필요한 도구가 많으면 혼동 유발

## AI 리포트

### 리포트가 생성되지 않음

**1. 세션이 `Completed` 상태인지 확인**

세션이 여전히 `Active` 상태이면 리포트가 생성되지 않습니다.

**2. Summary Agent 런타임 상태 확인**

Bedrock 콘솔 → AgentCore → `prechat-summary-agent-*` Status 확인

**3. Stream Handler 로그**

```bash
sam logs -n SessionStreamHandler --stack-name mte-prechat-workshop --tail
```

세션 완료 이벤트 처리 중 에러가 있는지 봅니다.

### 리포트 언어가 영어로 나옴

에이전트 구성의 `locale` 설정이 `en`으로 되어 있습니다. 한국어 원하면 `ko`로 변경합니다.

## 비용/성능

### Lambda cold start가 느림

- `ReservedConcurrentExecutions`를 낮추면 cold start 빈도 증가
- 자주 호출되는 함수만 Provisioned Concurrency 추가 검토

### Bedrock 비용이 예상보다 높음

- CloudWatch에서 `BedrockInvocations` 지표 확인
- 에이전트 기본 모델을 Nova Lite 또는 Claude Haiku 계열로 교체
- `retrieve` 호출 수와 KB 크기를 점검

## 기타

### DynamoDB에서 세션이 보이지 않음

TTL이 지났거나 수동 삭제된 경우입니다. 한 번 만료된 항목은 복구할 수 없습니다.

### CloudShell 디스크 부족

```bash
rm -rf ~/.aws-sam ~/sample-prechat-ai/node_modules
du -sh ~/* | sort -h
```

`node_modules`는 재설치 가능하므로 용량 문제 시 우선 삭제합니다.

## 더 도움이 필요하다면

- [자주 묻는 질문](faq.md) — 개념/운영 관련 Q&A
- 레포지토리 이슈 트래커 — 버그 리포트
- AWS Support — 인프라/서비스 관련 지원
