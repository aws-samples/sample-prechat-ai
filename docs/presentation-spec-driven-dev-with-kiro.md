# Spec-Driven Development with Kiro: AI Agent 시대의 실전 개발 경험

> 발표자 노트 포함 슬라이드 구성안
> Last Updated: 2026-03-02

---

## Slide 1: Title

**Spec-Driven Development with Kiro**
AI Agent (w/ Context Engineering, MCP) 가 Vibe Coding 에 가져온 가치

> 📝 발표자 노트:
> 인사 및 자기소개. "오늘은 제가 AWS PreChat 프로젝트를 Kiro IDE로 개발하면서 겪은 실전 경험을 공유하겠습니다."

---

## Slide 2: AI Agent가 Vibe Coding에 가져온 가치

**무제한적인 가치** — 가치가 무한하다는 게 아니라, 가치 실현에 제한이 없다는 것

- 더 많은 아이디어 실험과 검증
- 횡단성 업무 위임과 반자동화

> 📝 발표자 노트:
> "무제한적"이라는 표현에 주목해주세요. AI가 만능이라는 뜻이 아닙니다. 이전에는 시간/리소스 제약으로 시도조차 못했던 아이디어를 이제는 빠르게 실험하고 검증할 수 있다는 뜻입니다. i18n, 보안 리뷰, 문서화 같은 횡단 관심사를 AI에게 위임하면서 핵심 로직에 집중할 수 있게 됩니다.

---

## Slide 3: Why Context Engineering?

**LLM 토큰과 문해력의 한계**

- LLM은 한 번에 처리할 수 있는 컨텍스트에 한계가 있음
- 컨텍스트를 유지하고 관리하기 위한 메커니즘 수립 필요 (md 파일 기반)
- 이미 진영적 기술 텀으로 자리잡고 있음:
  - CLAUDE.md, SKILL.md, AGENT.md, AgentSkills
  - **Kiro: Spec-Driven Development, Steering**

> 📝 발표자 노트:
> "Prompt Engineering"의 다음 단계가 "Context Engineering"입니다. 단순히 좋은 프롬프트를 쓰는 것을 넘어, AI가 참조할 컨텍스트 자체를 체계적으로 설계하고 관리하는 것이죠. 각 도구마다 이를 위한 자체 메커니즘을 제공하고 있고, Kiro는 Spec과 Steering이라는 개념으로 이를 풀고 있습니다.

---

## Slide 4: Why are you so anxious when facing AI tools?

커뮤니티에서 공개하는 다양한 성공 사례들
→ 당신이 뭔가 놓치고 있거나, 시대가 빠르게 변하는 것처럼 느끼게 함

- "Tool Pre-Hook에서 trust를 AI가 판단하도록 해서..."
- "요구사항을 넣어주면 체계적인 /plan을 거쳐서 파일 영향 없이..."
- "OWASP10 정적 리뷰를 알아서 수행..."

> 📝 발표자 노트:
> 화려한 데모와 성공 사례를 보면 불안해지기 쉽습니다. 하지만 까고 보면, 이것들은 전부 Context Engineering (Prompt Engineering) 성공사례를 공유하고 있는 겁니다. 어찌보면 "그들 팀에 치우쳐진" 구성이에요.

---

## Slide 5: 깨달으세요

**"이게 당신 팀에 Align한 구성인가요?"**

- 화려한 말에 속지 말 것
- 그들이 무료로 공개한 SW 운영 인사이트(= 컨텍스트 파일)를 이해하고 뽑아 먹으면 됩니다
- 핵심: 남의 컨텍스트를 복붙하는 게 아니라, 원리를 이해하고 우리 팀에 맞게 구성하는 것

> 📝 발표자 노트:
> 여기가 오늘 발표의 핵심 메시지 중 하나입니다. 커뮤니티의 성공 사례는 참고 자료이지, 정답이 아닙니다. 중요한 건 그 뒤에 있는 "컨텍스트 설계 원리"를 이해하는 것이고, Kiro는 이 원리를 IDE 레벨에서 구조화해줍니다.

---

## Slide 6: Why Kiro?

