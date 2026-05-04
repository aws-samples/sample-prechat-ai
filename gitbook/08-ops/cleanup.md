---
description: 워크샵 종료 후 AWS 리소스를 안전하게 정리
icon: broom
---

# 리소스 정리 (Cleanup)

워크샵이 끝났다면 불필요한 비용 발생을 막기 위해 리소스를 정리합니다.

{% hint style="danger" %}
Cleanup은 되돌릴 수 없는 작업입니다. 세션 데이터, 캠페인, 대화 로그가 모두 삭제됩니다. 필요한 데이터는 미리 **내보내기**를 완료하고 진행하세요.
{% endhint %}

## 정리 범위

| 대상 | 정리 방법 |
|------|---------|
| SAM 스택 (Lambda, API Gateway, DynamoDB, Cognito, CloudFront 등) | `aws cloudformation delete-stack` |
| Strands 에이전트 (Bedrock AgentCore Runtime) | AgentCore 콘솔에서 수동 삭제 |
| SSM 파라미터 | `aws ssm delete-parameters` |
| S3 버킷의 업로드 파일 | CloudFormation 삭제 전 수동 비우기 필요 |
| ECR 리포지토리 (에이전트 이미지) | 콘솔에서 수동 삭제 |
| CloudWatch Logs | 리텐션 설정에 따라 자동 만료, 수동 즉시 삭제도 가능 |

## 1. 데이터 백업 (선택)

보관하고 싶은 데이터가 있다면 먼저 내보냅니다.

### 세션 데이터 내보내기

```bash
# DynamoDB 테이블을 S3로 내보내기 (PITR 활성화 필요)
aws dynamodb export-table-to-point-in-time \
  --table-arn $(aws dynamodb describe-table --table-name mte-prechat-workshop-sessions-dev --query 'Table.TableArn' --output text) \
  --s3-bucket your-backup-bucket \
  --s3-prefix prechat-backup/sessions/

# Messages 테이블도 동일하게
aws dynamodb export-table-to-point-in-time \
  --table-arn $(aws dynamodb describe-table --table-name mte-prechat-workshop-messages-dev --query 'Table.TableArn' --output text) \
  --s3-bucket your-backup-bucket \
  --s3-prefix prechat-backup/messages/
```

PITR이 활성화되어 있지 않은 경우 Scan API로 수동 내보냅니다.

## 2. S3 버킷 비우기

CloudFormation은 비어 있지 않은 S3 버킷을 삭제하지 못합니다. 먼저 비웁니다.

```bash
STACK=mte-prechat-workshop
REGION=ap-northeast-2

# 웹사이트 버킷
WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' \
  --output text)

# Failover 버킷
FAILOVER_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FailoverBucket`].OutputValue' \
  --output text)

# 버전 포함 완전 비우기
aws s3api delete-objects --bucket $WEBSITE_BUCKET \
  --delete "$(aws s3api list-object-versions --bucket $WEBSITE_BUCKET \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" 2>/dev/null || true

aws s3 rm s3://$WEBSITE_BUCKET --recursive
aws s3 rm s3://$FAILOVER_BUCKET --recursive
```

## 3. 에이전트 수동 삭제

AgentCore Runtime은 CloudFormation 관리 밖에 있으므로 수동 삭제합니다.

{% stepper %}
{% step %}
### AgentCore 콘솔 진입

AWS Console → **Amazon Bedrock** → 좌측 **AgentCore** → **Runtime**
{% endstep %}

{% step %}
### PreChat 관련 런타임 선택

`prechat-consultation-agent-*`, `prechat-summary-agent-*` 선택 후 **Delete**

**[사진첨부]** AgentCore Runtime 삭제 버튼
{% endstep %}

{% step %}
### ECR 리포지토리 삭제

런타임과 연결된 Docker 이미지가 ECR에 남아 있습니다.

```bash
aws ecr describe-repositories \
  --region ap-northeast-2 \
  --query 'repositories[?contains(repositoryName, `prechat`) || contains(repositoryName, `bedrock-agentcore`)].repositoryName' \
  --output table
```

해당 리포지토리를 삭제합니다.

```bash
aws ecr delete-repository \
  --repository-name <repo-name> \
  --force \
  --region ap-northeast-2
```
{% endstep %}
{% endstepper %}

## 4. SSM 파라미터 삭제

```bash
aws ssm delete-parameters \
  --names "/prechat/dev/agents/consultation/runtime-arn" "/prechat/dev/agents/summary/runtime-arn" \
  --region ap-northeast-2
```

## 5. CloudFormation 스택 삭제

```bash
aws cloudformation delete-stack \
  --stack-name mte-prechat-workshop \
  --region ap-northeast-2

# 완료 대기 (10~15분 소요)
aws cloudformation wait stack-delete-complete \
  --stack-name mte-prechat-workshop \
  --region ap-northeast-2

echo "✅ Stack deletion completed"
```

### 삭제가 실패하면

가장 흔한 원인:

1. **S3 버킷이 비어 있지 않음** — 위 2번 단계 다시 수행
2. **DynamoDB 삭제 보호 활성화** — 콘솔에서 해제 후 재시도
3. **Cognito User Pool에 남아 있는 사용자** — 콘솔에서 수동 삭제 후 재시도

## 6. CloudWatch Logs 즉시 삭제 (선택)

리텐션으로 자동 만료되지만 즉시 비용을 낮추려면 삭제합니다.

```bash
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/mte-prechat-workshop \
  --query 'logGroups[].logGroupName' \
  --output text | tr '\t' '\n' | while read group; do
  aws logs delete-log-group --log-group-name "$group"
done
```

## 7. Bedrock 모델 액세스 유지/해제

Bedrock 모델 액세스는 리소스가 아니라 계정 속성이므로 별도로 지우지 않아도 됩니다. 다른 AWS 서비스 이용에 영향이 없습니다.

## 검증

정리가 제대로 됐는지 확인합니다.

```bash
# 스택이 사라졌는지
aws cloudformation describe-stacks --stack-name mte-prechat-workshop --region ap-northeast-2
# → An error occurred (ValidationError)... 가 나오면 OK

# SSM 파라미터
aws ssm get-parameters-by-path --path /prechat/dev --recursive --region ap-northeast-2
# → Parameters: [] 가 나오면 OK

# AgentCore 런타임
# 콘솔에서 prechat 관련 런타임이 없어야 함

# ECR 리포지토리
aws ecr describe-repositories --region ap-northeast-2 \
  --query 'repositories[?contains(repositoryName, `prechat`)]'
# → [] 가 나오면 OK
```

## 로컬 작업 정리

```bash
cd ~
rm -rf sample-prechat-ai/.aws-sam
# 레포지토리 자체가 필요 없다면
# rm -rf sample-prechat-ai
```

## 축하합니다

워크샵을 완료하고 정리까지 마쳤습니다. PreChat을 자사 환경에 도입하려는 경우 main 브랜치의 VPC 격리 버전을 기반으로 보안 요구사항을 추가하세요.
