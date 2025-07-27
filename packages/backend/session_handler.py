import json
import boto3
from utils import lambda_response, parse_body, get_timestamp, generate_id

dynamodb = boto3.resource('dynamodb')

def create_session(event, context):
    body = parse_body(event)
    
    customer_name = body.get('customerName', '')
    customer_email = body.get('customerEmail', '')
    customer_company = body.get('customerCompany', '')
    target_authority = body.get('targetAuthority', '')
    sales_rep_id = body.get('salesRepId', '')
    
    if not all([customer_name, customer_email, sales_rep_id]):
        return lambda_response(400, {'error': 'Missing required fields'})
    
    session_id = generate_id()
    timestamp = get_timestamp()
    
    session_record = {
        'PK': f'SESSION#{session_id}',
        'SK': 'METADATA',
        'sessionId': session_id,
        'status': 'active',
        'customerInfo': {
            'name': customer_name,
            'email': customer_email,
            'company': customer_company,
            'targetAuthority': target_authority
        },
        'salesRepId': sales_rep_id,
        'createdAt': timestamp,
        'currentStage': 'authority',
        'GSI1PK': f'SALESREP#{sales_rep_id}',
        'GSI1SK': f'SESSION#{timestamp}'
    }
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        sessions_table.put_item(Item=session_record)
        
        return lambda_response(200, {
            'sessionId': session_id,
            'sessionUrl': f'/chat/{session_id}',
            'createdAt': timestamp
        })
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to create session'})

def get_session(event, context):
    session_id = event['pathParameters']['sessionId']
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Get conversation history
        messages_table = dynamodb.Table('mte-messages')
        history_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        
        return lambda_response(200, {
            'sessionId': session['sessionId'],
            'status': session['status'],
            'currentStage': session['currentStage'],
            'customerInfo': session['customerInfo'],
            'salesRepId': session.get('salesRepId', ''),
            'conversationHistory': history_resp.get('Items', [])
        })
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to get session'})