**당신이 어떤 팀이든, SW Development LifeCycle에서 거치는 핵심 공통 패턴을 IDE 자체에서 제공**

여러분은 해당 라이프사이클에 align하여, 당신 팀을 위한 **적은 노력의 컨텍스트 구성**으로 개발 환경을 구성할 수 있습니다.

> 📝 발표자 노트:
> 다른 도구들은 "여기 빈 md 파일이 있으니 알아서 채우세요"라는 접근입니다. Kiro는 Spec → Design → Tasks라는 개발 라이프사이클 자체를 구조화하고, Steering으로 팀의 컨텍스트를 주입하는 프레임워크를 제공합니다. 시작점이 명확하니 진입 장벽이 낮습니다.

---

## Slide 7: Spec-Driven Development 개념

**Spec → Design → Tasks** (`.kiro/specs/{feature}/` 에 저장)

- `requirements.md` — 요구사항 정의 (사용자 스토리, 수용 기준)
- `design.md` — AI가 생성하는 기술 설계 문서 (데이터 모델, API, 컴포넌트 구조)
- `tasks.md` — Design에서 도출된 구현 작업 목록 (체크리스트 형태, 순차 실행)

각 Spec은 독립적인 feature 단위로 관리되며, `#[[file:경로]]` 문법으로 외부 문서(OpenAPI spec, GraphQL schema 등)를 참조할 수 있음

```
.kiro/specs/
├── ui-customization/        # UI 커스터마이징 기능
│   ├── requirements.md      # "파트너가 로고, 색상, 레이아웃을 변경할 수 있어야 한다"
│   ├── design.md            # 컴포넌트 구조, API 설계, DB 스키마
│   └── tasks.md             # [ ] CustomizationContext 생성, [ ] API 엔드포인트 구현, ...
├── websocket-streaming/     # WebSocket 스트리밍
├── planning-agent-chat/     # Planning Agent 채팅
└── ...
```

> 📝 발표자 노트:
> Spec-Driven Development는 "코드부터 짜자"가 아니라 "뭘 만들지 먼저 정의하자"입니다. AI가 Spec을 이해하고 Design을 제안하고, 거기서 Tasks를 뽑아내니까 개발 방향이 흔들리지 않습니다. PreChat 프로젝트에서는 8개의 Spec을 만들어 기능별로 독립 관리했습니다. Tasks에 "이 작업 시 `front-i18n-guideline` Steering을 참조하라"고 명시하면 AI가 맥락을 잃지 않습니다.

---

## Slide 8: Steering (운전대) 개념

**AI 에이전트의 행동을 팀에 맞게 조향하는 메커니즘** (`.kiro/steering/*.md`)

Steering 파일은 inclusion 모드에 따라 컨텍스트 주입 방식이 달라짐:

| 모드 | 동작 | 예시 |
|------|------|------|
| `always` (기본) | 모든 대화에 자동 포함 | `tech.md`, `product.md`, `structure.md` |
| `fileMatch` | 특정 파일 패턴 읽힐 때만 포함 | `front-i18n-guideline.md` (`.tsx` 작업 시) |
| `manual` | 사용자가 `#` 컨텍스트 키로 명시적 호출 | `strands-dev.md` (에이전트 코드 작업 시) |

PreChat 프로젝트에서 사용한 주요 Steering:

| Steering 파일 | 역할 | 모드 |
|--------------|------|------|
| `tech.md` | 기술 스택, 빌드 규칙, 코드 스타일 | always |
| `product.md` | 제품 개요, 도메인 용어, 핵심 가치 | always |
| `structure.md` | 프로젝트 구조, 명명 규칙, 배포 영향 범위 | always |
| `prechat-domain-knowledge.md` | DDD 모델, API 구조, 용어 사전 | always |
| `prechat-system-architecture.md` | 시스템 아키텍처, 워크플로우 | always |
| `front-i18n-guideline.md` | 프론트엔드 다국어 처리 규칙 | fileMatch |
| `security.md` | OWASP Top 10, 시크릿 관리 | always |
| `coding-style.md` | 불변성, 에러 핸들링, 입력 검증 | always |
| `git-workflow.md` | 커밋 컨벤션, 브랜치 전략 | always |
| `strands-dev.md` | Strands SDK 에이전트 코드 가이드 | fileMatch |

