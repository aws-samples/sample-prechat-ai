"""
Agent Configuration API Handler

에이전트 설정 CRUD 관리 API입니다. Cognito 인증 필요.

Endpoints:
  POST   /api/admin/agent-configs              - 설정 생성
  GET    /api/admin/agent-configs              - 설정 목록
  GET    /api/admin/agent-configs/{configId}   - 설정 조회
  PUT    /api/admin/agent-configs/{configId}   - 설정 수정
  DELETE /api/admin/agent-configs/{configId}   - 설정 삭제
"""

import boto3
import os

from utils import lambda_response, parse_body, get_timestamp, generate_id
from models.agent_config import AgentConfiguration, AgentCapabilities

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')


def create_config(event, context):
    """에이전트 설정을 생성합니다."""
    body = parse_body(event)
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    created_by = claims.get('sub', claims.get('email', 'unknown'))
    timestamp = get_timestamp()

    config = AgentConfiguration(
        config_id=generate_id(),
        agent_role=body.get('agentRole', ''),
        campaign_id=body.get('campaignId', ''),
        agent_runtime_arn=body.get('agentRuntimeArn', ''),
        model_id=body.get('modelId', 'us.anthropic.claude-sonnet-4-20250514-v1:0'),
        system_prompt=body.get('systemPrompt', ''),
        agent_name=body.get('agentName', ''),
        capabilities=AgentCapabilities.from_dict(body.get('capabilities', {})),
        created_at=timestamp,
        updated_at=timestamp,
        created_by=created_by,
    )

    errors = config.validate()
    if errors:
        return lambda_response(400, {'error': 'Validation failed', 'details': errors})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        table.put_item(Item=config.to_dynamodb_item())
        return lambda_response(201, config.to_api_response())
    except Exception as e:
        print(f"Failed to create agent config: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create agent configuration'})


def list_configs(event, context):
    """에이전트 설정 목록을 조회합니다."""
    params = event.get('queryStringParameters') or {}
    campaign_id = params.get('campaignId')

    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        if campaign_id:
            resp = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'}
            )
            items = [i for i in resp.get('Items', []) if i.get('PK', '').startswith('AGENTCONFIG#')]
        else:
            resp = table.scan(
                FilterExpression='begins_with(PK, :prefix) AND SK = :sk',
                ExpressionAttributeValues={':prefix': 'AGENTCONFIG#', ':sk': 'METADATA'}
            )
            items = resp.get('Items', [])

        configs = [AgentConfiguration.from_dynamodb_item(i).to_api_response() for i in items]
        return lambda_response(200, {'configs': configs, 'count': len(configs)})
    except Exception as e:
        print(f"Failed to list agent configs: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list agent configurations'})


def get_config(event, context):
    """에이전트 설정을 조회합니다."""
    config_id = event.get('pathParameters', {}).get('configId')
    if not config_id:
        return lambda_response(400, {'error': 'Missing configId'})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Agent configuration not found'})

        config = AgentConfiguration.from_dynamodb_item(resp['Item'])
        return lambda_response(200, config.to_api_response())
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to get agent configuration'})


def update_config(event, context):
    """에이전트 설정을 수정합니다."""
    config_id = event.get('pathParameters', {}).get('configId')
    if not config_id:
        return lambda_response(400, {'error': 'Missing configId'})

    body = parse_body(event)
    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        resp = table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Agent configuration not found'})

        config = AgentConfiguration.from_dynamodb_item(resp['Item'])

        if 'modelId' in body:
            config.model_id = body['modelId']
        if 'systemPrompt' in body:
            config.system_prompt = body['systemPrompt']
        if 'agentName' in body:
            config.agent_name = body['agentName']
        if 'agentRuntimeArn' in body:
            config.agent_runtime_arn = body['agentRuntimeArn']
        if 'capabilities' in body:
            config.capabilities = AgentCapabilities.from_dict(body['capabilities'])
        if 'status' in body:
            config.status = body['status']

        config.updated_at = get_timestamp()

        errors = config.validate()
        if errors:
            return lambda_response(400, {'error': 'Validation failed', 'details': errors})

        table.put_item(Item=config.to_dynamodb_item())
        return lambda_response(200, config.to_api_response())
    except Exception as e:
        print(f"Failed to update agent config: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update agent configuration'})


def delete_config(event, context):
    """에이전트 설정을 삭제합니다."""
    config_id = event.get('pathParameters', {}).get('configId')
    if not config_id:
        return lambda_response(400, {'error': 'Missing configId'})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Agent configuration not found'})

        table.delete_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
        return lambda_response(200, {'message': 'Agent configuration deleted', 'configId': config_id})
    except Exception as e:
        return lambda_response(500, {'error': 'Failed to delete agent configuration'})
