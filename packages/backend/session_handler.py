import json
import boto3
import os
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp

dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID')

def create_session(event, context):
    body = parse_body(event)
    
    customer_name = body.get('customerName', '')
    customer_email = body.get('customerEmail', '')
    customer_company = body.get('customerCompany', '')
    customer_title = body.get('customerTitle', '')
    sales_rep_email = body.get('salesRepEmail', '')
    agent_id = body.get('agentId', '')
    
    if not all([customer_name, customer_email, sales_rep_email, agent_id]):
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
            'title': customer_title
        },
        'salesRepEmail': sales_rep_email,
        'agentId': agent_id,
        'createdAt': timestamp,
        'ttl': get_ttl_timestamp(30),  # 30 days TTL
        'GSI1PK': f'SALESREP#{sales_rep_email}',
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
        
        # Transform messages to match frontend Message interface
        conversation_history = []
        for item in history_resp.get('Items', []):
            # Extract message ID from SK (format: MESSAGE#{messageId})
            sk = item.get('SK', '')
            message_id = sk.replace('MESSAGE#', '') if sk.startswith('MESSAGE#') else sk
            
            conversation_history.append({
                'id': message_id,
                'content': item.get('content', ''),
                'sender': item.get('sender', ''),
                'timestamp': item.get('timestamp', ''),
                'stage': item.get('stage', 'conversation')
            })
        
        # Get sales rep info from Cognito
        sales_rep_email = session.get('salesRepEmail', session.get('salesRepId', ''))
        sales_rep_info = get_sales_rep_info(sales_rep_email)
        
        return lambda_response(200, {
            'sessionId': session['sessionId'],
            'status': session['status'],
            'customerInfo': session['customerInfo'],
            'salesRepEmail': sales_rep_email,
            'salesRepInfo': sales_rep_info,
            'agentId': session.get('agentId', ''),
            'conversationHistory': conversation_history
        })
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to get session'})

def get_sales_rep_info(email):
    """Get sales representative info from Cognito"""
    if not email or not USER_POOL_ID:
        return {
            'email': email or 'Unknown',
            'name': email.split('@')[0] if email else 'Unknown',
            'phone': 'Contact via email'
        }
    
    try:
        # List users to find the user by email
        response = cognito.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email = "{email}"',
            Limit=1
        )
        
        if response['Users']:
            user = response['Users'][0]
            attributes = {attr['Name']: attr['Value'] for attr in user['Attributes']}
            
            return {
                'email': attributes.get('email', email),
                'name': attributes.get('name', email.split('@')[0]),
                'phone': attributes.get('phone_number', 'Contact via email')
            }
        else:
            # User not found in Cognito, return basic info
            return {
                'email': email,
                'name': email.split('@')[0],
                'phone': 'Contact via email'
            }
    except Exception as e:
        print(f"Error getting sales rep info from Cognito: {str(e)}")
        # Fallback to basic info
        return {
            'email': email,
            'name': email.split('@')[0] if email else 'Unknown',
            'phone': 'Contact via email'
        }