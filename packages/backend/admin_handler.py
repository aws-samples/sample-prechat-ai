import json
import boto3
from utils import lambda_response, parse_body

dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent-runtime', region_name='ap-northeast-2')

def clean_llm_response(content):
    """Clean up LLM response by removing code block markers and trimming"""
    content = content.strip()
    
    # Remove opening code block
    if content.startswith('```'):
        lines = content.split('\n')
        if lines[0].strip().startswith('```'):
            lines = lines[1:]
        content = '\n'.join(lines)
    
    # Remove closing code block
    if content.endswith('```'):
        lines = content.split('\n')
        if lines[-1].strip() == '```':
            lines = lines[:-1]
        elif lines[-1].strip().endswith('```'):
            lines[-1] = lines[-1].replace('```', '').rstrip()
        content = '\n'.join(lines)
    
    return content.strip()

def list_sessions(event, context):
    sales_rep_id = event['queryStringParameters'].get('salesRepId') if event.get('queryStringParameters') else None
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        
        if sales_rep_id:
            # Query by sales rep
            response = sessions_table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'SALESREP#{sales_rep_id}'},
                ScanIndexForward=False
            )
        else:
            # Scan all sessions
            response = sessions_table.scan(
                FilterExpression='SK = :sk',
                ExpressionAttributeValues={':sk': 'METADATA'}
            )
        
        sessions = []
        for item in response.get('Items', []):
            sessions.append({
                'sessionId': item['sessionId'],
                'status': item['status'],
                'customerName': item['customerInfo']['name'],
                'customerEmail': item['customerInfo']['email'],
                'customerCompany': item['customerInfo']['company'],
                'customerTitle': item['customerInfo'].get('title', ''),
                'createdAt': item['createdAt'],
                'completedAt': item.get('completedAt', ''),
                'salesRepEmail': item.get('salesRepEmail', item.get('salesRepId', '')),
                'agentId': item.get('agentId', '')
                # PIN 번호는 보안상 세션 목록에서 제외
            })
        
        return lambda_response(200, {'sessions': sessions})
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to list sessions'})

def inactivate_session(event, context):
    session_id = event['pathParameters']['sessionId']
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'inactive'}
        )
        
        return lambda_response(200, {'message': 'Session inactivated'})
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to inactivate session'})

def delete_session(event, context):
    session_id = event['pathParameters']['sessionId']
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        messages_table = dynamodb.Table('mte-messages')
        
        # Delete session metadata
        sessions_table.delete_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        # Delete all messages
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'}
        )
        
        for message in messages_resp.get('Items', []):
            messages_table.delete_item(Key={'PK': message['PK'], 'SK': message['SK']})
        
        return lambda_response(200, {'message': 'Session deleted'})
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to delete session'})

def get_session_report(event, context):
    session_id = event['pathParameters']['sessionId']
    model_id = event.get('queryStringParameters', {}).get('modelId') if event.get('queryStringParameters') else None
    
    try:
        # Get session
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Get messages
        messages_table = dynamodb.Table('mte-messages')
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        
        messages = messages_resp.get('Items', [])
        
        # Generate summary using selected or default model
        selected_model = model_id or 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-sonnet-20240229-v1:0'
        summary = generate_summary(messages, session, selected_model)
        
        return lambda_response(200, {
            'sessionId': session_id,
            'summary': summary,
        })
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to generate report'})

def generate_summary(messages, session, model_id):
    conversation_text = '\n'.join([f"{msg['sender']}: {msg['content']}" for msg in messages])
    
    prompt = f"""Generate a concise 1-page markdown summary of this AWS pre-consultation conversation in KOREAN. This will help our sales team understand the customer's needs and prepare for the next steps.:

Customer: {session['customerInfo']['name']} from {session['customerInfo']['company']}

Conversation:
{conversation_text[:3000]}

Include:
- Business requirements
- Technical needs
- AWS services discussed
- Next steps

Format as markdown."""
    
    try:
        if 'anthropic' in model_id.lower():
            # Anthropic Claude format
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 8192,
                "messages": [{"role": "user", "content": prompt}]
            })
        else:
            # Amazon Nova format
            body = json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"max_new_tokens": 8192}
            })
        
        response = bedrock.invoke_model(modelId=model_id, body=body)
        result = json.loads(response['body'].read())
        
        if 'anthropic' in model_id.lower():
            return result['content'][0]['text']
        else:
            return result['output']['message']['content'][0]['text']
    except Exception as e:
        print(e)
        return f"# Summary for {session['customerInfo']['name']}\n\nConversation completed with {len(messages)} messages."

