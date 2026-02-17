"""
Agent Runtime - AgentCore 호출 클라이언트

배포된 Strands Agent를 bedrock-agentcore 클라이언트로 호출합니다.

구성 주입 흐름:
  1. agentRole 기반으로 AgentConfiguration 조회 (DynamoDB GSI1)
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
        """AgentCore Runtime에 배포된 에이전트를 호출하고 전체 응답을 반환합니다."""
        runtime_session_id = session_id
        if len(runtime_session_id) < 33:
            runtime_session_id = runtime_session_id + '-' + uuid.uuid4().hex[:10]

        try:
            # payload를 JSON 문자열로 변환하여 bytes로 인코딩
            payload_bytes = json.dumps(payload).encode('utf-8')
            
            print(f"[INFO] Invoking AgentCore ARN: {agent_runtime_arn}")
            print(f"[INFO] Runtime Session ID: {runtime_session_id}")
            print(f"[INFO] Payload: {json.dumps(payload)}")
            
            response = self.client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=runtime_session_id,
                payload=payload_bytes,
            )

            # contentType에 따라 응답 처리
            content_type = response.get("contentType", "")
            print(f"[INFO] Response contentType: {content_type}")
            
            if "text/event-stream" in content_type:
                # 스트리밍 응답 처리
                content = []
                for line in response["response"].iter_lines(chunk_size=10):
                    if line:
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            line_str = line_str[6:]
                        content.append(line_str)
                result_text = "\n".join(content)
                
            elif content_type == "application/json":
                # JSON 응답 처리 (기존 방식)
                content_chunks = []
                for chunk in response.get("response", []):
                    content_chunks.append(chunk.decode('utf-8'))
                result_text = ''.join(content_chunks)
                
            else:
                # 기타 응답 타입
                print(f"[WARN] Unexpected contentType: {content_type}")
                content_chunks = []
                for chunk in response.get("response", []):
                    content_chunks.append(chunk.decode('utf-8'))
                result_text = ''.join(content_chunks)

            print(f"[INFO] Response length: {len(result_text)} chars")

            # JSON 파싱 시도
            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                return {"result": result_text}

        except Exception as e:
            print(f"[ERROR] AgentCore invoke error: {str(e)}")
            print(f"[ERROR] Error type: {type(e).__name__}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            raise

    def invoke_consultation(
        self,
        agent_runtime_arn: str,
        session_id: str,
        message: str,
        config: Optional[AgentConfiguration] = None,
    ) -> str:
        """Consultation Agent를 호출하여 전체 응답 텍스트를 한 번에 반환합니다 (뭉태기)."""
        try:
            # payload 구조: {"prompt": "메시지", "session_id": "세션ID", "config": {...}}
            payload = {
                "prompt": message,
                "session_id": session_id
            }
            
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            # invoke()가 이미 모든 청크를 모아서 반환함
            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            
            response_text = result.get("result", "")
            if not response_text:
                print(f"Empty result from agent, full response: {result}")
                return "죄송합니다. 다시 말씀해 주시겠어요?"
            
            return response_text
            
        except Exception as e:
            print(f"Consultation agent error: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return self._handle_error(e)

    def invoke_consultation_stream(
        self,
        agent_runtime_arn: str,
        session_id: str,
        message: str,
        config: Optional[AgentConfiguration] = None,
    ):
        """Consultation Agent를 호출하여 스트리밍 응답을 생성합니다."""
        runtime_session_id = session_id
        if len(runtime_session_id) < 33:
            runtime_session_id = runtime_session_id + '-' + uuid.uuid4().hex[:10]

        try:
            payload = {"prompt": message, "session_id": session_id}
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            response = self.client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=runtime_session_id,
                payload=json.dumps(payload).encode(),
            )

            for chunk in response.get("response", []):
                chunk_text = chunk.decode('utf-8')
                # JSON 응답인 경우 result 필드 추출
                try:
                    chunk_data = json.loads(chunk_text)
                    if 'result' in chunk_data:
                        yield chunk_data['result']
                    else:
                        yield chunk_text
                except json.JSONDecodeError:
                    yield chunk_text

        except Exception as e:
            print(f"AgentCore streaming invoke error: {str(e)}")
            yield self._handle_error(e)

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
    """Session에 연결된 AgentConfiguration을 조회합니다.

    조회 흐름:
      1. 역할(agentRole) 기반으로 AgentConfiguration 조회 (GSI1)
      2. 없으면 기본 ARN으로 폴백
    """
    return get_agent_config_by_role(agent_role)


def get_agent_config_by_role(
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """역할별 AgentConfiguration을 조회합니다."""
    if not SESSIONS_TABLE:
        return _fallback_config(agent_role)

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={
                ':pk': f'AGENTCONFIG#{agent_role}',
            },
            Limit=1
        )

        items = resp.get('Items', [])
        if items:
            return AgentConfiguration.from_dynamodb_item(items[0])

        print(f"No agent config for role={agent_role}. Using default ARN from SSM.")
        return _fallback_config(agent_role)

    except Exception as e:
        print(f"Error loading agent config for role {agent_role}: {str(e)}")
        return _fallback_config(agent_role)


# 하위 호환성을 위한 별칭
def get_agent_config_for_campaign(
    campaign_id: str,
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """Deprecated: 역할 기반 조회로 위임합니다."""
    return get_agent_config_by_role(agent_role)


def _fallback_config(agent_role: str) -> Optional[AgentConfiguration]:
    """기본 ARN으로 폴백 AgentConfiguration을 생성합니다."""
    default_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
    if default_arn:
        return AgentConfiguration(
            config_id='default',
            agent_role=agent_role,
            agent_runtime_arn=default_arn,
        )
    return None