> 📝 발표자 노트:
> Steering은 말 그대로 "운전대"입니다. AI가 코드를 생성할 때 우리 팀의 규칙을 따르도록 방향을 잡아주는 거죠. 한 번 잘 세팅해두면 모든 대화에서 자동으로 참조됩니다. PreChat 프로젝트에서는 14개의 Steering 파일을 운용했고, 특히 도메인 지식 문서를 always 모드로 넣어서 AI가 우리 비즈니스를 이해한 상태로 코드를 작성하게 했습니다. `front-i18n-guideline.md`처럼 특정 파일 작업 시에만 활성화되는 조건부 Steering도 활용했습니다.

---

## Slide 9: AgentSkill Import & Hooks

**AgentSkill** (`.kiro/skills/{skill-name}/SKILL.md`) — 재사용 가능한 AI 행동 패턴

- 커뮤니티 또는 팀이 만든 전문 역할을 AI에게 부여
- `SKILL.md`에 역할, 제약조건, 실행 프로토콜을 정의
- 대화 중 자동 또는 수동으로 활성화

PreChat에서 활용한 주요 AgentSkill:

| Skill | 역할 | 활성화 |
|-------|------|--------|
| `security-reviewer` | OWASP Top 10 기반 보안 정적 리뷰 | Hook에서 자동 권장 |
| `doc-updater` | 소스 코드 기반 문서 생성/갱신 | 수동 호출 |
| `verify` | 빌드/테스트/린트 통합 검증 | 수동 호출 |
| `code-reviewer` | 코드 품질, 보안, 유지보수성 리뷰 | 수동 호출 |
| `explore` | 코드베이스 탐색 및 분석 | 수동 호출 |
| `tdd-guide` | 테스트 먼저 작성 가이드 | 수동 호출 |

**Hooks** (`.kiro/hooks/*.kiro.hook`) — IDE 이벤트에 반응하는 자동화 트리거

| 이벤트 타입 | 트리거 시점 | 액션 타입 |
|------------|-----------|----------|
| `fileEdited` | 파일 저장 시 | `askAgent` / `runCommand` |
| `fileCreated` | 파일 생성 시 | `askAgent` / `runCommand` |
| `postToolUse` | 도구 실행 후 | `askAgent` |
| `agentStop` | 에이전트 대화 종료 시 | `askAgent` |
| `userTriggered` | 사용자 수동 실행 | `runCommand` / `askAgent` |

Hook JSON 구조 예시:
```json
{
  "name": "Security Auto Trigger",
  "version": "1.0.0",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "보안 민감 파일인지 확인하고, 해당하면 security-reviewer Skill 권장"
  }
}
```

> 📝 발표자 노트:
> AgentSkill은 npm 패키지처럼 남이 만든 AI 행동 패턴을 가져다 쓸 수 있는 개념이고, Hooks는 GitHub Actions처럼 특정 이벤트에 자동으로 반응하는 자동화입니다. 이 두 가지를 조합하면 상당히 강력한 개발 자동화가 가능합니다. PreChat에서는 30개의 AgentSkill과 6개의 Hook을 운용했습니다.

---

## Slide 10: 나의 일화 — AWS PreChat 개발 경험

> ⚠️ **Disclaimer**: 이것은 발표자의 일화이지, Best Practice가 아닙니다. 당신네 팀에 들어맞는 부분이 있다면 참고만 하세요.

**AWS PreChat**: Amazon Bedrock AgentCore + Strands SDK 기반 AI 사전 상담 시스템

> 📝 발표자 노트:
> 여기서부터는 제 실전 경험입니다. 정답이 아니라 하나의 사례로 봐주세요. 팀마다 상황이 다르니까요.

---

## Slide 11: Domain 지식의 주입

**설계 이미지, 마크다운 문서 가릴 것 없이 주입**

- `product.md` 뿐만 아니라, 도메인 해설 문서를 별개로 Steering에 추가
- `always` 참조를 걸어서 모든 대화에서 도메인 컨텍스트 유지
- 시스템 아키텍처, 데이터 모델, API 구조, 용어 사전까지 포함

