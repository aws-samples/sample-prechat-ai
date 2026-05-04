---
description: PreChat 시스템과 워크샵에서 자주 등장하는 용어
icon: book
---

# 용어 사전

## 시스템 용어

| 용어 | 설명 |
|------|------|
| **PreChat** | Amazon Bedrock AgentCore와 Strands SDK 기반 AI 사전상담 시스템 |
| **Pre-Consultation** | 본 미팅 전에 챗봇과 대화하여 요구사항을 수집하는 활동 |
| **Session** | 고객 1인과의 개별 상담 인스턴스 (Aggregate Root) |
| **Campaign** | 특정 목적을 가진 상담 활동의 단위. 여러 세션을 묶음 |
| **Campaign Code** | 고객이 캠페인에 접근할 때 사용하는 코드 (예: `FY26NEW`) |
| **PIN** | 세션 또는 캠페인 접근용 6자리 인증 코드 |
| **Consultation Purpose** | 고객이 선택하는 상담 목적 (신규 도입, 비용 최적화, 이관 등) |
| **BANT** | Budget, Authority, Need, Timeline. 영업 기회 평가 프레임워크 |
| **CSAT** | Customer Satisfaction Score. 1~5점 고객 만족도 |

## 캠페인 유형

| 용어 | 설명 |
|------|------|
| **Outbound** | 관리자가 고객별로 세션을 사전 생성하고 URL/PIN을 개별 전달 |
| **Inbound** | 고객이 캠페인 URL로 직접 접근하여 세션을 자가 생성 |

## 에이전트 용어

| 용어 | 설명 |
|------|------|
| **AgentCore** | Amazon Bedrock AgentCore. Strands SDK로 개발한 에이전트의 런타임 실행 환경 |
| **Strands SDK** | 에이전트를 선언적으로 작성하는 Python SDK |
| **상담 에이전트 (Consultation Agent)** | 고객과 대화하는 메인 에이전트 |
| **요약 에이전트 (Summary Agent)** | 세션 종료 후 BANT 분석 요약을 생성하는 에이전트 |
| **System Prompt** | 에이전트의 페르소나와 행동 지침 |
| **Tool / 도구** | 에이전트가 외부 기능을 호출하기 위한 함수 (예: retrieve, render_form) |
| **MCP** | Model Context Protocol. 에이전트가 외부 서비스와 통신하는 표준 |
| **AWS Documentation MCP** | AWS 공식 문서를 실시간 검색하는 MCP 서버 |
| **Knowledge Base (KB)** | Bedrock Knowledge Base. RAG용 벡터 데이터베이스 |
| **STM** | Short-Term Memory. AgentCore가 제공하는 세션 요약 메모리 (30일 기본) |

## 인프라 용어

| 용어 | 설명 |
|------|------|
| **SAM** | AWS Serverless Application Model. CloudFormation 확장 |
| **CloudFormation** | AWS IaC 서비스 |
| **Lambda** | 서버리스 함수 실행 서비스 |
| **API Gateway** | REST/WebSocket API 관리 |
| **DynamoDB** | 완전 관리형 NoSQL 데이터베이스 |
| **Cognito** | 사용자 인증/인가 서비스 |
| **CloudFront** | CDN 서비스 |
| **KMS** | Key Management Service. 암호화 키 관리 |
| **SSM Parameter Store** | 구성 값과 시크릿 저장소 |
| **VPC** | Virtual Private Cloud. 네트워크 격리 (워크샵 브랜치에서는 제거됨) |

## 데이터 모델 용어

| 용어 | 설명 |
|------|------|
| **PK / SK** | DynamoDB Partition Key / Sort Key |
| **GSI** | Global Secondary Index. 보조 조회 인덱스 |
| **TTL** | Time-To-Live. 자동 만료 시간 (기본 30일) |

## 운영 용어

| 용어 | 설명 |
|------|------|
| **Stage** | 배포 환경 (`dev`, `prod` 등) |
| **Deploy order** | 배포 순서: Agents → SAM → Frontend |
| **Redeployment** | 변경 범위에 맞춘 부분 재배포 |
| **Rollback** | 이전 버전으로 복원 |

## 문서 내 표기 규칙

| 표기 | 의미 |
|------|-----|
| `[사진첨부]` | 실제 환경에서 스크린샷을 추가해야 할 자리 |
| `{WebsiteURL}` | 배포 후 발급받는 CloudFront 도메인 (예: `dxxx.cloudfront.net`) |
| `{campaignCode}` | 생성된 캠페인의 코드 |
| `{sessionId}` | 생성된 세션의 고유 ID |
