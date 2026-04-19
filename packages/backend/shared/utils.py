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
        'body': json.dumps(body, ensure_ascii=False)
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

# Lambda 인스턴스 메모리 내 CSRF 토큰 캐시
# warm start 시 DynamoDB Get 호출 감소 목적
# key: session_id, value: csrf_token
_CSRF_CACHE: dict[str, str] = {}


def csrf_cache_invalidate(session_id: str) -> None:
    """세션의 CSRF 캐시 항목 무효화 (토큰 재발급 시 호출)."""
    _CSRF_CACHE.pop(session_id, None)


def verify_csrf_token(event, session_id):
    """Verify CSRF token for session operations (with in-memory cache)"""
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

    # 1. 메모리 캐시 우선 확인 (warm start 최적화)
    cached_token = _CSRF_CACHE.get(session_id)
    if cached_token is not None and secure_compare(csrf_token, cached_token):
        return True

    # 2. DB 조회 fallback (캐시 미스 또는 토큰 회전)
    try:
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

        if not secure_compare(csrf_token, stored_csrf_token):
            print(f"CSRF - Token mismatch for session: {session_id}")
            return False

        # 검증 성공 → 캐시에 저장
        _CSRF_CACHE[session_id] = stored_csrf_token
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
def convert_decimal_to_int(value):
    """Convert DynamoDB Decimal to int, handling None values"""
    from decimal import Decimal
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return int(value)
    return int(value) if value else 0

def serialize_dynamodb_item(item):
    """Convert DynamoDB item with Decimal values to JSON-serializable format"""
    from decimal import Decimal
    
    if isinstance(item, dict):
        return {key: serialize_dynamodb_item(value) for key, value in item.items()}
    elif isinstance(item, list):
        return [serialize_dynamodb_item(value) for value in item]
    elif isinstance(item, Decimal):
        # Convert Decimal to int if it's a whole number, otherwise to float
        if item % 1 == 0:
            return int(item)
        else:
            return float(item)
    else:
        return item

def build_update_expression(update_data, reserved_keywords=None):
    """
    Build DynamoDB UpdateExpression with proper handling of reserved keywords
    
    Args:
        update_data (dict): Dictionary of field names and values to update
        reserved_keywords (set): Set of reserved keywords that need ExpressionAttributeNames
    
    Returns:
        tuple: (update_expression, expression_values, expression_names)
    """
    if reserved_keywords is None:
        reserved_keywords = {'status', 'name', 'description', 'date', 'timestamp', 'type', 'order', 'size'}
    
    update_expression = 'SET updatedAt = :timestamp'
    expression_values = {':timestamp': get_timestamp()}
    expression_names = {}
    
    for field, value in update_data.items():
        if field.lower() in reserved_keywords:
            # Use ExpressionAttributeNames for reserved keywords
            attr_name = f'#{field}'
            update_expression += f', {attr_name} = :{field}'
            expression_names[attr_name] = field
        else:
            update_expression += f', {field} = :{field}'
        expression_values[f':{field}'] = value
    
    return update_expression, expression_values, expression_names


import re
import hmac

# sessionId 포맷: UUID4 + optional md5 hash suffix
_SESSION_ID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    r'(-[0-9a-f]{8})?$'
)


def validate_session_id(session_id):
    """sessionId 포맷 검증 (UUID4 + optional 8-char hex suffix)"""
    if not session_id or not isinstance(session_id, str) or len(session_id) > 50:
        return False
    return bool(_SESSION_ID_PATTERN.match(session_id))


def secure_compare(a, b):
    """타이밍 공격 방지를 위한 상수 시간 문자열 비교"""
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))




def hash_campaign_pin(pin: str, campaign_id: str) -> str:
    """캠페인 PIN을 salted HMAC-SHA256으로 해시.

    Salt로 campaign_id를 사용하여 캠페인 간 레인보우 테이블 공격 방어.
    Secret은 PIN_HASH_SECRET 환경변수에서 로드 (KMS/Secrets Manager 연동 권장).
    환경변수 미설정 시 고정 fallback 사용 (보안성 약화 경고 — 프로덕션 설정 필수).
    """
    import hmac
    import hashlib
    import os

    secret = os.environ.get('PIN_HASH_SECRET', '')
    if not secret:
        # 모든 Lambda 함수에서 동일한 값을 사용해야 함 (함수명 등 가변값 사용 금지)
        secret = 'YWt0ZGxUc21zdmx3aw=='
    salt = campaign_id.encode('utf-8')
    return hmac.new(
        secret.encode('utf-8'),
        salt + pin.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()