실제 구성:
```
.kiro/steering/
├── product.md                       # 제품 개요, 핵심 가치, 사용자 정의
├── prechat-domain-knowledge.md      # DDD 모델, Aggregate Root, Bounded Context
│                                    #   API 엔드포인트, DynamoDB 스키마, 용어 사전
├── prechat-system-architecture.md   # 계층 구조, 워크플로우, 에이전트 역할
│                                    #   설계 다이어그램 참조
└── (모두 inclusion: always)
```

`prechat-domain-knowledge.md` 에 포함된 내용 예시:
- Session(Aggregate Root)의 속성, 상태 전이, CRUD 메서드
- Campaign ↔ Session ↔ Agent 관계 정의
- DynamoDB PK/SK 네이밍 규칙 (`SESSION#{id}`, `MESSAGE#{id}`)
- Ubiquitous Language 용어 사전 (폐기 용어 포함)
- API 엔드포인트 전체 목록 (고객용/관리자용 분리)

> 📝 발표자 노트:
> PreChat은 세션, 캠페인, 에이전트 등 도메인 개념이 복잡합니다. 이걸 매번 AI에게 설명하는 대신, Steering 파일로 한 번 정리해두니까 AI가 "세션이 뭔지", "캠페인과 세션의 관계가 뭔지" 이미 알고 있는 상태에서 대화가 시작됩니다. 설계 다이어그램 이미지도 넣었습니다. 도메인 지식 문서만 약 500줄인데, 이걸 매 대화마다 설명하는 것과 Steering으로 자동 주입하는 것의 차이는 엄청납니다.

---

## Slide 12: 횡단 관심사 자동화 — i18n

**i18n은 번거로운 반복 작업**

- `front-i18n-guideline.md` Steering (inclusion: `fileMatch`, pattern: `*.tsx`)
  - `.tsx` 파일 작업 시에만 자동으로 i18n 가이드라인이 컨텍스트에 주입
  - 번역 키 네이밍 규칙, `useTranslation()` 훅 사용법, 번역 파일 위치 등 명시
- `domain-alignment-check` Hook (event: `fileCreated`)
  - 새 프론트엔드 파일 생성 시 자동으로 도메인 정렬 + i18n 지원 여부 검증
  - "i18n 키로서 문자열 상수를 활용해 다국어를 지원하고 있는가?" 체크 포함

```json
// domain-alignment-check.kiro.hook (발췌)
{
  "when": {
    "type": "fileCreated",
    "patterns": ["packages/web-app/src/**/*.tsx", "packages/web-app/src/**/*.ts"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "...i18n 키로서 문자열 상수를 활용해 다국어를 지원하고 있는가?..."
  }
}
```

> 📝 발표자 노트:
> 한국어/영어 다국어 지원이 필요한 프로젝트였는데, 매번 번역 키를 수동으로 관리하는 건 정말 번거롭습니다. Steering에 i18n 가이드라인을 fileMatch 모드로 넣어서 `.tsx` 파일 작업 시에만 활성화되게 했고, 새 파일 생성 시 Hook이 자동으로 i18n 지원 여부를 체크합니다. 이 조합으로 번역 키 누락이 거의 사라졌습니다.

---

## Slide 13: 횡단 관심사 자동화 — Security Check

**Security check 역시 번거로운 작업**

- `security-auto-trigger` Hook (event: `postToolUse`, toolTypes: `write`)
  - 파일 쓰기 도구 실행 후 자동으로 보안 민감 파일 여부 판단
  - `auth`, `session`, `token`, `jwt`, `credential`, `.env`, `security`, `api/` 패턴 매칭
  - 해당 시 `security-reviewer` AgentSkill 활성화 권장

```json
// security-auto-trigger.kiro.hook
{
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "보안 민감 파일(auth, session, token, jwt, .env 등)인지 확인.
              해당하면 security-reviewer Skill 보안 검토 권장.
              해당하지 않으면 아무것도 하지 마세요."
  }
}
```

- `security.md` Steering (inclusion: `always`)
  - OWASP Top 10 인지, 시크릿 핸들링, 취약점 방지 규칙을 상시 주입
