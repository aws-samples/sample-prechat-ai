# Comprehensive Security Deployment Guide

This guide covers the complete security enhancements implemented to address Lambda, DynamoDB, and S3 security issues identified in the security audit.

## Security Issues Addressed

### Lambda Security Issues

### 1. ✅ CKV_AWS_115: Missing concurrent execution limits (38 functions)
**Solution**: Added `ReservedConcurrencyLimit` parameter to all Lambda functions
- **Configuration**: Set to 10 concurrent executions per function (configurable via parameter)
- **Impact**: Prevents resource exhaustion and controls costs
- **Parameter**: `LambdaConcurrencyLimit` (default: 10, range: 1-1000)

### 2. ✅ CKV_AWS_116: Missing Dead Letter Queue configuration (35 functions)
**Solution**: Implemented centralized Dead Letter Queue for all Lambda functions
- **Resource**: `LambdaDeadLetterQueue` SQS queue
- **Configuration**: 14-day message retention, KMS encrypted
- **Impact**: Captures failed function executions for debugging and monitoring

### 3. ✅ CKV_AWS_117: Functions not configured inside VPC (35 functions)
**Solution**: Deployed Lambda functions in private VPC subnets with NAT Gateway internet access
- **VPC Configuration**: 
  - VPC CIDR: 10.0.0.0/16
  - Private subnets: 10.0.11.0/24, 10.0.12.0/24 (Multi-AZ)
  - Public subnets: 10.0.1.0/24, 10.0.2.0/24 (for NAT Gateways)
- **Internet Access**: NAT Gateways in public subnets for outbound connectivity
- **VPC Endpoints**: Gateway and Interface endpoints for AWS services

### 4. ✅ CKV_AWS_173: Environment variables not encrypted (38 functions)
**Solution**: Created dedicated KMS key for Lambda environment variable encryption
- **KMS Key**: `LambdaKMSKey` with appropriate IAM policies
- **Encryption**: All environment variables encrypted at rest
- **Key Alias**: `alias/mte-lambda-{Stage}` for easy identification

### DynamoDB Security Issues

### 5. ✅ CKV_AWS_119: Tables not encrypted with KMS CMK (2 tables)
**Solution**: Implemented customer-managed KMS encryption for all DynamoDB tables
- **KMS Key**: `DynamoDBKMSKey` dedicated for DynamoDB encryption
- **Tables**: SessionsTable and MessagesTable now use KMS encryption
- **Key Alias**: `alias/mte-dynamodb-{Stage}` for easy identification

### 6. ✅ CKV_AWS_28: Point-in-time recovery not enabled (2 tables)
**Solution**: Enabled point-in-time recovery for all DynamoDB tables
- **Configuration**: `PointInTimeRecoveryEnabled: true` for both tables
- **Benefit**: Continuous backups with 35-day retention
- **Recovery**: Point-in-time recovery to any second within retention period

### 7. ✅ DYNAMODB_TABLE_ENCRYPTED_KMS: Missing KMS encryption (14 violations)
**Solution**: Comprehensive KMS encryption implementation
- **SSE Configuration**: Server-side encryption enabled with customer-managed KMS key
- **Key Management**: Dedicated DynamoDB KMS key with proper IAM policies
- **Compliance**: Addresses all KMS encryption requirements

### S3 Security Issues

### 8. ✅ CKV_AWS_18: Access logging not enabled
**Solution**: Dedicated S3 bucket for access logging
- **Logging Bucket**: `AccessLoggingBucket` for centralized access logs
- **Bucket Policy**: `AccessLoggingBucketPolicy` allows S3 logging service access
- **Configuration**: Website bucket logs to dedicated logging bucket with proper permissions
- **Retention**: 90-day lifecycle policy for log management

### 9. ✅ CKV_AWS_21: Versioning not enabled
**Solution**: S3 versioning enabled on all buckets
- **Versioning**: Enabled on website, logging, and failover buckets
- **Lifecycle**: Automatic cleanup of old versions
- **Protection**: Prevents accidental deletion and provides rollback capability

