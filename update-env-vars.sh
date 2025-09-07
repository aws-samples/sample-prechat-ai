#!/bin/bash

# Update environment variables after deployment
set -e

PROFILE=${1:-default}
STAGE=${2:-dev}
REGION=${3:-ap-northeast-2}
STACK_NAME=${4:-mte-prechat}

echo "📋 Getting deployment outputs..."

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --profile $PROFILE)

if [ -z "$API_URL" ]; then
  echo "❌ Failed to get API URL from CloudFormation stack"
  exit 1
fi

# Update environment files
ENV_FILE="packages/web-app/.env.${STAGE}"
if [ "$STAGE" = "dev" ]; then
  ENV_FILE="packages/web-app/.env.development"
elif [ "$STAGE" = "prod" ]; then
  ENV_FILE="packages/web-app/.env.production"
fi

echo "📝 Updating $ENV_FILE..."

# Create or update environment file
cat > $ENV_FILE << EOF
VITE_API_BASE_URL=${API_URL}/api
VITE_APP_TITLE=AWS PreChat
EOF

echo "✅ Environment variables updated successfully!"
echo "🔗 API URL: ${API_URL}/api"
echo "🌍 Region: $REGION"
echo "📋 Stage: $STAGE"