- `security-reviewer` AgentSkill
  - 커뮤니티에서 다운로드한 Skill
  - CWE Top 25 + STRIDE 기반 정적 리뷰 레포트 생성

**Hook + Steering + Skill 3중 조합**으로 보안 검토 자동화

> 📝 발표자 노트:
> 보안 리뷰를 매번 수동으로 하기엔 현실적으로 어렵습니다. 이 3중 조합이 핵심입니다: (1) Steering으로 보안 규칙을 상시 주입, (2) Hook으로 보안 민감 파일 수정을 자동 감지, (3) AgentSkill로 전문적인 정적 리뷰 수행. 완벽한 보안 감사는 아니지만, 기본적인 정적 리뷰를 놓치지 않게 해줍니다.

---

## Slide 14: 횡단 관심사 자동화 — TODO Hook

**`session-wrap` Hook** (event: `agentStop`) — 대화 세션이 끝날 때마다 자동 실행

```json
// session-wrap.kiro.hook
{
  "name": "Session Wrap",
  "when": { "type": "agentStop" },
  "then": {
    "type": "askAgent",
    "prompt": "이번 세션에서 상당한 작업이 진행되었다면:
              (1) 변경사항이 커밋되었는가
              (2) 문서 업데이트가 필요한가
              (3) 다음 세션을 위한 TODO가 있는가
              필요한 경우 간단히 안내. 해당 없으면 아무것도 하지 마세요."
  }
}
```

- 에이전트 대화가 끝날 때마다 3가지 체크포인트를 자동 확인
- 커밋 누락, 문서 미갱신, 후속 작업 누락을 방지
- **상당한 도움이 됨** — 작업 흐름이 끊기지 않음

> 📝 발표자 노트:
> 이게 생각보다 정말 유용했습니다. 작업하다 보면 "아 이것도 해야 하는데" 하고 까먹는 경우가 많잖아요. 에이전트 대화가 끝날 때마다 자동으로 체크해주니까 흐름이 끊기지 않았습니다. 단순한 Hook 하나인데 개발 습관 자체를 개선해주는 효과가 있었습니다.

---

## Slide 15: Spec-Driven 개발 + Steering + Skill 조합 사례

**요구사항: 파트너들이 자기 특색에 맞게 웹사이트를 커스터마이징 (UI Customizing)**

1. **Spec** → Design → Tasks 생성
2. Tasks 중간에 특정 **Steering**이나 **AgentSkill**을 참조하라고 일러둠
3. 오후 5시부터 약 **2시간** 정도 지나서
4. 일정 unit 테스트를 거친 **기능 개선 결과물**을 얻게 됨

> 📝 발표자 노트:
> 이게 Spec-Driven Development의 진가입니다. Spec에서 "이 Task를 수행할 때는 이 Steering을 참고하고, 이 AgentSkill을 활용해라"고 명시해두면, AI가 맥락을 잃지 않고 일관된 품질로 작업합니다. 2시간 만에 UI 커스터마이징 기능이 테스트까지 통과한 상태로 나왔습니다.

---

## Slide 16: 배포 전/후 사이트 현장 데모

**배포 Hook** — `userTriggered` 이벤트로 수동 실행

실제 프로젝트에서 사용한 배포 Hook 구성:

```json
// deployment-script-for-frontend-infrastructure.kiro.hook
{
  "name": "deployment script for frontend infrastructure",
  "when": { "type": "userTriggered" },
  "then": {
    "type": "runCommand",
    "command": "./deploy-website.sh prod prechat ap-northeast-2"
  }
}
```

```json
// sam-build-and-deploy-script-for-the-backend-infrastructure.kiro.hook
{
  "name": "sam build and deploy script for the backend infrastructure",
  "when": { "type": "userTriggered" },
  "then": {
    "type": "askAgent",
    "prompt": "sam build --profile prechat && sam deploy --profile prechat
              --region ap-northeast-2 --stack-name mte-prechat ..."
  }
}
```

| Hook | 타입 | 대상 | 실행 방식 |
|------|------|------|----------|
| Deploy Frontend | `runCommand` | 프론트엔드 | `./deploy-website.sh` 직접 실행 |
| Deploy Backend | `askAgent` | SAM 인프라 | 에이전트에게 명령어 위임 |
| Deploy Agents | `runCommand` | AI 에이전트 | `./deploy-agents.sh` 직접 실행 |