### 10. ✅ S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED: Missing encryption
**Solution**: SSE-S3 encryption on all S3 buckets
- **Algorithm**: AES256 server-side encryption
- **BucketKeyEnabled**: Reduces encryption costs
- **Coverage**: All buckets (website, logging, failover) encrypted

### 11. ✅ S3_BUCKET_LOGGING_ENABLED: Missing access logs
**Solution**: Comprehensive access logging implementation
- **Target Bucket**: Dedicated access logging bucket with proper IAM policy
- **Service Principal**: `logging.s3.amazonaws.com` granted PutObject permissions
- **Log Prefix**: Organized log structure with `website-access-logs/` prefix
- **Security**: Source account and ARN validation in bucket policy
- **Monitoring**: Track all access patterns and requests

### 12. ✅ S3_BUCKET_VERSIONING_ENABLED: Versioning disabled
**Solution**: Versioning enabled with lifecycle management
- **Status**: Enabled on all buckets
- **Lifecycle**: Automatic transition and cleanup policies
- **Cost Optimization**: Old versions moved to cheaper storage classes

### 13. ✅ S3_BUCKET_REPLICATION_ENABLED: No replication configured
**Solution**: Cross-region replication to failover bucket
- **Replication Rule**: Uploads folder replicated to failover bucket
- **Storage Class**: STANDARD_IA for cost optimization
- **IAM Role**: Dedicated replication role with minimal permissions

## New Infrastructure Components

### VPC Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        VPC (10.0.0.0/16)                   │
├─────────────────────────┬───────────────────────────────────┤
│    Public Subnet 1      │         Public Subnet 2          │
│     (10.0.1.0/24)       │          (10.0.2.0/24)           │
│   ┌─────────────────┐   │     ┌─────────────────────────┐   │
│   │   NAT Gateway   │   │     │     NAT Gateway         │   │
│   └─────────────────┘   │     └─────────────────────────┘   │
├─────────────────────────┼───────────────────────────────────┤
│   Private Subnet 1      │        Private Subnet 2          │
│    (10.0.11.0/24)       │         (10.0.12.0/24)           │
│  ┌─────────────────┐    │    ┌─────────────────────────┐    │
│  │ Lambda Functions│    │    │   Lambda Functions     │    │
│  └─────────────────┘    │    └─────────────────────────┘    │
└─────────────────────────┴───────────────────────────────────┘
```

### Security Groups
- **LambdaSecurityGroup**: Allows HTTPS (443) and HTTP (80) outbound
- **VPCEndpointSecurityGroup**: Allows HTTPS (443) from Lambda security group

### VPC Endpoints
- **Gateway Endpoints**: DynamoDB, S3 (no additional charges)
- **Interface Endpoints**: Bedrock, Cognito, SQS, KMS (charges apply)

### S3 Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    S3 Security Architecture                 │
├─────────────────────────────────────────────────────────────┤
│  WebsiteBucket          AccessLoggingBucket    FailoverBucket│
│  ┌─────────────────┐    ┌─────────────────┐   ┌─────────────┐│
│  │ • SSE-S3        │    │ • SSE-S3        │   │ • SSE-S3    ││
│  │ • Versioning    │───▶│ • Versioning    │   │ • Versioning││
│  │ • Replication   │    │ • Lifecycle     │◀──│ • STANDARD_IA││
│  │ • Lifecycle     │    │ • 90d retention │   │             ││
│  │ • CORS          │    └─────────────────┘   └─────────────┘│
│  └─────────────────┘                                        │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐                                        │
│  │ CloudFront CDN  │                                        │
│  │ • OAC Security  │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### DynamoDB Security Enhancements
- **KMS Encryption**: Customer-managed KMS key for all DynamoDB tables
- **Point-in-Time Recovery**: Enabled for both SessionsTable and MessagesTable
- **Backup Retention**: 35-day continuous backup window
- **Encryption at Rest**: All table data encrypted with DynamoDBKMSKey
- **Tags**: Comprehensive tagging for resource management and compliance

## Deployment Steps

### 1. Pre-deployment Checklist
- [ ] Backup existing deployment configuration
- [ ] Review parameter values in `samconfig.toml`
- [ ] Ensure AWS CLI profile has necessary permissions
- [ ] Verify region supports all required services
- [ ] Confirm S3 bucket names are globally unique

### 2. Deploy Security Infrastructure
```bash
# Build the SAM application
sam build --profile default

