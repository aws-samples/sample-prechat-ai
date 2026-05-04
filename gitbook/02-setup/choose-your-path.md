---
description: CloudShell, macOS, Windows 세 가지 환경 준비 경로 비교 가이드
icon: signs-post
---

# 배포 경로 고르기

PreChat은 세 가지 환경에서 배포할 수 있습니다. 내 워크스테이션 상황에 맞춰 한 가지 경로를 선택합니다.

## 경로 비교

| 항목 | CloudShell | macOS 로컬 | Windows 로컬 |
|------|-----------|-----------|------------|
| 사전 설치 | 거의 없음 | Homebrew 경유 | WSL2 + 각종 도구 |
| AWS 자격증명 | 자동 | `aws configure` | `aws configure` |
| 디스크 용량 | **1 GB 제한** — 주의 필요 | 10 GB+ 여유 권장 | 10 GB+ 여유 권장 |
| Docker 빌드 | 원격 CodeBuild가 대신 빌드 | 로컬 Docker Desktop | WSL Docker |
| 배포 속도 | 보통 | 빠름 | WSL 오버헤드로 약간 느림 |
| 권장 대상 | 빠른 체험, 사전 설치 최소화 희망 | macOS 사용자 전반 | Windows 사용자 전반 |

## 경로별 가이드

{% tabs %}
{% tab title="CloudShell (권장)" %}
AWS Console 로그인 상태로 바로 시작할 수 있습니다. 자격증명을 따로 설정할 필요가 없습니다.

{% hint style="warning" %}
CloudShell은 홈 디렉토리에 **1 GB 한도**가 있습니다. `node_modules`와 SAM 빌드 산출물이 합해 약 800 MB~1 GB에 달하므로, 배포 후 불필요한 파일은 바로 정리해야 합니다. 상세는 [CloudShell로 시작하기](cloudshell-setup.md)에서 다룹니다.
{% endhint %}

→ [AWS CloudShell로 시작하기](cloudshell-setup.md)
{% endtab %}

{% tab title="macOS" %}
Homebrew로 도구를 일괄 설치합니다. Docker Desktop이 실행 중이어야 에이전트를 빌드할 수 있습니다.

→ [macOS 로컬 환경 구성](macos-setup.md)
{% endtab %}

{% tab title="Windows" %}
WSL2 Ubuntu에서 macOS와 거의 동일한 경험으로 진행합니다. PowerShell 네이티브 경로도 가능하지만 문서에서는 WSL2를 권장합니다.

→ [Windows 로컬 환경 구성](windows-setup.md)
{% endtab %}
{% endtabs %}

## 어떤 경로를 고르더라도 공통으로 필요한 것

- AWS 계정과 적절한 IAM 권한
- Bedrock 모델 액세스 승인
- 유효한 관리자 가입 이메일

Bedrock 모델 액세스 승인은 다음 페이지에서 따로 안내합니다.

→ [Bedrock 모델 액세스 승인](bedrock-model-access.md)

## 다음 단계

선택한 경로의 상세 가이드를 먼저 끝낸 뒤, Bedrock 모델 액세스 승인을 진행하고 [배포 섹션](../03-deploy/clone-repository.md)으로 이동합니다.
