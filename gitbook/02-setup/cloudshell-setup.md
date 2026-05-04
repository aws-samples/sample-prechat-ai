---
description: AWS CloudShell에서 PreChat을 배포하기 위한 준비 단계
icon: cloud
---

# AWS CloudShell로 시작하기 (권장)

CloudShell은 브라우저에서 바로 사용하는 AWS 인증된 쉘 환경입니다. 별도 설치 없이 AWS CLI, Python, Node.js, Docker 클라이언트가 이미 구비되어 있어 워크샵에 가장 적합합니다.

{% hint style="warning" %}
CloudShell 홈 디렉토리는 **1 GB 한도**가 있습니다. 배포 중 `node_modules`, SAM 빌드 캐시가 합해 800 MB~1 GB에 달합니다. 필요 없는 디렉토리는 바로 정리하고, 1 GB를 넘으면 `sam build` 전에 한 번 정리합니다.
{% endhint %}

## 1. CloudShell 실행

{% stepper %}
{% step %}
### AWS Console에 로그인한다

워크샵을 진행할 리전으로 이동합니다.
{% endstep %}

{% step %}
### 상단 헤더의 CloudShell 아이콘을 클릭한다

터미널 모양 아이콘입니다. 새 탭으로 CloudShell 세션이 열립니다.

**[사진첨부]** AWS Console 상단 CloudShell 아이콘
{% endstep %}

{% step %}
### 홈 디렉토리를 확인한다

```bash
pwd
# /home/cloudshell-user

df -h ~
```

사용 가능 용량을 확인합니다.
{% endstep %}
{% endstepper %}

## 2. 도구 버전 확인과 설치

CloudShell 기본 제공 도구를 확인합니다.

```bash
aws --version          # aws-cli/2.x
python3 --version      # Python 3.9+
node --version         # v18 이상
docker --version       # 버전 표시되면 OK
```

### Node.js 20 LTS 업그레이드

기본 Node가 20 미만이면 `nvm`으로 업그레이드합니다.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version   # v20.x 확인
```

### Yarn 설치

```bash
npm install -g yarn
yarn --version
```

### SAM CLI 설치

CloudShell에는 SAM CLI가 없으므로 설치합니다.

```bash
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
rm -rf aws-sam-cli-linux-x86_64.zip sam-installation
sam --version
```

### Python 3.13과 uv 설치

Strands 에이전트 배포 도구(`bedrock-agentcore-starter-toolkit`)는 Python 3.10+에서 동작합니다. CloudShell 기본 Python으로 충분합니다.

```bash
# uv 설치 (MCP 서버 설치에 사용)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
uv --version
```

### AgentCore Starter Toolkit 설치

```bash
pip install --user bedrock-agentcore-starter-toolkit
```

## 3. AWS 자격증명 확인

CloudShell은 로그인한 IAM 엔터티의 자격증명을 자동으로 사용합니다.

```bash
aws sts get-caller-identity
```

`UserId`, `Account`, `Arn`이 나오면 자격증명이 정상입니다.

## 4. 디스크 공간 관리 팁

1 GB 제한을 피하는 요령입니다.

{% hint style="info" %}
**중간 산출물 정리**

배포가 끝나면 즉시 아래를 실행해 용량을 확보합니다.

```bash
# SAM 빌드 캐시 정리
rm -rf .aws-sam

# yarn 캐시 정리
yarn cache clean

# 홈 디렉토리 사용량 확인
du -sh ~/* | sort -h
```
{% endhint %}

## 5. 다음 단계

CloudShell 준비가 끝났으면 [Bedrock 모델 액세스 승인](bedrock-model-access.md)을 완료한 후 [레포지토리 클론](../03-deploy/clone-repository.md)으로 이동합니다.

## 문제 해결

### "No space left on device"

```bash
# CloudShell 홈 용량 확인
du -sh ~/* 2>/dev/null | sort -h | tail -10

# 가장 큰 디렉토리 정리
rm -rf ~/.cache ~/.aws-sam
```

### Docker 명령이 실패

CloudShell의 Docker는 **클라이언트만** 제공됩니다. 에이전트 빌드는 원격 CodeBuild를 통해 진행되므로 로컬 Docker 엔진이 필요하지 않습니다. `docker build`를 직접 실행할 일은 없습니다.

### 세션이 끊기면 설치한 도구가 남아있나

CloudShell 홈 디렉토리(`/home/cloudshell-user`)는 **세션 간 유지**됩니다. 하지만 `/tmp`와 시스템 영역은 초기화되므로 `sam`처럼 시스템에 설치한 도구는 다시 설치해야 할 수 있습니다. Node.js(nvm)와 Python 패키지(`--user` 설치)는 유지됩니다.
