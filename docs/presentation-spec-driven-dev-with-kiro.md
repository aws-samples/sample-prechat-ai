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

**Spec → Design → Tasks**

- 요구사항을 Spec으로 정의
- AI가 Design 문서를 생성
- Design에서 구현 Tasks를 도출
- Tasks를 순차적으로 실행하며 개발

> 📝 발표자 노트:
> Spec-Driven Development는 "코드부터 짜자"가 아니라 "뭘 만들지 먼저 정의하자"입니다. AI가 Spec을 이해하고 Design을 제안하고, 거기서 Tasks를 뽑아내니까 개발 방향이 흔들리지 않습니다.

---

## Slide 8: Steering (운전대) 개념

**AI 에이전트의 행동을 팀에 맞게 조향하는 메커니즘**

- `tech.md` — 기술 스택, 빌드 규칙, 코드 스타일
- `product.md` — 제품 개요, 도메인 용어, 핵심 가치
- `structure.md` — 프로젝트 구조, 명명 규칙, 배포 영향 범위
- Custom Steering — 팀 고유의 규칙 추가 가능

> 📝 발표자 노트:
> Steering은 말 그대로 "운전대"입니다. AI가 코드를 생성할 때 우리 팀의 규칙을 따르도록 방향을 잡아주는 거죠. 한 번 잘 세팅해두면 모든 대화에서 자동으로 참조됩니다. PreChat 프로젝트에서는 도메인 지식 문서까지 Steering에 넣어서 AI가 우리 비즈니스를 이해한 상태로 코드를 작성하게 했습니다.

---

## Slide 9: AgentSkill Import & Hooks

**AgentSkill** — 커뮤니티/팀이 만든 재사용 가능한 AI 행동 패턴

**Hooks** — IDE 이벤트에 반응하는 자동화 트리거
- `fileEdited` → 파일 저장 시 자동 실행
- `preToolUse` → 도구 실행 전 검증
- `postToolUse` → 도구 실행 후 후처리
- `agentStop` → 에이전트 대화 종료 시

> 📝 발표자 노트:
> AgentSkill은 npm 패키지처럼 남이 만든 AI 행동 패턴을 가져다 쓸 수 있는 개념이고, Hooks는 GitHub Actions처럼 특정 이벤트에 자동으로 반응하는 자동화입니다. 이 두 가지를 조합하면 상당히 강력한 개발 자동화가 가능합니다.

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

> 📝 발표자 노트:
> PreChat은 세션, 캠페인, 에이전트 등 도메인 개념이 복잡합니다. 이걸 매번 AI에게 설명하는 대신, Steering 파일로 한 번 정리해두니까 AI가 "세션이 뭔지", "캠페인과 세션의 관계가 뭔지" 이미 알고 있는 상태에서 대화가 시작됩니다. 설계 다이어그램 이미지도 넣었습니다.

---

## Slide 12: 횡단 관심사 자동화 — i18n

**i18n은 번거로운 반복 작업**

- AI Agent가 이를 알잘딱 수행할 수 있도록 Steering 제공
- Hook에서 i18n 해야 할지 여부를 판단하게 함
- 프론트엔드 파일 수정 시 자동으로 번역 키 누락 체크

> 📝 발표자 노트:
> 한국어/영어 다국어 지원이 필요한 프로젝트였는데, 매번 번역 키를 수동으로 관리하는 건 정말 번거롭습니다. Steering에 i18n 가이드라인을 넣고, Hook으로 프론트엔드 파일 수정 시 자동으로 번역 필요 여부를 판단하게 했습니다.

---

## Slide 13: 횡단 관심사 자동화 — Security Check

**Security check 역시 번거로운 작업**

- 커뮤니티에서 다운로드한 AgentSkill 활성화
- 보안 민감 파일 수정 시 자동으로 정적 리뷰 레포트 생성
- auth, session, token, .env 등 패턴 매칭으로 트리거

> 📝 발표자 노트:
> 보안 리뷰를 매번 수동으로 하기엔 현실적으로 어렵습니다. PostToolUse Hook에서 파일 패턴을 체크하고, 보안 민감 파일이면 자동으로 security-reviewer AgentSkill을 권장하도록 구성했습니다. 완벽한 보안 감사는 아니지만, 기본적인 정적 리뷰를 놓치지 않게 해줍니다.

---

## Slide 14: 횡단 관심사 자동화 — TODO Hook

**Agent Stop Hook: 대화 세션이 끝날 때마다 TODO 제안**

- Kiro 에이전트와 대화 세션이 끝날 때마다 TODO 제안 Hook이 실행
- Next Action Item을 놓치지 않을 수 있었음
- **상당한 도움이 됨**

> 📝 발표자 노트:
> 이게 생각보다 정말 유용했습니다. 작업하다 보면 "아 이것도 해야 하는데" 하고 까먹는 경우가 많잖아요. 에이전트 대화가 끝날 때마다 자동으로 "커밋했나? 문서 업데이트 필요한가? 다음 TODO가 있나?" 체크해주니까 흐름이 끊기지 않았습니다.

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

**배포 Hook**

- 실제 웹사이트 / 백엔드 / 에이전트 배포를 위한 배포 Hook을 만들어 놓고
- Agent에게 실행 위임

| Hook | 대상 | 명령어 |
|------|------|--------|
| Deploy Frontend | 프론트엔드 | `./deploy-website.sh` |
| Deploy Backend | SAM 인프라 | `sam build && sam deploy` |
| Deploy Agents | AI 에이전트 | `./deploy-agents.sh` |

> 📝 발표자 노트:
> 여기서 실제 배포 전/후 사이트를 라이브 데모합니다. 배포 자체도 Hook으로 자동화해두었기 때문에, 에이전트에게 "배포해줘"라고 하면 적절한 Hook이 실행됩니다. [데모 진행]

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
