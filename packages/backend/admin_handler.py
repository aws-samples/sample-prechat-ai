import json
import boto3
from utils import lambda_response, parse_body

dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-2')

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
    