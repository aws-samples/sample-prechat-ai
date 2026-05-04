---
description: macOS에서 PreChat을 배포하기 위한 로컬 환경 구성
icon: apple
---

# macOS 로컬 환경 구성

macOS 사용자를 위한 배포 환경 준비 가이드입니다. Apple Silicon(M1/M2/M3/M4)과 Intel Mac 모두에서 동일한 절차로 진행합니다.

## 1. Homebrew 설치

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

설치 후 안내에 따라 PATH 설정을 완료합니다(특히 Apple Silicon은 `/opt/homebrew/bin` 등록).

```bash
brew --version
```

## 2. 필수 도구 설치

```bash
# AWS CLI v2
brew install awscli

# AWS SAM CLI
brew install aws-sam-cli

# Node.js 20 LTS
brew install node@20
brew link --force --overwrite node@20

# Python 3.13
brew install python@3.13

# uv (Python 패키지/도구 관리)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

각 도구 버전을 확인합니다.

```bash
aws --version          # aws-cli/2.x
sam --version          # SAM CLI, version 1.x
node --version         # v20.x
python3.13 --version   # Python 3.13.x
uv --version
```

## 3. Docker Desktop 설치

에이전트는 Docker 이미지로 빌드되어 AgentCore에 배포됩니다.

{% stepper %}
{% step %}
### Docker Desktop 다운로드와 설치

[docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)에서 Mac용 설치 파일을 받아 설치합니다. Apple Silicon은 "Mac with Apple chip" 버전을 선택합니다.
{% endstep %}

{% step %}
### Docker Desktop을 실행한다

상단 메뉴바에 고래 아이콘이 나타나고 "Docker Desktop is running" 상태가 되면 준비 완료입니다.
{% endstep %}

{% step %}
### 터미널에서 확인한다

```bash
docker --version
docker ps
```

`docker ps`가 에러 없이 실행되어야 합니다.
{% endstep %}
{% endstepper %}

{% hint style="info" %}
Docker Desktop이 실행 중이 아니면 에이전트 빌드 단계에서 "Cannot connect to the Docker daemon" 오류가 발생합니다.
{% endhint %}

## 4. AgentCore Starter Toolkit 설치

```bash
pip3.13 install --user bedrock-agentcore-starter-toolkit
```

설치 후 PATH에 `~/.local/bin`이 포함되어 있는지 확인합니다.

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 5. AWS 자격증명 설정

```bash
aws configure
```

다음을 입력합니다.

- AWS Access Key ID
- AWS Secret Access Key
- Default region name (예: `ap-northeast-2`)
- Default output format (`json`)

여러 프로필을 쓴다면 `aws configure --profile workshop` 형태로 지정합니다. 이후 `deploy-full.sh` 실행 시 첫 번째 인자로 프로필명을 전달합니다.

확인:

```bash
aws sts get-caller-identity
```

### IAM Identity Center (SSO) 사용자

SSO를 쓰는 경우:

```bash
aws configure sso
aws sso login --profile workshop
```

## 6. 권한 확인

배포에는 다음 서비스에 대한 권한이 필요합니다.

- CloudFormation, IAM, Lambda, API Gateway, DynamoDB, S3
- Cognito, CloudFront, KMS, SQS, SNS
- Bedrock, Bedrock AgentCore, ECR, CodeBuild

`AdministratorAccess` 또는 이에 준하는 정책이 있으면 안전합니다.

## 다음 단계

[레포지토리 클론](../03-deploy/clone-repository.md)으로 이동합니다.

## 문제 해결

### `brew: command not found`

Apple Silicon Mac의 경우 Homebrew가 `/opt/homebrew`에 설치됩니다. `.zshrc`에 다음을 추가합니다.

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Docker가 느리거나 메모리 부족

Docker Desktop → **Settings** → **Resources**에서 **Memory**를 최소 4 GB로 늘립니다. 에이전트 이미지 빌드에 필요합니다.

### `sam build`가 ARM/x86 호환 경고

M1/M2/M3는 ARM 아키텍처입니다. Lambda가 x86이면 Docker로 크로스 빌드합니다. `sam build --use-container`로 빌드하거나 리눅스 x86 환경(CloudShell, Linux 서버)에서 진행하는 것이 안정적입니다.
