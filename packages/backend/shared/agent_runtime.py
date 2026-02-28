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
# 모듈 로드 시점에 환경 변수 읽기
DEFAULT_CONSULTATION_AGENT_ARN = os.environ.get('CONSULTATION_AGENT_ARN', '')
DEFAULT_SUMMARY_AGENT_ARN = os.environ.get('SUMMARY_AGENT_ARN', '')
DEFAULT_PLANNING_AGENT_ARN = os.environ.get('PLANNING_AGENT_ARN', '')

print(f"[INIT] Module loaded - DEFAULT_CONSULTATION_AGENT_ARN: '{DEFAULT_CONSULTATION_AGENT_ARN}'")
print(f"[INIT] Module loaded - DEFAULT_SUMMARY_AGENT_ARN: '{DEFAULT_SUMMARY_AGENT_ARN}'")
print(f"[INIT] Module loaded - DEFAULT_PLANNING_AGENT_ARN: '{DEFAULT_PLANNING_AGENT_ARN}'")

# 역할별 기본 ARN 매핑
DEFAULT_AGENT_ARNS = {
    'prechat': DEFAULT_CONSULTATION_AGENT_ARN,
    'consultation': DEFAULT_CONSULTATION_AGENT_ARN,
    'summary': DEFAULT_SUMMARY_AGENT_ARN,
    'planning': DEFAULT_PLANNING_AGENT_ARN,
}

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
AGENTCORE_REGION = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')


