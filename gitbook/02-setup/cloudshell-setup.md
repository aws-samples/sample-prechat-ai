---
description: AWS CloudShell에서 PreChat을 배포하기 위한 준비 단계
icon: cloud
---

# AWS CloudShell로 시작하기 (권장)

CloudShell은 브라우저에서 바로 사용하는 AWS 인증된 쉘 환경입니다. AWS CLI, SAM CLI, Python, Node.js 20, Docker 클라이언트가 이미 구비되어 있어 워크샵을 빠르게 시작할 수 있습니다.

## 1. CloudShell 실행

AWS Console에 로그인한 뒤 상단 헤더의 CloudShell 아이콘(터미널 모양)을 클릭합니다. 워크샵을 진행할 리전인지 확인합니다.

![AWS Console 상단 CloudShell 아이콘](../.gitbook/assets/02-open-cloudshell.png)

## 2. 도구 확인과 추가 설치

CloudShell에는 주요 도구가 이미 설치되어 있습니다. 아래 스크립트를 한 번에 실행하면 버전 확인과 추가 설치가 끝납니다.

```bash
# 기본 도구 버전 확인
aws --version && sam --version && node --version && git --version && echo "✅ 기본 도구 정상"

# uv 설치 (에이전트 배포 시 Python 3.13 + 의존성 자동 해결에 필요)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# uv로 Python 3.13 설치 (CloudShell 기본 Python은 3.9이므로 별도 설치)
uv python install 3.13
```

## 3. AWS 자격증명 확인

CloudShell은 로그인한 IAM 엔터티의 자격증명을 자동으로 사용합니다.

```bash
aws sts get-caller-identity
```

`UserId`, `Account`, `Arn`이 나오면 정상입니다.

## 4. API Gateway 로깅 역할 설정

API Gateway가 CloudWatch에 로그를 기록하려면 계정 수준에서 역할을 한 번 등록해야 합니다. 이미 설정된 계정이라면 건너뛰어도 됩니다.

```bash
# 1. API Gateway용 CloudWatch Logs 역할 생성
aws iam create-role \
  --role-name ApiGatewayCloudWatchLogsRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "apigateway.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "역할이 이미 존재합니다 (정상)"
```

```bash
# 2. 로깅 권한 정책 연결
aws iam attach-role-policy \
  --role-name ApiGatewayCloudWatchLogsRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs
```

```bash
# 3. API Gateway 계정 설정에 역할 등록
ROLE_ARN=$(aws iam get-role --role-name ApiGatewayCloudWatchLogsRole --query 'Role.Arn' --output text)
aws apigateway update-account --patch-operations op=replace,path=/cloudwatchRoleArn,value=$ROLE_ARN && echo "✅ API Gateway 로깅 역할 설정 완료"
```

## 5. 다음 단계

CloudShell 준비가 끝났으면 [레포지토리 클론](../03-deploy/clone-repository.md)으로 이동합니다.

## 문제 해결

### 세션이 끊기거나 로그아웃됨

CloudShell은 유휴 20~30분이면 세션이 종료됩니다. 콘솔에서 로그아웃해도 마찬가지입니다.

| 항목 | 세션 끊김 후 상태 |
|------|-----------------|
| 배포된 인프라 (CloudFormation 스택) | 그대로 유지 |
| SSM 파라미터, Cognito 사용자 | 그대로 유지 |
| `uv`, `sam` 등 설치한 도구 (`~/.local/bin`) | 그대로 유지 |
| 홈 디렉토리(`~`) 안의 파일 | 유지 (1GB 영구 스토리지) |
| `/tmp` 등 홈 바깥 파일 | 삭제됨 |

레포지토리를 `~` 안에 클론했다면 대부분 보존됩니다. 만약 파일이 사라졌다면 레포만 다시 클론하면 됩니다.

{% hint style="warning" %}
120일 이상 해당 리전에서 CloudShell을 사용하지 않으면 홈 디렉토리의 영구 스토리지가 자동 삭제됩니다.
{% endhint %}

```bash
cd ~
git clone https://github.com/aws-samples/sample-prechat-ai.git
cd sample-prechat-ai
git checkout prsworkshop
```

이미 배포한 스택과 도구는 그대로이므로, 클론 후 중단된 단계부터 이어서 진행하면 됩니다.

{% hint style="info" %}
작업 중간에 잠시 자리를 비울 때는 CloudShell 창을 닫지 말고 그대로 두세요. 브라우저 탭이 열려 있으면 세션이 유지됩니다.
{% endhint %}

### CloudShell이 열리지 않음

CloudShell은 대부분의 상용 리전에서 지원되지만, 일부 옵트인 리전에서는 사용할 수 없습니다. 콘솔 우측 상단에서 리전이 `ap-northeast-2` (서울) 또는 `us-east-1` (버지니아 북부)인지 확인하세요. 지원 리전 전체 목록은 [AWS CloudShell 지원 리전](https://docs.aws.amazon.com/cloudshell/latest/userguide/supported-aws-regions.html) 문서를 참고합니다.
