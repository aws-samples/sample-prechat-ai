---
description: PreChat 워크샵용 레포지토리를 클론하고 prsworkshop 브랜치로 전환하기
icon: code-branch
---

# PreChat 소스코드 설치

[PreChat 워크샵](https://github.com/aws-samples/sample-prechat-ai)은 **`prsworkshop` 브랜치**를 기반으로 진행합니다. 이 브랜치는 워크샵 편의를 위해 보안 옵션 (VPC/PrivateLink) 을 제거하여 복잡한 네트워크 구성 없이 배포 가능한 상태입니다.

## 1. 레포지토리 클론

AWS CloudShell 화면에서 다음을 복사-붙여넣기 후 엔터(Enter)를 입력해 실행합니다.

```bash
sudo mkdir -p /home/workshop && sudo chown $(whoami) /home/workshop
cd /home/workshop
git clone https://github.com/aws-samples/sample-prechat-ai.git
cd sample-prechat-ai
```

{% hint style="info" %}
CloudShell의 `~/`(홈 디렉토리)는 974MB 한도가 있어 SAM 빌드 중 용량이 부족합니다. `/home`은 16GB 임시 스토리지로 워크샵 진행에 충분합니다. 단, CloudShell 세션이 종료되면 `/home/workshop`의 데이터는 삭제됩니다.
{% endhint %}

## 2. `prsworkshop` 브랜치로 전환

```bash
git checkout prsworkshop
git branch --show-current
# prsworkshop 출력 확인
```

## 3. 의존성 설치

배포에 필요한 Node 의존성을 설치합니다.

```bash
npm install
```

## 4. 배포 스크립트 실행 권한

배포 스크립트 실행 권한을 부여합니다.

```bash
chmod +x deploy-full.sh deploy-website.sh update-env-vars.sh
chmod +x packages/strands-agents/deploy-agents.sh
```

## 5. 설정 파일 훑어보기

다음 파일을 들여다보면 프로젝트 구조 이해에 도움이 됩니다.

| 파일 | 설명 |
|------|------|
| `template.yaml` | SAM IaC 템플릿. Lambda, API Gateway, DynamoDB, Cognito, CloudFront 등 정의 |
| `samconfig.toml` | SAM 배포 기본 파라미터 |
| `deploy-full.sh` | 전체 배포 오케스트레이션 스크립트 |

## 다음 단계

[전체 배포](full-deployment.md)로 이동합니다.
