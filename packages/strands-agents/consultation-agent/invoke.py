import json
import uuid
import boto3

agent_arn = "arn:aws:bedrock-agentcore:ap-northeast-2:487498333664:runtime/prechatConsultationAgent-kE0op82EVw"

session = boto3.session.Session(profile_name="prechat")
client = session.client('bedrock-agentcore', region_name='ap-northeast-2')
prompt = "125 * 37은 얼마야?"


payload = json.dumps({"prompt": prompt}).encode()

response = client.invoke_agent_runtime(
    agentRuntimeArn=agent_arn,
    runtimeSessionId=str(uuid.uuid4()),
    payload=payload,
)

content = []
for chunk in response.get("response", []):
    content.append(chunk.decode('utf-8'))
print(json.loads(''.join(content)))
