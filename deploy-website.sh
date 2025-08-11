#!/bin/bash

# Website deployment script for MTE PreChat
set -e

STAGE=${1:-dev}
PROFILE=${2:-default}
REGION=${3:-ap-northeast-2}
STACK_NAME=${4:-mte-prechat}

echo "📋 Configuration:"
echo "   Stage: $STAGE"
echo "   AWS Profile: $PROFILE"
echo "   Region: $REGION"
echo "   Stack Name: $STACK_NAME"
echo ""

# Build the website
echo "🔨 Building website..."
cd packages/web-app
NODE_ENV=production yarn build
cd ../..

# Get CloudFormation outputs
echo "📋 Getting deployment info..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' \
  --output text \
  --profile $PROFILE)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text \
  --profile $PROFILE)

WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --profile $PROFILE)

echo "📤 Uploading to S3 bucket: $BUCKET_NAME"

# Sync files to S3
aws s3 sync packages/web-app/dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --profile $PROFILE

# Upload HTML files with no-cache
aws s3 sync packages/web-app/dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" \
  --profile $PROFILE

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --profile $PROFILE

echo "✅ Website deployed successfully!"
echo "🌐 Website URL: $WEBSITE_URL"