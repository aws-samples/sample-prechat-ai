---
description: Amazon Bedrock 파운데이션 모델 액세스 승인 절차
icon: key
---

# Bedrock 모델 액세스 승인

PreChat의 AI 에이전트는 Amazon Bedrock을 통해 파운데이션 모델을 호출합니다. 배포 전에 사용할 모델의 액세스를 승인받아야 합니다.

## 승인 절차

{% stepper %}
{% step %}
### Bedrock 콘솔에서 배포 리전을 선택한다

AWS Console → **Amazon Bedrock** → 우측 상단 리전 셀렉터에서 배포에 사용할 리전(예: `ap-northeast-2`)을 선택합니다.

**[사진첨부]** Bedrock 콘솔 홈 + 리전 셀렉터 화면
{% endstep %}

{% step %}
### Model access 페이지로 이동한다

좌측 메뉴 → **Bedrock configurations** → **Model access**

**[사진첨부]** Model access 메뉴 경로
{% endstep %}

{% step %}
### 모델 액세스를 요청한다

우측 상단 **Modify model access** (또는 **Enable specific models**) 버튼을 클릭합니다.

**[사진첨부]** Modify model access 버튼 위치
{% endstep %}

{% step %}
### 필요한 모델을 선택한다

다음 모델 중 **최소 한 가지**를 선택합니다.

- **Anthropic Claude 3.5 Sonnet** 또는 **Claude Sonnet 4** (권장)
- **Amazon Nova Pro / Lite / Micro**

Anthropic 모델은 사용 사례 기재 폼을 요구할 수 있습니다. 회사명과 사용 목적을 간결히 기재합니다.

**[사진첨부]** 모델 선택 체크리스트 화면
{% endstep %}

{% step %}
### 요청을 제출하고 승인을 기다린다

제출 후 상태가 **In progress** → **Access granted**로 바뀝니다. 대부분 즉시 승인되며, 일부 모델은 몇 분 걸릴 수 있습니다.

**[사진첨부]** Access granted 상태 화면
{% endstep %}
{% endstepper %}

## 배포 리전과 Bedrock 리전 분리

`deploy-full.sh`는 `BEDROCK_REGION` 파라미터로 Bedrock 호출 리전을 별도로 지정할 수 있습니다. 인프라는 `ap-northeast-2`에 있지만 Bedrock 모델은 `us-west-2`를 사용하고 싶다면:

```bash
./deploy-full.sh default dev ap-northeast-2 us-west-2 mte-prechat
```

{% hint style="info" %}
Bedrock 모델 가용성은 리전마다 다릅니다. 원하는 모델이 배포 리전에 없다면 가용 리전(`us-east-1`, `us-west-2` 등)을 `BEDROCK_REGION`으로 지정하세요. 단, 동일 리전 사용이 레이턴시와 데이터 이동 관점에서 유리합니다.
{% endhint %}

## AgentCore Runtime 가용성 확인

Strands 에이전트는 Amazon Bedrock AgentCore Runtime에 배포됩니다. AgentCore는 **2025년 기준 일부 리전에서만 GA** 상태입니다. 사용 리전에 AgentCore가 없으면 배포가 실패합니다.

- 가용 리전 확인: AWS 콘솔 → **Amazon Bedrock** → 좌측 메뉴 **AgentCore** 항목 존재 여부
- 가용 리전이 아니면 `REGION`을 AgentCore 가용 리전으로 바꾸어 배포합니다.

## 검증

AWS CLI로 액세스 상태를 확인할 수 있습니다.

```bash
aws bedrock list-foundation-models \
  --region ap-northeast-2 \
  --query 'modelSummaries[?contains(modelId, `claude`) || contains(modelId, `nova`)].[modelId,modelName]' \
  --output table
```

`Access granted` 상태의 모델이 목록에 나타나면 준비 완료입니다.

## 다음 단계

Bedrock 액세스가 확보되면 [배포 → 레포지토리 클론](../03-deploy/clone-repository.md)으로 이동합니다.
