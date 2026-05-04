---
description: 워크샵 가이드의 [사진첨부] 자리에 삽입할 스크린샷 준비 체크리스트
icon: camera
hidden: true
---

# 스크린샷 준비 체크리스트

워크샵 가이드 전체에 산재된 `[사진첨부]` 자리표시자를 한곳에 모은 체크리스트입니다. 파일별·화면별로 그룹핑되어 있어 리허설 시 순차적으로 촬영할 수 있습니다.

## 촬영 지침

- **해상도**: 1920×1080 권장, 최소 1280×720
- **포맷**: PNG (UI 텍스트가 선명)
- **언어**: 한국어 가이드이므로 **한국어 UI** 스크린샷 사용 (관리자 대시보드에서 언어를 ko로 설정)
- **민감 정보 마스킹**: AWS 계정 ID, 이메일, 전화번호는 블러 또는 더미 값으로 교체
- **저장 위치 제안**: `gitbook/.gitbook/assets/` 또는 `gitbook/images/`
- **파일명 규칙**: `{섹션번호}-{페이지}-{순번}-{설명}.png` (예: `04-create-campaign-02-outbound-form.png`)

## 진행 현황

총 **76장** (키워드 설명용 2개 제외)

- [ ] 02-setup: 8장
- [ ] 03-deploy: 3장
- [ ] 04-admin: 19장
- [ ] 05-session: 21장
- [ ] 06-postsession: 11장
- [ ] 07-analytics: 13장
- [ ] 08-ops: 1장

---

## 02. 환경 준비 (8장)

### `02-setup/cloudshell-setup.md` (1장)

- [ ] 1. AWS Console 상단 CloudShell 아이콘

### `02-setup/bedrock-model-access.md` (5장)

- [ ] 1. Bedrock 콘솔 홈 + 리전 셀렉터 화면
- [ ] 2. Model access 메뉴 경로
- [ ] 3. Modify model access 버튼 위치
- [ ] 4. 모델 선택 체크리스트 화면
- [ ] 5. Access granted 상태 화면

### `02-setup/windows-setup.md` (2장)

- [ ] 1. Docker Desktop Settings의 WSL 2 based engine 옵션
- [ ] 2. WSL integration 화면

---

## 03. 배포 (3장)

### `03-deploy/verify-deployment.md` (3장)

- [ ] 1. PreChat 랜딩 페이지 (캠페인 코드 입력 화면)
- [ ] 2. AgentCore Runtime 목록 화면
- [ ] 3. Runtime 상세 → Logs 탭

---

## 04. 관리자 온보딩 (19장)

### `04-admin/create-admin-account.md` (6장)

- [ ] 1. 관리자 로그인 화면
- [ ] 2. Sign up 링크 위치
- [ ] 3. 회원가입 폼
- [ ] 4. 이메일 인증 화면
- [ ] 5. 관리자 대시보드 첫 화면
- [ ] 6. 온보딩 Quest 카드 6개

### `04-admin/create-agent.md` (6장)

- [ ] 1. Agents 리스트 화면
- [ ] 2. 모델 선택 드롭다운
- [ ] 3. 시스템 프롬프트 입력 영역
- [ ] 4. 도구 선택 체크리스트
- [ ] 5. KB ID 입력 필드
- [ ] 6. Prepare 버튼 및 Status 표시

### `04-admin/create-campaign.md` (7장)

- [ ] 1. Campaigns 리스트와 Create 버튼
- [ ] 2. 캠페인 생성 폼 기본 정보 (Outbound)
- [ ] 3. Agent Configurations 섹션
- [ ] 4. Active 상태로 전환된 캠페인
- [ ] 5. Inbound 타입 선택 시 나타나는 PIN 필드
- [ ] 6. 캠페인 URL 복사 버튼
- [ ] 7. 캠페인 리스트 화면

---

## 05. 세션 유스케이스 (21장)

### `05-session/outbound-session.md` (8장)

- [ ] 1. Sessions 리스트와 Create 버튼
- [ ] 2. 캠페인 드롭다운
- [ ] 3. 고객 정보 입력 폼
- [ ] 4. Agent override 드롭다운
- [ ] 5. 세션 생성 완료 화면 — URL과 PIN 표시
- [ ] 6. Sessions 리스트 전체 뷰
- [ ] 7. 세션 상세 화면 (Info 탭)
- [ ] 8. Inactivate 버튼 위치

