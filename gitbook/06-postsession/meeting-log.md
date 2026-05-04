---
description: 본 미팅 종료 후 결과를 기록하고 후속 활동을 추적
icon: file-pen
---

# 미팅 로그 기록

본 미팅이 끝나면 결과를 **Meeting Log**에 기록합니다. 이후 분석과 후속 영업 활동의 근거가 됩니다.

## 목적

- 미팅에서 얻은 구체적인 사실(예산 승인 상태, 담당자 변경 등)을 기록
- 플랜 대비 달성도 평가
- 다음 행동(Next Action)의 명확한 정의
- 캠페인 분석의 정성적 데이터 제공

## 로그 작성

{% stepper %}
{% step %}
### 세션 상세 → Meeting Log 탭

미팅 플랜과 같은 세션 내에 Meeting Log 탭이 있습니다.

![Meeting Log 빈 상태](../.gitbook/assets/06-meeting-log-01-session-detail.png)
{% endstep %}

{% step %}
### "Create Meeting Log" 클릭

폼이 열립니다.
{% endstep %}

{% step %}
### 기본 필드 입력

- **Meeting Date** — 미팅 진행 일시
- **Participants** — 고객 측과 자사 측 참석자
- **Outcome** — 핵심 결과 요약 (2~3문장)
- **Next Action** — 다음 행동, 담당자, 기한
- **Notes** — 자유 메모

![Meeting Log 입력 폼](../.gitbook/assets/06-meeting-log-02-log-form.png)
{% endstep %}

{% step %}
### 저장

세션 상태와 캠페인 메트릭에 반영됩니다.
{% endstep %}
{% endstepper %}

## 템플릿 예시

```markdown
## Meeting Outcome

- 2027 Q2 Go-Live 일정 확정
- Aurora PostgreSQL 기반 PoC 진행 합의 (2026 Q4)
- IT 본부장 김담당이 주 의사결정자로 확정
- 예산은 연간 3억원 확보, CFO 승인 완료 상태

## Next Action

| # | 액션 | 담당 | 기한 |
|---|------|------|------|
| 1 | PoC 제안서 초안 작성 | SA 박엔지니어 | 2026-05-15 |
| 2 | 라이선스 TCO 분석 | AM 이세일 | 2026-05-20 |
| 3 | 클라우드 보안 리뷰 요청 | 고객 보안팀 | 2026-05-25 |

## Key Quotes

> "라이선스 비용 절감이 되기만 하면 이관 방식은 우리가 협의해서 맞출 수 있어요." — 김담당, IT 본부장

## Risks and Concerns

- 레거시 ERP와 연동된 15개 주변 시스템의 호환성 검증 필요
- 보안팀의 클라우드 정책 리뷰 일정이 불투명
```

## 요약 에이전트 활용

로그 작성 중 요약 에이전트 채팅 창을 열어두면 참고 자료를 즉석에서 찾을 수 있습니다.

```
관리자: 유사한 이관 일정으로 진행한 사례 있어?

Planning Agent: KB에서 검색한 결과 다음 사례가 있습니다.

  - xyz-corp: 2024 Q3 PoC → 2025 Q1 Production 이관 (6개월)
  - abc-inc: 2023 Q4 PoC → 2024 Q2 Production (9개월, 보안 리뷰로 지연)

  고객이 제시한 2027 Q2 Go-Live는 xyz-corp과 유사한 템포입니다.
```

## 로그 편집과 버전

로그는 생성 후에도 편집 가능합니다. 편집 이력은 `updatedAt` 타임스탬프에 반영되지만 별도 버전 관리 UI는 제공하지 않습니다. 중요한 변경은 별도 노트로 보관하는 것을 권장합니다.

## 캠페인 차원 통계

여러 세션의 Meeting Log를 종합한 통계는 [캠페인 대시보드](../07-analytics/campaign-dashboard.md)에서 확인합니다.

## 다음 단계

[캠페인 대시보드](../07-analytics/campaign-dashboard.md)로 이동하여 전체 캠페인 관점의 분석을 살펴봅니다.
