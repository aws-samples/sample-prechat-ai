#!/bin/bash

echo "🚀 MTE Pre-consultation Chatbot 개발 서버 시작"

# Podman Docker 호환 설정
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock

# 백그라운드에서 백엔드 API 실행
echo "🔧 백엔드 API 시작 중... (포트 3001)"
sam local start-api --profile terraform --port 3001 &
BACKEND_PID=$!

# 잠시 대기 (백엔드 시작 시간)
sleep 5

# 프론트엔드 실행
echo "🌐 프론트엔드 시작 중... (포트 3000)"
cd packages/web-app && yarn dev

# 종료 시 백엔드 프로세스도 종료
trap "kill $BACKEND_PID" EXIT