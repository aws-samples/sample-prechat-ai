# 배포 가이드 (Deployment Guide)

이 가이드는 MTE Pre-consultation Chatbot을 다른 AWS 계정이나 리전에 배포하는 방법을 설명합니다.

## 사전 요구사항

### 1. AWS 계정 설정
- AWS CLI 설치 및 구성
- 적절한 IAM 권한 (CloudFormation, Lambda, DynamoDB, Bedrock, S3, CloudFront 등)
- AWS 프로필 설정 (기본값: `terraform`)

### 2. 필요한 AWS 서비스 액세스
다음 서비스들이 배포할 리전에서 사용 가능해야 합니다:
- Amazon Bedrock (모델 액세스 권한 필요)
- AWS Lambda
- Amazon DynamoDB
- Amazon S3
- Amazon CloudFront
- Amazon Cognito
- Amazon API Gateway

## 배포 단계

### 1. 리전별 설정

#### Bedrock 지원 리전
현재 지원되는 Bedrock 리전:
- `us-east-1` (버지니아 북부)
- `us-west-2` (오레곤)
- `ap-northeast-1` (도쿄)
- `ap-northeast-2` (서울) - 기본값
- `eu-west-1` (아일랜드)
- `eu-central-1` (프랑크푸르트)

### 2. samconfig.toml 수정

배포할 리전과 환경에 맞게 `samconfig.toml` 파일을 수정하세요:

```toml
[default.deploy.parameters]
region = "YOUR_TARGET_REGION"
parameter_overrides = "Stage=\"YOUR_STAGE\" BedrockRegion=\"YOUR_BEDROCK_REGION\" BedrockAgentRoleName=\"YOUR_ROLE_NAME\" BedrockAgentAliasId=\"YOUR_ALIAS_ID\" AllowedEmailDomains=\"YOUR_DOMAINS\""
```

예시:
```toml
# 미국 동부 리전에 개발 환경 배포
region = "us-east-1"
parameter_overrides = "Stage=\"dev\" BedrockRegion=\"us-east-1\" BedrockAgentRoleName=\"MyCompany-BedrockAgentRole\" BedrockAgentAliasId=\"TSTALIASID\" AllowedEmailDomains=\"mycompany.com\""

# 유럽 서부 리전에 프로덕션 환경 배포
region = "eu-west-1"
parameter_overrides = "Stage=\"prod\" BedrockRegion=\"eu-west-1\" BedrockAgentRoleName=\"MyCompany-BedrockAgentRole-Prod\" BedrockAgentAliasId=\"PRODALIASID\" AllowedEmailDomains=\"mycompany.com,partner.com\""
```

### 3. Bedrock 모델 액세스 설정

1. AWS Console → Amazon Bedrock → Model access
2. 필요한 모델들에 대한 액세스 요청:
   - Claude 3 Haiku
   - Claude 3 Sonnet
   - Claude 3.5 Sonnet
   - Amazon Nova 모델들
3. Cross-inference profiles 활성화 (해당 리전에서 지원하는 경우)

### 4. 인프라 배포

#### 옵션 1: 통합 배포 스크립트 (권장)
```bash
# 기본 설정으로 배포 (ap-northeast-2 리전, dev 스테이지)
./deploy-full.sh

# 커스텀 설정으로 배포
./deploy-full.sh AWS_PROFILE STAGE REGION BEDROCK_REGION STACK_NAME

# 예시: 미국 동부 리전에 프로덕션 환경 배포
./deploy-full.sh default prod us-east-1 us-east-1 my-prechat-stack
```

#### 옵션 2: 단계별 배포
```bash
# 1. 의존성 설치
yarn install

# 2. SAM 빌드
yarn sam:build

# 3. SAM 배포
sam deploy --profile YOUR_PROFILE --region YOUR_REGION \
  --parameter-overrides "Stage=\"YOUR_STAGE\" BedrockRegion=\"YOUR_BEDROCK_REGION\""

# 4. 환경 변수 업데이트 (API Gateway URL 자동 설정)
./update-env-vars.sh YOUR_AWS_PROFILE YOUR_STAGE YOUR_REGION YOUR_STACK_NAME

# 5. 웹사이트 빌드 및 배포
./deploy-website.sh YOUR_STAGE YOUR_AWS_PROFILE YOUR_REGION YOUR_STACK_NAME
```

### 5. 배포 후 확인

배포가 완료되면 다음을 확인하세요:

1. **CloudFormation 스택 상태**: AWS Console에서 스택이 성공적으로 생성되었는지 확인
2. **API Gateway**: 엔드포인트가 정상적으로 생성되었는지 확인
3. **Bedrock Agents**: 에이전트 생성 및 준비 상태 확인
4. **웹사이트**: CloudFront URL을 통해 웹사이트 접근 가능 여부 확인

## 환경별 배포

