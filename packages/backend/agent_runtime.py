"""
Agent Runtime - AgentCore 호출 클라이언트

배포된 Strands Agent를 bedrock-agentcore 클라이언트로 호출합니다.

구성 주입 흐름:
  1. Session ID → Campaign ID → AgentConfiguration 조회 (DynamoDB)
  2. AgentConfiguration의 system_prompt, model_id, agent_name을 payload.config에 포함
  3. AgentCore Runtime의 invoke 엔트리포인트가 config를 읽어 Agent 객체를 동적 초기화
  4. agentRuntimeArn이 없으면 SSM 환경 변수에서 기본 에이전트 ARN 사용
"""

import json
import uuid
import boto3
import os
from typing import Optional

from models.agent_config import AgentConfiguration

# SSM에서 resolve된 기본 에이전트 ARN (deploy-agents.sh로 등록)
DEFAULT_CONSULTATION_AGENT_ARN = os.environ.get('CONSULTATION_AGENT_ARN', '')
DEFAULT_ANALYSIS_AGENT_ARN = os.environ.get('ANALYSIS_AGENT_ARN', '')
DEFAULT_PLANNING_AGENT_ARN = os.environ.get('PLANNING_AGENT_ARN', '')

# 역할별 기본 ARN 매핑
DEFAULT_AGENT_ARNS = {
    'prechat': DEFAULT_CONSULTATION_AGENT_ARN,
    'consultation': DEFAULT_CONSULTATION_AGENT_ARN,
    'analysis': DEFAULT_ANALYSIS_AGENT_ARN,
    'summary': DEFAULT_ANALYSIS_AGENT_ARN,
    'planning': DEFAULT_PLANNING_AGENT_ARN,
}

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
AGENTCORE_REGION = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')


def _build_config_payload(config: Optional[AgentConfiguration]) -> dict:
    """AgentConfiguration에서 에이전트 주입용 config dict를 생성합니다.

    이 dict는 AgentCore payload의 "config" 키로 전달되어,
    에이전트 컨테이너의 invoke 엔트리포인트에서 Agent 객체 초기화에 사용됩니다.
    """
    if not config:
        return {}
    result = {}
    if config.system_prompt:
        result['system_prompt'] = config.system_prompt
    if config.model_id:
        result['model_id'] = config.model_id
    if config.agent_name:
        result['agent_name'] = config.agent_name
    return result


class AgentCoreClient:
    """AgentCore Runtime 호출 클라이언트"""

    def __init__(self):
        self.client = boto3.client('bedrock-agentcore', region_name=AGENTCORE_REGION)

    def invoke(
        self,
        agent_runtime_arn: str,
        session_id: str,
        payload: dict,
    ) -> dict:
        """AgentCore Runtime에 배포된 에이전트를 호출합니다."""
        runtime_session_id = session_id
        if len(runtime_session_id) < 33:
            runtime_session_id = runtime_session_id + '-' + uuid.uuid4().hex[:10]

        try:
            response = self.client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=runtime_session_id,
                payload=json.dumps(payload).encode(),
            )

            content = []
            for chunk in response.get("response", []):
                content.append(chunk.decode('utf-8'))

            result_text = ''.join(content)

            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                return {"result": result_text}

        except Exception as e:
            print(f"AgentCore invoke error: {str(e)}")
            raise

    def invoke_consultation(
        self,
        agent_runtime_arn: str,
        session_id: str,
        message: str,
        config: Optional[AgentConfiguration] = None,
    ) -> str:
        """Consultation Agent를 호출하여 응답 텍스트를 반환합니다."""
        try:
            payload = {"prompt": message}
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            return result.get("result", "죄송합니다. 다시 말씀해 주시겠어요?")
        except Exception as e:
            return self._handle_error(e)

    def invoke_analysis(
        self,
        agent_runtime_arn: str,
        session_id: str,
        conversation_history: str,
        config: Optional[AgentConfiguration] = None,
    ) -> dict:
        """Analysis Agent를 호출하여 BANT 요약을 반환합니다."""
        try:
            payload = {"conversation_history": conversation_history}
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            return result
        except Exception as e:
            print(f"Analysis agent error: {str(e)}")
            return {"error": str(e)}

    def invoke_planning(
        self,
        agent_runtime_arn: str,
        session_id: str,
        session_summary: str,
        config: Optional[AgentConfiguration] = None,
    ) -> dict:
        """Planning Agent를 호출하여 미팅 플랜을 반환합니다."""
        try:
            payload = {"session_summary": session_summary}
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            return result
        except Exception as e:
            print(f"Planning agent error: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    def _handle_error(error: Exception) -> str:
        """에러 유형별 사용자 친화적 메시지를 반환합니다."""
        error_str = str(error)
        if 'ResourceNotFoundException' in error_str:
            return "죄송합니다. 에이전트를 찾을 수 없습니다. 관리자에게 문의해 주세요."
        elif 'ThrottlingException' in error_str:
            return "죄송합니다. 현재 요청이 많아 잠시 후 다시 시도해 주세요."
        else:
            return "죄송합니다. 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요."


def get_agent_config_for_session(
    session_id: str,
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """Session ID로부터 연결된 Campaign의 Agent Configuration을 조회합니다.

    조회 흐름:
      1. Session → campaignId 획득
      2. Campaign + agentRole → AgentConfiguration 조회
      3. 없으면 기본 ARN으로 폴백
    """
    if not SESSIONS_TABLE:
        return _fallback_config(agent_role, '')

    try:
        table = dynamodb.Table(SESSIONS_TABLE)

        # 1. Session에서 campaignId 획득
        session_resp = table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        session_item = session_resp.get('Item')
        if not session_item:
            print(f"Session {session_id} not found, using default ARN")
            return _fallback_config(agent_role, '')

        campaign_id = session_item.get('campaignId', '')
        if not campaign_id:
            print(f"Session {session_id} has no campaignId, using default ARN")
            return _fallback_config(agent_role, '')

        # 2. Campaign + agentRole → AgentConfiguration 조회
        return get_agent_config_for_campaign(campaign_id, agent_role)

    except Exception as e:
        print(f"Error loading agent config for session {session_id}: {str(e)}")
        return _fallback_config(agent_role, '')


def get_agent_config_for_campaign(
    campaign_id: str,
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """Campaign의 Agent Configuration을 조회합니다."""
    if not SESSIONS_TABLE:
        return _fallback_config(agent_role, campaign_id)

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk AND GSI1SK = :sk',
            ExpressionAttributeValues={
                ':pk': f'CAMPAIGN#{campaign_id}',
                ':sk': f'AGENTCONFIG#{agent_role}'
            }
        )

        items = resp.get('Items', [])
        if items:
            return AgentConfiguration.from_dynamodb_item(items[0])

        print(f"No agent config in DB for campaign={campaign_id}, role={agent_role}. "
              f"Using default ARN from SSM.")
        return _fallback_config(agent_role, campaign_id)

    except Exception as e:
        print(f"Error loading agent config: {str(e)}")
        return _fallback_config(agent_role, campaign_id)


def _fallback_config(agent_role: str, campaign_id: str) -> Optional[AgentConfiguration]:
    """기본 ARN으로 폴백 AgentConfiguration을 생성합니다."""
    default_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
    if default_arn:
        return AgentConfiguration(
            config_id='default',
            agent_role=agent_role,
            campaign_id=campaign_id,
            agent_runtime_arn=default_arn,
        )
    return None