### `05-session/inbound-session.md` (5장)

- [ ] 1. 인바운드 랜딩 화면
- [ ] 2. PIN 입력 화면
- [ ] 3. PII 입력과 동의 체크박스
- [ ] 4. 채팅 화면 진입 직후
- [ ] 5. 인바운드 캠페인의 Sessions 리스트 (Created By: Inbound)

### `05-session/customer-conversation.md` (8장)

- [ ] 1. 고객 채팅 화면 전체
- [ ] 2. 스트리밍 중인 응답 (커서 깜빡임 순간 캡처)
- [ ] 3. 채팅 내 폼 UI 예시
- [ ] 4. AWS 문서 근거가 포함된 AI 응답
- [ ] 5. End conversation 버튼
- [ ] 6. 피드백 모달
- [ ] 7. 감사 화면
- [ ] 8. 언어 전환 셀렉터

---

## 06. 세션 종료 후 자동화 (11장)

### `06-postsession/ai-report.md` (3장)

- [ ] 1. AI Report 탭 전체 화면
- [ ] 2. 실제 BANT 리포트 렌더링 예시
- [ ] 3. Regenerate Report 버튼

### `06-postsession/meeting-plan.md` (6장)

- [ ] 1. Meeting Plan 탭 전체 화면
- [ ] 2. Meeting Plan 탭 진입 (빈 상태 또는 생성 중)
- [ ] 3. References 섹션
- [ ] 4. Comments 입력 UI
- [ ] 5. Planning Agent 채팅 사이드 패널
- [ ] 6. 플랜 섹션 인라인 편집

### `06-postsession/meeting-log.md` (2장)

- [ ] 1. Meeting Log 빈 상태
- [ ] 2. Meeting Log 입력 폼

---

## 07. 캠페인 분석 (13장)

### `07-analytics/campaign-dashboard.md` (8장)

- [ ] 1. 캠페인 상세 상단 탭
- [ ] 2. 캠페인 대시보드 최상단 메트릭 카드
- [ ] 3. 세션 추이 라인 차트
- [ ] 4. 상담 목적 도넛 차트
- [ ] 5. BANT 파악률 막대 차트
- [ ] 6. CSAT 히스토그램
- [ ] 7. AWS 서비스 언급 빈도
- [ ] 8. 필터 패널

### `07-analytics/campaign-comparison.md` (5장)

- [ ] 1. 캠페인 비교 페이지 진입
- [ ] 2. 캠페인 멀티 셀렉트
- [ ] 3. 기간 셀렉터
- [ ] 4. 캠페인 비교 테이블
- [ ] 5. 지표별 그룹 막대 차트

---

## 08. 운영 (1장)

### `08-ops/cleanup.md` (1장)

- [ ] 1. AgentCore Runtime 삭제 버튼

---

## 사진첨부 교체 방법

촬영이 끝나면 각 `**[사진첨부]**` 표기를 마크다운 이미지 문법으로 교체합니다.

### Before

```markdown
**[사진첨부]** 고객 채팅 화면 전체
```

### After (예: GitBook assets 사용)

```markdown
![고객 채팅 화면 전체](../.gitbook/assets/05-customer-conversation-01-chat-overview.png)
```

### 팁

- GitBook UI에서 이미지를 드래그앤드롭하면 `.gitbook/assets/`에 자동 업로드되고 상대경로가 삽입됩니다
- Git Sync 중이라면 Git에서 이미지를 커밋하면 GitBook에도 자동 반영됩니다
- 대안: `gitbook/images/{section}/` 같은 별도 디렉토리에 정리해도 무방 (상대경로만 맞추면 됨)

## 일괄 교체 스크립트 (선택)

Python으로 반자동 교체할 때 참고 템플릿입니다.

```python
# scripts/replace-screenshots.py
import re
from pathlib import Path

# (파일경로, 순번, 설명) → 이미지 파일명 매핑
mapping = {
    ("gitbook/05-session/customer-conversation.md", 1): "05-customer-conversation-01-chat-overview.png",
    # ... 나머지 75개
}

for (file_path, idx), image_name in mapping.items():
    # 구현 생략
    pass
```

수동으로도 충분히 가능하며, 한 번 작성 후 재사용할 일이 많지 않으므로 직접 편집을 권장합니다.
