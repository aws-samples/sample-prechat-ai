"""
Agent Runtime - AgentCore 호출 클라이언트

배포된 Strands Agent를 bedrock-agentcore 클라이언트로 호출합니다.
PreChat User가 정의한 Agent Configuration(system_prompt, model_id, name)을
AgentCore Runtime에 전달하여 커스텀 에이전트를 구성합니다.

호출 흐름:
  1. Campaign → Agent Configuration 조회 (DynamoDB) → agentRuntimeArn 확인
  2. agentRuntimeArn이 없으면 SSM 환경 변수에서 기본 에이전트 ARN 사용
  3. bedrock-agentcore 클라이언트로 invoke_agent_runtime 호출
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
        """AgentCore Runtime에 배포된 에이전트를 호출합니다.

        Args:
            agent_runtime_arn: 배포된 에이전트의 Runtime ARN
            session_id: 세션 ID (33자 이상)
            payload: 에이전트에 전달할 페이로드

        Returns:
            에이전트 응답 딕셔너리
        """
        # AgentCore는 runtimeSessionId가 33자 이상이어야 함
        runtime_session_id = session_id
        if len(runtime_session_id) < 33:
            runtime_session_id = runtime_session_id + '-' + uuid.uuid4().hex[:10]

        try:
            response = self.client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=runtime_session_id,
                payload=json.dumps(payload).encode(),
            )

            # 스트리밍 응답 수집
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
    ) -> str:
        """Consultation Agent를 호출하여 응답 텍스트를 반환합니다.

        Args:
            agent_runtime_arn: Consultation Agent Runtime ARN
            session_id: 세션 ID
            message: 고객 메시지

        Returns:
            에이전트 응답 텍스트
        """
        try:
            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload={"prompt": message},
            )
            return result.get("result", "죄송합니다. 다시 말씀해 주시겠어요?")
        except Exception as e:
            return self._handle_error(e)

    def invoke_analysis(
        self,
        agent_runtime_arn: str,
        session_id: str,
        conversation_history: str,
    ) -> dict:
        """Analysis Agent를 호출하여 BANT 요약을 반환합니다.

        Args:
            agent_runtime_arn: Analysis Agent Runtime ARN
            session_id: 세션 ID
            conversation_history: 대화 이력 텍스트

        Returns:
            BANT 분석 결과 딕셔너리
        """
        try:
            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload={"conversation_history": conversation_history},
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
    ) -> dict:
        """Planning Agent를 호출하여 미팅 플랜을 반환합니다.

        Args:
            agent_runtime_arn: Planning Agent Runtime ARN
            session_id: 세션 ID
            session_summary: 세션 요약 텍스트

        Returns:
            미팅 플랜 딕셔너리
        """
        try:
            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload={"session_summary": session_summary},
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


def get_agent_config_for_campaign(
    campaign_id: str,
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """Campaign의 Agent Configuration을 조회합니다.

    조회 우선순위:
      1. DynamoDB에서 Campaign별 Agent Configuration 조회
      2. 없으면 SSM 환경 변수의 기본 에이전트 ARN으로 폴백

    Args:
        campaign_id: 캠페인 ID
        agent_role: 에이전트 역할 (prechat, summary, planning)

    Returns:
        AgentConfiguration 또는 None
    """
    if not SESSIONS_TABLE:
        # DB 없이 기본 ARN으로 폴백
        default_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
        if default_arn:
            return AgentConfiguration(
                config_id='default',
                agent_role=agent_role,
                campaign_id=campaign_id,
                agent_runtime_arn=default_arn,
            )
        return None

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

        # DB에 없으면 기본 ARN으로 폴백
        default_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
        if default_arn:
            print(f"No agent config in DB for campaign={campaign_id}, role={agent_role}. "
                  f"Using default ARN from SSM.")
            return AgentConfiguration(
                config_id='default',
                agent_role=agent_role,
                campaign_id=campaign_id,
                agent_runtime_arn=default_arn,
            )

        return None

    except Exception as e:
        print(f"Error loading agent config: {str(e)}")
        # 에러 시에도 기본 ARN으로 폴백
        default_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
        if default_arn:
            return AgentConfiguration(
                config_id='default',
                agent_role=agent_role,
                campaign_id=campaign_id,
                agent_runtime_arn=default_arn,
            )
        return None
