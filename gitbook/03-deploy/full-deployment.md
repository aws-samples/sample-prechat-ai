---
description: deploy-full.sh 한 줄로 전체 배포하기
icon: rocket
---

# 전체 배포

이 단계에서는 명령어 한 줄로 에이전트, 백엔드, 프론트엔드를 모두 배포합니다.

## 1. 배포 명령 실행

CloudShell에서 다음을 복사해 붙여넣고 Enter를 누릅니다.

```bash
cd /home/sample-prechat-ai
./deploy-full.sh default dev ap-northeast-2 ap-northeast-2 mte-prechat-workshop
```

![CloudShell 에서 배포 명령하기](../.gitbook/assets/03-full-deployment.png)

{% hint style="info" %}
배포는 20~40분 걸립니다. 중간에 터미널을 닫지 마세요.
{% endhint %}

## 2. 중간에 확인이 필요한 순간

배포 도중 아래 프롬프트가 나타나면 **`y`를 입력**하고 Enter를 누릅니다.

```
Deploy this changeset? [y/N]:
```

그 외에는 자동으로 진행되므로 기다리면 됩니다.

## 3. 배포 완료 확인

마지막에 다음과 같은 요약이 출력됩니다.

```
📋 Deployment Summary:
   🔗 API URL: https://xxxx.execute-api.ap-northeast-2.amazonaws.com/dev/api
   🌐 Website URL: https://dxxx.cloudfront.net
   🌍 Region: ap-northeast-2
```

{% hint style="warning" %}
**Website URL을 메모장에 복사해 두세요.** 이후 모든 단계에서 이 URL을 사용합니다.
{% endhint %}


## 4. 배포가 중간에 실패했다면

실패한 지점부터 다시 실행하면 됩니다. 전체를 처음부터 돌릴 필요는 없습니다.

{% tabs %}
{% tab title="에이전트만 재실행" %}
```bash
./packages/strands-agents/deploy-agents.sh default dev ap-northeast-2
```
{% endtab %}

{% tab title="백엔드만 재실행" %}
```bash
sam build && sam deploy
```
{% endtab %}

{% tab title="프론트엔드만 재실행" %}
```bash
./update-env-vars.sh default dev ap-northeast-2 mte-prechat-workshop
./deploy-website.sh dev default ap-northeast-2 mte-prechat-workshop
```
{% endtab %}
{% endtabs %}

에러 메시지가 이해되지 않으면 [문제 해결 가이드](../08-ops/troubleshooting.md)를 참고하세요.

## 다음 단계

[배포 결과 검증](verify-deployment.md)으로 이동합니다.