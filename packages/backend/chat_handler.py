import json
import boto3
import os
from decimal import Decimal
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp

dynamodb = boto3.resource('dynamodb')
bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=bedrock_region)
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

def handle_message(event, context):
    body = parse_body(event)
    session_id = body.get('sessionId')
    message = body.get('message', '')
    message_id = body.get('messageId', generate_id())
    
    if not session_id or not message:
        return lambda_response(400, {'error': 'Missing sessionId or message'})
    
    # Log memory isolation info for debugging
    print(f"Processing message for session {session_id}")
    
    # Get session
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except:
        return lambda_response(500, {'error': 'Database error'})
    
    # Get conversation history
    messages_table = dynamodb.Table(MESSAGES_TABLE)
    try:
        history_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        messages = history_resp.get('Items', [])
    except:
        messages = []
    
    agent_id = session.get('agentId')
    
    # Save customer message immediately
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(30)  # 30 days TTL
    
    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{message_id}',  # Use frontend messageId
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'stage': 'conversation',
        'ttl': ttl_value
    }
    
    # Save customer message first
    try:
        messages_table.put_item(Item=customer_msg)
        print(f"Customer message saved successfully: {message_id} - {message[:50]}...")
    except Exception as e:
        print(f"Failed to save customer message {message_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save customer message'})
    
    # Generate AI response using Bedrock Agent
    if not agent_id:
        print(f"No agent assigned to session {session_id}")
        return lambda_response(400, {'error': 'No agent assigned to this session'})
    
    try:
        ai_response = generate_agent_response(message, session_id, agent_id)
    except Exception as e:
        print(f"Failed to generate AI response: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate AI response'})
    
    # Check if conversation should be marked as complete (based on agent's EOF token)
    is_complete = 'EOF' in ai_response
    
    # Clean up EOF token from response before saving
    if is_complete:
        ai_response = ai_response.replace('EOF', '').strip()
    
    # Save bot response
    bot_response_id = f"{int(message_id) + 1}"  # Increment for bot response
    bot_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{bot_response_id}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'bot',
        'content': ai_response,
        'stage': 'conversation',
        'ttl': ttl_value
    }
    
    # Save bot message
    try:
        messages_table.put_item(Item=bot_msg)
        print(f"Bot message saved successfully: {bot_response_id} - {ai_response[:50]}...")
    except Exception as e:
        print(f"Failed to save bot message {bot_response_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save bot response'})
    
    # Update session status if conversation is complete
    if is_complete:
        try:
            # Update session status to completed (this will trigger DynamoDB Streams)
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET #status = :status, completedAt = :completed_at',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':completed_at': timestamp
                }
            )
            print(f"Session {session_id} marked as completed successfully - DynamoDB Streams triggered")
        except Exception as e:
            print(f"Warning: Failed to update session status for {session_id}: {str(e)}")
            # Don't fail the entire request if session status update fails
            pass
    
    return lambda_response(200, {
        'response': ai_response,
        'stage': 'conversation',
        'isComplete': is_complete
    })

def generate_agent_response(message, session_id, agent_id):
    """Generate response using Bedrock Agent with memory support"""
    try:
        print(f"Invoking Bedrock Agent {agent_id} for session {session_id} with memory enabled")
        
        # Use consistent sessionId to maintain conversation context
        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId=os.environ.get('BEDROCK_AGENT_ALIAS_ID', 'TSTALIASID'),
            sessionId=session_id,  # This ensures memory continuity
            inputText=message,
            enableTrace=False,  # Set to True for debugging if needed
            endSession=False    # Keep session alive for memory
        )
        
        # Extract response from agent
        response_text = ""
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    response_text += chunk['bytes'].decode('utf-8')
        
        if response_text:
            print(f"Agent response generated successfully for session {session_id}: {len(response_text)} characters")
            return response_text
        else:
            print(f"Agent returned empty response for session {session_id}")
            return "죄송합니다. 다시 말씀해 주시겠어요?"
            
    except Exception as e:
        print(f"Bedrock Agent error for session {session_id}: {str(e)}")
        # Return a more specific error message
        if 'ResourceNotFoundException' in str(e):
            return "죄송합니다. 에이전트를 찾을 수 없습니다. 관리자에게 문의해 주세요."
        elif 'ValidationException' in str(e):
            return "죄송합니다. 요청이 올바르지 않습니다. 다시 시도해 주세요."
        elif 'ThrottlingException' in str(e):
            return "죄송합니다. 현재 요청이 많아 잠시 대기가 필요합니다. 잠시 후 다시 시도해 주세요."
        else:
            return "죄송합니다. 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요."


def update_consultation_purposes(event, context):
    """Update consultation purposes for a session"""
    body = parse_body(event)
    session_id = event['pathParameters']['sessionId']
    consultation_purposes = body.get('consultationPurposes', '')
    
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})
    
    if not consultation_purposes:
        return lambda_response(400, {'error': 'Missing consultationPurposes'})
    
    # Get session to verify it exists and is active
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except Exception as e:
        print(f"Database error checking session: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})
    
    # Update consultation purposes
    try:
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET consultationPurposes = :purposes',
            ExpressionAttributeValues={':purposes': consultation_purposes}
        )
        
        print(f"Consultation purposes updated for session {session_id}: {consultation_purposes}")
        
        return lambda_response(200, {
            'message': 'Consultation purposes updated successfully',
            'sessionId': session_id,
            'consultationPurposes': consultation_purposes
        })
    except Exception as e:
        print(f"Failed to update consultation purposes for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update consultation purposes'})

def handle_feedback(event, context):
    """Handle customer feedback submission"""
    body = parse_body(event)
    session_id = event['pathParameters']['sessionId']
    rating = body.get('rating')
    feedback = body.get('feedback', '')
    
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})
    
    if not rating or not isinstance(rating, (int, float)) or rating < 0.5 or rating > 5:
        return lambda_response(400, {'error': 'Invalid rating. Must be between 0.5 and 5.0'})
    
    # Get session to verify it exists
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
    except Exception as e:
        print(f"Database error checking session: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})
    
    # Save feedback
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(365)  # Keep feedback for 1 year
    
    feedback_item = {
        'PK': f'SESSION#{session_id}',
        'SK': 'FEEDBACK',
        'sessionId': session_id,
        'rating': Decimal(str(rating)),  # Convert float to Decimal for DynamoDB
        'feedback': feedback,
        'timestamp': timestamp,
        'ttl': ttl_value
    }
    
    try:
        sessions_table.put_item(Item=feedback_item)
        print(f"Feedback saved for session {session_id}: rating={rating}, feedback_length={len(feedback)}")
        
        return lambda_response(200, {
            'message': 'Feedback submitted successfully',
            'sessionId': session_id,
            'rating': rating
        })
    except Exception as e:
        print(f"Failed to save feedback for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save feedback'})

