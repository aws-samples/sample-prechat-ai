---
description: 워크샵 시작 전에 준비할 항목 체크리스트
icon: list-check
---

# 워크샵 체크리스트

워크샵을 원활하게 진행하려면 시작 전에 다음 항목을 확인합니다.

## 계정과 권한

- [ ] AWS 계정을 보유하고 로그인할 수 있다
- [ ] 해당 계정에 **Administrator Access** 또는 다음 서비스에 대한 권한이 있다
  - CloudFormation, IAM, Lambda, API Gateway, DynamoDB, S3
  - Cognito, CloudFront, KMS, SQS, SNS
  - Bedrock, Bedrock AgentCore, ECR, CodeBuild
- [ ] 배포 리전을 정했다 (권장: `ap-northeast-2` 서울 또는 `us-east-1` 버지니아 북부)

## 도구 준비

다음 중 **하나의 경로**를 택해 준비합니다. 상세는 [환경 준비](../02-setup/choose-your-path.md) 섹션에서 안내합니다.

{% tabs %}
{% tab title="CloudShell (권장)" %}
별도 설치가 거의 없고 AWS 인증이 자동입니다.

- [ ] AWS Console에서 CloudShell을 열 수 있다
- [ ] Docker를 쓰는 에이전트 빌드 단계에서는 CodeBuild가 대신 빌드하므로 CloudShell에서도 실행 가능
{% endtab %}

{% tab title="macOS" %}
- [ ] Homebrew 설치 완료
- [ ] Node.js 20.18.1+ (`node --version`)
- [ ] Python 3.13 (`python3 --version`)
- [ ] AWS CLI v2 (`aws --version`)
- [ ] SAM CLI v1 (`sam --version`)
- [ ] Docker Desktop 실행 중
- [ ] `aws configure`로 자격증명과 기본 리전 설정
{% endtab %}

{% tab title="Windows" %}
- [ ] WSL2 (Ubuntu 22.04 권장) 또는 Windows용 네이티브 도구
- [ ] Node.js 20.18.1+
- [ ] Python 3.13
- [ ] AWS CLI v2
- [ ] SAM CLI v1
- [ ] Docker Desktop (WSL 통합 활성화)
- [ ] `aws configure`로 자격증명 설정
{% endtab %}
{% endtabs %}

## 필수 데이터

세션 테스트에 사용할 데이터를 준비합니다.

- [ ] 테스트용 고객 이름, 이메일, 회사명, 전화번호 (샘플 1~2건)
- [ ] 관리자 계정 가입용 이메일 주소 (수신 가능한 주소 — 인증 코드가 메일로 전송됩니다)
- [ ] 가입 이메일 도메인이 `template.yaml`의 `AllowedEmailDomains`에 포함되는지 확인 (기본값: `amazon.com,your-email-domain.com`)

{% hint style="info" %}
이메일 도메인 제한은 SAM 파라미터 `AllowedEmailDomains`로 배포 시 조정합니다. `sam deploy --parameter-overrides "AllowedEmailDomains=example.com,mycompany.com"` 형태로 지정하면 됩니다.
{% endhint %}

## 비용 인지

- [ ] 워크샵 진행 중 발생하는 예상 비용을 확인했다 ([비용 고려사항](../appendix/security-and-cost.md))
- [ ] 워크샵 종료 후 리소스를 정리할 계획을 세웠다 ([Cleanup 가이드](../08-ops/cleanup.md))

## 준비 완료

모든 체크박스에 표시가 되었다면 [환경 준비 → 배포 경로 고르기](../02-setup/choose-your-path.md)로 이동합니다.
