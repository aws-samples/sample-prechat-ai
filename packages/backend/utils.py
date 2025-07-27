import json
import uuid
from datetime import datetime, timezone

def lambda_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(body)
    }

def generate_id():
    return str(uuid.uuid4())

def get_timestamp():
    return datetime.now(timezone.utc).isoformat()

def parse_body(event):
    try:
        return json.loads(event.get('body', '{}'))
    except:
        return {}

STAGES = ['authority', 'business', 'aws_services', 'technical', 'next_steps', 'completed']

def get_next_stage(current_stage):
    try:
        idx = STAGES.index(current_stage)
        return STAGES[min(idx + 1, len(STAGES) - 1)]
    except:
        return STAGES[0]