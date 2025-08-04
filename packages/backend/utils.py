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

