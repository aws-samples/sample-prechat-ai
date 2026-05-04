---
description: deploy-full.sh를 사용해 Strands 에이전트, SAM 인프라, 프론트엔드를 한 번에 배포
icon: rocket
---

# 에이전트 → SAM → 프론트엔드 배포

`deploy-full.sh` 스크립트가 배포를 자동화합니다. 내부적으로 다음 순서로 실행됩니다.

{% stepper %}
{% step %}
### Strands 에이전트를 AgentCore에 배포

`packages/strands-agents/deploy-agents.sh`가 Consultation Agent, Summary Agent를 Docker 이미지로 빌드하여 Bedrock AgentCore Runtime에 배포합니다. 배포 결과 ARN은 SSM Parameter Store에 등록됩니다.
{% endstep %}

{% step %}
### SAM 빌드 & 배포

`sam build` 후 `sam deploy`로 CloudFormation 스택을 생성/업데이트합니다. Lambda는 SSM에서 에이전트 ARN을 resolve하여 환경 변수로 주입받습니다.
{% endstep %}

{% step %}
### 환경 변수 갱신

`update-env-vars.sh`가 CloudFormation Outputs에서 API URL, WebSocket URL을 가져와 `packages/web-app/.env.{stage}` 파일을 갱신합니다.
{% endstep %}

{% step %}
### 프론트엔드 빌드 & 업로드

`deploy-website.sh`가 Vite 프로덕션 빌드를 수행하고 S3로 업로드한 뒤 CloudFront 캐시를 무효화합니다.
{% endstep %}
{% endstepper %}

## 1. 기본 배포 실행

CloudShell은 로그인된 IAM 자격증명을 쓰므로 `default` 프로필을 사용합니다.

```bash
cd ~/sample-prechat-ai
./deploy-full.sh default dev ap-northeast-2 ap-northeast-2 mte-prechat-workshop
```

## 2. 스크립트 파라미터

`deploy-full.sh`는 5개의 위치 인자를 받습니다.

| 순서 | 파라미터 | 기본값 | 설명 |
|------|---------|-------|-----|
| 1 | AWS_PROFILE | `default` | AWS CLI 프로필 이름 |
| 2 | STAGE | `dev` | 배포 환경 (`dev` 또는 `prod`) |
| 3 | REGION | `ap-northeast-2` | 인프라 배포 리전 |
| 4 | BEDROCK_REGION | REGION과 동일 | Bedrock 모델 호출 리전 |
| 5 | STACK_NAME | `mte-prechat` | CloudFormation 스택 이름 |

## 3. 진행 중 확인할 출력

{% stepper %}
{% step %}
### 에이전트 배포 시작

```
🤖 Deploying Strands Agents to AgentCore...
📦 Deploying consultation agent...
```

Docker 이미지 빌드가 CodeBuild에서 진행되며 10~20분 걸립니다. 로그에 `✅ consultation agent deployed: arn:aws:bedrock-agentcore:...`가 나타나면 성공입니다.
{% endstep %}

{% step %}
### SSM 파라미터 등록

```
📝 Registering ARN in SSM: /prechat/dev/agents/consultation/runtime-arn
✅ SSM parameter registered: ...
```

두 에이전트가 모두 등록된 후 SAM 배포로 진행됩니다.
{% endstep %}

{% step %}
### SAM 빌드와 배포

```
🔨 Building SAM application...
🏗️  Deploying infrastructure...
```

CloudFormation 변경 세트를 생성한 후 "Deploy this changeset?" 확인 프롬프트가 뜰 수 있습니다. `y`를 입력합니다.

{% hint style="info" %}
`samconfig.toml`에서 `confirm_changeset = true`로 설정되어 있어 확인이 필요합니다. 자동화가 필요하면 `samconfig.toml`을 `confirm_changeset = false`로 수정하세요.
{% endhint %}
{% endstep %}

{% step %}
### 환경 변수와 프론트엔드 배포

```
🔧 Updating environment variables...
🌐 Building and deploying website...
```

Vite 빌드와 S3 업로드, CloudFront 무효화까지 완료됩니다.
{% endstep %}

{% step %}
### 최종 요약

```
📋 Deployment Summary:
   🔗 API URL: https://xxxx.execute-api.ap-northeast-2.amazonaws.com/dev/api
   🌐 Website URL: https://dxxx.cloudfront.net
   🌍 Region: ap-northeast-2
```

**Website URL을 기록해 두세요.** 이 URL이 관리자와 고객이 접근하는 주소입니다.
{% endstep %}
{% endstepper %}

## 4. 배포 시간 기대치

| 단계 | 소요 시간 |
|------|---------|
| 에이전트 배포 (Docker 빌드 + AgentCore 등록, 2개) | 10~20분 |
| SAM 빌드 | 2~5분 |
| SAM 배포 (CloudFormation) | 10~15분 |
| 프론트엔드 빌드 & S3 업로드 | 1~2분 |
| CloudFront 캐시 무효화 | 1~3분 |
| **합계** | **25~45분** |

첫 배포가 가장 오래 걸립니다. 재배포는 변경 범위에 따라 수 분 내 끝납니다.

## 5. 단계별 개별 실행

문제가 발생해 중단됐을 때 단계를 나누어 재실행할 수 있습니다.

{% tabs %}
{% tab title="에이전트만" %}
```bash
./packages/strands-agents/deploy-agents.sh default dev ap-northeast-2
```
{% endtab %}

{% tab title="SAM만" %}
```bash
sam build
sam deploy \
  --profile default \
  --region ap-northeast-2 \
  --stack-name mte-prechat-workshop \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides "Stage=dev BedrockRegion=ap-northeast-2"
```
{% endtab %}

{% tab title="프론트엔드만" %}
```bash
./update-env-vars.sh default dev ap-northeast-2 mte-prechat-workshop
./deploy-website.sh dev default ap-northeast-2 mte-prechat-workshop
```
{% endtab %}
{% endtabs %}

## 6. 파라미터 커스터마이즈

### 관리자 이메일 도메인 제한

`AllowedEmailDomains` 파라미터로 가입 가능한 이메일 도메인을 제한합니다.

```bash
sam deploy \
  --parameter-overrides "Stage=dev BedrockRegion=ap-northeast-2 AllowedEmailDomains=mycompany.com,partner.com"
```

### 인바운드 캠페인 PIN 해시 시크릿

인바운드 캠페인 PIN은 HMAC-SHA256으로 해시되어 저장됩니다. `PinHashSecret`을 프로덕션에서는 반드시 지정합니다.

```bash
sam deploy \
  --parameter-overrides "PinHashSecret=your-strong-secret-here"
```

{% hint style="warning" %}
`PinHashSecret`이 비어 있으면 기본 폴백 문자열이 사용됩니다. 워크샵 체험에는 무방하지만 프로덕션에는 반드시 시크릿을 지정하세요.
{% endhint %}

## 다음 단계

배포가 완료되면 [배포 결과 검증](verify-deployment.md)으로 이동합니다.
