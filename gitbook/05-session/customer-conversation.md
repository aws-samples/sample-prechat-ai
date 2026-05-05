---
description: 고객이 챗봇과 대화하는 흐름과 주요 기능
icon: comments
---

# 고객 대화 흐름

PIN 인증을 통과하면 고객은 AI 챗봇과 실시간으로 대화합니다.

## 채팅 화면 구조

![고객 채팅 화면 전체](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

| 영역 | 설명 |
|------|------|
| 상단 헤더 | 캠페인 이름, 대화 종료 버튼 |
| 메시지 영역 | AI와 고객의 메시지가 시간순으로 표시 |
| 입력창 | 메시지 입력, 전송 버튼 |

## 대화 시작

에이전트가 인사말과 첫 질문을 던집니다.

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

AI 응답이 한 글자씩 실시간으로 표시됩니다. 응답이 끝나기 전에도 읽기 시작할 수 있습니다.

![스트리밍 중인 응답 (커서 깜빡임)](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

<details>
<summary>기술 참고</summary>

스트리밍은 WebSocket 기반 SSE(Server-Sent Events)로 구현됩니다. 클라이언트는 WebSocket 연결을 유지하며 토큰 단위로 응답을 수신합니다.
</details>

### 구조화된 양식 입력 (render_form)

에이전트가 여러 항목을 한꺼번에 수집할 때 채팅 안에 폼을 렌더링합니다. 고객이 폼을 작성·제출하면 응답이 메시지로 변환되어 대화가 이어집니다.

![채팅 내 폼 UI 예시](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

### AWS 문서 검색

에이전트가 공식 AWS 문서를 실시간 검색해 답변에 활용합니다. "Aurora와 RDS 차이가 뭐예요?" 같은 기술 질문에 최신 문서를 근거로 답합니다.

![AWS 문서 근거가 포함된 AI 응답](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

### 유사 고객 사례

Knowledge Base에 등록된 과거 고객 사례를 검색해 비슷한 상황의 해결책을 제시합니다.

## 대화 종료

{% stepper %}
{% step %}
### "End conversation" 클릭

상단 우측 버튼 클릭. 또는 AI가 종료를 제안한 뒤 고객이 동의하면 자동 종료됩니다.

![End conversation 버튼](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}

{% step %}
### 피드백 입력

5점 척도 CSAT과 자유 코멘트를 입력합니다.

![피드백 모달](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}

{% step %}
### 감사 화면 표시

세션 상태가 **Completed**로 변경되고 AI 요약 파이프라인이 자동 시작됩니다.

![감사 화면](../.gitbook/assets/05-customer-conversation-01-chat-history.png)
{% endstep %}
{% endstepper %}

## 세션 이어가기

브라우저를 닫았다가 같은 URL로 다시 접속하면 대화를 이어갑니다 (PIN 재인증 필요).

- **아웃바운드**: 세션 URL + 세션 PIN 재입력
- **인바운드**: 캠페인 URL + 캠페인 PIN → 같은 전화번호 입력 시 기존 세션 복원

## 접근성과 다국어

한국어·영어 지원, 키보드 네비게이션(Tab), 스크린 리더(ARIA), 모바일 반응형을 지원합니다.

![언어 전환 셀렉터](../.gitbook/assets/05-customer-conversation-01-chat-history.png)

<details>
<summary>대화 품질 팁 (관리자 관점)</summary>

에이전트 프롬프트에 다음을 반영하면 대화 품질이 높아집니다.

- 한 번에 하나의 질문만 던지도록 지시
- 모호한 답변에 follow-up 질문 요구
- 세션 종료 전 수집한 정보를 요약하고 확인 요청
- 기술 용어 사용 시 쉬운 설명 병기

에이전트 편집은 [에이전트 생성과 프롬프트 작성](../04-admin/create-agent.md)을 참고합니다.
</details>

## 다음 단계

대화가 종료되면 [BANT 요약과 AI 리포트](../06-postsession/ai-report.md)로 이동합니다.