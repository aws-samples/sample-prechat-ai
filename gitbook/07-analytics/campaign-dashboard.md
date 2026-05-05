---
description: 캠페인 대시보드에서 세션 지표, 상담 목적 분포, CSAT 트렌드 보기
icon: chart-line
---

# 캠페인 대시보드

캠페인의 전체 세션을 집계해 트렌드와 패턴을 보여줍니다. 마케팅 성과 검토와 ICP 분석에 활용합니다.

## 진입 방법

캠페인 리스트에서 해당 캠페인 클릭 → 상단 **Analytics** 탭 선택

![캠페인 상세 상단 탭](../.gitbook/assets/07-campaign-dashboard-01-detail-tabs.png)

## 주요 지표 카드

![캠페인 대시보드 최상단 메트릭 카드](../.gitbook/assets/07-campaign-dashboard-01-detail-tabs.png)

| 카드 | 설명 |
|------|------|
| Total Sessions | 생성된 전체 세션 수 |
| Active Sessions | 현재 진행 중인 세션 수 |
| Completed Sessions | 정상 종료된 세션 수 |
| Completion Rate | 완료율 (Completed / Total × 100) |
| Avg. Messages / Session | 세션당 평균 메시지 수 |
| Avg. CSAT | 평균 피드백 점수 (1~5) |

## 세션 추이 차트

시간대별 세션 생성/완료 추이를 라인 차트로 보여줍니다. 일별·주별·시간대별 뷰를 전환할 수 있습니다.

![세션 추이 라인 차트](../.gitbook/assets/07-campaign-dashboard-02-metrics-cards.png)

## 상담 목적 분포

고객이 대화 초반에 선택한 Consultation Purpose를 도넛 차트로 집계합니다.

![상담 목적 도넛 차트](../.gitbook/assets/07-campaign-dashboard-02-metrics-cards.png)

| 목적 예시 | 의미 |
|---------|-----|
| New Adoption | 신규 도입 상담 |
| Cost Optimization | 비용 최적화 |
| Migration | 마이그레이션 |
| Training | 학습/교육 |
| Other | 기타 |

## BANT 파악률

BANT 네 항목별 "파악됨/누락" 비율을 막대 그래프로 표시합니다.

![BANT 파악률 막대 차트](../.gitbook/assets/07-campaign-dashboard-02-metrics-cards.png)

## CSAT 분포

피드백 점수(1~5)의 분포와 평균을 표시합니다. 점수 하락 추세는 에이전트 프롬프트 개선이 필요하다는 신호입니다.

![CSAT 히스토그램](../.gitbook/assets/07-campaign-dashboard-02-metrics-cards.png)

## AWS Services 언급 빈도

대화 중 언급되거나 요약 에이전트가 추천한 AWS 서비스의 빈도를 막대 그래프로 표시합니다.

![AWS 서비스 언급 빈도](../.gitbook/assets/07-campaign-dashboard-02-metrics-cards.png)

<details>
<summary>필터와 드릴다운</summary>

![필터 패널](../.gitbook/assets/07-campaign-dashboard-01-detail-tabs.png)

대시보드 상단에서 다음 필터를 적용할 수 있습니다.

- **기간** — 최근 7일, 30일, 90일, 사용자 정의
- **상태** — Completed만 / 전체
- **CSAT** — 특정 점수 이상
- **상담 목적** — 특정 목적만

차트의 데이터 포인트를 클릭하면 해당 세션 목록으로 드릴다운됩니다.
</details>

<details>
<summary>데이터 내보내기</summary>

우측 상단 **Export** 버튼 클릭. 현재 적용된 필터 기준으로 CSV가 생성됩니다.

```
sessionId, customerName, company, status, purpose,
messageCount, csat, createdAt, completedAt
```
</details>

<details>
<summary>원시 데이터 접근</summary>

| 경로 | 내용 |
|------|------|
| DynamoDB `SessionsTable` | 세션 메타데이터 |
| DynamoDB `MessagesTable` | 모든 대화 메시지 |
| CloudWatch Logs | Lambda 실행 로그 |
| AgentCore Observability | 에이전트 호출 trace |

대규모 분석이 필요하면 DynamoDB Streams → S3 → Athena 파이프라인을 구축합니다.
</details>

## 다음 단계

[캠페인 간 비교](campaign-comparison.md)로 이동합니다.