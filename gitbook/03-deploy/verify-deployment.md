---
description: 배포가 성공했는지 확인하고 주요 엔드포인트 동작을 점검
icon: circle-check
---

# 배포 결과 검증

배포가 완료되면 아래 순서로 정상 동작을 확인합니다.

## 1. CloudFormation 스택 상태

```bash
aws cloudformation describe-stacks \
  --stack-name mte-prechat-workshop \
  --region ap-northeast-2 \
  --query 'Stacks[0].StackStatus'
```

`CREATE_COMPLETE` 또는 `UPDATE_COMPLETE`가 출력되어야 합니다.

## 2. 주요 Outputs 확인

```bash
aws cloudformation describe-stacks \
  --stack-name mte-prechat-workshop \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL` || OutputKey==`ApiUrl` || OutputKey==`WebSocketUrl`].[OutputKey,OutputValue]' \
  --output table
```

출력 예시:

```
|   OutputKey    |                         OutputValue                         |
|----------------|-------------------------------------------------------------|
|  ApiUrl        |  https://xxxx.execute-api.ap-northeast-2.amazonaws.com/dev  |
|  WebSocketUrl  |  wss://yyyy.execute-api.ap-northeast-2.amazonaws.com/dev    |
|  WebsiteURL    |  https://dxxx.cloudfront.net                                |
```

세 URL이 모두 채워져 있어야 합니다.

## 3. SSM 파라미터 확인

에이전트 ARN이 SSM에 제대로 등록됐는지 봅니다.

```bash
aws ssm get-parameters-by-path \
  --path "/prechat/dev/agents" \
  --recursive \
  --region ap-northeast-2 \
  --query 'Parameters[].{Name:Name,Value:Value}' \
  --output table
```

`consultation/runtime-arn`과 `summary/runtime-arn` 두 항목이 있어야 합니다.

## 4. 웹사이트 접속

브라우저에서 `WebsiteURL`을 열어 PreChat 첫 화면이 로드되는지 확인합니다.

**[사진첨부]** PreChat 랜딩 페이지 (캠페인 코드 입력 화면)

화면이 비어 있거나 `Network Error`가 뜨면 CloudFront 캐시 무효화가 완료되지 않았을 수 있습니다. 1~3분 기다린 뒤 새로고침합니다.

## 5. API 헬스 체크

API Gateway가 응답하는지 간단히 테스트합니다.

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name mte-prechat-workshop \
  --region ap-northeast-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# 존재하지 않는 캠페인 코드 조회 → 404 응답이면 API가 동작 중
curl -i "${API_URL}/api/campaigns/code/NONEXISTENT"
```

`HTTP/2 404`와 JSON 바디가 반환되면 API가 정상 동작 중입니다. `502 Bad Gateway`나 타임아웃이 나오면 Lambda 로그를 확인합니다.

## 6. Lambda 로그 확인 (이슈 시)

```bash
# 함수 목록
aws lambda list-functions \
  --region ap-northeast-2 \
  --query 'Functions[?contains(FunctionName, `mte-prechat`)].FunctionName' \
  --output table
```

특정 함수의 최근 로그 확인:

```bash
sam logs -n CampaignHandlerFunction --stack-name mte-prechat-workshop --tail
```

## 7. 에이전트 런타임 확인

AgentCore 콘솔에서 에이전트 상태를 봅니다.

{% stepper %}
{% step %}
### Bedrock 콘솔 열기

AWS Console → **Amazon Bedrock** → 좌측 **AgentCore** → **Runtime**
{% endstep %}

{% step %}
### 배포된 에이전트 확인

`prechat-consultation-agent-dev`, `prechat-summary-agent-dev`와 유사한 이름의 런타임 두 개가 `Status: READY` 상태여야 합니다.

**[사진첨부]** AgentCore Runtime 목록 화면
{% endstep %}

{% step %}
### Runtime 상세에서 로그 탭 확인

컨테이너 시작 로그가 정상 출력되었는지 확인합니다.

**[사진첨부]** Runtime 상세 → Logs 탭
{% endstep %}
{% endstepper %}

## 검증 체크리스트

- [ ] CloudFormation 스택이 `CREATE_COMPLETE`/`UPDATE_COMPLETE`
- [ ] 웹사이트 URL이 200으로 응답하고 랜딩 화면이 표시됨
- [ ] API URL의 `/api/campaigns/code/xxx` 호출이 404 JSON을 반환
- [ ] SSM에 두 에이전트 ARN 파라미터가 등록됨
- [ ] AgentCore 콘솔에 두 에이전트 런타임이 READY 상태

모두 통과하면 [관리자 계정 만들기](../04-admin/create-admin-account.md)로 이동합니다.
