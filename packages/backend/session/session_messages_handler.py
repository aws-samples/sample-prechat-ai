"""
Session Messages Handler

도메인 기반 API 엔드포인트: POST /api/sessions/{sessionId}/messages
AgentCore Runtime (Strands Agent)을 호출하여 대화를 처리합니다.
"""

import json
import boto3
import os
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp
from agent_runtime import AgentCoreClient, get_agent_config_for_session

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

# AgentCore 클라이언트 (Strands Agent 호출용)
agentcore_client = AgentCoreClient()

# Div Return Protocol: contentType 감지
DIV_RETURN_MARKER = '<div class="prechat-form" data-form-type="div-return">'


def detect_content_type(content: str) -> str:
    """에이전트 응답에서 contentType을 감지합니다.

    Args:
        content: 에이전트 응답 문자열

    Returns:
        'div-return' (마커 포함 시) 또는 'text'
    """
    if DIV_RETURN_MARKER in content:
        return 'div-return'
    return 'text'


def format_form_submission_for_agent(form_data: dict) -> str:
    """폼 제출 JSON을 에이전트가 이해할 수 있는 텍스트로 변환합니다.

    Args:
        form_data: 폼 필드 키-값 딕셔너리

    Returns:
        사람이 읽을 수 있는 텍스트 형식
    """
    lines = ["[폼 제출 데이터]"]
    for key, value in form_data.items():
        lines.append(f"- {key}: {value}")
    return "\n".join(lines)


def _extract_text_from_agent_response(agent_result: dict) -> str:
    """에이전트 raw 응답에서 전체 텍스트를 추출합니다 (EOF 감지 및 contentType 판별용).

    Args:
        agent_result: {"role": "assistant", "content": [{"text": "..."}, ...]}

    Returns:
        content 배열의 모든 text를 합친 문자열
    """
    if not isinstance(agent_result, dict):
        return str(agent_result)
    
    content_list = agent_result.get("content", [])
    if not isinstance(content_list, list):
        return str(agent_result)
    
    text_parts = []
    for item in content_list:
        if isinstance(item, dict) and "text" in item:
            text_parts.append(item["text"])
    
    return "\n".join(text_parts)


