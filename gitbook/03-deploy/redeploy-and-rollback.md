---
description: 코드를 고친 뒤 재배포하는 범위별 최적 경로와 롤백 방법
icon: arrows-rotate
---

# 재배포와 롤백

코드를 수정한 뒤 전체 스크립트를 다시 실행할 필요는 없습니다. 변경 범위에 맞는 재배포 경로를 선택하면 시간을 크게 절약할 수 있습니다.

## 변경 범위별 재배포

| 변경 대상 | 재배포 명령 | 소요 시간 |
|----------|-----------|---------|
| 프론트엔드 (`packages/web-app/`) | `./deploy-website.sh dev default ap-northeast-2 mte-prechat-workshop` | 2~4분 |
| 백엔드 도메인 디렉토리 (`session/`, `campaign/` 등) | `sam build && sam deploy` | 5~10분 |
| 공통 코드 (`shared/`) | `sam build && sam deploy` (Layer 전체 업데이트) | 8~12분 |
| `template.yaml` | `sam build && sam deploy` | 10~15분 |
| 에이전트 (`consultation-agent/`, `summary-agent/`) | `./packages/strands-agents/deploy-agents.sh` | 10~20분 |
| 전체 | `./deploy-full.sh` | 25~45분 |

## 프론트엔드만 재배포

{% tabs %}
{% tab title="CloudShell" %}
```bash
cd ~/sample-prechat-ai
./deploy-website.sh dev default ap-northeast-2 mte-prechat-workshop
```
{% endtab %}

{% tab title="로컬" %}
```bash
cd ~/sample-prechat-ai
./deploy-website.sh dev workshop ap-northeast-2 mte-prechat-workshop
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
CloudFront 캐시 무효화가 포함되지만 전파에 1~3분이 걸립니다. 브라우저 하드 리프레시(⌘+Shift+R 또는 Ctrl+F5)로 확인합니다.
{% endhint %}

## 백엔드만 재배포

Python 핸들러나 `template.yaml`을 수정한 경우:

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

`samconfig.toml`에 파라미터가 저장되어 있으면 단축 실행이 가능합니다.

```bash
sam build && sam deploy
```

## 에이전트만 재배포

에이전트의 프롬프트나 도구 설정은 **관리자 대시보드에서 즉시 변경 가능**하므로 재배포가 필요하지 않습니다.

에이전트 **컨테이너 코드(`agent.py`, `tool_registry.py` 등)**를 변경한 경우에만 재배포합니다.

```bash
./packages/strands-agents/deploy-agents.sh default dev ap-northeast-2
```

{% hint style="warning" %}
에이전트를 재배포하면 ARN이 바뀔 수 있습니다. 스크립트는 SSM 파라미터를 자동으로 갱신하지만, Lambda 함수가 이전 ARN을 캐시하고 있을 수 있으므로 SAM 재배포로 환경 변수를 다시 주입하는 것이 안전합니다.

```bash
sam deploy  # SSM의 최신 ARN을 resolve
```
{% endhint %}

## 롤백 방법

### CloudFormation 자동 롤백

`sam deploy`가 실패하면 CloudFormation이 자동으로 이전 상태로 롤백합니다. 별도 조치가 필요하지 않습니다.

### 수동 롤백 (이전 버전으로 되돌리기)

깃 히스토리에서 이전 커밋으로 되돌아가 재배포합니다.

```bash
git log --oneline -n 10      # 최근 커밋 확인
git checkout <old-commit-sha>
./deploy-full.sh default dev ap-northeast-2 ap-northeast-2 mte-prechat-workshop
```

복구 후 원래 브랜치로 복귀:

```bash
git checkout prsworkshop
```

### 에이전트 롤백

AgentCore는 런타임 버전을 자동으로 관리합니다. 이전 버전으로 돌아가려면:

{% stepper %}
{% step %}
### AgentCore 콘솔 → Runtime → 해당 에이전트 선택
{% endstep %}

{% step %}
### Versions 탭에서 이전 버전 찾기
{% endstep %}

{% step %}
### 이전 버전을 기본 엔드포인트로 설정
{% endstep %}

{% step %}
### SSM 파라미터를 이전 ARN으로 갱신 (필요 시)

```bash
aws ssm put-parameter \
  --name "/prechat/dev/agents/consultation/runtime-arn" \
  --value "arn:aws:bedrock-agentcore:ap-northeast-2:...:runtime/...:version/1" \
  --overwrite \
  --region ap-northeast-2
```
{% endstep %}

{% step %}
### Lambda 환경 변수 갱신

```bash
sam deploy
```
{% endstep %}
{% endstepper %}

## 다음 단계

재배포까지 익숙해졌다면 [관리자 계정 만들기](../04-admin/create-admin-account.md)로 이동해 실제 기능을 사용합니다.