> 📝 발표자 노트:
> 여기서 실제 배포 전/후 사이트를 라이브 데모합니다. 배포 자체도 Hook으로 자동화해두었기 때문에, Kiro IDE의 Hook 패널에서 버튼 하나로 배포가 실행됩니다. `runCommand`는 직접 셸 명령을 실행하고, `askAgent`는 에이전트에게 명령어를 전달해서 실행 과정을 모니터링할 수 있습니다. [데모 진행]

---

## Slide 17: Wrap-up

**핵심 메시지**

1. AI 도구의 화려한 성공 사례에 불안해하지 마세요 — 본질은 Context Engineering입니다
2. 남의 컨텍스트를 복붙하지 말고, 원리를 이해하고 우리 팀에 맞게 구성하세요
3. Kiro는 SW Development LifeCycle의 공통 패턴을 IDE에서 제공하여, 적은 노력으로 팀에 맞는 컨텍스트를 구성할 수 있게 해줍니다

**Spec-Driven Development + Steering + Hooks + AgentSkills = 팀에 Align된 AI 개발 환경**

> 📝 발표자 노트:
> 마무리입니다. 오늘 전달하고 싶은 건 하나입니다. "AI 도구를 잘 쓰는 건 프롬프트를 잘 쓰는 게 아니라, 컨텍스트를 잘 설계하는 것이다." Kiro가 그 설계를 쉽게 만들어줍니다. 감사합니다.

---

## Slide 18: Q&A

**질문 & 답변**

📧 aws-prechat@amazon.com / jaebin@amazon.com

---

## Appendix A: PreChat 프로젝트 `.kiro` 디렉토리 구조

```
.kiro/
├── hooks/                                          # 🔗 IDE 이벤트 자동화 (6개)
│   ├── security-auto-trigger.kiro.hook             #   postToolUse(write) → 보안 민감 파일 감지
│   ├── session-wrap.kiro.hook                      #   agentStop → 커밋/문서/TODO 체크
│   ├── domain-alignment-check.kiro.hook            #   fileCreated(*.py,*.tsx,*.ts) → 도메인 정렬 검증
│   ├── code-quality-reminder.kiro.hook             #   fileEdited(*.ts,*.tsx,*.py,...) → 품질 체크
│   ├── deployment-script-for-frontend-...hook       #   userTriggered → ./deploy-website.sh
│   └── sam-build-and-deploy-...kiro.hook           #   userTriggered → sam build && sam deploy
│
├── steering/                                       # 🧭 AI 컨텍스트 조향 (14개)
│   ├── product.md                                  #   [always] 제품 개요, 핵심 가치
│   ├── tech.md                                     #   [always] 기술 스택, 빌드 규칙
│   ├── structure.md                                #   [always] 프로젝트 구조, 명명 규칙
│   ├── prechat-domain-knowledge.md                 #   [always] DDD 모델, API, 용어 사전
│   ├── prechat-system-architecture.md              #   [always] 시스템 아키텍처, 워크플로우
│   ├── coding-style.md                             #   [always] 불변성, 에러 핸들링
│   ├── security.md                                 #   [always] OWASP Top 10, 시크릿 관리
│   ├── git-workflow.md                             #   [always] 커밋 컨벤션, 브랜치 전략
│   ├── golden-principles.md                        #   [always] 핵심 개발 원칙
│   ├── interaction.md                              #   [always] AI 상호작용 패턴
│   ├── agents.md                                   #   [always] 스킬 오케스트레이션 가이드
│   ├── front-i18n-guideline.md                     #   [fileMatch: *.tsx] 다국어 처리 규칙
│   ├── strands-dev.md                              #   [fileMatch: agent*.py] Strands SDK 가이드
│   ├── date-calculation.md                         #   [always] 날짜 계산 규칙
│   └── testing.md                                  #   [always] 테스트 규칙
│
├── specs/                                          # 📋 Spec-Driven Development (8개 feature)
│   ├── campaign-management/                        #   캠페인 관리 기능
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── ui-customization/                           #   파트너 UI 커스터마이징
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── websocket-streaming/                        #   WebSocket 스트리밍
│   ├── planning-agent-chat/                        #   Planning Agent 채팅
│   ├── div-return-protocol/                        #   DIV Return 프로토콜
│   ├── domain-alignment/                           #   도메인 정렬 리팩토링
│   ├── i18n-audit/                                 #   i18n 감사
│   └── i18n-implementation/                        #   i18n 구현
│
├── skills/                                         # 🛠️ AgentSkill (30개, 주요 항목만 표시)
│   ├── security-reviewer/SKILL.md                  #   보안 정적 리뷰
│   ├── security-pipeline/SKILL.md                  #   CWE Top 25 + STRIDE 검증
│   ├── doc-updater/SKILL.md                        #   소스 기반 문서 생성/갱신
│   ├── code-reviewer/SKILL.md                      #   코드 품질 리뷰
│   ├── verify/SKILL.md                             #   빌드/테스트/린트 통합 검증
│   ├── tdd-guide/SKILL.md                          #   TDD 가이드
│   ├── explore/SKILL.md                            #   코드베이스 탐색
│   ├── architect/SKILL.md                          #   시스템 설계
│   ├── planner/SKILL.md                            #   복잡 기능 계획
│   ├── frontend-code-review/SKILL.md               #   프론트엔드 전문 리뷰
│   ├── commit-push-pr/SKILL.md                     #   Git 커밋/PR 자동화
│   └── ... (19개 추가)
│
└── settings/
    └── mcp.json                                    # MCP 서버 설정
```

