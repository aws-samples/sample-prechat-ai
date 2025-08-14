# 배포 가이드 (Deployment Guide)

AWS PreChat - 사전상담 챗봇을 AWS 환경에 배포하는 간단한 가이드입니다.

## 필요한 CLI 도구

다음 도구들이 설치되어 있어야 합니다:

- **AWS CLI v2**: AWS 서비스와 상호작용
- **AWS SAM CLI**: 서버리스 애플리케이션 배포
- **Node.js v20+**: 프론트엔드 빌드
- **Yarn v1.22+**: 패키지 관리

```bash
# AWS CLI 설치 확인
aws --version

# SAM CLI 설치 확인
sam --version

# Node.js 설치 확인
node --version

# Yarn 설치 확인
yarn --version
```

## Bedrock 모델 액세스 설정

배포 전에 Amazon Bedrock에서 필요한 모델들에 대한 액세스를 요청해야 합니다:

1. **AWS Console** → **Amazon Bedrock** → **Model access**
2. 다음 모델들에 대한 액세스 요청:
   - **Claude 3 Haiku** (apac.anthropic.claude-3-haiku-20240307-v1:0)
   - **Claude 3 Sonnet** (apac.anthropic.claude-3-sonnet-20240229-v1:0)
   - **Claude 3.5 Sonnet** (apac.anthropic.claude-3-5-sonnet-20241022-v2:0)
   - **Amazon Nova Micro** (apac.amazon.nova-micro-v1:0)
   - **Amazon Nova Lite** (apac.amazon.nova-lite-v1:0)
   - **Amazon Nova Pro** (apac.amazon.nova-pro-v1:0)

> **참고**: 모델 액세스 승인에는 몇 분에서 몇 시간이 소요될 수 있습니다.

## 스크립트 파라미터 이해하기

배포 스크립트는 다음과 같은 구조를 가집니다:

```bash
./deploy-full.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_REGION] [STACK_NAME]
```

### 각 파라미터의 의미

| 순서 | 파라미터 | 기본값 | 설명 | 예시 |
|------|---------|--------|------|------|
| 1 | **AWS_PROFILE** | `default` | AWS CLI에서 사용할 프로파일 이름 | `default`, `production`, `dev-team` |
| 2 | **STAGE** | `dev` | 배포 환경 (개발/프로덕션) | `dev`, `prod` |
| 3 | **REGION** | `ap-northeast-2` | 인프라를 배포할 AWS 리전 | `us-east-1`, `eu-west-1`, `ap-northeast-2` |
| 4 | **BEDROCK_REGION** | REGION과 동일 | Bedrock AI 모델을 사용할 리전 | `ap-northeast-2`, `us-east-1` |
| 5 | **STACK_NAME** | `mte-prechat` | CloudFormation 스택 이름 | `my-company-prechat`, `prechat-prod` |

### 파라미터 선택 가이드

**AWS_PROFILE**: 
- `~/.aws/credentials`에 설정된 프로파일 이름
- 여러 AWS 계정을 관리할 때 사용

**STAGE**:
- `dev`: 개발/테스트 환경 (비용 최적화)
- `prod`: 프로덕션 환경 (고가용성)

**REGION vs BEDROCK_REGION**:
- **REGION**: 웹사이트, API, 데이터베이스가 배포될 리전
- **BEDROCK_REGION**: AI 모델이 실행될 리전 (Bedrock 지원 리전만 가능)
- 보통 같은 리전을 사용하지만, Bedrock 미지원 리전에서는 다를 수 있음

## 배포 방법

### 1. 실행 권한 설정
```bash
chmod +x deploy-full.sh
```

### 3. 기본 배포
```bash
# 프로덕션 환경으로 배포
./deploy-full.sh default prod ap-northeast-2 ap-northeast-2
```

### 3. 커스텀 스택 이름으로 배포
```bash
# 회사명을 포함한 스택 이름 사용
./deploy-full.sh default prod ap-northeast-2 ap-northeast-2 my-company-prechat
```

## 배포 완료 후

배포가 성공하면 다음과 같은 정보가 출력됩니다:

```bash
✅ Full deployment completed successfully!
🎉 Your MTE PreChat application is ready!

📋 Deployment Summary:
   🔗 API URL: https://abcd1234.execute-api.ap-northeast-2.amazonaws.com/dev/api
   🌐 Website URL: https://d1234567890.cloudfront.net
   🌍 Region: ap-northeast-2
   🤖 Bedrock Region: ap-northeast-2
   📋 Stage: dev

🎯 Next steps:
   1. Access the admin dashboard at: https://d1234567890.cloudfront.net/admin
   2. Create your first Bedrock Agent
   3. Create customer sessions and start chatting!
```

- 배포후 진행할 사항:

  - 웹사이트 S3 버킷 정책에서 CloudFront OAC 를 허용하고 있는지 재확인합니다.
  - AWS PreChat 에 접속하고 Sign-up 및 Sign-in 을 진행합니다.
  - AWS PreChat 에서 PreChat Agent 를 생성합니다. (Amazon Bedrock Agents)

## 리소스 정리

배포된 리소스를 삭제하려면:

```bash
# CloudFormation 스택 삭제
aws cloudformation delete-stack --stack-name mte-prechat --profile default
```

## 라이선스

### 📄 라이선스 정보

이 프로젝트는 **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)** 하에 배포됩니다.

### ✅ 허용되는 사용

- **개인 학습 및 연구**: 개인적인 학습이나 연구 목적으로 자유롭게 사용
- **교육 목적**: 대학, 학교 등 교육 기관에서의 교육 목적 사용
- **오픈소스 프로젝트**: 비영리 오픈소스 프로젝트에서의 활용
- **내부 도구**: 회사 내부 도구로 사용 (외부 고객 대상 서비스 제외)

### ❌ 제한되는 사용

- **상업적 서비스**: 고객에게 유료로 제공하는 서비스
- **SaaS 플랫폼**: 구독 기반 또는 유료 서비스로 운영
- **컨설팅 서비스**: 이 코드를 기반으로 한 유료 컨설팅
- **재판매**: 코드나 솔루션을 제3자에게 판매

### 🤝 상업적 사용 문의

상업적 목적으로 사용하고 싶으시다면 **aws-prechat@amazon.com**으로 연락해 주세요.

- 조직 대 조직 간 구체적 협의 필요

### 📋 라이선스 준수 방법

이 프로젝트를 사용할 때는 다음을 포함해 주세요:

```
Based on AWS PreChat
Copyright (c) 2025 AWS PreChat
Licensed under CC BY-NC 4.0
```

### 🔗 자세한 라이선스 내용

- **영문**: [LICENSE](LICENSE) 파일 참조
- **한글**: [LICENSE-KOR](LICENSE-KOR) 파일 참조
- **공식 라이선스**: https://creativecommons.org/licenses/by-nc/4.0/
