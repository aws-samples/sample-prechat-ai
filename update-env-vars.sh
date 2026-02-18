#!/bin/bash

# 배포 후 환경 변수 업데이트
set -e

PROFILE=${1:-default}
STAGE=${2:-dev}
REGION=${3:-ap-northeast-2}
STACK_NAME=${4:-mte-prechat}

echo "📋 CloudFormation 출력값 가져오는 중..."

# API Gateway URL 가져오기
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --profile $PROFILE)

if [ -z "$API_URL" ]; then
  echo "❌ CloudFormation 스택에서 API URL을 가져오지 못했습니다"
  exit 1
fi

# WebSocket API URL 가져오기
WS_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketUrl`].OutputValue' \
  --output text \
  --profile $PROFILE)

if [ -z "$WS_URL" ]; then
  echo "⚠️  WebSocket URL을 가져오지 못했습니다. VITE_WS_URL이 설정되지 않습니다."
fi

# 환경 파일 경로 결정
ENV_FILE="packages/web-app/.env.${STAGE}"
if [ "$STAGE" = "dev" ]; then
  ENV_FILE="packages/web-app/.env.development"
elif [ "$STAGE" = "prod" ]; then
  ENV_FILE="packages/web-app/.env.production"
fi

echo "📝 $ENV_FILE 업데이트 중..."

# 환경 파일 생성 또는 업데이트
cat > $ENV_FILE << EOF
VITE_API_BASE_URL=${API_URL}/api
VITE_WS_URL=${WS_URL}
VITE_APP_TITLE=AWS PreChat
EOF

echo "✅ 환경 변수 업데이트 완료!"
echo "🔗 API URL: ${API_URL}/api"
echo "🔌 WebSocket URL: ${WS_URL}"
echo "🌍 Region: $REGION"
echo "📋 Stage: $STAGE"