### 개발 환경 (Development)
```bash
# 통합 배포 스크립트 사용
./deploy-full.sh default dev ap-northeast-2

# 또는 단계별 배포
./update-env-vars.sh default dev ap-northeast-2 mte-prechat
./deploy-website.sh dev default ap-northeast-2 mte-prechat
```

### 프로덕션 환경 (Production)
```bash
# 통합 배포 스크립트 사용
./deploy-full.sh default prod ap-northeast-2

# 또는 단계별 배포
./update-env-vars.sh default prod ap-northeast-2 mte-prechat
./deploy-website.sh prod default ap-northeast-2 mte-prechat
```

### 다중 리전 배포 예시
```bash
# 미국 동부 리전에 배포
./deploy-full.sh default prod us-east-1 us-east-1 mte-prechat-us

# 유럽 서부 리전에 배포
./deploy-full.sh default prod eu-west-1 eu-west-1 mte-prechat-eu

# 도쿄 리전에 배포 (Bedrock은 서울 리전 사용)
./deploy-full.sh default prod ap-northeast-1 ap-northeast-2 mte-prechat-jp
```

## 트러블슈팅

### 일반적인 문제들

1. **Bedrock 모델 액세스 오류**
   - 해당 리전에서 모델 액세스가 승인되었는지 확인
   - Cross-inference profiles 설정 확인

2. **CloudFormation 배포 실패**
   - IAM 권한 확인
   - 리전별 서비스 가용성 확인
   - 리소스 이름 충돌 확인

3. **API Gateway 연결 오류**
   - 환경 변수 파일이 올바르게 업데이트되었는지 확인
   - CORS 설정 확인

4. **웹사이트 배포 오류**
   - S3 버킷 권한 확인
   - CloudFront 배포 상태 확인

## 정리 (Clean Up)

리소스를 삭제하려면:

```bash
# CloudFormation 스택 삭제
aws cloudformation delete-stack --stack-name YOUR_STACK_NAME --profile YOUR_PROFILE

# S3 버킷 내용 삭제 (필요한 경우)
aws s3 rm s3://mte-prechat-website-STAGE-ACCOUNT_ID --recursive --profile YOUR_PROFILE
```

## 스크립트 파라미터 설명

### deploy-full.sh
```bash
./deploy-full.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_REGION] [STACK_NAME]
```
- **AWS_PROFILE**: AWS CLI 프로파일 (기본값: `default`)
- **STAGE**: 배포 환경 (기본값: `dev`)
- **REGION**: AWS 리전 (기본값: `ap-northeast-2`)
- **BEDROCK_REGION**: Bedrock 서비스 리전 (기본값: REGION과 동일)
- **STACK_NAME**: CloudFormation 스택 이름 (기본값: `mte-prechat`)

### deploy-website.sh
```bash
./deploy-website.sh [STAGE] [AWS_PROFILE] [REGION] [STACK_NAME]
```

### update-env-vars.sh
```bash
./update-env-vars.sh [AWS_PROFILE] [STAGE] [REGION] [STACK_NAME]
```

## CloudFormation 파라미터 설명

### 필수 파라미터
- **Stage**: 배포 환경 (`dev`, `prod`)
- **BedrockRegion**: Bedrock 서비스를 사용할 AWS 리전
- **BedrockAgentRoleName**: Bedrock Agent가 사용할 IAM 역할 이름
- **BedrockAgentAliasId**: Bedrock Agent 호출 시 사용할 Alias ID
- **AllowedEmailDomains**: 사용자 등록을 허용할 이메일 도메인 (쉼표로 구분)

### 파라미터 예시
```bash
# 개발 환경
Stage="dev"
BedrockRegion="ap-northeast-2"
BedrockAgentRoleName="MyCompany-BedrockAgentRole-Dev"
BedrockAgentAliasId="TSTALIASID"
AllowedEmailDomains="mycompany.com,contractor.com"

# 프로덕션 환경
Stage="prod"
BedrockRegion="us-east-1"
BedrockAgentRoleName="MyCompany-BedrockAgentRole-Prod"
BedrockAgentAliasId="PRODALIASID"
AllowedEmailDomains="mycompany.com"
```

## 보안 고려사항

1. **Cognito 사용자 풀**: `AllowedEmailDomains` 파라미터로 허용된 이메일 도메인 제한
2. **IAM 역할**: Bedrock Agent 역할에 최소 권한 원칙 적용
3. **API Gateway**: 적절한 인증 및 권한 부여 설정
4. **S3 버킷**: 퍼블릭 액세스 차단 설정 유지
5. **CloudFront**: HTTPS 리디렉션 설정 확인

## 지원

배포 관련 문제가 있으면 다음을 확인하세요:
1. AWS 서비스 상태 페이지
2. CloudFormation 이벤트 로그
3. Lambda 함수 로그 (CloudWatch)
4. API Gateway 액세스 로그