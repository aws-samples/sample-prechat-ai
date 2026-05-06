---
description: 워크샵 시작 전에 준비할 항목 체크리스트
icon: list-check
---

# 워크샵 체크리스트

시작 전에 아래 세 가지만 확인하면 됩니다. 개발 환경 설치는 필요 없습니다. 모든 작업은 브라우저 안의 [AWS CloudShell](../02-setup/cloudshell-setup.md)에서 진행합니다.

## 준비물

| # | 준비물 | 확인 기준 |
|:-:|--------|----------|
| 1 | **AWS 계정** | 콘솔에 로그인할 수 있고, 관리자 수준 권한이 있다 |
| 2 | **브라우저** | Chrome, Edge, Firefox, Safari 중 최신 버전 하나 |
| 3 | **이메일** | 인증 코드를 받을 수 있는 이메일 주소가 있다 |

이 세 가지가 준비되었으면 워크샵을 진행할 수 있습니다.

## 추가 지식

### AWS CloudShell이 뭔가요?

AWS CloudShell은 브라우저 안에서 바로 쓸 수 있는 터미널입니다. AWS 콘솔에 로그인한 상태에서 클릭 한 번이면 열리고, Git / Python / AWS CLI가 이미 설치되어 있어서 노트북에 깔지 않아도 됩니다.

워크샵에서 명령어를 CloudShell에서 복사 & 붙여넣기로 실행하세요. 터미널이 익숙하지 않아도 괜찮습니다. 

{% hint style="info" %}
CloudShell은 무료입니다. 세션당 최대 12시간 유지되며, 홈 디렉토리(`~`)에 저장한 파일은 다음 접속 시에도 남아 있습니다.
{% endhint %}

### AWS 계정 권한

가장 간단한 방법은 **Administrator Access** 정책이 붙은 [IAM 사용자](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) 또는 [IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) 세션을 쓰는 것입니다. 조직 정책상 관리자 권한을 받기 어렵다면, IT 팀에 "CloudFormation으로 서버리스 스택을 배포해야 한다"고 요청하세요.

### 배포 리전

워크샵에서는 **서울 리전** (`ap-northeast-2`)을 기본으로 사용합니다. [Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html) 모델 가용성 때문에 다른 리전을 쓰고 싶다면 `us-east-1` (버지니아 북부)도 가능합니다.

### 비용

워크샵 1회 진행 비용은 대부분 $5 미만입니다 ([Bedrock](https://aws.amazon.com/bedrock/pricing/) 호출 + [DynamoDB](https://aws.amazon.com/dynamodb/pricing/)). 상세 추정은 [보안과 비용 고려사항](../appendix/security-and-cost.md)을 참고하세요. 워크샵이 끝나면 반드시 [리소스 정리](../08-ops/cleanup.md)를 수행하세요.

## 다음 단계

준비가 되었으면 [AWS CloudShell 환경 준비](../02-setup/cloudshell-setup.md)로 이동합니다.
