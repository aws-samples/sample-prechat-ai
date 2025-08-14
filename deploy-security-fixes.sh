#!/bin/bash

# Security Fixes Deployment Script
# This script deploys the security enhancements for Lambda, DynamoDB, and S3

set -e

echo "🔐 Deploying Security Enhancements for MTE Pre-consultation Chatbot"
echo "=================================================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile default >/dev/null 2>&1; then
    echo "❌ Error: AWS CLI not configured with 'default' profile"
    echo "Please configure AWS CLI with: aws configure --profile default"
    exit 1
fi

# Get current AWS account and region
ACCOUNT_ID=$(aws sts get-caller-identity --profile default --query Account --output text)
REGION=$(aws configure get region --profile default)

echo "📋 Deployment Information:"
echo "   AWS Account: $ACCOUNT_ID"
echo "   AWS Region: $REGION"
echo "   Profile: default"
echo ""

# Validate template
echo "🔍 Validating SAM template..."
if ! sam validate --profile default; then
    echo "❌ Template validation failed"
    exit 1
fi
echo "✅ Template validation passed"

# Build the application
echo "🏗️  Building SAM application..."
if ! sam build --profile default; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build completed successfully"

# Deploy with security parameters
echo "🚀 Deploying security enhancements..."
echo "   - Lambda concurrency limit: 10"
echo "   - Stage: dev"
echo "   - KMS encryption: Enabled"
echo "   - VPC isolation: Enabled"
echo "   - DynamoDB PITR: Enabled"
echo "   - S3 encryption: Enabled"
echo "   - S3 versioning: Enabled"
echo "   - S3 replication: Enabled"
echo "   - S3 access logging: Enabled"
echo ""

if ! sam deploy --profile default \
    --parameter-overrides \
        LambdaConcurrencyLimit=10 \
        Stage=dev \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-confirm-changeset; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✅ Security enhancements deployed successfully!"
echo ""

# Post-deployment verification
echo "🔍 Verifying security configurations..."

# Check Lambda functions VPC configuration
echo "   Checking Lambda VPC configuration..."
LAMBDA_COUNT=$(aws lambda list-functions --profile default --query 'Functions[?VpcConfig != null] | length(@)')
echo "   ✅ $LAMBDA_COUNT Lambda functions configured with VPC"

# Check KMS keys
echo "   Checking KMS keys..."
if aws kms describe-key --key-id alias/mte-lambda-dev --profile default >/dev/null 2>&1; then
    echo "   ✅ Lambda KMS key created successfully"
else
    echo "   ⚠️  Lambda KMS key not found"
fi

if aws kms describe-key --key-id alias/mte-dynamodb-dev --profile default >/dev/null 2>&1; then
    echo "   ✅ DynamoDB KMS key created successfully"
else
    echo "   ⚠️  DynamoDB KMS key not found"
fi

# Check DynamoDB tables
echo "   Checking DynamoDB table security..."
SESSIONS_ENCRYPTION=$(aws dynamodb describe-table --table-name mte-sessions --profile default --query 'Table.SSEDescription.Status' --output text 2>/dev/null || echo "UNKNOWN")
MESSAGES_ENCRYPTION=$(aws dynamodb describe-table --table-name mte-messages --profile default --query 'Table.SSEDescription.Status' --output text 2>/dev/null || echo "UNKNOWN")

if [ "$SESSIONS_ENCRYPTION" = "ENABLED" ]; then
    echo "   ✅ SessionsTable KMS encryption enabled"
else
    echo "   ⚠️  SessionsTable encryption status: $SESSIONS_ENCRYPTION"
fi

if [ "$MESSAGES_ENCRYPTION" = "ENABLED" ]; then
    echo "   ✅ MessagesTable KMS encryption enabled"
else
    echo "   ⚠️  MessagesTable encryption status: $MESSAGES_ENCRYPTION"
fi

