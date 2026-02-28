# PreChat: AWS 기반 AI 사전 상담 시스템

> Amazon Bedrock AgentCore + Strands SDK를 활용한 대화형 사전 상담 시스템

[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange.svg)](https://aws.amazon.com/serverless/)
[![Node.js](https://img.shields.io/badge/Node.js-20.18.1-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)

Last Updated: 2026-02-28

[English](README.md) | **한국어**

## 개요

PreChat은 전통적인 폼 기반 데이터 수집을 AI 챗봇 인터페이스로 대체하는 사전 상담 시스템입니다. 고객과의 자연스러운 대화를 통해 비즈니스 요구사항을 수집하고, BANT 분석 리포트와 미팅 플랜을 자동 생성합니다.

### 핵심 기능

- **대화형 상담**: Strands SDK 에이전트가 고객과 구조화된 대화를 진행
- **BANT 분석**: 상담 완료 후 AI가 Budget/Authority/Need/Timeline 프레임워크로 자동 분석
- **미팅 플랜 생성**: 유사 고객사례 검색(KB RAG) + AWS Documentation MCP 연동
- **실시간 스트리밍**: WebSocket 기반 SSE 스트리밍 응답
- **다국어 지원**: 한국어/영어 완전 지원 (i18n)
- **이벤트 트리거**: 세션 완료 시 Slack/SNS 자동 알림

## 배포 후 주요 화면

| 섹션 | 설명 | 미리보기 |
|------|------|---------|
| **고객 채팅 인터페이스** | 고객이 가이드된 대화에 참여하는 인터랙티브 챗봇. 실시간 AI 응답, 모바일 반응형 디자인, PIN 보호 세션을 제공합니다. | ![Customer Chat](repo/images/customer_chat.png) |
| **관리자 대시보드** | 상담 세션 관리 인터페이스. 세션 생성, 모니터링, AI 생성 리포트 및 대화 이력을 포함한 분석 기능을 제공합니다. | ![Admin Dashboard](repo/images/admin_dashboard.png) |
| **미팅 로그 분석** | AI 기반 분석 및 리포팅 시스템. 대화 데이터로부터 세션 요약, 인사이트, 상담 효과 지표를 생성합니다. | ![Meeting Log Analysis](repo/images/meetlog_analysis.png) |

## 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│   React SPA     │     │   API Gateway    │     │   Lambda Functions       │
│  (CloudFront)   │◄───►│   (REST + WS)    │◄───►│   (Python 3.13)          │
│  Cloudscape UI  │     │                  │     │   도메인별 격리           │
└─────────────────┘     └──────────────────┘     └──────────┬───────────────┘
                                                            │
┌─────────────────┐     ┌──────────────────┐     ┌──────────▼───────────────┐
│  Cognito        │     │   DynamoDB       │     │  Bedrock AgentCore       │
│  (Admin Auth)   │     │  (KMS 암호화)     │     │  ┌─────────────────────┐ │
└─────────────────┘     │  Sessions Table  │     │  │ Consultation Agent  │ │
                        │  Messages Table  │     │  │ Summary Agent       │ │
┌─────────────────┐     │  Campaigns Table │     │  │ Planning Agent      │ │
│  S3 + CloudFront│     └──────────────────┘     │  └─────────────────────┘ │
│  (Static + Files)│                             │  Strands SDK + MCP       │
└─────────────────┘                              └──────────────────────────┘
```

## 프로젝트 구조

```
prechat/
├── packages/
│   ├── backend/              # Python Lambda (도메인별 분리)
│   │   ├── session/          # 세션 CRUD, PIN 인증, 메시지
│   │   ├── campaign/         # 캠페인 CRUD, 분석
│   │   ├── admin/            # 관리자 API, 커스터마이징
│   │   ├── auth/             # Cognito 인증
│   │   ├── agent/            # Agent 관리/설정
│   │   ├── trigger/          # 이벤트 트리거 (Slack/SNS)
│   │   ├── file/             # 파일 업로드 (S3)
│   │   ├── stream/           # DynamoDB Streams
│   │   ├── websocket/        # WebSocket 핸들러
│   │   ├── meeting/          # 미팅 플랜
│   │   ├── migration/        # 마이그레이션
│   │   └── shared/           # Lambda Layer 공통 코드
│   ├── web-app/              # React SPA (Vite + Cloudscape)
│   └── strands-agents/       # Strands SDK AI 에이전트 (AgentCore)
│       ├── consultation-agent/  # 고객 상담 에이전트
│       ├── summary-agent/       # BANT 요약 에이전트
│       └── planning-agent/      # 미팅 플랜 + Sales Rep 채팅 에이전트
├── template.yaml             # AWS SAM IaC
├── deploy-full.sh            # 전체 배포 (에이전트 → SAM → 프론트엔드)
├── deploy-website.sh         # 프론트엔드만 배포
└── package.json              # Yarn Workspaces 루트
```

## 기술 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | React 18 + Vite + Cloudscape | TypeScript, i18n (ko/en) |
| 백엔드 | Python 3.13 Lambda | 도메인별 격리, SharedLayer |
| AI 에이전트 | Strands SDK + Bedrock AgentCore | Docker 컨테이너 배포 |
| MCP 연동 | AWS Documentation MCP Server | uvx 기반, Dockerfile 사전 설치 |
| 데이터베이스 | DynamoDB (KMS 암호화) | TTL 자동 만료, GSI |
| 인증 | Cognito (관리자) + PIN (고객) | JWT + 6자리 PIN |
| 인프라 | SAM + CloudFront + VPC | IaC, Private Subnet |
| 테스트 | Vitest + fast-check | Property-based 테스트 |

## 빠른 시작

### 사전 요구사항

- Node.js v20.18.1+, Yarn v1.22.22+
- Python 3.13, uv (uvx)
- AWS CLI v2, SAM CLI v1
- Docker (에이전트 빌드용)
- `bedrock-agentcore-starter-toolkit` (`pip install bedrock-agentcore-starter-toolkit`)

### 배포

```bash
# 1. 의존성 설치
yarn install

# 2. 전체 배포 (에이전트 → SAM → 프론트엔드)
chmod +x deploy-full.sh deploy-website.sh
./deploy-full.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_REGION] [STACK_NAME] [BEDROCK_KB_ID]

# 기본값: default / dev / ap-northeast-2 / (REGION) / mte-prechat
```

배포 순서: `deploy-agents.sh` (AgentCore) → `sam deploy` (인프라) → `deploy-website.sh` (프론트엔드)

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `AWS_PROFILE` | `default` | AWS CLI 프로파일 |
| `STAGE` | `dev` | 배포 환경 (dev/prod) |
| `REGION` | `ap-northeast-2` | AWS 리전 |
| `BEDROCK_REGION` | REGION과 동일 | Bedrock 모델 리전 |
| `STACK_NAME` | `mte-prechat` | CloudFormation 스택명 |
| `BEDROCK_KB_ID` | (없음) | Knowledge Base ID (유사사례 검색용) |

### 배포 후 확인

1. AWS Console → Amazon Bedrock → Model access에서 Claude/Nova 모델 접근 승인
2. `https://[cloudfront-domain]/admin`에서 관리자 계정 생성
3. PreChat Agent 생성 → 캠페인 생성 → 세션 생성 → 고객 채팅 테스트

## 개발

```bash
# 프론트엔드 개발 서버 (포트 5173)
yarn dev

# 전체 린팅
yarn lint

# 전체 테스트 (Vitest, 단일 실행)
yarn test

# SAM 백엔드 빌드
sam build

# 번역 키 관리
cd packages/web-app
yarn extract-text           # 번역 키 추출
yarn manage-translations    # 번역 파일 관리
yarn validate-translations  # 번역 검증
```

### 변경 시 재배포 범위

| 변경 대상 | 재배포 범위 | 명령어 |
|-----------|------------|--------|
| `packages/web-app/` | 프론트엔드만 | `./deploy-website.sh` |
| 도메인 디렉토리 (`session/`, `campaign/` 등) | 해당 Lambda만 | `sam build && sam deploy` |
| `shared/` | Lambda Layer 전체 | `sam build && sam deploy` |
| `template.yaml` | SAM 전체 | `sam build && sam deploy` |
| `strands-agents/` | 해당 에이전트만 | `./deploy-agents.sh` |

## AI 에이전트

3개의 Strands SDK 에이전트가 Bedrock AgentCore Runtime에 Docker 컨테이너로 배포됩니다.

| 에이전트 | 역할 | Memory | 도구 |
|---------|------|--------|------|
| Consultation Agent | 고객 사전 상담 수행 | STM (AgentCore Memory) | retrieve (KB RAG), render_form, current_time, AWS Docs MCP |
| Summary Agent | BANT 프레임워크 분석 | 없음 | 없음 (Structured Output) |
| Planning Agent | 미팅 플랜 생성 + Sales Rep 채팅 | 없음 | retrieve (KB RAG), http_request, AWS Docs MCP |

Consultation Agent와 Planning Agent는 AWS Documentation MCP Server가 연동되어 있어, 에이전트가 AWS 공식 문서를 실시간으로 검색하여 고객에게 정확한 정보를 제공할 수 있습니다.

자세한 내용은 [packages/strands-agents/README.md](packages/strands-agents/README.md)를 참조하세요.

## 데이터 모델

### DynamoDB 테이블

| 테이블 | PK | SK | 용도 |
|--------|----|----|------|
| SessionsTable | `SESSION#{sessionId}` | `METADATA` | 세션 데이터, 고객 정보 |
| MessagesTable | `SESSION#{sessionId}` | `MESSAGE#{messageId}` | 대화 메시지 |
| CampaignsTable | `CAMPAIGN#{campaignId}` | `METADATA` | 캠페인 설정 |

모든 테이블은 KMS 암호화, TTL 자동 만료(30일), GSI를 지원합니다.

## 보안

- VPC Private Subnet에서 Lambda 실행
- DynamoDB KMS 암호화 (저장 시)
- HTTPS TLS 1.2+ (전송 시)
- Cognito JWT 인증 (관리자)
- 6자리 PIN 인증 (고객)
- IAM 최소 권한 원칙
- API 키/시크릿 환경 변수 관리 (하드코딩 금지)

## 주요 워크플로우

```
1. 관리자: 캠페인 생성 → 세션 생성 → 고객에게 URL + PIN 전달
2. 고객: PIN 인증 → 상담 목적 선택 → AI 챗봇과 대화 → 피드백 제출
3. 시스템: 세션 완료 → Summary Agent (BANT 분석) → Planning Agent (미팅 플랜)
4. 관리자: AI 리포트 확인 → 미팅 로그 작성 → Planning Agent와 채팅으로 미팅 준비
```

## 라이선스

[MIT-0 (MIT No Attribution)](LICENSE) — 상업적 사용 포함 모든 사용 허용, 저작자 표시 불필요.

## 문서

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — 상세 배포 가이드
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — API 엔드포인트 레퍼런스
- [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) — 마이그레이션 가이드
- [packages/strands-agents/README.md](packages/strands-agents/README.md) — AI 에이전트 상세
- [packages/web-app/README.md](packages/web-app/README.md) — 프론트엔드 상세

## 연락처

📧 aws-prechat@amazon.com / jaebin@amazon.com