def _build_config_payload(config: Optional[AgentConfiguration], locale: str = 'ko') -> dict:
    """AgentConfiguration에서 에이전트 주입용 config dict를 생성합니다.

    이 dict는 AgentCore payload의 "config" 키로 전달되어,
    에이전트 컨테이너의 invoke 엔트리포인트에서 Agent 객체 초기화에 사용됩니다.
    """
    if not config:
        return {'locale': locale} if locale else {}
    result = {}
    if config.system_prompt:
        result['system_prompt'] = config.system_prompt
    if config.model_id:
        result['model_id'] = config.model_id
    if config.agent_name:
        result['agent_name'] = config.agent_name
    if locale:
        result['locale'] = locale
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
                # 스트리밍 응답 처리: data: 접두사를 제거하고 전체를 합침
                content = []
                for line in response["response"].iter_lines(chunk_size=10):
                    if line:
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            line_str = line_str[6:]
                        content.append(line_str)
                # 모든 data 라인을 합쳐서 하나의 JSON으로 파싱 시도
                result_text = ''.join(content)
                
            elif content_type == "application/json":
                # JSON 응답 처리: StreamingBody.read()로 한 번에 읽기
                result_text = response["response"].read().decode('utf-8')
                
            else:
                # 기타 응답 타입
                print(f"[WARN] Unexpected contentType: {content_type}")
                result_text = response["response"].read().decode('utf-8')

            print(f"[INFO] Response length: {len(result_text)} chars")

            # JSON 파싱 시도, 실패하면 텍스트로 반환
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
    ) -> dict:
        """Consultation Agent를 호출하여 raw 응답을 그대로 반환합니다."""
        try:
            payload = {
                "prompt": message,
                "session_id": session_id
            }
            
            config_dict = _build_config_payload(config)
            if config_dict:
                payload["config"] = config_dict

            return self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            
        except Exception as e:
            print(f"[ERROR] Consultation agent error: {str(e)}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            return {"error": self._handle_error(e)}

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

    def invoke_consultation_stream_chunks(
        self,
        agent_runtime_arn: str,
        session_id: str,
        message: str,
        config: Optional[AgentConfiguration] = None,
        locale: str = 'ko',
    ):
        """AgentCore 스트리밍 응답을 이벤트 단위로 yield합니다.

        에이전트의 'stream' 엔트리포인트를 호출하고,
        text/event-stream 응답의 각 SSE data 라인을 파싱하여
        텍스트 청크 또는 tool_use 이벤트로 반환합니다.

        payload에 entrypoint: "stream"을 포함하여 스트리밍 엔트리포인트를 지정합니다.

        Yields:
            dict: 파싱된 이벤트 딕셔너리. type 필드로 분류:
                - {"type": "chunk", "content": "텍스트 조각"}
                - {"type": "tool", "toolName": "...", "toolUseId": "...", "status": "running|complete", ...}
                - {"type": "result", "message": "전체 응답 텍스트"}
                - {"type": "error", "message": "에러 메시지"}
        """
        # runtimeSessionId는 최소 33자 이상이어야 함
        runtime_session_id = session_id
        if len(runtime_session_id) < 33:
            runtime_session_id = runtime_session_id + '-' + uuid.uuid4().hex[:10]

        try:
            # stream 엔트리포인트를 호출하도록 payload 구성
            payload = {
                "prompt": message,
                "session_id": session_id,
                "entrypoint": "stream",
            }
            config_dict = _build_config_payload(config, locale)
            if config_dict:
                payload["config"] = config_dict

            print(f"[INFO] Invoking AgentCore stream - ARN: {agent_runtime_arn}")
            print(f"[INFO] Runtime Session ID: {runtime_session_id}")

            response = self.client.invoke_agent_runtime(
                agentRuntimeArn=agent_runtime_arn,
                runtimeSessionId=runtime_session_id,
                payload=json.dumps(payload).encode('utf-8'),
            )

            content_type = response.get("contentType", "")
            print(f"[INFO] Stream response contentType: {content_type}")

            # text/event-stream 응답의 SSE data: 라인을 파싱
            # 각 라인을 순회하며 "data: " 접두사가 있는 라인에서 JSON 이벤트를 추출
            for line in response["response"].iter_lines(chunk_size=10):
                if not line:
                    # 빈 라인은 SSE 이벤트 구분자이므로 건너뜀
                    continue

                line_str = line.decode("utf-8")

                # SSE data: 접두사 제거
                if line_str.startswith("data: "):
                    line_str = line_str[6:]
                elif line_str.startswith("data:"):
                    line_str = line_str[5:]
                else:
                    # data: 접두사가 없는 라인 (comment, event, id 등)은 건너뜀
                    continue

                # 빈 데이터 라인 건너뜀
                stripped = line_str.strip()
                if not stripped:
                    continue

                # AgentCore SSE 응답은 JSON이 이중 따옴표로 감싸질 수 있음
                # 예: data: "{"type": "chunk", "content": "Hello"}"
                # 바깥 따옴표를 제거하여 내부 JSON을 추출
                if stripped.startswith('"') and stripped.endswith('"'):
                    # 이중 따옴표 감싸기 제거 후 이스케이프된 따옴표 복원
                    inner = stripped[1:-1].replace('\\"', '"').replace('\\\\', '\\')
                    stripped = inner

                # JSON 파싱하여 이벤트 타입별로 yield
                try:
                    event = json.loads(stripped)
                    if isinstance(event, dict) and "type" in event:
                        # content가 JSON 문자열로 이중 직렬화된 경우 내부 파싱
                        if event.get("type") == "chunk" and isinstance(event.get("content"), str):
                            try:
                                inner = json.loads(event["content"])
                                if isinstance(inner, dict) and "type" in inner:
                                    yield inner
                                    continue
                            except (json.JSONDecodeError, TypeError):
                                pass
                        # result의 message가 문자열인 경우 파싱
                        if event.get("type") == "result" and isinstance(event.get("message"), str):
                            try:
                                inner_msg = json.loads(event["message"])
                                event["message"] = inner_msg
                            except (json.JSONDecodeError, TypeError):
                                pass
                        yield event
                    else:
                        # type 필드가 없는 JSON은 chunk로 래핑
                        yield {"type": "chunk", "content": json.dumps(event, ensure_ascii=False) if isinstance(event, dict) else stripped}
                except json.JSONDecodeError:
                    # JSON이 아닌 텍스트 데이터는 chunk로 래핑
                    yield {"type": "chunk", "content": stripped}

        except Exception as e:
            print(f"[ERROR] AgentCore stream chunks error: {str(e)}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            yield {"type": "error", "message": self._handle_error(e)}


    def invoke_analysis(
        self,
        agent_runtime_arn: str,
        session_id: str,
        conversation_history: str,
        config: Optional[AgentConfiguration] = None,
        locale: str = 'ko',
        meeting_log: str = '',
    ) -> dict:
        """Summary Agent를 호출하여 BANT 요약을 반환합니다."""
        try:
            payload = {"conversation_history": conversation_history}
            if meeting_log:
                payload["meeting_log"] = meeting_log
            config_dict = _build_config_payload(config, locale)
            if config_dict:
                payload["config"] = config_dict

            result = self.invoke(
                agent_runtime_arn=agent_runtime_arn,
                session_id=session_id,
                payload=payload,
            )
            return result
        except Exception as e:
            print(f"Summary agent error: {str(e)}")
            return {"error": str(e)}

    def invoke_planning(
        self,
        agent_runtime_arn: str,
        session_id: str,
        session_summary: str,
        config: Optional[AgentConfiguration] = None,
        locale: str = 'ko',
    ) -> dict:
        """Planning Agent를 호출하여 미팅 플랜을 반환합니다."""
        try:
            payload = {"session_summary": session_summary}
            config_dict = _build_config_payload(config, locale)
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


def get_agent_runtime_arn(agent_role: str) -> str:
    """역할에 맞는 AgentCore Runtime ARN을 환경 변수에서 가져옵니다."""
    base_arn = DEFAULT_AGENT_ARNS.get(agent_role, '')
    
    if not base_arn:
        print(f"[ERROR] No ARN found in env vars for role: {agent_role}")
        return ''
    
    print(f"[DEBUG] Final ARN for role '{agent_role}': '{base_arn}'")
    return base_arn


def get_agent_config_for_session(
    session_id: str,
    agent_role: str,
) -> tuple[str, Optional[AgentConfiguration]]:
    """Session에 연결된 ARN과 사용자 정의 config를 반환합니다.

    Returns:
        (agent_runtime_arn, config): ARN은 환경 변수에서, config는 DynamoDB에서 조회
    """
    print(f"[DEBUG] get_agent_config_for_session: session={session_id}, role={agent_role}")
    
    # 1. ARN은 환경 변수에서 가져오기 (고정)
    arn = get_agent_runtime_arn(agent_role)
    
    # 2. 사용자 정의 config는 DynamoDB에서 조회 (선택적)
    config = get_agent_config_by_role(agent_role)
    
    return (arn, config)


def get_agent_config_by_role(
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """역할별 사용자 정의 AgentConfiguration을 DynamoDB에서 조회합니다.
    
    ARN은 포함하지 않고, system_prompt, model_id, agent_name만 조회합니다.
    """
    print(f"[DEBUG] get_agent_config_by_role: role={agent_role}")
    
    if not SESSIONS_TABLE:
        print(f"[WARN] SESSIONS_TABLE not set")
        return None

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        print(f"[DEBUG] Querying GSI1 with PK: AGENTCONFIG#{agent_role}")
        
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={
                ':pk': f'AGENTCONFIG#{agent_role}',
            },
            Limit=1
        )

        items = resp.get('Items', [])
        print(f"[DEBUG] Query returned {len(items)} items")
        
        if items:
            print(f"[INFO] Found custom config in DynamoDB")
            return AgentConfiguration.from_dynamodb_item(items[0])

        print(f"[INFO] No custom config for role={agent_role} in DynamoDB")
        return None

    except Exception as e:
        print(f"[ERROR] Error querying agent config for role {agent_role}: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return None


# 하위 호환성을 위한 별칭
def get_agent_config_for_campaign(
    campaign_id: str,
    agent_role: str,
) -> Optional[AgentConfiguration]:
    """Deprecated: 역할 기반 조회로 위임합니다."""
    return get_agent_config_by_role(agent_role)


def _fallback_config(agent_role: str) -> Optional[AgentConfiguration]:
    """Deprecated: get_agent_config_for_session()이 직접 처리합니다."""
    print(f"[WARN] _fallback_config is deprecated and should not be called")
    return None
