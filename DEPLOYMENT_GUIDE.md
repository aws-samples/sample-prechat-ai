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
   - **Claude Sonnet 4.5** (global.anthropic.claude-sonnet-4-5-20250929-v1:0)
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
chmod +x deploy-website.sh
chmod +x update-env-vars.sh
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

## Makefile을 이용한 선택적 배포

`Makefile`을 사용하면 git diff 기반으로 변경된 컴포넌트만 선택적으로 배포할 수 있습니다.

### 기본 사용법

```bash
# 변경분 기반 자동 선택 배포
make deploy PROFILE=default STAGE=dev

# 배포 계획만 확인 (dry-run)
make plan

# 전체 배포 (deploy-full.sh 대체)
make deploy-all PROFILE=prechat STAGE=prod REGION=ap-northeast-2 BEDROCK_KB_ID=ABCDEFGHIJ
```

### 컴포넌트별 배포

```bash
# SAM 백엔드만
make deploy-backend PROFILE=prechat STAGE=prod

# 프론트엔드만
make deploy-website STAGE=prod PROFILE=prechat REGION=ap-northeast-2

# 변경된 에이전트만
make deploy-agents PROFILE=prechat STAGE=prod

# 개별 에이전트 (SSM 파라미터 자동 등록 포함)
make deploy-agent-ship PROFILE=prechat STAGE=prod
make deploy-agent-consultation PROFILE=prechat STAGE=prod
make deploy-agent-summary PROFILE=prechat STAGE=prod
make deploy-agent-planning PROFILE=prechat STAGE=prod
```

### 변경 감지 규칙

| 변경 대상 | 배포 범위 |
|-----------|----------|
| `packages/backend/shared/` | SAM 전체 (Lambda Layer 영향) |
| `packages/backend/{도메인}/` | SAM 배포 (해당 Lambda) |
| `template.yaml` | SAM 전체 배포 |
| `packages/web-app/` | 프론트엔드만 |
| `packages/strands-agents/{에이전트}/` | 해당 에이전트만 |

### diff 기준 변경

```bash
# main 브랜치 대비 변경분
make plan DIFF_BASE=main

# 특정 커밋 대비
make plan DIFF_BASE=abc1234
```

## 리소스 정리

배포된 리소스를 삭제하려면:

```bash
# CloudFormation 스택 삭제
aws cloudformation delete-stack --stack-name mte-prechat --profile default
```

## 라이선스

### 📄 라이선스 정보

이 프로젝트는 **MIT No Attribution License (MIT-0)** 하에 배포됩니다.

### ✅ 허용되는 사용

- **무제한 사용**: 개인, 교육, 상업적 목적 모두 자유롭게 사용 가능
- **수정 및 배포**: 코드 수정, 재배포, 서브라이선스 허용
- **상업적 활용**: SaaS, 컨설팅, 재판매 등 모든 상업적 사용 허용
- **저작자 표시 불필요**: 별도의 저작자 표시나 라이선스 고지 의무 없음

### 📋 라이선스 특징

MIT-0는 가장 관대한 오픈소스 라이선스 중 하나로:
- 어떠한 제약 조건도 없음
- 저작자 표시 의무 없음
- 상업적 사용 완전 허용
- 법적 분쟁 위험 최소화

### 🔗 자세한 라이선스 내용

- **영문**: [LICENSE](LICENSE) 파일 참조
- **한글**: [LICENSE-KOR](LICENSE-KOR) 파일 참조
- **공식 라이선스**: https://opensource.org/licenses/MIT-0
