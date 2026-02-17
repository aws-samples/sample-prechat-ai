"""
Analysis Agent 배포 스크립트

Capabilities:
  - BANT 요약만 수행 → memory_mode="NO_MEMORY"
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
    agent_name="prechat-analysis-agent",
    requirements_file="requirements.txt",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    region=region,
    memory_mode="NO_MEMORY",
)

print("🚀 Analysis Agent 배포 시작...", file=sys.stderr)
launch_result = agentcore_runtime.launch()

output = {
    "agent_name": "prechat-analysis-agent",
    "agent_runtime_arn": getattr(launch_result, 'agent_runtime_arn', str(launch_result)),
    "region": region,
}
print(json.dumps(output))
