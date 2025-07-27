#!/bin/bash

echo "🐳 Podman을 Docker 호환 모드로 설정 중..."

# Docker 명령어 alias 생성
if ! command -v docker &> /dev/null; then
    echo "📦 Docker alias 생성 중..."
    sudo ln -sf $(which podman) /usr/local/bin/docker
fi

# Podman socket 활성화
echo "🔌 Podman socket 활성화 중..."
systemctl --user enable podman.socket
systemctl --user start podman.socket

# Docker 호환 환경 변수 설정
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock

echo "✅ Podman Docker 호환 설정 완료!"
echo "SAM CLI가 Podman을 Docker처럼 사용할 수 있습니다."