def get_aws_docs_recommendations(messages):
    # Simple keyword-based recommendations
    content = ' '.join([msg['content'].lower() for msg in messages])
    
    recommendations = []
    
    if 'ec2' in content or 'compute' in content:
        recommendations.append({'service': 'EC2', 'url': 'https://docs.aws.amazon.com/ec2/'})
    if 's3' in content or 'storage' in content:
        recommendations.append({'service': 'S3', 'url': 'https://docs.aws.amazon.com/s3/'})
    if 'rds' in content or 'database' in content:
        recommendations.append({'service': 'RDS', 'url': 'https://docs.aws.amazon.com/rds/'})
    if 'lambda' in content or 'serverless' in content:
        recommendations.append({'service': 'Lambda', 'url': 'https://docs.aws.amazon.com/lambda/'})
    
    return recommendations

def get_session_details(event, context):
    """Get detailed session info including PIN (only for session owner)"""
    session_id = event['pathParameters']['sessionId']
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Return session details including PIN for the owner
        return lambda_response(200, {
            'sessionId': session['sessionId'],
            'status': session['status'],
            'customerInfo': session['customerInfo'],
            'salesRepEmail': session.get('salesRepEmail', session.get('salesRepId', '')),
            'agentId': session.get('agentId', ''),
            'pinNumber': session.get('pinNumber', ''),
            'createdAt': session['createdAt'],
            'completedAt': session.get('completedAt', '')
        })
        
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to get session details'})

