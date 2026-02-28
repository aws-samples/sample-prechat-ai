# Strands Agents on Bedrock AgentCore

PreChat 시스템의 AI 에이전트입니다. Strands SDK로 작성되어 Bedrock AgentCore Runtime에 배포됩니다.

## 구조

```
strands-agents/
├── deploy-agents.sh           # 전체 에이전트 배포 + SSM 등록
├── consultation-agent/        # 고객 상담 에이전트
│   ├── agent.py               # Strands Agent + AgentCore 엔트리포인트
│   ├── deploy_agent.py        # 개별 배포 스크립트
│   └── requirements.txt
├── summary-agent/             # BANT 요약 에이전트 (Summary Agent)
│   ├── agent.py
│   ├── deploy_agent.py
│   └── requirements.txt
└── planning-agent/            # 미팅 플랜 에이전트
    ├── agent.py
    ├── deploy_agent.py
    └── requirements.txt
```

## 에이전트 배포

```bash
# 세 에이전트 일괄 배포 + SSM 파라미터 등록
cd packages/strands-agents
./deploy-agents.sh [AWS_PROFILE] [STAGE] [REGION]

# 예시
./deploy-agents.sh default dev us-west-2
```

배포 후 SSM Parameter Store에 다음 파라미터가 등록됩니다:

| SSM 파라미터 | 설명 |
|-------------|------|
| `/prechat/{stage}/agents/consultation/runtime-arn` | Consultation Agent ARN |
| `/prechat/{stage}/agents/summary/runtime-arn` | Summary Agent ARN |
| `/prechat/{stage}/agents/planning/runtime-arn` | Planning Agent ARN |

## Lambda 함수에서 에이전트 사용

SAM 템플릿의 Globals에서 SSM 파라미터를 resolve하여 환경 변수로 주입합니다:

```yaml
# template.yaml (자동 설정됨)
Environment:
  Variables:
    CONSULTATION_AGENT_ARN: !Sub '{{resolve:ssm:/prechat/${Stage}/agents/consultation/runtime-arn:1}}'
    SUMMARY_AGENT_ARN: !Sub '{{resolve:ssm:/prechat/${Stage}/agents/summary/runtime-arn:1}}'
    PLANNING_AGENT_ARN: !Sub '{{resolve:ssm:/prechat/${Stage}/agents/planning/runtime-arn:1}}'
```

백엔드 코드에서:

```python
from agent_runtime import AgentCoreClient, get_agent_config_for_campaign

# Campaign별 커스텀 설정이 있으면 사용, 없으면 SSM 기본 ARN 폴백
config = get_agent_config_for_campaign(campaign_id, 'prechat')
if config and config.agent_runtime_arn:
    client = AgentCoreClient()
    response = client.invoke_consultation(
        agent_runtime_arn=config.agent_runtime_arn,
        session_id=session_id,
        message=message,
    )
```

## 에이전트 Capabilities

| 에이전트 | memory_mode | 부가 능력 |
|---------|-------------|----------|
| Consultation | `STM_ONLY` | KB RAG (@tool), Div Return (@tool) |
| Analysis (Summary) | `NO_MEMORY` | BANT 분석 (프롬프트) |
| Planning | `NO_MEMORY` | KB RAG (@tool) |

## 배포 순서

```
1. deploy-agents.sh  →  에이전트 배포 + SSM 등록
2. deploy-full.sh    →  SAM 배포 (SSM에서 ARN resolve)
```

에이전트를 먼저 배포해야 SSM 파라미터가 존재하여 SAM 배포 시 resolve가 성공합니다.
