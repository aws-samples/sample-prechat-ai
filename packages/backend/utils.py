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

def get_timestamp():
    return datetime.now(timezone.utc).isoformat()

def verify_origin(event):
    """Verify request origin for CSRF protection"""
    import os
    
    # Get headers (case-insensitive)
    headers = event.get('headers', {})
    
    # Convert headers to lowercase for case-insensitive lookup
    headers_lower = {k.lower(): v for k, v in headers.items()}
    
    origin = headers_lower.get('origin')
    referer = headers_lower.get('referer')
    
    # Get allowed origins from environment or use defaults
    allowed_origins = [
        'http://localhost:5173',  # Vite dev server
        'http://localhost:3000',  # Alternative dev server
    ]
    
    # Add CloudFront domain if available
    cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN')
    if cloudfront_domain:
        allowed_origins.append(f'https://{cloudfront_domain}')
    
    # Add custom domain if available
    custom_domain = os.environ.get('CUSTOM_DOMAIN')
    if custom_domain:
        allowed_origins.append(f'https://{custom_domain}')
    
    print(f"CSRF - Allowed origins: {allowed_origins}")
    print(f"CSRF - Request origin: {origin}")
    print(f"CSRF - Request referer: {referer}")
    
    # Check origin header first
    if origin:
        if origin in allowed_origins:
            return True
        print(f"CSRF - Invalid origin: {origin}")
        return False
    
    # Fallback to referer header
    if referer:
        for allowed_origin in allowed_origins:
            if referer.startswith(allowed_origin):
                return True
        print(f"CSRF - Invalid referer: {referer}")
        return False
    
    # No origin or referer header (suspicious)
    print("CSRF - No origin or referer header found")
    return False

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

