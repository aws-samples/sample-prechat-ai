import json
import boto3
import os
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp, generate_csrf_token

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
    pin_number = body.get('pinNumber', '')
    
    if not all([customer_name, customer_email, sales_rep_email, agent_id, pin_number]):
        return lambda_response(400, {'error': 'Missing required fields'})
    
    # Validate PIN format (6 digits)
    if not pin_number.isdigit() or len(pin_number) != 6:
        return lambda_response(400, {'error': 'PIN must be exactly 6 digits'})
    
    session_id = generate_id()
    timestamp = get_timestamp()
    
    csrf_token = generate_csrf_token()
    
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
        'pinNumber': pin_number,
        'csrfToken': csrf_token,
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
            'csrfToken': csrf_token,
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
            'csrfToken': session.get('csrfToken', ''),
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

def verify_session_pin(event, context):
    """Verify PIN for session access and record privacy consent"""
    session_id = event['pathParameters']['sessionId']
    body = parse_body(event)
    provided_pin = body.get('pinNumber', '')
    privacy_agreed = body.get('privacyAgreed', False)
    
    if not provided_pin:
        return lambda_response(400, {'error': 'PIN number is required'})
    
    if not privacy_agreed:
        return lambda_response(400, {'error': 'Privacy policy agreement is required'})
    
    try:
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Check if session is active
        if session.get('status') != 'active':
            return lambda_response(403, {'error': 'Session is not active'})
        
        # Verify PIN
        stored_pin = session.get('pinNumber', '')
        if provided_pin != stored_pin:
            return lambda_response(403, {'error': 'Invalid PIN number'})
        
        # Record privacy consent
        timestamp = get_timestamp()
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET privacyConsentTimestamp = :timestamp, privacyConsentAgreed = :agreed',
            ExpressionAttributeValues={
                ':timestamp': timestamp,
                ':agreed': True
            }
        )
        
        # Return CSRF token for subsequent requests
        csrf_token = session.get('csrfToken', '')
        return lambda_response(200, {
            'message': 'PIN verified successfully',
            'csrfToken': csrf_token
        })
        
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to verify PIN'})