# Deploy with security enhancements
sam deploy --profile default --parameter-overrides \
  LambdaConcurrencyLimit=10 \
  Stage=dev \
  --capabilities CAPABILITY_NAMED_IAM
```

### 3. Post-deployment Verification
```bash
# Verify VPC configuration
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=mte-vpc-*" --profile default

# Check Lambda function VPC configuration
aws lambda list-functions --profile default | jq '.Functions[] | select(.VpcConfig != null) | {FunctionName, VpcConfig}'

# Verify KMS keys
aws kms describe-key --key-id alias/mte-lambda-dev --profile default
aws kms describe-key --key-id alias/mte-dynamodb-dev --profile default

# Check Dead Letter Queue
aws sqs get-queue-attributes --queue-url $(aws sqs get-queue-url --queue-name mte-lambda-dlq-dev --profile default --output text) --attribute-names All --profile default

# Verify DynamoDB encryption and PITR
aws dynamodb describe-table --table-name mte-sessions --profile default | jq '.Table | {TableName, SSEDescription, PointInTimeRecoveryDescription}'
aws dynamodb describe-table --table-name mte-messages --profile default | jq '.Table | {TableName, SSEDescription, PointInTimeRecoveryDescription}'

# Check S3 bucket security
aws s3api get-bucket-encryption --bucket mte-prechat-website-dev-$(aws sts get-caller-identity --query Account --output text) --profile default
aws s3api get-bucket-versioning --bucket mte-prechat-website-dev-$(aws sts get-caller-identity --query Account --output text) --profile default
aws s3api get-bucket-replication --bucket mte-prechat-website-dev-$(aws sts get-caller-identity --query Account --output text) --profile default
aws s3api get-bucket-logging --bucket mte-prechat-website-dev-$(aws sts get-caller-identity --query Account --output text) --profile default
```

## Cost Impact Analysis

### New Resources and Estimated Costs (Monthly)

#### VPC Components (No additional charges)
- VPC, Subnets, Route Tables, Internet Gateway: **$0**
- Security Groups: **$0**

#### NAT Gateways (Primary cost driver)
- 2 NAT Gateways: **~$90/month** ($45 each)
- Data processing: **$0.045/GB** processed

#### VPC Endpoints
- Gateway Endpoints (DynamoDB, S3): **$0**
- Interface Endpoints (4 endpoints): **~$28/month** ($7 each)
- Data processing: **$0.01/GB** processed

#### KMS Keys
- Lambda KMS key: **$1/month**
- DynamoDB KMS key: **$1/month**
- API requests: **$0.03/10,000 requests**

#### DynamoDB Point-in-Time Recovery
- Continuous backups: **~$0.20/GB/month** (based on table size)
- Estimated cost: **~$5-10/month** (depends on data volume)

#### S3 Storage and Features
- Access logging bucket storage: **~$2-5/month**
- Failover bucket storage: **~$5-10/month** (STANDARD_IA)
- Replication data transfer: **~$3-5/month**
- Versioning overhead: **~$2-3/month**

#### Dead Letter Queue
- SQS queue: **$0** (within free tier for typical usage)

**Total Estimated Additional Cost: ~$140-150/month**

### Cost Optimization Options

1. **Single AZ Deployment** (Development only)
   - Use only one NAT Gateway: **Save ~$45/month**
   - Reduce to 2 Interface VPC Endpoints: **Save ~$14/month**

2. **S3 Lifecycle Optimization**
   - Aggressive lifecycle policies: **Save ~$5-10/month**
   - Intelligent Tiering: **Optimize storage costs automatically**

3. **Conditional Features**
   - Deploy replication only in production: **Save ~$8-15/month in dev**
   - Reduce logging retention: **Save ~$2-3/month**

## Security Benefits

### Enhanced Security Posture
1. **Network Isolation**: Lambda functions isolated in private subnets
2. **Encryption at Rest**: All data encrypted with customer-managed KMS keys
3. **Error Handling**: Failed executions captured in Dead Letter Queue
4. **Resource Control**: Concurrent execution limits prevent resource exhaustion
5. **Audit Trail**: Comprehensive logging and monitoring
6. **Data Protection**: S3 versioning and replication for data durability
7. **Access Monitoring**: S3 access logging for security analysis

### Compliance Improvements
- Addresses CIS AWS Foundations Benchmark recommendations
- Improves SOC 2 Type II compliance posture
- Enhances data protection and privacy controls
- Meets enterprise security requirements for encryption and logging

## Monitoring and Alerting

### CloudWatch Metrics to Monitor
- Lambda function errors and duration
- Dead Letter Queue message count
- NAT Gateway data processing
- VPC Endpoint usage
- S3 bucket access patterns
- DynamoDB read/write capacity and errors

### Recommended Alarms
```bash
# Dead Letter Queue alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "Lambda-DLQ-Messages" \
  --alarm-description "Alert when messages appear in Lambda DLQ" \
  --metric-name ApproximateNumberOfVisibleMessages \
  --namespace AWS/SQS \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=QueueName,Value=mte-lambda-dlq-dev \
  --profile default

