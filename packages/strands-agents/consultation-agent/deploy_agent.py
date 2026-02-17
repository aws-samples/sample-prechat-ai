"""
Consultation Agent 배포 스크립트

Capabilities:
  - STM (AgentCore Memory; 기간 30일) → memory_mode="STM_ONLY"
  - Bedrock KB retrieve → strands_tools.retrieve (BEDROCK_KB_ID env var)
  - Div Return → agent.py 내 @tool로 구현

사용법:
  pip install bedrock-agentcore-starter-toolkit
  BEDROCK_KB_ID=xxx STAGE=dev python deploy_agent.py
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
kb_id = os.environ.get("BEDROCK_KB_ID", "NONE")

agentcore_runtime = Runtime()

response = agentcore_runtime.configure(
    entrypoint="agent.py",
    agent_name="prechatConsultationAgent",
    requirements_file="requirements.txt",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    region=region,
    memory_mode="STM_ONLY",
)

print("🚀 Consultation Agent 배포 시작...", file=sys.stderr)
launch_result = agentcore_runtime.launch(
    env_vars={
        "STAGE": stage,
        "AWS_REGION": region,
        "BEDROCK_KB_ID": kb_id,
    },
)

# launch_result에서 ARN만 추출
# launch_result는 객체 또는 문자열일 수 있음
arn = ""
if hasattr(launch_result, 'agent_arn'):
    arn = launch_result.agent_arn
elif hasattr(launch_result, 'agent_runtime_arn'):
    arn = launch_result.agent_runtime_arn
else:
    # 문자열에서 ARN 패턴 추출
    result_str = str(launch_result)
    match = re.search(r"arn:aws:bedrock-agentcore:[^'\"\s]+", result_str)
    if match:
        arn = match.group(0)

if not arn:
    print(f"⚠️  ARN 추출 실패. Raw result: {launch_result}", file=sys.stderr)

output = {
    "agent_name": "prechatConsultationAgent",
    "agent_runtime_arn": arn,
    "region": region,
}
print(json.dumps(output))
