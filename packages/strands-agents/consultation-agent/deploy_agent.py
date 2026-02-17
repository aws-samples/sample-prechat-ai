"""
Consultation Agent 배포 스크립트

Capabilities:
  - STM (AgentCore Memory; 기간 30일) → memory_mode="STM_ONLY"
  - Bedrock KB retrieve → agent.py 내 @tool로 구현
  - Div Return → agent.py 내 @tool로 구현

사용법:
  pip install bedrock-agentcore-starter-toolkit
  python deploy_agent.py
"""

import json
import sys
from bedrock_agentcore_starter_toolkit import Runtime
from boto3.session import Session

boto_session = Session()
region = boto_session.region_name or "ap-northeast-2"

agentcore_runtime = Runtime()

response = agentcore_runtime.configure(
    entrypoint="agent.py",
    agent_name="prechat-consultation-agent",
    requirements_file="requirements.txt",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    region=region,
    memory_mode="STM_ONLY",
)

print("🚀 Consultation Agent 배포 시작...", file=sys.stderr)
launch_result = agentcore_runtime.launch()

# ARN을 stdout JSON으로 출력 (sh 스크립트에서 파싱)
output = {
    "agent_name": "prechat-consultation-agent",
    "agent_runtime_arn": getattr(launch_result, 'agent_runtime_arn', str(launch_result)),
    "region": region,
}
print(json.dumps(output))
