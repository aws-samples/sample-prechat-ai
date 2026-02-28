"""WebSocket 연결 수명주기 및 메시지 처리 핸들러

WebSocket API Gateway의 $connect, $disconnect, sendMessage, $default 라우트를 처리합니다.
Connection Store는 기존 SessionsTable을 활용하여 PK=WSCONN#{connectionId}, SK=METADATA 형식으로 저장합니다.

Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
"""

import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from utils import get_timestamp, generate_id, get_ttl_timestamp
from agent_runtime import AgentCoreClient, get_agent_config_for_session

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

# AgentCore 클라이언트 (Strands Agent 호출용)
agentcore_client = AgentCoreClient()

# Div Return Protocol: contentType 감지 마커
DIV_RETURN_MARKER = '<div class="prechat-form" data-form-type="div-return">'


def handle_connect(event, context):
    """$connect 라우트 핸들러

    두 가지 인증 방식을 지원합니다:
    1. PIN 인증 (고객용): sessionId + pin
    2. Cognito 토큰 인증 (Admin용): sessionId + token

    queryStringParameters에서 파라미터를 추출하여 인증 후
    연결을 수락하거나 거부합니다. 성공 시 Connection Store에 connectionId를 저장합니다.

    Args:
        event: API Gateway WebSocket $connect 이벤트
        context: Lambda 컨텍스트

    Returns:
        statusCode 200 (연결 수락) 또는 403 (거부)
    """
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    query_params = event.get('queryStringParameters') or {}

    session_id = query_params.get('sessionId', '')
    pin = query_params.get('pin', '')
    token = query_params.get('token', '')

    # sessionId 필수
    if not session_id:
        print(f"WebSocket 연결 거부 - sessionId 누락")
        return {'statusCode': 403}

    # pin 또는 token 중 하나는 필수
    if not pin and not token:
        print(f"WebSocket 연결 거부 - 인증 파라미터 누락 (pin 또는 token 필요)")
        return {'statusCode': 403}

    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)

        # Cognito 토큰 인증 (Admin용 - Planning Chat 등)
        if token:
            cognito = boto3.client('cognito-idp')
            try:
                cognito.get_user(AccessToken=token)
            except Exception as e:
                print(f"WebSocket 연결 거부 - Cognito 토큰 검증 실패: {str(e)}")
                return {'statusCode': 403}

            # 세션 존재 여부만 확인 (PIN/상태 검증 불필요)
            session_resp = sessions_table.get_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
            )
            if 'Item' not in session_resp:
                print(f"WebSocket 연결 거부 - 세션 미존재: {session_id}")
                return {'statusCode': 403}

        # PIN 인증 (고객용)
        else:
            session_resp = sessions_table.get_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
            )

            if 'Item' not in session_resp:
                print(f"WebSocket 연결 거부 - 세션 미존재: {session_id}")
                return {'statusCode': 403}

            session = session_resp['Item']

            # PIN 검증
            stored_pin = session.get('pinNumber', '')
            if pin != stored_pin:
                print(f"WebSocket 연결 거부 - PIN 불일치: {session_id}")
                return {'statusCode': 403}

            # 세션 활성 상태 확인
            status = session.get('status', '')
            if status != 'active':
                print(f"WebSocket 연결 거부 - 비활성 세션: {session_id}, status={status}")
                return {'statusCode': 403}

        # Connection Store에 connectionId 저장 (TTL: 24시간)
        now = datetime.now(timezone.utc)
        ttl = int((now + timedelta(hours=24)).timestamp())

        sessions_table.put_item(Item={
            'PK': f'WSCONN#{connection_id}',
            'SK': 'METADATA',
            'sessionId': session_id,
            'connectedAt': now.isoformat(),
            'ttl': ttl,
        })

        print(f"WebSocket 연결 수락: connectionId={connection_id}, sessionId={session_id}")
        return {'statusCode': 200}

    except Exception as e:
        print(f"WebSocket 연결 처리 중 오류: {str(e)}")
        return {'statusCode': 403}


def handle_disconnect(event, context):
    """$disconnect 라우트 핸들러

    Connection Store에서 해당 connectionId 레코드를 삭제합니다.

    Args:
        event: API Gateway WebSocket $disconnect 이벤트
        context: Lambda 컨텍스트

    Returns:
        statusCode 200
    """
    connection_id = event.get('requestContext', {}).get('connectionId', '')

    if not connection_id:
        print("WebSocket 연결 해제 - connectionId 누락")
        return {'statusCode': 200}

    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)

        # Connection Store에서 레코드 삭제
        sessions_table.delete_item(
            Key={'PK': f'WSCONN#{connection_id}', 'SK': 'METADATA'}
        )

        print(f"WebSocket 연결 해제: connectionId={connection_id}")

    except Exception as e:
        print(f"WebSocket 연결 해제 중 오류: {str(e)}")

    return {'statusCode': 200}


