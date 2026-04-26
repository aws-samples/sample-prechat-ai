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

import json

import boto3
import os

from utils import lambda_response, parse_body, generate_id
from models.agent_config import AgentConfiguration, LEGACY_ROLE_MAP

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')


def create_config(event, context):
    """에이전트 설정을 생성합니다."""
    body = parse_body(event)

    # tools: 요청 본문에서 JSON 배열로 수신 → JSON 문자열로 저장
    tools_raw = body.get('tools', [])
    if isinstance(tools_raw, list):
        tools = json.dumps(tools_raw, ensure_ascii=False)
    elif isinstance(tools_raw, str):
        tools = tools_raw
    else:
        return lambda_response(400, {'error': 'Invalid tools format'})

    config = AgentConfiguration(
        config_id=generate_id(),
        agent_role=body.get('agentRole', ''),
        model_id=body.get('modelId', 'global.amazon.nova-2-lite-v1:0'),
        system_prompt=body.get('systemPrompt', ''),
        agent_name=body.get('agentName', ''),
        tools=tools,
        i18n=body.get('i18n', 'ko'),
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


def _query_gsi1_by_role(table, role):
    """GSI1에서 특정 역할의 AgentConfig 아이템을 조회합니다."""
    resp = table.query(
        IndexName='GSI1',
        KeyConditionExpression='GSI1PK = :pk',
        ExpressionAttributeValues={
            ':pk': f'AGENTCONFIG#{role}',
        },
    )
    return resp.get('Items', [])


def list_configs(event, context):
    """에이전트 설정 목록을 조회합니다.

    agentRole 필터 시 레거시 역할 자동 매핑을 지원합니다.
    예: agentRole=consultation → consultation, prechat,
        planning, ship GSI도 함께 조회합니다.
    """
    params = event.get('queryStringParameters') or {}
    agent_role = params.get('agentRole')

    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        if agent_role:
            # 요청된 역할에 매핑되는 레거시 역할 수집
            legacy_roles = [
                legacy
                for legacy, mapped in LEGACY_ROLE_MAP.items()
                if mapped == agent_role
            ]
            # 요청 역할 + 레거시 역할 모두 조회
            roles_to_query = [agent_role] + legacy_roles
            items = []
            for role in roles_to_query:
                items.extend(
                    _query_gsi1_by_role(table, role)
                )
        else:
            # 전체 조회
            resp = table.scan(
                FilterExpression=(
                    'begins_with(PK, :prefix) '
                    'AND SK = :sk'
                ),
                ExpressionAttributeValues={
                    ':prefix': 'AGENTCONFIG#',
                    ':sk': 'METADATA',
                },
            )
            items = resp.get('Items', [])

        configs = [
            AgentConfiguration.from_dynamodb_item(i)
            .to_api_response()
            for i in items
        ]
        return lambda_response(
            200,
            {'configs': configs, 'count': len(configs)},
        )
    except Exception as e:
        print(f"Failed to list agent configs: {str(e)}")
        return lambda_response(
            500,
            {'error': 'Failed to list agent configurations'},
        )


def get_config(event, context):
    """에이전트 설정을 조회합니다."""
    path_params = event.get('pathParameters') or {}
    config_id = path_params.get('configId')
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
    path_params = event.get('pathParameters') or {}
    config_id = path_params.get('configId')
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
        if 'tools' in body:
            tools_raw = body['tools']
            if isinstance(tools_raw, list):
                config.tools = json.dumps(
                    tools_raw, ensure_ascii=False
                )
            elif isinstance(tools_raw, str):
                config.tools = tools_raw
            else:
                return lambda_response(
                    400, {'error': 'Invalid tools format'}
                )
        if 'i18n' in body:
            config.i18n = body['i18n']

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
    path_params = event.get('pathParameters') or {}
    config_id = path_params.get('configId')
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