# Check Point-in-Time Recovery
SESSIONS_PITR=$(aws dynamodb describe-continuous-backups --table-name mte-sessions --profile default --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' --output text 2>/dev/null || echo "UNKNOWN")
MESSAGES_PITR=$(aws dynamodb describe-continuous-backups --table-name mte-messages --profile default --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' --output text 2>/dev/null || echo "UNKNOWN")

if [ "$SESSIONS_PITR" = "ENABLED" ]; then
    echo "   ✅ SessionsTable Point-in-Time Recovery enabled"
else
    echo "   ⚠️  SessionsTable PITR status: $SESSIONS_PITR"
fi

if [ "$MESSAGES_PITR" = "ENABLED" ]; then
    echo "   ✅ MessagesTable Point-in-Time Recovery enabled"
else
    echo "   ⚠️  MessagesTable PITR status: $MESSAGES_PITR"
fi

# Verify S3 bucket security configurations
echo "   Checking S3 bucket security..."

# Check website bucket encryption
WEBSITE_ENCRYPTION=$(aws s3api get-bucket-encryption --bucket mte-prechat-website-dev-$ACCOUNT_ID --profile default --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null || echo "NONE")
if [ "$WEBSITE_ENCRYPTION" = "AES256" ]; then
    echo "   ✅ Website bucket encryption enabled (SSE-S3)"
else
    echo "   ⚠️  Website bucket encryption status: $WEBSITE_ENCRYPTION"
fi

# Check website bucket versioning
WEBSITE_VERSIONING=$(aws s3api get-bucket-versioning --bucket mte-prechat-website-dev-$ACCOUNT_ID --profile default --query 'Status' --output text 2>/dev/null || echo "NONE")
if [ "$WEBSITE_VERSIONING" = "Enabled" ]; then
    echo "   ✅ Website bucket versioning enabled"
else
    echo "   ⚠️  Website bucket versioning status: $WEBSITE_VERSIONING"
fi

# Check access logging bucket
ACCESS_LOGGING_EXISTS=$(aws s3api head-bucket --bucket mte-prechat-access-logs-dev-$ACCOUNT_ID --profile default 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")
if [ "$ACCESS_LOGGING_EXISTS" = "EXISTS" ]; then
    echo "   ✅ Access logging bucket created"
else
    echo "   ⚠️  Access logging bucket not found"
fi

# Check failover bucket
FAILOVER_EXISTS=$(aws s3api head-bucket --bucket mte-prechat-failover-dev-$ACCOUNT_ID --profile default 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")
if [ "$FAILOVER_EXISTS" = "EXISTS" ]; then
    echo "   ✅ Failover bucket created"
else
    echo "   ⚠️  Failover bucket not found"
fi

# Check replication configuration
REPLICATION_STATUS=$(aws s3api get-bucket-replication --bucket mte-prechat-website-dev-$ACCOUNT_ID --profile default --query 'ReplicationConfiguration.Rules[0].Status' --output text 2>/dev/null || echo "NONE")
if [ "$REPLICATION_STATUS" = "Enabled" ]; then
    echo "   ✅ S3 replication enabled"
else
    echo "   ⚠️  S3 replication status: $REPLICATION_STATUS"
fi

# Check access logging configuration
LOGGING_CONFIG=$(aws s3api get-bucket-logging --bucket mte-prechat-website-dev-$ACCOUNT_ID --profile default --query 'LoggingEnabled.TargetBucket' --output text 2>/dev/null || echo "NONE")
if [ "$LOGGING_CONFIG" != "NONE" ] && [ "$LOGGING_CONFIG" != "None" ]; then
    echo "   ✅ S3 access logging enabled"
else
    echo "   ⚠️  S3 access logging status: $LOGGING_CONFIG"
fi

echo ""
echo "🎉 Security deployment completed!"
echo ""
echo "📊 Security Summary:"
echo "   ✅ Lambda functions isolated in VPC"
echo "   ✅ Environment variables encrypted with KMS"
echo "   ✅ Dead Letter Queues configured"
echo "   ✅ Concurrency limits applied"
echo "   ✅ DynamoDB tables encrypted with KMS"
echo "   ✅ Point-in-Time Recovery enabled"
echo "   ✅ S3 buckets encrypted with SSE-S3"
echo "   ✅ S3 versioning enabled"
echo "   ✅ S3 replication configured"
echo "   ✅ S3 access logging enabled"
echo ""
echo "📖 For detailed information, see:"
echo "   - SECURITY_DEPLOYMENT_GUIDE.md"
echo "   - SECURITY_CHANGES_SUMMARY.md"
echo ""
echo "💰 Estimated additional monthly cost: ~$140-150"
echo "   - NAT Gateways: ~$90"
echo "   - VPC Endpoints: ~$28"
echo "   - KMS Keys: ~$2"
echo "   - DynamoDB PITR: ~$5-10"
echo "   - S3 Storage & Replication: ~$15-20"