def handle_default(event, context):
    """$default 라우트 핸들러

    알 수 없는 액션에 대해 에러 메시지를 반환합니다.

    Args:
        event: API Gateway WebSocket $default 이벤트
        context: Lambda 컨텍스트

    Returns:
        statusCode 200 with error message
    """
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    domain_name = event.get('requestContext', {}).get('domainName', '')
    stage = event.get('requestContext', {}).get('stage', '')

    # 요청 body에서 액션 추출 시도
    body = {}
    try:
        raw_body = event.get('body', '{}')
        if raw_body:
            body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        pass

    action = body.get('action', 'unknown')
    print(f"WebSocket 알 수 없는 액션: action={action}, connectionId={connection_id}")

    # Management API를 통해 에러 메시지 전송
    if connection_id and domain_name and stage:
        try:
            endpoint_url = f'https://{domain_name}/{stage}'
            apigw_management = boto3.client(
                'apigatewaymanagementapi',
                endpoint_url=endpoint_url,
            )

            error_message = json.dumps({
                'type': 'error',
                'message': f'알 수 없는 액션입니다: {action}',
            }, ensure_ascii=False)

            apigw_management.post_to_connection(
                ConnectionId=connection_id,
                Data=error_message.encode('utf-8'),
            )
        except Exception as e:
            print(f"에러 메시지 전송 실패: {str(e)}")

    return {'statusCode': 200}


def _detect_content_type(content: str) -> str:
    """에이전트 응답에서 contentType을 감지합니다.

    Div Return 마커가 포함되면 'div-return', 아니면 'text'를 반환합니다.

    Args:
        content: 에이전트 응답 문자열

    Returns:
        'div-return' 또는 'text'
    """
    if DIV_RETURN_MARKER in content:
        return 'div-return'
    return 'text'


def _format_form_submission(message: str) -> str:
    """form-submission contentType의 JSON 폼 데이터를 텍스트로 변환합니다.

    에이전트가 이해할 수 있는 사람이 읽을 수 있는 형식으로 변환합니다.

    Args:
        message: JSON 문자열 형태의 폼 데이터

    Returns:
        텍스트 형식의 폼 데이터. JSON 파싱 실패 시 원본 반환.
    """
    try:
        form_data = json.loads(message)
        lines = ["[폼 제출 데이터]"]
        for key, value in form_data.items():
            lines.append(f"- {key}: {value}")
        return "\n".join(lines)
    except (json.JSONDecodeError, TypeError, AttributeError):
        return message


def _post_to_connection(apigw_management, connection_id: str, data: dict) -> bool:
    """Management API를 통해 WebSocket 클라이언트에 메시지를 전송합니다.

    Args:
        apigw_management: API Gateway Management API 클라이언트
        connection_id: WebSocket 연결 ID
        data: 전송할 데이터 딕셔너리

    Returns:
        True (성공) 또는 False (GoneException 등 실패)
    """
    try:
        apigw_management.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
        )
        return True
    except apigw_management.exceptions.GoneException:
        print(f"[WARN] 클라이언트 연결 끊김 (GoneException): connectionId={connection_id}")
        return False
    except Exception as e:
        print(f"[ERROR] post_to_connection 실패: {str(e)}")
        return True  # GoneException이 아닌 에러는 연결이 살아있을 수 있으므로 계속 진행


