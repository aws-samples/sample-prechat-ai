import json
import os
import boto3
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp

dynamodb = boto3.resource('dynamodb')
bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=bedrock_region)

def handle_stream_message(event, context):
    """Handle streaming chat messages with real-time agent responses"""
    body = parse_body(event)
    session_id = body.get('sessionId')
    message = body.get('message', '')
    message_id = body.get('messageId', generate_id())
    
    if not session_id or not message:
        return lambda_response(400, {'error': 'Missing sessionId or message'})
    
    # Get session
    sessions_table = dynamodb.Table('mte-sessions')
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except Exception as e:
        return lambda_response(500, {'error': 'Database error'})
    
    agent_id = session.get('agentId')
    if not agent_id:
        return lambda_response(400, {'error': 'No agent assigned to this session'})
    
    # Save customer message immediately
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(30)
    
    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{message_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'stage': 'conversation',
        'ttl': ttl_value
    }
    
    messages_table = dynamodb.Table('mte-messages')
    try:
        messages_table.put_item(Item=customer_msg)
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to save customer message'})
    
    # Generate streaming response
    try:
        response_data = generate_streaming_response(message, session_id, agent_id, message_id, timestamp, ttl_value)
        return lambda_response(200, response_data)
    except Exception as e:
        print(f"Streaming error: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate response'})

def generate_streaming_response(message, session_id, agent_id, message_id, timestamp, ttl_value):
    """Generate streaming response using Bedrock Agent with streamFinalResponse enabled"""
    try:
        # Invoke Bedrock Agent with streaming enabled
        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId=os.environ.get('BEDROCK_AGENT_ALIAS_ID', 'TSTALIASID'),
            sessionId=session_id,
            inputText=message,
            streamingConfigurations={
                'streamFinalResponse': True,
                'applyGuardrailInterval': 50
            }
        )
        
        full_response = ""
        chunks = []
        messages_table = dynamodb.Table('mte-messages')
        bot_response_id = f"{int(message_id) + 1}"
        
        # Process streaming events and collect chunks
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    chunk_text = chunk['bytes'].decode('utf-8')
                    full_response += chunk_text
                    chunks.append(chunk_text)
        
        # Check if conversation is complete
        is_complete = 'EOF' in full_response
        if is_complete:
            full_response = full_response.replace('EOF', '').strip()
        
        # Save bot response to database
        bot_msg = {
            'PK': f'SESSION#{session_id}',
            'SK': f'MESSAGE#{bot_response_id}',
            'sessionId': session_id,
            'timestamp': timestamp,
            'sender': 'bot',
            'content': full_response,
            'stage': 'conversation',
            'ttl': ttl_value
        }
        
        try:
            messages_table.put_item(Item=bot_msg)
        except Exception as e:
            print(f"Failed to save bot message: {str(e)}")
        
        # Update session status if complete
        if is_complete:
            try:
                sessions_table = dynamodb.Table('mte-sessions')
                sessions_table.update_item(
                    Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                    UpdateExpression='SET #status = :status, completedAt = :completed_at',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'completed',
                        ':completed_at': timestamp
                    }
                )
            except Exception as e:
                print(f"Failed to update session status: {str(e)}")
        
        return {
            'response': full_response,
            'chunks': chunks,
            'isComplete': is_complete,
            'messageId': bot_response_id,
            'stage': 'conversation'
        }
        
    except Exception as e:
        print(f"Streaming error: {str(e)}")
        error_message = "죄송합니다. 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요."
        return {
            'response': error_message,
            'chunks': [error_message],
            'isComplete': False,
            'messageId': f"{int(message_id) + 1}",
            'stage': 'conversation',
            'error': True
        }