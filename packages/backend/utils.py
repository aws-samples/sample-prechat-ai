import json
import uuid
from datetime import datetime, timezone, timedelta

def lambda_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def generate_id():
    return str(uuid.uuid4())

def generate_session_id(customer_email=None):
    """Generate a session ID with optional customer context for better isolation"""
    base_id = str(uuid.uuid4())
    if customer_email:
        # Add customer email hash for better traceability (but still unique)
        import hashlib
        email_hash = hashlib.md5(customer_email.encode()).hexdigest()[:8]
        return f"{base_id}-{email_hash}"
    return base_id

def generate_csrf_token():
    """Generate a secure CSRF token"""
    import secrets
    return secrets.token_urlsafe(32)

def verify_csrf_token(event, session_id):
    """Verify CSRF token for session operations"""
    import boto3
    import os
    
    # Get CSRF token from request headers or body
    headers = event.get('headers', {})
    headers_lower = {k.lower(): v for k, v in headers.items()}
    csrf_token = headers_lower.get('x-csrf-token')
    
    if not csrf_token:
        # Try to get from body as fallback
        body = parse_body(event)
        csrf_token = body.get('csrfToken')
    
    if not csrf_token:
        print("CSRF - No CSRF token provided")
        return False
    
    try:
        # Get session from DynamoDB to verify token
        dynamodb = boto3.resource('dynamodb')
        sessions_table_name = os.environ.get('SESSIONS_TABLE')
        if not sessions_table_name:
            print("CSRF - SESSIONS_TABLE environment variable not set")
            return False
            
        sessions_table = dynamodb.Table(sessions_table_name)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            print(f"CSRF - Session not found: {session_id}")
            return False
        
        session = session_resp['Item']
        stored_csrf_token = session.get('csrfToken', '')
        
        if not stored_csrf_token:
            print(f"CSRF - No CSRF token stored for session: {session_id}")
            return False
        
        if csrf_token != stored_csrf_token:
            print(f"CSRF - Token mismatch for session: {session_id}")
            return False
        
        print(f"CSRF - Token verified for session: {session_id}")
        return True
        
    except Exception as e:
        print(f"CSRF - Error verifying token: {str(e)}")
        return False

def get_timestamp():
    return datetime.now(timezone.utc).isoformat()

def get_ttl_timestamp(days=30):
    """Get TTL timestamp for DynamoDB (30 days from now)"""
    future_date = datetime.now(timezone.utc) + timedelta(days=days)
    return int(future_date.timestamp())

def parse_body(event):
    try:
        body = event.get('body')
        if not body:
            return {}
        if isinstance(body, str):
            return json.loads(body)
        return body
    except json.JSONDecodeError:
        return {}
    except Exception:
        return {}