## Appendix B: Kiro 기술 용어 정리

| 용어 | 정의 | 타 도구 대응 개념 |
|------|------|-----------------|
| **Spec** | 기능 단위의 요구사항-설계-작업 문서 묶음 (`requirements.md` → `design.md` → `tasks.md`) | GitHub Copilot의 `/plan`, Cursor의 Composer |
| **Steering** | AI 에이전트에 상시/조건부로 주입되는 컨텍스트 파일 (`.kiro/steering/*.md`) | `CLAUDE.md`, `.cursorrules`, `AGENTS.md` |
| **Hook** | IDE 이벤트에 반응하는 자동화 트리거 (`.kiro/hooks/*.kiro.hook`) | GitHub Actions, Git Hooks |
| **AgentSkill** | 재사용 가능한 AI 행동 패턴 (`.kiro/skills/{name}/SKILL.md`) | Claude의 AgentSkills, Custom Instructions |
| **Inclusion Mode** | Steering 파일의 컨텍스트 주입 조건 (`always` / `fileMatch` / `manual`) | — (Kiro 고유) |
| **Spec-Driven Development** | Spec을 중심으로 요구사항→설계→구현을 체계적으로 진행하는 개발 방법론 | — (Kiro 고유) |
| **Context Engineering** | AI가 참조할 컨텍스트를 체계적으로 설계하고 관리하는 방법론 | Prompt Engineering의 상위 개념 |
| **MCP** | Model Context Protocol — AI 에이전트가 외부 도구/서비스와 통신하는 표준 프로토콜 | Function Calling, Tool Use |

## Appendix C: PreChat 프로젝트에서 사용한 Hook 전체 목록

| Hook 이름 | 이벤트 | 액션 | 용도 |
|----------|--------|------|------|
| Security Auto Trigger | `postToolUse` (write) | `askAgent` | 보안 민감 파일 수정 시 security-reviewer 권장 |
| Session Wrap | `agentStop` | `askAgent` | 대화 종료 시 커밋/문서/TODO 체크 |
| Domain Alignment Check | `fileCreated` (*.py, *.tsx, *.ts) | `askAgent` | 새 파일의 도메인 모델 정렬 검증 |
| Code Quality Reminder | `fileEdited` (*.ts, *.tsx, *.py, ...) | `askAgent` | 에러 핸들링, 불변성, 입력 검증 체크 |
| Deploy Frontend | `userTriggered` | `runCommand` | `./deploy-website.sh` 실행 |
| Deploy Backend | `userTriggered` | `askAgent` | `sam build && sam deploy` 위임 |
