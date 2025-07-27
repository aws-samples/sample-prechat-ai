#!/bin/bash

echo "🚀 MTE Pre-consultation Chatbot 개발 환경 설정"

# 0. Podman Docker 호환 설정
echo "🐳 Podman Docker 호환 설정 중..."
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock

# 1. 의존성 설치
echo "📦 의존성 설치 중..."
yarn install

# 2. 백엔드 빌드
echo "🔨 백엔드 빌드 중..."
sam build

# 3. 환경 변수 확인
if [ ! -f "packages/web-app/.env.local" ]; then
    echo "⚙️  환경 변수 파일 생성 중..."
    cp packages/web-app/.env.example packages/web-app/.env.local
fi

echo "✅ 설정 완료!"
echo ""
echo "다음 명령어로 개발 서버를 실행하세요:"
echo "1. 백엔드 API: sam local start-api --profile terraform --port 3001"
echo "2. 프론트엔드: cd packages/web-app && yarn dev"
echo ""
echo "접속 주소:"
echo "- 프론트엔드: http://localhost:3000"
echo "- 백엔드 API: http://localhost:3001/api"