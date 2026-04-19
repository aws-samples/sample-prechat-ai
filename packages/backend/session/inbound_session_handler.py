# nosemgrep
"""인바운드 캠페인 세션 핸들러

익명 유저가 캠페인 코드 + PIN으로 접근하여 세션을 생성하는 플로우.
전화번호 기반 캠페인 내 중복 세션 방지 포함.
"""
import boto3
import os
import re
import logging
from botocore.exceptions import ClientError
from utils import (
    lambda_response, parse_body, get_timestamp,
    generate_session_id, get_ttl_timestamp, generate_csrf_token,
    secure_compare, hash_campaign_pin,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE')


def _normalize_phone(phone: str) -> str:
    """전화번호를 숫자만 추출하여 정규화."""
    return re.sub(r'\D', '', phone)


def _validate_phone(phone: str) -> bool:
    """전화번호 유효성 검사 (7~15자리 숫자)."""
    normalized = _normalize_phone(phone)
    return 7 <= len(normalized) <= 15


def _get_inbound_campaign(campaign_code: str) -> dict | None:
    """캠페인 코드로 인바운드 캠페인 조회."""
    campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
    resp = campaigns_table.query(
        IndexName='CampaignCodeIndex',
        KeyConditionExpression='campaignCode = :code',
        ExpressionAttributeValues={':code': campaign_code}
    )
    items = resp.get('Items', [])
    if not items:
        return None
    campaign = items[0]
    if campaign.get('campaignType') != 'inbound':
        return None
    return campaign


def _find_existing_session(campaign_id: str, phone_normalized: str) -> dict | None:
    """동일 캠페인 내 동일 전화번호 기존 세션 조회 (GSI3)."""
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    gsi3_pk = f'INBOUND#{campaign_id}#PHONE#{phone_normalized}'
    resp = sessions_table.query(
        IndexName='GSI3',
        KeyConditionExpression='GSI3PK = :pk',
        ExpressionAttributeValues={':pk': gsi3_pk},
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def get_inbound_campaign_info(event, context):
    """GET /api/inbound/{campaignCode} - 캠페인 공개 정보 조회 (PIN 제외)."""
    try:
        campaign_code = event.get('pathParameters', {}).get('campaignCode', '')
        if not campaign_code:
            return lambda_response(400, {'error': 'Campaign code is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign code'})

    try:
        campaign = _get_inbound_campaign(campaign_code)
        if not campaign:
            return lambda_response(404, {'error': 'Inbound campaign not found'})
        if campaign.get('status') != 'active':
            return lambda_response(403, {'error': 'Campaign is not active'})

        return lambda_response(200, {
            'campaignId': campaign['campaignId'],
            'campaignName': campaign.get('campaignName', ''),
            'campaignCode': campaign_code,
            'description': campaign.get('description', ''),
            'startDate': campaign.get('startDate', ''),
            'endDate': campaign.get('endDate', ''),
        })
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaign info'})


def create_inbound_session(event, context):
    """POST /api/inbound/{campaignCode}/sessions - 고객 자가 세션 생성."""
    try:
        campaign_code = event.get('pathParameters', {}).get('campaignCode', '')
        if not campaign_code:
            return lambda_response(400, {'error': 'Campaign code is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign code'})

    body = parse_body(event)
    customer_name = (body.get('customerName') or '').strip()
    customer_email = (body.get('customerEmail') or '').strip()
    customer_company = (body.get('customerCompany') or '').strip()
    customer_phone = (body.get('customerPhone') or '').strip()
    pin_input = (body.get('pinNumber') or '').strip()

    if not all([customer_name, customer_email, customer_company, customer_phone, pin_input]):
        return lambda_response(400, {'error': 'Missing required fields'})

    # 입력값 길이 제한 (DoS 방어)
    if len(customer_name) > 100:
        return lambda_response(400, {'error': 'customerName too long (max 100)'})
    if len(customer_email) > 254:
        return lambda_response(400, {'error': 'customerEmail too long (max 254)'})
    if len(customer_company) > 200:
        return lambda_response(400, {'error': 'customerCompany too long (max 200)'})
    if len(customer_phone) > 20:
        return lambda_response(400, {'error': 'customerPhone too long (max 20)'})

    if not _validate_phone(customer_phone):
        return lambda_response(400, {'error': 'Invalid phone number format'})

    return _create_inbound_session_inner(
        campaign_code, customer_name, customer_email,
        customer_company, customer_phone, pin_input,
    )


def _create_inbound_session_inner(
    campaign_code, customer_name, customer_email,
    customer_company, customer_phone, pin_input,
):
    """인바운드 세션 생성 내부 로직 - 복잡도 분리."""
    try:
        campaign = _get_inbound_campaign(campaign_code)
        if not campaign:
            return lambda_response(404, {'error': 'Inbound campaign not found'})
        if campaign.get('status') != 'active':
            return lambda_response(403, {'error': 'Campaign is not active'})

        campaign_id = campaign['campaignId']

        # PIN 검증: 해시 우선, 평문 fallback (마이그레이션 호환)
        stored_hash = campaign.get('campaignPinHash', '')
        if stored_hash:
            input_hash = hash_campaign_pin(pin_input, campaign_id)
            logger.info(
                f"PIN verify (hashed) campaign={campaign_id} "
                f"input_hash_prefix={input_hash[:8]} stored_hash_prefix={stored_hash[:8]}"
            )
            if not secure_compare(input_hash, stored_hash):
                return lambda_response(401, {'error': 'Invalid PIN'})
        else:
            # 레거시: 해시가 아직 없는 캠페인은 평문 비교
            legacy_pin = campaign.get('campaignPin', '')
            logger.info(
                f"PIN verify (legacy) campaign={campaign_id} "
                f"has_legacy_pin={bool(legacy_pin)}"
            )
            if not legacy_pin or not secure_compare(pin_input, legacy_pin):
                return lambda_response(401, {'error': 'Invalid PIN'})

        phone_normalized = _normalize_phone(customer_phone)

        existing = _find_existing_session(campaign_id, phone_normalized)
        if existing:
            session_id = existing['sessionId']
            logger.info(f"Returning existing inbound session {session_id} for campaign {campaign_id}")
            return lambda_response(200, {
                'sessionId': session_id,
                'sessionUrl': f'/customer/{session_id}',
                'csrfToken': existing.get('csrfToken', ''),
                'isExisting': True,
                'campaignId': campaign_id,
                'campaignName': campaign.get('campaignName', ''),
            })

        return _create_new_inbound_session(
            campaign, campaign_id, phone_normalized,
            customer_name, customer_email, customer_company, customer_phone,
        )
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error creating inbound session: {error_code}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error creating inbound session: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create session'})


def _create_new_inbound_session(
    campaign, campaign_id, phone_normalized,
    customer_name, customer_email, customer_company, customer_phone,
):
    """신규 인바운드 세션 생성."""
    session_id = generate_session_id(customer_email)
    timestamp = get_timestamp()
    csrf_token = generate_csrf_token()
    gsi3_pk = f'INBOUND#{campaign_id}#PHONE#{phone_normalized}'

    session_record = {
        'PK': f'SESSION#{session_id}',
        'SK': 'METADATA',
        'sessionId': session_id,
        'status': 'active',
        'campaignType': 'inbound',
        'customerInfo': {
            'name': customer_name,
            'email': customer_email,
            'company': customer_company,
            'phone': customer_phone,
        },
        'salesRepEmail': campaign.get('ownerEmail', ''),
        'agentId': campaign.get('agentConfigurations', {}).get('prechat', ''),
        'csrfToken': csrf_token,
        'createdAt': timestamp,
        'ttl': get_ttl_timestamp(30),
        'campaignId': campaign_id,
        'campaignName': campaign.get('campaignName', ''),
        'GSI1PK': f'SALESREP#{campaign.get("ownerEmail", "")}',
        'GSI1SK': f'SESSION#{timestamp}',
        'GSI2PK': f'CAMPAIGN#{campaign_id}',
        'GSI2SK': f'SESSION#{timestamp}',
        'GSI3PK': gsi3_pk,
        'GSI3SK': f'SESSION#{timestamp}',
    }

    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    sessions_table.put_item(Item=session_record)
    logger.info(f"Created inbound session {session_id} for campaign {campaign_id}")

    return lambda_response(201, {
        'sessionId': session_id,
        'sessionUrl': f'/customer/{session_id}',
        'csrfToken': csrf_token,
        'isExisting': False,
        'campaignId': campaign_id,
        'campaignName': campaign.get('campaignName', ''),
    })
