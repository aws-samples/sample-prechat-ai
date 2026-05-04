---
description: 고객이 챗봇과 대화하는 흐름과 주요 기능
icon: comments
---

# 고객 대화 흐름

PIN 인증을 통과하면 고객은 AI 챗봇과 실시간으로 대화합니다. 이 페이지는 고객 시점의 경험을 다룹니다.

## 채팅 화면 구조

![고객 채팅 화면 전체](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

| 영역 | 설명 |
|------|------|
| 상단 헤더 | 캠페인 이름, 대화 종료 버튼 |
| 메시지 영역 | AI와 고객의 메시지가 시간순으로 표시 |
| 입력창 | 메시지 입력, 전송 버튼 |

## 대화 시작

대화 시작 시 에이전트가 인사말과 함께 첫 질문을 던집니다. 시스템 프롬프트에 따라 인사말 내용이 달라집니다.

```
AI: 안녕하세요 김고객님! ACME 솔루션즈 사전상담 AI입니다.
    편한 대화 방식으로 20분 정도 진행되며, 입력하신 내용은
    본 미팅 준비에만 활용됩니다.

    먼저, 지금 해결하고 싶은 가장 큰 과제가 무엇인지
    간단히 말씀해 주시겠어요?

You: 현재 온프레미스에서 운영 중인 ERP를 클라우드로 옮기고 싶어요.
    라이선스 비용이 너무 부담스러워서요.

AI: 네, 라이선스 비용 절감은 많은 고객이 고민하시는 부분입니다.
    조금 더 여쭤봐도 될까요?
    - 현재 ERP는 어느 벤더 제품을 쓰고 계신가요?
    - 사용자 수는 대략 몇 명인가요?
    - 이관을 고려하시는 시점은 언제쯤입니까?
```

## 주요 기능

### 실시간 스트리밍 응답

AI 응답은 WebSocket 기반 SSE로 **한 글자씩 실시간**으로 표시됩니다. 응답이 끝나기 전에도 읽기 시작할 수 있습니다.

![스트리밍 중인 응답 (커서 깜빡임)](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

### 구조화된 양식 입력 (render_form 도구)

에이전트가 여러 항목을 한꺼번에 수집하고 싶을 때 채팅 안에 폼을 렌더링합니다.

![채팅 내 폼 UI 예시](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

고객이 폼을 작성하고 제출하면 응답이 자동으로 메시지로 변환되어 대화가 이어집니다.

### AWS 문서 검색 (aws_docs_mcp 도구)

에이전트가 공식 AWS 문서를 실시간으로 검색해 답변에 활용합니다. 고객이 "Aurora와 RDS 차이가 뭐예요?" 같은 기술 질문을 하면 최신 문서를 근거로 답합니다.

![AWS 문서 근거가 포함된 AI 응답](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

### 유사 고객 사례 (retrieve 도구)

Knowledge Base에 등록된 과거 고객 사례를 검색해 비슷한 상황의 해결책을 제시합니다. 에이전트 구성에서 `retrieve` 도구를 활성화한 경우에만 동작합니다.

## 대화 종료

{% stepper %}
{% step %}
### 상단 우측 "End conversation" 버튼 클릭

또는 AI가 상담 종료를 제안한 뒤 고객이 동의하면 자동으로 종료됩니다.

![End conversation 버튼](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}

{% step %}
### 피드백 모달 표시

5점 척도 CSAT과 자유 코멘트를 입력합니다.

- **Rating** — 1~5점
- **Comment** — 개선 의견, 도움 된 점 등

![피드백 모달](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}

{% step %}
### 제출 후 감사 화면

"상담에 응해주셔서 감사합니다" 메시지가 표시됩니다. 이 시점에 세션 상태가 **Completed**로 변경되고 AI 요약 파이프라인이 자동으로 시작됩니다.

![감사 화면](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}
{% endstepper %}

## 세션 이어가기

고객이 브라우저를 닫았다가 같은 URL로 다시 접속하면 대화를 이어갈 수 있습니다 (PIN 재인증 필요).

- **아웃바운드**: 세션 URL + 세션 PIN 재입력
- **인바운드**: 캠페인 URL + 캠페인 PIN → 같은 전화번호 입력 시 기존 세션 복원

{% hint style="info" %}
세션 TTL(기본 30일)이 지나면 DynamoDB에서 자동으로 삭제됩니다. 이 전에 완료하지 못한 세션은 만료됩니다.
{% endhint %}

## 접근성과 다국어

PreChat은 다음을 지원합니다.

- **다국어**: 한국어, 영어 (우측 상단 언어 선택)
- **키보드 네비게이션**: 모든 주요 기능에 Tab 접근 가능
- **스크린 리더**: ARIA 속성 준수
- **모바일 반응형**: 스마트폰/태블릿에서도 동작

![언어 전환 셀렉터](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

## 대화 품질 팁 (관리자 관점)

대화 품질을 높이려면 다음을 에이전트 프롬프트에 반영합니다.

- 한 번에 **하나의 질문**만 던지도록 지시
- 모호한 답변에 **follow-up 질문**을 요구
- 세션 종료 전 **수집한 정보를 요약**하고 확인 요청
- **기술 용어 사용 시 쉬운 설명을 병기**하도록 지시

에이전트 편집은 [에이전트 생성과 프롬프트 작성](../04-admin/create-agent.md)을 참고합니다.

## 다음 단계

대화가 종료되면 AI가 세션을 정리합니다. [BANT 요약과 AI 리포트](../06-postsession/ai-report.md)로 이동합니다.