# S3 bucket access monitoring
aws cloudwatch put-metric-alarm \
  --alarm-name "S3-Unusual-Access-Pattern" \
  --alarm-description "Alert on unusual S3 access patterns" \
  --metric-name NumberOfObjects \
  --namespace AWS/S3 \
  --statistic Average \
  --period 3600 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --profile default
```

## Troubleshooting

### Common Issues

1. **Lambda Timeout in VPC**
   - **Cause**: VPC Endpoint not configured or NAT Gateway issues
   - **Solution**: Verify VPC Endpoint connectivity and NAT Gateway routing

2. **KMS Access Denied**
   - **Cause**: Lambda execution role lacks KMS permissions
   - **Solution**: Verify KMS key policy includes Lambda service principal

3. **S3 Replication Failures**
   - **Cause**: IAM role permissions or bucket policies
   - **Solution**: Check S3ReplicationRole permissions and destination bucket policy

4. **High S3 Costs**
   - **Cause**: Excessive versioning or replication
   - **Solution**: Implement lifecycle policies and optimize replication rules

### Debugging Commands
```bash
# Check Lambda function configuration
aws lambda get-function --function-name <function-name> --profile default

# Test VPC connectivity
aws ec2 describe-vpc-endpoints --profile default

# Monitor S3 replication status
aws s3api get-bucket-replication --bucket <bucket-name> --profile default

# Check S3 access logs
aws s3 ls s3://mte-prechat-access-logs-dev-<account-id>/website-access-logs/ --profile default
```

## Rollback Plan

If issues arise, rollback steps:

1. **Immediate Rollback**
   ```bash
   # Deploy previous version
   sam deploy --profile default --parameter-overrides \
     LambdaConcurrencyLimit=1000 \
     Stage=dev \
     --no-confirm-changeset
   ```

2. **Remove VPC Configuration** (if needed)
   - Update Globals section to remove VpcConfig
   - Redeploy without VPC constraints

3. **S3 Rollback**
   - Disable replication if causing issues
   - Restore from versioned objects if needed

## Next Steps

1. **Monitor Performance**: Track Lambda cold starts and execution times
2. **Cost Optimization**: Review S3 storage patterns and optimize lifecycle policies
3. **Security Hardening**: Implement additional security controls as needed
4. **Documentation**: Update operational runbooks with new architecture
5. **Backup Testing**: Regularly test DynamoDB point-in-time recovery
6. **Access Review**: Monitor S3 access logs for unusual patterns

## Support

For issues or questions regarding this security implementation:
1. Check CloudWatch logs for Lambda function errors
2. Review VPC Flow Logs for network connectivity issues
3. Monitor Dead Letter Queue for failed executions
4. Analyze S3 access logs for security incidents
5. Consult AWS documentation for best practices