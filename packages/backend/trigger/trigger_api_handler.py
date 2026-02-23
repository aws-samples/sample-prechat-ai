"""
Trigger Management API Handler

트리거 CRUD 관리 API 엔드포인트입니다.
모든 엔드포인트는 Cognito 인증이 필요합니다.

Endpoints:
  POST   /api/admin/triggers              - 트리거 생성
  GET    /api/admin/triggers              - 트리거 목록
  GET    /api/admin/triggers/{triggerId}  - 트리거 조회
  PUT    /api/admin/triggers/{triggerId}  - 트리거 수정
  DELETE /api/admin/triggers/{triggerId}  - 트리거 삭제
"""

import boto3
import os

from utils import lambda_response, parse_body, get_timestamp, generate_id
from models.trigger import Trigger, VALID_EVENT_TYPES, VALID_TRIGGER_TYPES

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')


def create_trigger(event, context):
    """새로운 트리거를 생성합니다."""
    body = parse_body(event)

    trigger = Trigger(
        trigger_id=generate_id(),
        trigger_type=body.get('triggerType', ''),
        event_type=body.get('eventType', ''),
        delivery_endpoint=body.get('deliveryEndpoint', ''),
        campaign_id=body.get('campaignId'),
        is_global=body.get('isGlobal', False),
        created_at=get_timestamp(),
        updated_at=get_timestamp(),
        created_by=_get_user_id(event),
    )

    errors = trigger.validate()
    if errors:
        return lambda_response(400, {'error': 'Validation failed', 'details': errors})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        table.put_item(Item=trigger.to_dynamodb_item())
        print(f"Trigger created: {trigger.trigger_id}")
        return lambda_response(201, trigger.to_api_response())
    except Exception as e:
        print(f"Failed to create trigger: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create trigger'})


def list_triggers(event, context):
    """트리거 목록을 조회합니다."""
    params = event.get('queryStringParameters') or {}
    campaign_id = params.get('campaignId')
    event_type = params.get('eventType')

    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        if event_type:
            resp = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'EVENT#{event_type}'}
            )
        elif campaign_id:
            resp = table.query(
                IndexName='GSI2',
                KeyConditionExpression='GSI2PK = :pk',
                ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'}
            )
        else:
            resp = table.scan(
                FilterExpression='begins_with(PK, :prefix) AND SK = :sk',
                ExpressionAttributeValues={
                    ':prefix': 'TRIGGER#',
                    ':sk': 'METADATA'
                }
            )

        triggers = []
        for item in resp.get('Items', []):
            if item.get('PK', '').startswith('TRIGGER#'):
                trigger = Trigger.from_dynamodb_item(item)
                triggers.append(trigger.to_api_response())

        return lambda_response(200, {'triggers': triggers, 'count': len(triggers)})
    except Exception as e:
        print(f"Failed to list triggers: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list triggers'})


def get_trigger(event, context):
    """특정 트리거를 조회합니다."""
    trigger_id = event.get('pathParameters', {}).get('triggerId')
    if not trigger_id:
        return lambda_response(400, {'error': 'Missing triggerId'})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.get_item(Key={'PK': f'TRIGGER#{trigger_id}', 'SK': 'METADATA'})

        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Trigger not found'})

        trigger = Trigger.from_dynamodb_item(resp['Item'])
        return lambda_response(200, trigger.to_api_response())
    except Exception as e:
        print(f"Failed to get trigger {trigger_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get trigger'})


def update_trigger(event, context):
    """트리거를 수정합니다."""
    trigger_id = event.get('pathParameters', {}).get('triggerId')
    if not trigger_id:
        return lambda_response(400, {'error': 'Missing triggerId'})

    body = parse_body(event)
    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        resp = table.get_item(Key={'PK': f'TRIGGER#{trigger_id}', 'SK': 'METADATA'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Trigger not found'})
    except Exception as e:
        return lambda_response(500, {'error': 'Database error'})

    existing = Trigger.from_dynamodb_item(resp['Item'])

    if 'deliveryEndpoint' in body:
        existing.delivery_endpoint = body['deliveryEndpoint']
    if 'status' in body:
        existing.status = body['status']
    if 'eventType' in body:
        existing.event_type = body['eventType']
    if 'isGlobal' in body:
        existing.is_global = body['isGlobal']
    if 'campaignId' in body:
        existing.campaign_id = body['campaignId']

    existing.updated_at = get_timestamp()

    errors = existing.validate()
    if errors:
        return lambda_response(400, {'error': 'Validation failed', 'details': errors})

    try:
        table.put_item(Item=existing.to_dynamodb_item())
        print(f"Trigger updated: {trigger_id}")
        return lambda_response(200, existing.to_api_response())
    except Exception as e:
        print(f"Failed to update trigger {trigger_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update trigger'})


def delete_trigger(event, context):
    """트리거를 삭제합니다."""
    trigger_id = event.get('pathParameters', {}).get('triggerId')
    if not trigger_id:
        return lambda_response(400, {'error': 'Missing triggerId'})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)

        resp = table.get_item(Key={'PK': f'TRIGGER#{trigger_id}', 'SK': 'METADATA'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Trigger not found'})

        table.delete_item(Key={'PK': f'TRIGGER#{trigger_id}', 'SK': 'METADATA'})
        print(f"Trigger deleted: {trigger_id}")
        return lambda_response(200, {'message': 'Trigger deleted', 'triggerId': trigger_id})
    except Exception as e:
        print(f"Failed to delete trigger {trigger_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete trigger'})


def _get_user_id(event) -> str:
    """Cognito 인증 정보에서 사용자 ID를 추출합니다."""
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        return claims.get('sub', claims.get('email', 'unknown'))
    except Exception:
        return 'unknown'


def list_sns_topics(event, context):
    """리전 내 SNS 토픽 목록을 반환합니다."""
    try:
        sns = boto3.client('sns')
        topics = []
        next_token = None

        while True:
            kwargs = {}
            if next_token:
                kwargs['NextToken'] = next_token

            resp = sns.list_topics(**kwargs)
            for topic in resp.get('Topics', []):
                arn = topic['TopicArn']
                # ARN에서 토픽 이름 추출
                name = arn.split(':')[-1]
                topics.append({'topicArn': arn, 'topicName': name})

            next_token = resp.get('NextToken')
            if not next_token:
                break

        return lambda_response(200, {'topics': topics, 'count': len(topics)})
    except Exception as e:
        print(f"Failed to list SNS topics: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list SNS topics'})
