# Strands Agents on Bedrock AgentCore

Last Updated: 2026-02-28

PreChat 시스템의 AI 에이전트입니다. Strands SDK로 작성되어 Bedrock AgentCore Runtime에 Docker 컨테이너로 배포됩니다.

## 에이전트 개요

| 에이전트 | 역할 | Memory | 엔트리포인트 | 도구 |
|---------|------|--------|-------------|------|
| Consultation Agent | 고객 사전 상담 (8회 대화 플로우) | STM (AgentCore Memory, 30일) | `stream` (SSE) | retrieve, current_time, render_form, AWS Docs MCP |
| Summary Agent | BANT 프레임워크 분석 | 없음 | `invoke` (동기) | 없음 (Structured Output) |
| Planning Agent | 미팅 플랜 생성 + Sales Rep 채팅 | 없음 | `invoke` (동기) + `stream` (SSE) | retrieve, http_request, AWS Docs MCP |

## 구조

```
strands-agents/
├── deploy-agents.sh              # 전체 에이전트 배포 + SSM 등록
├── consultation-agent/
│   ├── agent.py                  # Strands Agent + AgentCore 엔트리포인트
│   ├── deploy_agent.py           # AgentCore 배포 헬퍼
│   ├── Dockerfile                # uv 베이스 + MCP 서버 사전 설치
│   ├── requirements.txt          # strands-agents, mcp, boto3 등
│   ├── .bedrock_agentcore.yaml   # AgentCore 설정
│   └── .dockerignore
├── summary-agent/
│   ├── agent.py                  # Structured Output (AnalysisOutput)
│   ├── deploy_agent.py
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .bedrock_agentcore.yaml
│   └── .dockerignore
└── planning-agent/
    ├── agent.py                  # Structured Output (PlanningOutput) + 스트리밍 채팅
    ├── deploy_agent.py
    ├── Dockerfile                # uv 베이스 + MCP 서버 사전 설치
    ├── requirements.txt          # strands-agents, mcp, boto3 등
    ├── .bedrock_agentcore.yaml
    └── .dockerignore
```

## AWS Documentation MCP 연동

Consultation Agent와 Planning Agent는 [AWS Documentation MCP Server](https://github.com/awslabs/mcp)가 연동되어 있습니다. 에이전트가 고객 상담 중 AWS 공식 문서를 실시간으로 검색하여 정확한 정보를 제공할 수 있습니다.

### Docker 환경 구성

베이스 이미지 `ghcr.io/astral-sh/uv:python3.13-bookworm-slim`에 `uv`/`uvx`가 기본 탑재되어 있으며, Dockerfile에서 다음을 수행합니다:

1. `requirements.txt`에 `mcp` 패키지 포함 → `MCPClient`, `stdio_client` import 지원
2. `uv tool install awslabs.aws-documentation-mcp-server` → 빌드 시점에 사전 설치 (콜드 스타트 방지)
3. non-root 유저(`bedrock_agentcore`)에게 uvx 도구 디렉토리 소유권 이전

### agent.py 연동 패턴

```python
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

aws_docs_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    )
))

agent = Agent(
    tools=[retrieve, aws_docs_mcp_client],
    # ...
)
```

## Structured Output

Summary Agent와 Planning Agent는 Pydantic 모델로 타입 안전한 응답을 반환합니다.

| 에이전트 | Pydantic 모델 | 주요 필드 |
|---------|--------------|----------|
| Summary | `AnalysisOutput` | markdownSummary, bantAnalysis (B/A/N/T), awsServices |
| Planning | `PlanningOutput` | agenda, topics, recommended_services, customer_references, ai_suggestions, next_steps |

## 배포

```bash
# 세 에이전트 일괄 배포 + SSM 파라미터 등록
./deploy-agents.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_KB_ID]

# 예시
./deploy-agents.sh default dev ap-northeast-2 ABCDEFGHIJ
```

### 사전 요구사항

```bash
pip install bedrock-agentcore-starter-toolkit
```

### SSM 파라미터

배포 후 SSM Parameter Store에 등록됩니다:

| SSM 파라미터 | 설명 |
|-------------|------|
| `/prechat/{stage}/agents/consultation/runtime-arn` | Consultation Agent ARN |
| `/prechat/{stage}/agents/summary/runtime-arn` | Summary Agent ARN |
| `/prechat/{stage}/agents/planning/runtime-arn` | Planning Agent ARN |
| `/prechat/{stage}/agents/bedrock-kb-id` | Bedrock Knowledge Base ID |

SAM 템플릿에서 `{{resolve:ssm:...}}`로 ARN을 resolve하여 Lambda 환경 변수에 주입합니다.

### 배포 순서

```
1. deploy-agents.sh  →  에이전트 배포 + SSM 등록 (먼저)
2. deploy-full.sh    →  SAM 배포 (SSM에서 ARN resolve)
```

에이전트를 먼저 배포해야 SSM 파라미터가 존재하여 SAM 배포 시 resolve가 성공합니다.

## 환경 변수

컨테이너에 주입되는 환경 변수 (`deploy_agent.py` → `launch(env_vars=...)`):

| 변수 | 용도 | 에이전트 |
|------|------|---------|
| `BEDROCK_KB_ID` | Knowledge Base ID (RAG 검색) | Consultation, Planning |
| `BEDROCK_AGENTCORE_MEMORY_ID` | AgentCore Memory ID (STM) | Consultation |
| `BEDROCK_AGENTCORE_MEMORY_NAME` | Memory 이름 | Consultation |

## Payload 구조

### Consultation Agent (stream)

```json
{
  "prompt": "고객 메시지",
  "session_id": "PreChat 세션 ID",
  "config": {
    "system_prompt": "커스텀 프롬프트 (선택)",
    "model_id": "모델 ID (선택)",
    "agent_name": "에이전트 이름 (선택)",
    "locale": "ko"
  }
}
```

### Summary Agent (invoke)

```json
{
  "conversation_history": "대화 내용 텍스트",
  "meeting_log": "미팅 로그 (선택)",
  "config": { "locale": "ko" }
}
```

### Planning Agent (invoke)

```json
{
  "session_summary": "세션 요약 텍스트",
  "config": { "locale": "ko" }
}
```

### Planning Agent (stream — Sales Rep 채팅)

```json
{
  "prompt": "Sales Rep 질문",
  "session_id": "세션 ID",
  "customer_info": { "name": "...", "company": "..." },
  "conversation_history": "고객-AI 대화 이력",
  "config": { "locale": "ko" }
}
```

## SSE 이벤트 형식

스트리밍 엔트리포인트(`stream`)는 다음 이벤트를 yield합니다:

| 이벤트 | 형식 | 설명 |
|--------|------|------|
| chunk | `{"type": "chunk", "content": "텍스트"}` | 모델 텍스트 출력 |
| tool | `{"type": "tool", "toolName": "...", "status": "running/complete"}` | 도구 실행 상태 |
| result | `{"type": "result", "message": "전체 응답"}` | 최종 결과 |
| error | `{"type": "error", "message": "에러"}` | 에러 발생 |
