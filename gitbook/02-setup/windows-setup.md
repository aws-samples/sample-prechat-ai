---
description: Windows에서 PreChat을 배포하기 위한 WSL2 기반 환경 구성
icon: windows
---

# Windows 로컬 환경 구성

Windows 10/11 사용자는 **WSL2 (Ubuntu)**에서 진행하는 것을 권장합니다. PowerShell 네이티브도 가능하지만 Linux 쉘 스크립트 호환성과 Docker 성능을 고려할 때 WSL2가 안정적입니다.

## 경로 선택

{% tabs %}
{% tab title="WSL2 (권장)" %}
Ubuntu 22.04 LTS를 설치하고 macOS 가이드와 거의 동일하게 진행합니다.
{% endtab %}

{% tab title="PowerShell 네이티브" %}
`deploy-full.sh`는 Bash 스크립트이므로 Git Bash 또는 Cygwin이 필요합니다. WSL2가 없는 환경에서만 고려하세요.
{% endtab %}
{% endtabs %}

## 1. WSL2 설치

{% stepper %}
{% step %}
### 관리자 권한 PowerShell을 연다

시작 메뉴 → "Windows PowerShell" 우클릭 → "관리자 권한으로 실행"
{% endstep %}

{% step %}
### WSL을 설치한다

```powershell
wsl --install -d Ubuntu-22.04
```

설치 완료 후 컴퓨터를 재시작합니다.
{% endstep %}

{% step %}
### Ubuntu를 처음 실행하여 사용자를 만든다

시작 메뉴 → "Ubuntu 22.04" 클릭. UNIX 사용자명과 비밀번호를 설정합니다.
{% endstep %}

{% step %}
### 기본 패키지를 업데이트한다

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget unzip build-essential
```
{% endstep %}
{% endstepper %}

## 2. WSL2에서 도구 설치

아래는 모두 WSL2 Ubuntu 쉘 안에서 실행합니다.

### AWS CLI v2

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws
aws --version
```

### AWS SAM CLI

```bash
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
rm -rf aws-sam-cli-linux-x86_64.zip sam-installation
sam --version
```

### Node.js 20 LTS (nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm install -g yarn
node --version
yarn --version
```

### Python 3.13

Ubuntu 22.04 기본 Python은 3.10이므로 3.13을 추가 설치합니다.

```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3-pip
python3.13 --version
```

### uv와 AgentCore Toolkit

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

pip install --user bedrock-agentcore-starter-toolkit
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## 3. Docker Desktop + WSL 통합

{% stepper %}
{% step %}
### Docker Desktop for Windows를 설치한다

[docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)에서 설치 파일을 다운로드합니다.
{% endstep %}

{% step %}
### 설치 중 "Use WSL 2 instead of Hyper-V"를 선택한다

이미 Docker Desktop이 설치되어 있다면 **Settings** → **General** → **Use the WSL 2 based engine**을 활성화합니다.

**[수동 캡처 필요]** Docker Desktop Settings의 WSL 2 based engine 옵션
{% endstep %}

{% step %}
### WSL 통합을 활성화한다

**Settings** → **Resources** → **WSL integration** → Ubuntu-22.04 토글을 켭니다.

**[수동 캡처 필요]** WSL integration 화면
{% endstep %}

{% step %}
### WSL에서 Docker 실행을 확인한다

```bash
docker --version
docker ps
```
{% endstep %}
{% endstepper %}

## 4. AWS 자격증명 설정

```bash
aws configure
```

IAM Identity Center (SSO) 사용자:

```bash
aws configure sso
aws sso login --profile workshop
```

확인:

```bash
aws sts get-caller-identity
```

## 5. Git 설치

```bash
sudo apt install -y git
git --version
```

Git 사용자 정보 설정(나중에 필요):

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

## 다음 단계

[레포지토리 클론](../03-deploy/clone-repository.md)으로 이동합니다.

## 문제 해결

### WSL에서 `docker ps`가 실패

Docker Desktop이 실행 중이고 WSL 통합이 활성화되어 있는지 확인합니다. Windows를 재부팅하면 해결되는 경우가 많습니다.

### WSL 파일시스템 성능이 느리다

프로젝트를 `/mnt/c/...`(Windows 드라이브)가 아닌 **WSL 내부 홈 디렉토리(`~/`)**에 클론해야 성능이 정상입니다. `cd ~ && git clone ...` 형태로 진행합니다.

### `sam build`가 멈추거나 메모리 부족

Docker Desktop → **Settings** → **Resources**에서 메모리를 4 GB 이상 할당합니다. `%UserProfile%\.wslconfig`에 다음을 추가하고 `wsl --shutdown`으로 재시작해도 됩니다.

```ini
[wsl2]
memory=8GB
processors=4
```