def generate_optimized_prompt(event, context):
    """Generate optimized prompt using LLM based on analysis options"""
    session_id = event['pathParameters']['sessionId']
    body = parse_body(event)
    analysis_options = body.get('analysisOptions', {})
    model_id = body.get('modelId', 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-sonnet-20240229-v1:0')
    
    try:
        # Get session and messages
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Get messages
        messages_table = dynamodb.Table('mte-messages')
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        
        messages = messages_resp.get('Items', [])
        conversation_text = '\n'.join([f"{msg['sender']}: {msg['content']}" for msg in messages])
        
        # Build analysis requirements based on selected options
        analysis_requirements = []
        
        # 필수 항목들
        if analysis_options.get('coreRequirements', True):
            analysis_requirements.append("- 핵심 요구사항: 고객이 언급한 주요 비즈니스 요구사항과 기술적 니즈")
        
        if analysis_options.get('priorities', True):
            analysis_requirements.append("- 우선순위 분석: 고객이 중요하게 생각하는 항목들의 우선순위")
        
        # 선택 항목들
        if analysis_options.get('bant', False):
            analysis_requirements.append("- BANT 분석: Budget(예산), Authority(권한), Need(필요성), Timeline(일정)")
        
        if analysis_options.get('awsServices', False):
            analysis_requirements.append("- 추천 AWS 서비스: 고객 요구사항에 적합한 AWS 서비스 추천")
        
        if analysis_options.get('approachStrategy', False):
            analysis_requirements.append("- 유사고객 접근 전략: 비슷한 고객 사례 기반 접근 전략")
        
        # Create meta-prompt for LLM to generate optimized prompt
        meta_prompt = f"""당신은 AWS 영업 담당자를 위한 프롬프트 엔지니어링 전문가입니다. 
다음 고객 상담 정보를 바탕으로, 영업 담당자가 효과적인 미팅을 준비할 수 있도록 도와주는 최적화된 분석 프롬프트를 생성해주세요.

고객 정보:
- 이름: {session['customerInfo']['name']}
- 회사: {session['customerInfo']['company']}
- 직책: {session['customerInfo'].get('title', '미입력')}
- 이메일: {session['customerInfo']['email']}

대화 내용 요약:
{conversation_text[:2000]}

요청된 분석 항목:
{chr(10).join(analysis_requirements)}

다음 조건을 만족하는 프롬프트를 생성해주세요:

1. 위 대화 내용을 분석하여 요청된 항목들에 대한 구체적이고 실행 가능한 분석을 요구하는 프롬프트
2. 영업 담당자가 바로 활용할 수 있는 실무적인 관점의 분석을 유도
3. 마크다운 형식으로 구조화된 결과를 요구
4. 고객의 업종, 규모, 기술 수준을 고려한 맞춤형 분석을 유도
5. AWS 서비스 추천 시 구체적인 이유와 구현 방안을 포함하도록 유도

생성할 프롬프트는 다른 AI 모델이나 에이전트가 실행할 것이므로, 명확하고 구체적인 지시사항을 포함해주세요.

프롬프트만 출력하고, 다른 설명은 포함하지 마세요."""

        # Generate optimized prompt using LLM
        if 'anthropic' in model_id.lower():
            # Anthropic Claude format
            request_body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": meta_prompt}]
            })
        else:
            # Amazon Nova format
            request_body = json.dumps({
                "messages": [{"role": "user", "content": [{"text": meta_prompt}]}],
                "inferenceConfig": {"max_new_tokens": 4096}
            })
        
        response = bedrock.invoke_model(modelId=model_id, body=request_body)
        result = json.loads(response['body'].read())
        
        if 'anthropic' in model_id.lower():
            optimized_prompt = result['content'][0]['text']
        else:
            optimized_prompt = result['output']['message']['content'][0]['text']
        
        # Clean up the prompt
        optimized_prompt = clean_llm_response(optimized_prompt)
        
        return lambda_response(200, {
            'prompt': optimized_prompt,
            'sessionId': session_id,
            'modelUsed': model_id
        })
        
    except Exception as e:
        print(f"Error generating optimized prompt: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate optimized prompt'})

def generate_report_with_model(event, context):
    """Generate report using Bedrock model"""
    session_id = event['pathParameters']['sessionId']
    body = parse_body(event)
    model_id = body.get('modelId')
    prompt = body.get('prompt')
    conversation_history = body.get('conversationHistory', [])
    customer_info = body.get('customerInfo', {})
    
    if not model_id or not prompt:
        return lambda_response(400, {'error': 'Missing modelId or prompt'})
    
    try:
        # Build conversation context
        conversation_text = '\n'.join([f"{msg.get('sender', 'unknown')}: {msg.get('content', '')}" for msg in conversation_history])
        
        # Enhance prompt with conversation context
        enhanced_prompt = f"""고객 정보:
- 이름: {customer_info.get('name', '미입력')}
- 회사: {customer_info.get('company', '미입력')}
- 직책: {customer_info.get('title', '미입력')}
- 이메일: {customer_info.get('email', '미입력')}

대화 내용:
{conversation_text}

분석 요청:
{prompt}"""
        # Generate report using Bedrock model
        if 'anthropic' in model_id.lower():
            # Anthropic Claude format
            request_body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 8192,
                "messages": [{"role": "user", "content": enhanced_prompt}]
            })
        else:
            # Amazon Nova format
            request_body = json.dumps({
                "messages": [{"role": "user", "content": [{"text": enhanced_prompt}]}],
                "inferenceConfig": {"max_new_tokens": 8192}
            })
        
        response = bedrock.invoke_model(modelId=model_id, body=request_body)
        result = json.loads(response['body'].read())
        
        if 'anthropic' in model_id.lower():
            content = result['content'][0]['text']
        else:
            content = result['output']['message']['content'][0]['text']
        
        # Clean up the content
        content = clean_llm_response(content)
        
        return lambda_response(200, {
            'content': content,
            'modelUsed': model_id,
            'sessionId': session_id
        })
        
    except Exception as e:
        print(f"Error generating report with model: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate report with model'})

def generate_report_with_agent(event, context):
    """Generate report using Bedrock Agent"""
    session_id = event['pathParameters']['sessionId']
    body = parse_body(event)
    agent_id = body.get('agentId')
    prompt = body.get('prompt')
    conversation_history = body.get('conversationHistory', [])
    customer_info = body.get('customerInfo', {})
    
    if not agent_id or not prompt:
        return lambda_response(400, {'error': 'Missing agentId or prompt'})
    
    try:
        # Build conversation context
        conversation_text = '\n'.join([f"{msg.get('sender', 'unknown')}: {msg.get('content', '')}" for msg in conversation_history])
        
        # Enhance prompt with conversation context
        enhanced_prompt = f"""고객 정보:
- 이름: {customer_info.get('name', '미입력')}
- 회사: {customer_info.get('company', '미입력')}
- 직책: {customer_info.get('title', '미입력')}
- 이메일: {customer_info.get('email', '미입력')}

대화 내용:
{conversation_text}

분석 요청:
{prompt}"""
        # Generate report using Bedrock Agent
        response = bedrock_agent.invoke_agent(
            agentId=agent_id,
            agentAliasId='TSTALIASID',  # Use test alias
            sessionId=f"report-{session_id}",  # Unique session for report generation
            inputText=enhanced_prompt
        )
        
        # Extract response from agent
        response_text = ""
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    response_text += chunk['bytes'].decode('utf-8')
        
        if not response_text:
            response_text = "리포트 생성에 실패했습니다. 다시 시도해주세요."
        
        # Clean up the content
        response_text = clean_llm_response(response_text)
        
        return lambda_response(200, {
            'content': response_text,
            'agentUsed': agent_id,
            'sessionId': session_id
        })
        
    except Exception as e:
        print(f"Error generating report with agent: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate report with agent'})
