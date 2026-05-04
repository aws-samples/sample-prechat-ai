---
description: ISV 고객이 PreChat 캠페인으로 자사 고객 사전상담을 직접 운영할 수 있도록 배포부터 캠페인 분석까지 안내하는 워크샵 가이드
icon: rocket
---

# PreChat 워크샵에 오신 것을 환영합니다

PreChat은 Amazon Bedrock AgentCore와 Strands SDK로 만든 AI 사전상담 시스템입니다. 폼 기반 정보 수집을 대화형 챗봇으로 대체하여 고객과의 자연스러운 대화만으로 요구사항을 수집하고, 세션 종료 후 BANT 분석 리포트와 미팅 플랜을 자동으로 생성합니다.

이 워크샵은 **ISV 고객(고객이 있는 고객)이 자사 서비스에 PreChat을 도입**할 수 있도록 배포부터 운영까지 전 과정을 안내합니다.

## 워크샵에서 다루는 내용

{% stepper %}
{% step %}
### 환경 준비

AWS CloudShell 또는 로컬 환경(macOS/Windows)에 AWS CLI, SAM CLI, Node.js, Python, Docker를 준비합니다.
{% endstep %}

{% step %}
### 배포

`prsworkshop` 브랜치를 체크아웃하고 두 단계로 배포합니다. 먼저 Strands 에이전트를 Bedrock AgentCore에 올리고, 이어 SAM으로 백엔드와 프론트엔드를 한 번에 올립니다.
{% endstep %}

{% step %}
### 캠페인 구성

관리자 계정을 만들고 에이전트와 캠페인을 생성합니다. 아웃바운드와 인바운드 두 유형을 모두 다룹니다.
{% endstep %}

{% step %}
### 세션 운영

고객이 챗봇과 대화하는 흐름을 직접 체험하고, 세션 완료 후 자동 생성되는 BANT 요약과 미팅 플랜을 확인합니다.
{% endstep %}

{% step %}
### 캠페인 분석

다수의 세션이 집계된 캠페인 대시보드에서 트렌드와 상담 목적 분포를 분석합니다.
{% endstep %}
{% endstepper %}

## 대상 독자

- 사내 영업/CS 프로세스에 AI 사전상담을 도입하려는 **ISV 고객의 IT/플랫폼 담당자**
- AWS 서비스 경험이 있는 **솔루션 아키텍트, 개발자, 운영자**
- PreChat을 자사 고객 응대 시나리오에 커스터마이즈하려는 **프로덕트 오너**

## 사전 요구사항

{% hint style="info" %}
워크샵을 진행하려면 다음이 준비되어야 합니다.

- **AWS 계정** — IAM 사용자 또는 IAM Identity Center 권한 (Administrator 또는 동등한 수준)
- **Bedrock 모델 액세스** — Claude 계열 또는 Amazon Nova 모델 승인
- **브라우저** — 최신 버전 Chrome, Edge, Firefox, Safari 중 하나
{% endhint %}

비용 감각은 [보안과 비용 고려사항](appendix/security-and-cost.md)에서 미리 확인해 두는 것을 권장합니다.

## 진행 시간

| 섹션 | 예상 시간 |
|------|---------|
| 환경 준비 | 15분 |
| 배포 | 30~45분 (네트워크/에이전트 빌드 속도에 따라 변동) |
| 관리자 온보딩 | 10분 |
| 세션 시나리오 체험 | 20분 |
| 분석과 정리 | 15분 |
| **합계** | **약 90~120분** |

## 레포지토리

이 워크샵은 다음 레포지토리의 `prsworkshop` 브랜치를 기반으로 합니다.

```
https://github.com/aws-samples/sample-prechat-ai.git
```

워크샵 전용으로 이 브랜치는 VPC/PrivateLink 옵션이 제거되어 있어 고객 환경에서 네트워크 구성 없이 그대로 배포됩니다.

{% hint style="warning" %}
프로덕션 환경에 도입할 때는 VPC 격리, WAF, 세분화된 IAM 정책, CloudFront 커스텀 인증서 등을 추가로 검토해야 합니다. 본 워크샵은 학습 목적의 빠른 배포를 우선합니다.
{% endhint %}

[시작하기 →](01-overview/product-tour.md)
