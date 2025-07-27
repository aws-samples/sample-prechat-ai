import json
import boto3
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_next_stage

dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-2')

def handle_message(event, context):
    body = parse_body(event)
    session_id = body.get('sessionId')
    message = body.get('message', '')
    request_model_id = body.get('selectedModel')
    
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
    except:
        return lambda_response(500, {'error': 'Database error'})
    
    # Get conversation history
    messages_table = dynamodb.Table('mte-messages')
    try:
        history_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        messages = history_resp.get('Items', [])
    except:
        messages = []
    
    current_stage = session.get('currentStage', 'authority')
    
    # Generate AI response using request model or default
    selected_model = request_model_id or 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-sonnet-20240229-v1:0'
    ai_response = generate_ai_response(message, current_stage, messages, selected_model)
    
    # Save customer message
    timestamp = get_timestamp()
    customer_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{timestamp}#{generate_id()}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'customer',
        'content': message,
        'stage': current_stage
    }
    
    # Save bot response
    bot_msg = {
        'PK': f'SESSION#{session_id}',
        'SK': f'MESSAGE#{timestamp}#{generate_id()}',
        'sessionId': session_id,
        'timestamp': timestamp,
        'sender': 'bot',
        'content': ai_response,
        'stage': current_stage
    }
    
    try:
        messages_table.put_item(Item=customer_msg)
        messages_table.put_item(Item=bot_msg)
    except:
        return lambda_response(500, {'error': 'Failed to save messages'})
    
    # Check if conversation should progress
    is_complete = len(messages) > 15 and current_stage == 'next_steps'
    next_stage = get_next_stage(current_stage) if not is_complete else current_stage
    
    # Update session if needed
    if next_stage != current_stage or is_complete:
        try:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET currentStage = :stage, #status = :status',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':stage': next_stage,
                    ':status': 'completed' if is_complete else 'active'
                }
            )
        except:
            pass
    
    return lambda_response(200, {
        'response': ai_response,
        'stage': next_stage,
        'isComplete': is_complete
    })

def generate_ai_response(message, stage, history, model_id):
    stage_prompts = {
        'authority': "Ask about decision makers, budget approval, and authority structure.",
        'business': "Ask about business problems, industry, and AWS goals.",
        'aws_services': "Ask about specific AWS services of interest. You SHOULD focus on quality attributes of distributed system architecture.",
        'technical': "Ask about technical requirements, scale, and compliance.",
        'next_steps': "Ask about timeline, meeting preferences, and next steps."
    }
    
    # Build conversation messages - must start with user
    converse_messages = []
    
    # Process history to ensure user-first pattern
    for msg in history[-10:]:
        role = 'user' if msg['sender'] == 'customer' else 'assistant'
        converse_messages.append({
            'role': role,
            'content': [{'text': msg['content']}]
        })
    
    # Ensure conversation starts with user message
    while converse_messages and converse_messages[0]['role'] == 'assistant':
        converse_messages.pop(0)
    
    # Ensure alternating pattern (user -> assistant -> user...)
    cleaned_messages = []
    last_role = None
    for msg in converse_messages:
        if msg['role'] != last_role:
            cleaned_messages.append(msg)
            last_role = msg['role']
    converse_messages = cleaned_messages
    
    # Add current user message
    converse_messages.append({
        'role': 'user',
        'content': [{'text': message}]
    })
    
    # System prompt
    system_prompt = f"""You are an KOREAN AWS pre-consultation chatbot. You kindly handle your customer to understand their business&technical purpose, vision, expected outcome and what values they're seeking from AWS cloud adoption. You MUST provide the conversation using KOREAN. Current stage: {stage}.
    
    {stage_prompts.get(stage, 'Continue the conversation naturally.')}
    
    Respond naturally and ask relevant follow-up questions. Provide detailed explanations when helpful."""
    
    try:
        response = bedrock.converse(
            modelId=model_id,
            messages=converse_messages,
            system=[{'text': system_prompt}],
            inferenceConfig={'maxTokens': 8192}
        )
        
        return response['output']['message']['content'][0]['text']
    except Exception as e:
        print(f"Bedrock converse error: {str(e)}")
        print(f"Converse messages: {json.dumps(converse_messages, ensure_ascii=False)}")
        return "I understand. Could you tell me more about that?"