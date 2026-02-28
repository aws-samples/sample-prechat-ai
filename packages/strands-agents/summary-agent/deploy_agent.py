"""
Summary Agent 배포 스크립트

Capabilities:
  - BANT 요약만 수행 → memory_mode="NO_MEMORY"
  - KB 사용 안 함

사용법:
  pip install bedrock-agentcore-starter-toolkit
  STAGE=dev python deploy_agent.py
"""

import json
import os
import re
import sys
from bedrock_agentcore_starter_toolkit import Runtime
from boto3.session import Session

boto_session = Session()
region = boto_session.region_name or "ap-northeast-2"
stage = os.environ.get("STAGE", "prod")

agentcore_runtime = Runtime()

response = agentcore_runtime.configure(
    entrypoint="agent.py",
    agent_name="prechatSummaryAgent",
    requirements_file="requirements.txt",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    region=region,
    memory_mode="NO_MEMORY",
)

print("🚀 Summary Agent 배포 시작...", file=sys.stderr)
launch_result = agentcore_runtime.launch(
    env_vars={
        "STAGE": stage,
        "AWS_REGION": region,
    },
)

# launch_result에서 ARN만 추출
arn = ""
if hasattr(launch_result, 'agent_arn'):
    arn = launch_result.agent_arn
elif hasattr(launch_result, 'agent_runtime_arn'):
    arn = launch_result.agent_runtime_arn
else:
    result_str = str(launch_result)
    match = re.search(r"arn:aws:bedrock-agentcore:[^'\"\s]+", result_str)
    if match:
        arn = match.group(0)

if not arn:
    print(f"⚠️  ARN 추출 실패. Raw result: {launch_result}", file=sys.stderr)

output = {
    "agent_name": "prechatSummaryAgent",
    "agent_runtime_arn": arn,
    "region": region,
}
print(json.dumps(output))