def handle_send_message(event, context):
    """sendMessage 라우트 핸들러

    고객 메시지를 저장하고, AgentCore 스트리밍 응답을 수신하여
    각 청크를 WebSocket Management API로 클라이언트에 실시간 전달합니다.

    Args:
        event: API Gateway WebSocket sendMessage 이벤트
            body: {action, sessionId, message, messageId, contentType?}
        context: Lambda 컨텍스트

    Returns:
        statusCode 200

    Side Effects:
        - 고객 메시지 DynamoDB 저장
        - AgentCore 스트리밍 호출
        - 청크별 post_to_connection (텍스트 청크 및 tool_use 이벤트)
        - 봇 메시지 DynamoDB 저장
        - EOF 감지 시 세션 완료 처리
        - 완료 메타데이터 (type: done) 전송

    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    domain_name = event.get('requestContext', {}).get('domainName', '')
    stage = event.get('requestContext', {}).get('stage', '')

    # Management API 클라이언트 초기화
    endpoint_url = f'https://{domain_name}/{stage}'
    print(f"[DEBUG] WebSocket Management API endpoint: {endpoint_url}, connectionId: {connection_id}")
    apigw_management = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=endpoint_url,
    )

    # 요청 body 파싱
    body = {}
    try:
        raw_body = event.get('body', '{}')
        if raw_body:
            body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': '잘못된 요청 형식입니다.',
        })
        return {'statusCode': 200}

    session_id = body.get('sessionId', '')
    message = body.get('message', '')
    message_id = body.get('messageId', generate_id())
    request_content_type = body.get('contentType', 'text')
    locale = body.get('locale', 'ko')

    # 필수 파라미터 검증
    if not session_id or not message:
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': 'sessionId와 message는 필수입니다.',
        })
        return {'statusCode': 200}

    # 세션 조회 및 검증
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    messages_table = dynamodb.Table(MESSAGES_TABLE)

    try:
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        if 'Item' not in session_resp:
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '세션을 찾을 수 없습니다.',
            })
            return {'statusCode': 200}

        session = session_resp['Item']
        if session.get('status') != 'active':
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '비활성 세션입니다.',
            })
            return {'statusCode': 200}
    except Exception as e:
        print(f"[ERROR] 세션 조회 실패: {str(e)}")
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': '세션 조회 중 오류가 발생했습니다.',
        })
        return {'statusCode': 200}

    # 1. 고객 메시지 DynamoDB 저장 (Requirement 2.1)
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(30)

    # 세션에 locale 저장 (비동기 분석/플래닝 에이전트에서 참조)
    try:
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET locale = :locale',
            ExpressionAttributeValues={':locale': locale},
        )
    except Exception as e:
        print(f"[WARN] 세션 locale 업데이트 실패: {str(e)}")

    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{message_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'contentType': request_content_type,
        'stage': 'conversation',
        'ttl': ttl_value,
    }

    try:
        messages_table.put_item(Item=customer_msg)
        print(f"[INFO] 고객 메시지 저장 완료: messageId={message_id}, sessionId={session_id}")
    except Exception as e:
        print(f"[ERROR] 고객 메시지 저장 실패: {str(e)}")
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': '메시지 저장에 실패했습니다.',
        })
        return {'statusCode': 200}

    # 2. form-submission 메시지 텍스트 변환 (Requirement 2.6)
    if request_content_type == 'form-submission':
        agent_message = _format_form_submission(message)
    else:
        agent_message = message

    # 3. AgentCore 스트리밍 호출 및 청크 전달 (Requirement 2.2)
    full_text = ''
    is_complete = False
    response_content_type = 'text'
    connection_alive = True

    try:
        arn, config = get_agent_config_for_session(session_id, 'prechat')

        if not arn:
            print(f"[ERROR] prechat 역할의 AgentCore ARN을 찾을 수 없습니다")
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '에이전트가 구성되지 않았습니다.',
            })
            return {'statusCode': 200}

        print(f"[INFO] AgentCore 스트리밍 호출 시작: ARN={arn}, sessionId={session_id}")

        for stream_event in agentcore_client.invoke_consultation_stream_chunks(
            agent_runtime_arn=arn,
            session_id=session_id,
            message=agent_message,
            config=config,
            locale=locale,
        ):
            event_type = stream_event.get('type', '')

            if event_type == 'chunk':
                # 텍스트 청크 누적 및 클라이언트 전달 (Requirement 2.2)
                content = stream_event.get('content', '')
                full_text += content

                if connection_alive:
                    connection_alive = _post_to_connection(
                        apigw_management, connection_id, stream_event
                    )

            elif event_type == 'tool':
                # 도구 사용 이벤트 클라이언트 전달
                if connection_alive:
                    connection_alive = _post_to_connection(
                        apigw_management, connection_id, stream_event
                    )

            elif event_type == 'result':
                # 최종 결과 이벤트 - result의 message에서 텍스트 추출
                result_message = stream_event.get('message', '')
                if result_message:
                    # message가 dict인 경우 (Bedrock 응답 구조) 텍스트 추출
                    if isinstance(result_message, dict):
                        content_blocks = result_message.get('content', [])
                        if isinstance(content_blocks, list):
                            texts = [b.get('text', '') for b in content_blocks if isinstance(b, dict) and 'text' in b]
                            full_text = ''.join(texts)
                        else:
                            full_text = str(content_blocks)
                    else:
                        full_text = str(result_message)

            elif event_type == 'error':
                # 에이전트 에러 이벤트
                print(f"[ERROR] 에이전트 에러: {stream_event.get('message', '')}")
                if connection_alive:
                    _post_to_connection(apigw_management, connection_id, stream_event)
                return {'statusCode': 200}

            # GoneException으로 연결이 끊어진 경우 스트리밍 중단
            if not connection_alive:
                print(f"[WARN] 클라이언트 연결 끊김, 스트리밍 중단: connectionId={connection_id}")
                # Connection Store에서 제거
                try:
                    sessions_table.delete_item(
                        Key={'PK': f'WSCONN#{connection_id}', 'SK': 'METADATA'}
                    )
                except Exception:
                    pass
                break

    except Exception as e:
        print(f"[ERROR] AgentCore 스트리밍 호출 실패: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        if connection_alive:
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '죄송합니다. 응답 생성 중 오류가 발생했습니다.',
            })
        return {'statusCode': 200}

    # 4. EOF 토큰 감지 및 세션 완료 처리 (Requirement 2.4)
    if 'EOF' in full_text:
        is_complete = True
        full_text = full_text.replace('EOF', '').strip()

    # 5. Div Return 마커 감지 및 contentType 설정 (Requirement 2.5)
    response_content_type = _detect_content_type(full_text)

    # 6. 봇 메시지 DynamoDB 저장 (Requirement 2.3)
    bot_message_id = str(int(message_id) + 1) if message_id.isdigit() else generate_id()
    bot_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{bot_message_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'bot',
        'content': full_text,
        'contentType': response_content_type,
        'stage': 'conversation',
        'ttl': ttl_value,
    }

    try:
        messages_table.put_item(Item=bot_msg)
        print(f"[INFO] 봇 메시지 저장 완료: messageId={bot_message_id}, sessionId={session_id}")
    except Exception as e:
        print(f"[ERROR] 봇 메시지 저장 실패: {str(e)}")

    # 7. 세션 완료 처리 (Requirement 2.4)
    if is_complete:
        try:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET #status = :status, completedAt = :completed_at',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':completed_at': timestamp,
                },
            )
            print(f"[INFO] 세션 완료 처리: sessionId={session_id}")
        except Exception as e:
            print(f"[WARN] 세션 완료 상태 업데이트 실패: {str(e)}")

    # 8. 완료 메타데이터 전송 (type: done)
    if connection_alive:
        _post_to_connection(apigw_management, connection_id, {
            'type': 'done',
            'contentType': response_content_type,
            'isComplete': is_complete,
            'messageId': bot_message_id,
        })

    print(f"[INFO] sendMessage 처리 완료: sessionId={session_id}, "
          f"isComplete={is_complete}, contentType={response_content_type}")

    return {'statusCode': 200}


def handle_send_planning_message(event, context):
    """sendPlanningMessage 라우트 핸들러

    Sales Rep의 Planning Agent 질문을 수신하여 AgentCore 스트리밍 응답을
    WebSocket Management API로 클라이언트에 실시간 전달합니다.
    DynamoDB에 메시지를 저장하지 않습니다 (Stateless).

    Args:
        event: API Gateway WebSocket sendPlanningMessage 이벤트
            body: {action, sessionId, message, locale?}
        context: Lambda 컨텍스트

    Returns:
        statusCode 200

    Side Effects:
        - DynamoDB에서 세션 정보 및 대화 이력 조회 (읽기 전용)
        - AgentCore Planning Agent 스트리밍 호출
        - 청크별 post_to_connection
        - 완료 메타데이터 (type: done) 전송
        - 메시지 저장 없음 (Stateless)

    Requirements: 3.1, 3.2, 3.3, 3.4, 6.1
    """
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    domain_name = event.get('requestContext', {}).get('domainName', '')
    stage = event.get('requestContext', {}).get('stage', '')

    # Management API 클라이언트 초기화
    endpoint_url = f'https://{domain_name}/{stage}'
    print(f"[DEBUG] Planning WebSocket endpoint: {endpoint_url}, connectionId: {connection_id}")
    apigw_management = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=endpoint_url,
    )

    # 요청 body 파싱
    body = {}
    try:
        raw_body = event.get('body', '{}')
        if raw_body:
            body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': '잘못된 요청 형식입니다.',
        })
        return {'statusCode': 200}

    session_id = body.get('sessionId', '')
    message = body.get('message', '')
    locale = body.get('locale', 'ko')

    # 필수 파라미터 검증
    if not session_id:
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': 'sessionId는 필수입니다.',
        })
        return {'statusCode': 200}

    if not message:
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': 'message는 필수입니다.',
        })
        return {'statusCode': 200}

    # 세션 조회 (읽기 전용 - 고객 정보 추출용)
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    messages_table = dynamodb.Table(MESSAGES_TABLE)

    try:
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        if 'Item' not in session_resp:
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '세션을 찾을 수 없습니다.',
            })
            return {'statusCode': 200}

        session = session_resp['Item']
    except Exception as e:
        print(f"[ERROR] 세션 조회 실패: {str(e)}")
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': '세션을 찾을 수 없습니다.',
        })
        return {'statusCode': 200}

    # 고객 정보 추출 (Requirement 3.2)
    customer_info = {
        'name': session.get('customerName', ''),
        'email': session.get('customerEmail', ''),
        'company': session.get('customerCompany', ''),
    }

    # 대화 이력 조회 (Requirement 3.2)
    conversation_history = ''
    try:
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={
                ':pk': f'SESSION#{session_id}',
            },
        )
        items = messages_resp.get('Items', [])
        if items:
            history_lines = []
            for item in items:
                sender = item.get('sender', '')
                content = item.get('content', '')
                if sender and content:
                    role = '고객' if sender == 'customer' else 'AI'
                    history_lines.append(f"{role}: {content}")
            conversation_history = '\n'.join(history_lines)
    except Exception as e:
        print(f"[WARN] 대화 이력 조회 실패: {str(e)}")

    # Planning Agent ARN 조회 (Requirement 3.4)
    try:
        arn, config = get_agent_config_for_session(session_id, 'planning')

        if not arn:
            print(f"[ERROR] planning 역할의 AgentCore ARN을 찾을 수 없습니다")
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': 'Planning Agent가 구성되지 않았습니다.',
            })
            return {'statusCode': 200}
    except Exception as e:
        print(f"[ERROR] Planning Agent 설정 조회 실패: {str(e)}")
        _post_to_connection(apigw_management, connection_id, {
            'type': 'error',
            'message': 'Planning Agent가 구성되지 않았습니다.',
        })
        return {'statusCode': 200}

    # AgentCore Planning Agent 스트리밍 호출 (Requirement 3.1)
    connection_alive = True

    try:
        print(f"[INFO] Planning AgentCore 스트리밍 호출 시작: ARN={arn}, sessionId={session_id}")

        for stream_event in agentcore_client.invoke_planning_stream_chunks(
            agent_runtime_arn=arn,
            session_id=session_id,
            prompt=message,
            customer_info=customer_info,
            conversation_history=conversation_history,
            config=config,
            locale=locale,
        ):
            event_type = stream_event.get('type', '')

            if event_type == 'chunk':
                # 텍스트 청크 클라이언트 전달
                if connection_alive:
                    connection_alive = _post_to_connection(
                        apigw_management, connection_id, stream_event
                    )

            elif event_type == 'tool':
                # 도구 사용 이벤트 클라이언트 전달
                if connection_alive:
                    connection_alive = _post_to_connection(
                        apigw_management, connection_id, stream_event
                    )

            elif event_type == 'error':
                # 에이전트 에러 이벤트
                print(f"[ERROR] Planning Agent 에러: {stream_event.get('message', '')}")
                if connection_alive:
                    _post_to_connection(apigw_management, connection_id, stream_event)
                return {'statusCode': 200}

            # GoneException으로 연결이 끊어진 경우 스트리밍 중단
            if not connection_alive:
                print(f"[WARN] 클라이언트 연결 끊김, 스트리밍 중단: connectionId={connection_id}")
                try:
                    sessions_table.delete_item(
                        Key={'PK': f'WSCONN#{connection_id}', 'SK': 'METADATA'}
                    )
                except Exception:
                    pass
                break

    except Exception as e:
        print(f"[ERROR] Planning AgentCore 스트리밍 호출 실패: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        if connection_alive:
            _post_to_connection(apigw_management, connection_id, {
                'type': 'error',
                'message': '응답 생성 중 오류가 발생했습니다.',
            })
        return {'statusCode': 200}

    # 완료 메타데이터 전송 (Requirement 3.3)
    if connection_alive:
        _post_to_connection(apigw_management, connection_id, {
            'type': 'done',
        })

    print(f"[INFO] sendPlanningMessage 처리 완료: sessionId={session_id}")

    return {'statusCode': 200}

