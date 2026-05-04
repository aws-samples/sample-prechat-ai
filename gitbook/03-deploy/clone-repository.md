---
description: PreChat 워크샵용 레포지토리를 클론하고 prsworkshop 브랜치로 전환하기
icon: code-branch
---

# 레포지토리 클론과 브랜치 전환

PreChat 워크샵은 **`prsworkshop` 브랜치**를 기반으로 진행합니다. 이 브랜치는 워크샵 편의를 위해 VPC/PrivateLink 옵션을 제거하여 고객 환경에서 네트워크 구성 없이 배포 가능한 상태입니다.

## 1. 레포지토리 클론

선택한 환경(CloudShell, macOS, Windows WSL)의 쉘에서 홈 디렉토리로 이동한 뒤 클론합니다.

```bash
cd ~
git clone https://github.com/aws-samples/sample-prechat-ai.git
cd sample-prechat-ai
```

{% hint style="warning" %}
WSL2 사용자는 반드시 WSL 내부 `~` 경로에 클론합니다. `/mnt/c/...`(Windows 드라이브)에 두면 파일시스템 성능이 크게 저하됩니다.
{% endhint %}

## 2. `prsworkshop` 브랜치로 전환

```bash
git checkout prsworkshop
git branch --show-current
# prsworkshop 출력 확인
```

원격 브랜치가 아직 없다면 다음 명령으로 조회합니다.

```bash
git branch -r | grep prsworkshop
```

## 3. 변경 사항 확인

`prsworkshop` 브랜치에서 다음이 달라집니다.

| 항목 | main 브랜치 | prsworkshop 브랜치 |
|------|-----------|-------------------|
| VPC, PrivateSubnet, Route Table | 포함 | **제거** |
| Lambda SecurityGroup | 포함 | **제거** |
| VPC Gateway Endpoint (S3, DynamoDB) | 포함 | **제거** |
| VPC Interface Endpoint (Bedrock, AgentCore, Cognito, SQS, KMS, SNS 등) | 포함 | **제거** |
| Lambda 실행 위치 | VPC Private Subnet | **VPC 외부 (AWS 관리 기본 네트워크)** |
| 그 외 기능, 리소스, 환경 변수 | 동일 | 동일 |

{% hint style="info" %}
이 변경으로 **네트워크 이그레스가 퍼블릭 AWS 엔드포인트를 경유**합니다. 프로덕션 환경에 도입할 때는 main 브랜치로 돌아와 VPC 격리를 복구하고, 필요에 따라 WAF, IAM 세분화, 로그 집계 등 보안 조치를 추가합니다.
{% endhint%}

## 4. 의존성 설치

레포지토리 루트에서 모노레포 전체 의존성을 설치합니다.

```bash
yarn install
```

{% hint style="warning" %}
**CloudShell 사용자**: `yarn install`이 끝나면 `du -sh node_modules`로 용량을 확인합니다. 약 500~700 MB가 사용됩니다. 홈 1 GB 한도를 감안해 다른 큰 파일이 있으면 미리 정리하세요.
{% endhint %}

## 5. 배포 스크립트 실행 권한

macOS/Linux/WSL/CloudShell에서 스크립트에 실행 권한을 부여합니다.

```bash
chmod +x deploy-full.sh deploy-website.sh update-env-vars.sh
chmod +x packages/strands-agents/deploy-agents.sh
```

## 6. 설정 파일 훑어보기

다음 파일을 잠깐 열어보면 프로젝트 구조 이해에 도움이 됩니다.

| 파일 | 설명 |
|------|------|
| `template.yaml` | SAM IaC 템플릿. Lambda, API Gateway, DynamoDB, Cognito, CloudFront 등 정의 |
| `samconfig.toml` | SAM 배포 기본 파라미터 |
| `deploy-full.sh` | 전체 배포 오케스트레이션 스크립트 |
| `packages/strands-agents/deploy-agents.sh` | Strands 에이전트를 AgentCore에 배포 |
| `packages/web-app/.env.development` | 프론트엔드 개발용 환경 변수 (배포 후 자동 생성) |

## 다음 단계

[에이전트 → SAM → 프론트엔드 배포](full-deployment.md)로 이동합니다.
