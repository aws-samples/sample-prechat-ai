"""
Session Messages Handler

도메인 기반 API 엔드포인트: POST /api/sessions/{sessionId}/messages
기존 chat_handler의 비즈니스 로직을 재사용하여 도메인 구조에 맞게 구현합니다.
"""

import json
import boto3
import os
from decimal import Decimal
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp
from agent_runtime import AgentCoreClient, get_agent_config_for_campaign, get_agent_config_for_session

dynamodb = boto3.resource('dynamodb')
bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=bedrock_region)
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


def send_message(event, context):
    """
    세션에 메시지를 전송하고 AgentCore Agent 응답을 받습니다.

    POST /api/sessions/{sessionId}/messages

    Path Parameters:
        sessionId: 세션 고유 식별자

    Request Body:
        message (str): 메시지 내용 (필수)
        messageId (str): 메시지 ID (선택, 미제공 시 자동 생성)

    Returns:
        response (str): AI 응답
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
        print(f"Database error fetching session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})

    agent_id = session.get('agentId')
    if not agent_id:
        print(f"No agent assigned to session {session_id}")
        return lambda_response(400, {'error': 'No agent assigned to this session'})

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
        print(f"Customer message saved: {message_id}")
    except Exception as e:
        print(f"Failed to save customer message {message_id}: {str(e)}")
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
    # Session ID → Campaign → AgentConfiguration 조회하여 config를 payload에 주입
    campaign_id = session.get('campaignId', '')
    try:
        config = get_agent_config_for_session(session_id, 'prechat') if campaign_id else \
                 get_agent_config_for_campaign('', 'prechat')
        if config and config.agent_runtime_arn:
            ai_response = agentcore_client.invoke_consultation(
                agent_runtime_arn=config.agent_runtime_arn,
                session_id=session_id,
                message=agent_message,
                config=config,
            )
        else:
            ai_response = _generate_agent_response(agent_message, session_id, agent_id)
    except Exception as e:
        print(f"Failed to generate AI response: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate AI response'})

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
        print(f"Bot message saved: {bot_response_id}")
    except Exception as e:
        print(f"Failed to save bot message {bot_response_id}: {str(e)}")
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
            print(f"Session {session_id} marked as completed")
        except Exception as e:
            print(f"Warning: Failed to update session status for {session_id}: {str(e)}")

    return lambda_response(200, {
        'response': ai_response,
        'contentType': response_content_type,
        'stage': 'conversation',
        'isComplete': is_complete
    })


def _generate_agent_response(message, session_id, agent_id):
    """AgentCore Agent를 호출하여 응답을 생성합니다."""
    try:
        print(f"Invoking AgentCore Agent {agent_id} for session {session_id}")

        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId=os.environ.get('BEDROCK_AGENT_ALIAS_ID', 'TSTALIASID'),
            sessionId=session_id,
            inputText=message,
            enableTrace=False,
            endSession=False
        )

        response_text = ""
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    response_text += chunk['bytes'].decode('utf-8')

        if response_text:
            print(f"Agent response: {len(response_text)} chars for session {session_id}")
            return response_text
        else:
            print(f"Agent returned empty response for session {session_id}")
            return "죄송합니다. 다시 말씀해 주시겠어요?"

    except Exception as e:
        print(f"AgentCore Agent error for session {session_id}: {str(e)}")
        error_str = str(e)
        if 'ResourceNotFoundException' in error_str:
            return "죄송합니다. 에이전트를 찾을 수 없습니다. 관리자에게 문의해 주세요."
        elif 'ValidationException' in error_str:
            return "죄송합니다. 요청이 올바르지 않습니다. 다시 시도해 주세요."
        elif 'ThrottlingException' in error_str:
            return "죄송합니다. 현재 요청이 많아 잠시 후 다시 시도해 주세요."
        else:
            return "죄송합니다. 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요."