def send_message(event, context):
    """
    세션에 메시지를 전송하고 AgentCore Agent 응답을 받습니다.

    POST /api/sessions/{sessionId}/messages

    Path Parameters:
        sessionId: 세션 고유 식별자

    Request Body:
        message (str): 메시지 내용 (필수)
        messageId (str): 메시지 ID (선택, 미제공 시 자동 생성)
        contentType (str): 메시지 타입 (text/form-submission)

    Returns:
        response (str): AI 응답
        contentType (str): 응답 타입
        stage (str): 대화 단계
        isComplete (bool): 세션 완료 여부
    """
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId path parameter'})

    body = parse_body(event)
    message = body.get('message', '')
    message_id = body.get('messageId', generate_id())
    request_content_type = body.get('contentType', 'text')

    if not message:
        return lambda_response(400, {'error': 'Missing message in request body'})

    # 세션 조회 및 검증
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except Exception as e:
        print(f"[ERROR] Database error fetching session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})

    # 고객 메시지 저장
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(30)
    messages_table = dynamodb.Table(MESSAGES_TABLE)

    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{message_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'contentType': request_content_type,
        'stage': 'conversation',
        'ttl': ttl_value
    }

    try:
        messages_table.put_item(Item=customer_msg)
        print(f"[INFO] Customer message saved: {message_id}")
    except Exception as e:
        print(f"[ERROR] Failed to save customer message {message_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save customer message'})

    # form-submission인 경우 에이전트에 전달할 메시지를 텍스트로 변환
    if request_content_type == 'form-submission':
        try:
            form_data = json.loads(message)
            agent_message = format_form_submission_for_agent(form_data)
        except json.JSONDecodeError:
            agent_message = message
    else:
        agent_message = message

    # AgentCore Agent 응답 생성
    try:
        arn, config = get_agent_config_for_session(session_id, 'prechat')
        
        if not arn:
            print(f"[ERROR] No ARN found for role: prechat")
            return lambda_response(500, {'error': 'Agent runtime ARN not configured'})
        
        print(f"[INFO] Calling AgentCore ARN: {arn}")
        agent_result = agentcore_client.invoke_consultation(
            agent_runtime_arn=arn,
            session_id=session_id,
            message=agent_message,
            config=config,
        )
        
        # 에러 체크
        if "error" in agent_result:
            return lambda_response(500, {'error': agent_result["error"]})
        
        # "result" 키로 감싸져 있으면 벗기기
        agent_response = agent_result.get("result", agent_result)
        
    except Exception as e:
        print(f"[ERROR] Failed to generate AI response: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return lambda_response(500, {'error': f'Failed to generate AI response: {str(e)}'})

    # content 배열에서 전체 텍스트 추출
    full_text = _extract_text_from_agent_response(agent_response)
    
    # EOF 토큰으로 세션 완료 감지
    is_complete = 'EOF' in full_text
    if is_complete:
        full_text = full_text.replace('EOF', '').strip()

    # AI 응답의 contentType 감지
    response_content_type = detect_content_type(full_text)

    # AI 응답 저장 (텍스트만 저장)
    bot_response_id = f"{int(message_id) + 1}" if message_id.isdigit() else generate_id()
    bot_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{bot_response_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'bot',
        'content': full_text,
        'contentType': response_content_type,
        'stage': 'conversation',
        'ttl': ttl_value
    }

    try:
        messages_table.put_item(Item=bot_msg)
        print(f"[INFO] Bot message saved: {bot_response_id}")
    except Exception as e:
        print(f"[ERROR] Failed to save bot message {bot_response_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save bot response'})

    # 세션 완료 처리 (DynamoDB Streams 트리거)
    if is_complete:
        try:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET #status = :status, completedAt = :completed_at',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':completed_at': timestamp
                }
            )
            print(f"[INFO] Session {session_id} marked as completed")
        except Exception as e:
            print(f"[WARN] Failed to update session status for {session_id}: {str(e)}")

    # 프론트엔드에 텍스트 응답 전달
    return lambda_response(200, {
        'response': full_text,
        'contentType': response_content_type,
        'stage': 'conversation',
        'isComplete': is_complete
    })


def send_message_stream(event, context):
    """
    세션에 메시지를 전송하고 AgentCore Agent 응답을 스트리밍으로 받습니다.

    POST /api/sessions/{sessionId}/messages/stream

    Path Parameters:
        sessionId: 세션 고유 식별자

    Request Body:
        message (str): 메시지 내용 (필수)
        messageId (str): 메시지 ID (선택, 미제공 시 자동 생성)
        contentType (str): 메시지 타입 (text/form-submission)

    Returns:
        Streaming response with chunks
    """
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId path parameter'})

    body = parse_body(event)
    message = body.get('message', '')
    message_id = body.get('messageId', generate_id())
    request_content_type = body.get('contentType', 'text')

    if not message:
        return lambda_response(400, {'error': 'Missing message in request body'})

    # 세션 조회 및 검증
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except Exception as e:
        print(f"[ERROR] Database error fetching session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})

    # 고객 메시지 저장
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(30)
    messages_table = dynamodb.Table(MESSAGES_TABLE)

    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{message_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'contentType': request_content_type,
        'stage': 'conversation',
        'ttl': ttl_value
    }

    try:
        messages_table.put_item(Item=customer_msg)
        print(f"[INFO] Customer message saved: {message_id}")
    except Exception as e:
        print(f"[ERROR] Failed to save customer message {message_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save customer message'})

    # form-submission인 경우 에이전트에 전달할 메시지를 텍스트로 변환
    if request_content_type == 'form-submission':
        try:
            form_data = json.loads(message)
            agent_message = format_form_submission_for_agent(form_data)
        except json.JSONDecodeError:
            agent_message = message
    else:
        agent_message = message

    # AgentCore Agent 스트리밍 응답 생성
    try:
        arn, config = get_agent_config_for_session(session_id, 'prechat')
        # Strands Agent 스트리밍 호출
        full_response = ""
        for chunk in agentcore_client.invoke_consultation_stream(
            agent_runtime_arn=arn,
            session_id=session_id,
            message=agent_message,
            config=config,  # config 내부 필드는 None이어도 OK
        ):
            full_response += chunk
            yield json.dumps({'chunk': chunk}, ensure_ascii=False) + '\n'
        
        ai_response = full_response
                
    except Exception as e:
        print(f"[ERROR] Failed to generate AI response: {str(e)}")
        yield json.dumps({'error': 'Failed to generate AI response'}, ensure_ascii=False) + '\n'
        return

    # EOF 토큰으로 세션 완료 감지
    is_complete = 'EOF' in ai_response
    if is_complete:
        ai_response = ai_response.replace('EOF', '').strip()

    # AI 응답의 contentType 감지
    response_content_type = detect_content_type(ai_response)

    # AI 응답 저장
    bot_response_id = f"{int(message_id) + 1}" if message_id.isdigit() else generate_id()
    bot_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{bot_response_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'bot',
        'content': ai_response,
        'contentType': response_content_type,
        'stage': 'conversation',
        'ttl': ttl_value
    }

    try:
        messages_table.put_item(Item=bot_msg)
        print(f"[INFO] Bot message saved: {bot_response_id}")
    except Exception as e:
        print(f"[ERROR] Failed to save bot message {bot_response_id}: {str(e)}")

    # 세션 완료 처리
    if is_complete:
        try:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET #status = :status, completedAt = :completed_at',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':completed_at': timestamp
                }
            )
            print(f"[INFO] Session {session_id} marked as completed")
        except Exception as e:
            print(f"[WARN] Failed to update session status for {session_id}: {str(e)}")

    # 완료 메타데이터 전송
    yield json.dumps({
        'done': True,
        'contentType': response_content_type,
        'isComplete': is_complete
    }, ensure_ascii=False) + '\n'

