---
description: 아웃바운드 캠페인에서 개별 고객을 위한 세션을 생성하고 URL을 전달
icon: paper-plane
---

# 아웃바운드 세션 — 개별 고객 초대

아웃바운드 캠페인은 관리자가 고객별로 세션을 사전 생성하고 URL과 PIN을 개별 전달하는 방식입니다. 맞춤 상담에 적합합니다.

## 세션 생성

{% stepper %}
{% step %}
### 세션 페이지로 이동한다

대시보드 좌측 **Sessions** → **Create Session**

**[사진첨부]** Sessions 리스트와 Create 버튼
{% endstep %}

{% step %}
### 캠페인을 선택한다

**Campaign** 드롭다운에서 조금 전에 만든 **Outbound 캠페인**을 선택합니다.

**[사진첨부]** 캠페인 드롭다운
{% endstep %}

{% step %}
### 고객 정보를 입력한다

- **Customer Name** — 예: `김고객`
- **Customer Email** — 예: `customer@example.com`
- **Customer Company** — 예: `Example Corp`
- **Customer Phone** — 예: `+821098765432`

필수는 Customer Name과 Email이며, 나머지는 선택입니다.

**[사진첨부]** 고객 정보 입력 폼
{% endstep %}

{% step %}
### 에이전트 오버라이드 (선택)

캠페인의 기본 에이전트 대신 이 세션만 다른 에이전트를 쓰고 싶다면 **Agent override** 드롭다운에서 선택합니다. 비워 두면 캠페인 기본 에이전트가 사용됩니다.

**[사진첨부]** Agent override 드롭다운
{% endstep %}

{% step %}
### 세션을 생성한다

**Create**를 누르면 세션이 생성되며 URL과 PIN이 표시됩니다.

**[사진첨부]** 세션 생성 완료 화면 — URL과 PIN 표시
{% endstep %}
{% endstepper %}

## 세션 URL과 PIN

생성된 세션은 다음 정보를 갖습니다.

| 항목 | 예시 |
|------|------|
| **Session URL** | `https://{WebsiteURL}/chat/{sessionId}` |
| **PIN** | `849273` (6자리) |
| **TTL** | 생성 시점 + 30일 (기본) |

{% hint style="warning" %}
PIN은 평문으로 화면에 딱 한 번만 표시됩니다. 놓쳤다면 세션 상세에서 다시 확인할 수 있지만, **외부 전달 전에 정확하게 복사**했는지 꼭 검증합니다.
{% endhint %}

## 고객에게 전달하기

이메일, 슬랙, 문자 등 선호하는 채널로 URL과 PIN을 전달합니다. 이메일 예시:

```
안녕하세요 김고객님,

ACME 솔루션즈 사전상담을 위한 전용 링크를 보내드립니다.

  상담 링크: https://dxxx.cloudfront.net/chat/sess_abc123def456
  접속 PIN: 849273

아래 항목을 미리 생각해두시면 상담이 원활합니다.
- 현재 사용 중인 솔루션
- 도입을 고려하는 배경
- 희망 도입 시기

상담은 AI 챗봇과 자유롭게 대화하는 형태로 진행되며 약 15~20분 소요됩니다.
```

## 세션 상태 추적

**Sessions** 리스트에서 모든 세션 상태를 추적합니다.

**[사진첨부]** Sessions 리스트 전체 뷰

| Status | 의미 |
|--------|-----|
| `Created` | 생성됨, 고객이 아직 접근하지 않음 |
| `Active` | 고객이 PIN 인증에 성공하여 대화 진행 중 |
| `Completed` | 대화가 종료되고 AI 리포트 생성 중/완료 |
| `Inactive` | 관리자가 수동으로 비활성화 |

## 세션 상세 화면

세션 클릭 시 상세 탭이 열립니다.

| 탭 | 내용 |
|----|------|
| **Info** | 고객 정보, 상태, PIN, URL |
| **Messages** | 고객과 AI의 전체 대화 로그 |
| **AI Report** | BANT 분석 요약 (세션 종료 후 생성) |
| **Meeting Plan** | 미팅 준비 플랜 (세션 종료 후 생성) |
| **Meeting Log** | 본 미팅의 기록 (수동 작성) |

**[사진첨부]** 세션 상세 화면 (Info 탭)

## 세션 수동 종료

고객이 대화를 끝냈지만 명시적으로 종료하지 않은 경우 관리자가 수동으로 **Inactivate** 버튼을 눌러 종료할 수 있습니다. 종료 시 AI 요약 파이프라인이 자동으로 시작됩니다.

**[사진첨부]** Inactivate 버튼 위치

## 다음 단계

세션이 생성됐다면 [고객 대화 흐름](customer-conversation.md)으로 이동해 고객 시점의 경험을 체험합니다.
