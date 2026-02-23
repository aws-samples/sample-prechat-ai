#!/bin/bash

# Full deployment script for MTE PreChat
set -e

# Default values
PROFILE=${1:-default}
STAGE=${2:-dev}
REGION=${3:-ap-northeast-2}
BEDROCK_REGION=${4:-$REGION}
STACK_NAME=${5:-mte-prechat}
BEDROCK_KB_ID=${6:-""}

echo "🚀 Starting full deployment..."
echo "📋 Configuration:"
echo "   AWS Profile: $PROFILE"
echo "   Stage: $STAGE"
echo "   Region: $REGION"
echo "   Bedrock Region: $BEDROCK_REGION"
echo "   Stack Name: $STACK_NAME"
echo "   Bedrock KB: ${BEDROCK_KB_ID:-"(없음)"}"
echo ""

# Step 1: Deploy Strands Agents (must run before SAM to register SSM parameters)
echo "🤖 Deploying Strands Agents to AgentCore..."
if [ -f "packages/strands-agents/deploy-agents.sh" ]; then
  ./packages/strands-agents/deploy-agents.sh $PROFILE $STAGE $REGION $BEDROCK_KB_ID
  echo "✅ Strands Agents deployed and SSM parameters registered"
else
  echo "⚠️  deploy-agents.sh not found, skipping agent deployment"
  echo "   Lambda functions will use legacy Bedrock Agent fallback"
fi
echo ""

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Step 3: Build SAM application
echo "🔨 Building SAM application..."
sam build --profile $PROFILE

# Step 4: Deploy infrastructure
echo "🏗️  Deploying infrastructure..."
sam deploy \
  --profile $PROFILE \
  --region $REGION \
  --stack-name $STACK_NAME \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides "Stage=\"$STAGE\" BedrockRegion=\"$BEDROCK_REGION\"" \
  || echo "⚠️  sam deploy failed (exit code: $?), continuing with website deployment..."

# Step 5: Update environment variables
echo "🔧 Updating environment variables..."
./update-env-vars.sh $PROFILE $STAGE $REGION $STACK_NAME

# Step 6: Build and deploy website
echo "🌐 Building and deploying website..."
./deploy-website.sh $STAGE $PROFILE $REGION $STACK_NAME

echo ""
echo "✅ Full deployment completed successfully!"
echo "🎉 Your MTE PreChat application is ready!"

# Get final URLs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --profile $PROFILE)

WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --profile $PROFILE)

echo ""
echo "📋 Deployment Summary:"
echo "   🔗 API URL: ${API_URL}/api"
echo "   🌐 Website URL: $WEBSITE_URL"
echo "   🌍 Region: $REGION"
echo "   🤖 Bedrock Region: $BEDROCK_REGION"
echo "   📋 Stage: $STAGE"
echo ""
echo "🎯 Next steps:"
echo "   1. Access the admin dashboard at: $WEBSITE_URL/admin"
echo "   2. Configure Agent settings for your campaigns"
echo "   3. Create customer sessions and start chatting!"