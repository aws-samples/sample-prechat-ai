"""
agent_config_handler.py 단위 테스트

테스트 시나리오:
1. create_config: 유효/무효 데이터 처리, tools/i18n 저장, retrieve kb_id 검증
2. update_config: 부분 업데이트 병합, tools/i18n 반영, 존재하지 않는 configId → 404
3. list_configs: 전체 조회, agentRole 필터링, 레거시 역할 자동 매핑
4. get_config: 정상 조회, 존재하지 않는 configId → 404
5. delete_config: 정상 삭제, 존재하지 않는 configId → 404

Requirements: 4.1, 4.2, 4.4, 4.6
"""

import json
import os
import sys
from unittest.mock import patch, MagicMock

# shared 모듈 경로 추가 (agent_config 모델 임포트용)
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
)
# agent 도메인 경로 추가 (agent_config_handler 임포트용)
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), '..')
)

# 핸들러 임포트 전 환경변수 설정
os.environ['SESSIONS_TABLE'] = 'test-sessions-table'
os.environ['AWS_REGION'] = 'ap-northeast-2'

import agent_config_handler as handler  # noqa: E402


# ---------------------------------------------------------------------------
# 헬퍼 함수 (모듈 레벨, _ 접두사)
# ---------------------------------------------------------------------------

def _make_event(body=None, path_params=None, query_params=None):
    """API Gateway Lambda proxy 이벤트를 생성합니다."""
    event = {
        'headers': {'content-type': 'application/json'},
        'pathParameters': path_params,
        'queryStringParameters': query_params,
    }
    if body is not None:
        event['body'] = (
            json.dumps(body) if isinstance(body, dict) else body
        )
    return event


def _parse_response(response):
    """Lambda 응답에서 statusCode와 body를 파싱합니다."""
    status = response['statusCode']
    body = json.loads(response['body'])
    return status, body


def _make_ddb_item(
    config_id='cfg-1',
    agent_role='consultation',
    agent_name='Test Agent',
    system_prompt='sp',
    tools='[]',
    model_id='global.amazon.nova-2-lite-v1:0',
    i18n='ko',
):
    """DynamoDB AgentConfig 아이템을 생성합니다."""
    return {
        'PK': f'AGENTCONFIG#{config_id}',
        'SK': 'METADATA',
        'configId': config_id,
        'agentRole': agent_role,
        'agentName': agent_name,
        'systemPrompt': system_prompt,
        'tools': tools,
        'modelId': model_id,
        'i18n': i18n,
        'GSI1PK': f'AGENTCONFIG#{agent_role}',
        'GSI1SK': f'AGENTCONFIG#{config_id}',
    }



# ===========================================================================
# 1. create_config 테스트 — 유효/무효 데이터 (Requirements 4.1, 4.6)
# ===========================================================================

class TestCreateConfig:
    """create_config 함수 테스트"""

    @patch.object(handler, 'dynamodb')
    def test_creates_valid_consultation_config(self, mock_ddb):
        """유효한 consultation 데이터로 생성 시 201을 반환해야 합니다."""
        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table

        body = {
            'agentRole': 'consultation',
            'agentName': '고객 상담',
            'systemPrompt': '당신은 상담사입니다.',
            'tools': [{'tool_name': 'current_time'}],
            'modelId': 'global.amazon.nova-2-lite-v1:0',
            'i18n': 'ko',
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 201
        assert resp_body['agentRole'] == 'consultation'
        assert resp_body['agentName'] == '고객 상담'
        assert resp_body['i18n'] == 'ko'
        # tools가 리스트 형태로 응답에 포함됨
        assert isinstance(resp_body['tools'], list)
        assert resp_body['tools'][0]['tool_name'] == 'current_time'
        # put_item 호출 확인
        mock_table.put_item.assert_called_once()

    @patch.object(handler, 'dynamodb')
    def test_creates_valid_summary_config(self, mock_ddb):
        """유효한 summary 역할 데이터로 생성되어야 합니다."""
        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table

        body = {
            'agentRole': 'summary',
            'agentName': '요약 에이전트',
            'modelId': 'global.amazon.nova-2-lite-v1:0',
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 201
        assert resp_body['agentRole'] == 'summary'


    @patch.object(handler, 'dynamodb')
    def test_rejects_missing_agent_role(self, mock_ddb):
        """agentRole이 없으면 400 에러를 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        body = {
            'agentName': '이름만',
            'modelId': 'global.amazon.nova-2-lite-v1:0',
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'
        # details에 agent_role 관련 오류 포함
        assert any(
            'agent_role' in d for d in resp_body['details']
        )

    @patch.object(handler, 'dynamodb')
    def test_rejects_invalid_agent_role(self, mock_ddb):
        """유효하지 않은 agentRole은 400 에러를 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        body = {
            'agentRole': 'unknown_role',
            'modelId': 'global.amazon.nova-2-lite-v1:0',
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'

    @patch.object(handler, 'dynamodb')
    def test_rejects_invalid_tools_format(self, mock_ddb):
        """tools가 dict/list/str 외의 타입이면 400을 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        # dict 형태로 tools 전달 → Invalid tools format
        event = _make_event({
            'agentRole': 'consultation',
            'tools': {'not': 'a list'},
        })
        response = handler.create_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Invalid tools format'


    @patch.object(handler, 'dynamodb')
    def test_rejects_malformed_tools_json_string(self, mock_ddb):
        """tools가 잘못된 JSON 문자열이면 400 검증 오류를 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        # 문자열로 전달되지만 파싱 실패 → validate()가 에러 반환
        event = _make_event({
            'agentRole': 'consultation',
            'tools': 'not-valid-json{',
        })
        response = handler.create_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'
        assert any(
            'Invalid tools JSON' in d
            for d in resp_body['details']
        )

    @patch.object(handler, 'dynamodb')
    def test_rejects_retrieve_without_kb_id(self, mock_ddb):
        """retrieve 도구에 kb_id가 없으면 400을 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        body = {
            'agentRole': 'consultation',
            'tools': [{'tool_name': 'retrieve'}],
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'
        assert any(
            'retrieve tool requires kb_id' in d
            for d in resp_body['details']
        )

    @patch.object(handler, 'dynamodb')
    def test_rejects_retrieve_with_empty_kb_id(self, mock_ddb):
        """retrieve 도구의 kb_id가 빈 문자열이면 400을 반환해야 합니다."""
        mock_ddb.Table.return_value = MagicMock()

        body = {
            'agentRole': 'consultation',
            'tools': [{
                'tool_name': 'retrieve',
                'tool_attributes': {'kb_id': ''},
            }],
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'


    @patch.object(handler, 'dynamodb')
    def test_accepts_retrieve_with_valid_kb_id(self, mock_ddb):
        """retrieve 도구 + kb_id 조합은 정상 저장되어야 합니다."""
        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table

        body = {
            'agentRole': 'consultation',
            'tools': [{
                'tool_name': 'retrieve',
                'tool_attributes': {'kb_id': 'KB-ABC123'},
            }],
        }
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 201
        assert resp_body['tools'][0]['tool_name'] == 'retrieve'
        assert (
            resp_body['tools'][0]['tool_attributes']['kb_id']
            == 'KB-ABC123'
        )

    @patch.object(handler, 'dynamodb')
    def test_persists_tools_and_i18n_fields(self, mock_ddb):
        """DynamoDB put_item 호출 시 tools, i18n 필드가 저장되어야 합니다."""
        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table

        body = {
            'agentRole': 'consultation',
            'tools': [
                {'tool_name': 'current_time'},
                {
                    'tool_name': 'retrieve',
                    'tool_attributes': {'kb_id': 'KB-1'},
                },
            ],
            'i18n': 'en',
        }
        handler.create_config(_make_event(body), None)

        # put_item 호출 인자에서 저장된 Item 검증
        saved_item = mock_table.put_item.call_args[1]['Item']
        assert saved_item['i18n'] == 'en'
        # tools는 JSON 문자열로 저장됨
        saved_tools = json.loads(saved_item['tools'])
        assert len(saved_tools) == 2
        assert saved_tools[0]['tool_name'] == 'current_time'
        # GSI 키도 올바르게 저장됨
        assert saved_item['GSI1PK'] == 'AGENTCONFIG#consultation'


    @patch.object(handler, 'dynamodb')
    def test_returns_500_on_ddb_error(self, mock_ddb):
        """DynamoDB 쓰기 실패 시 500을 반환해야 합니다."""
        mock_table = MagicMock()
        mock_table.put_item.side_effect = Exception(
            'DynamoDB error'
        )
        mock_ddb.Table.return_value = mock_table

        body = {'agentRole': 'consultation'}
        response = handler.create_config(_make_event(body), None)
        status, resp_body = _parse_response(response)

        assert status == 500
        assert resp_body['error'] == (
            'Failed to create agent configuration'
        )


# ===========================================================================
# 2. update_config 테스트 — 부분 업데이트 병합 (Requirements 4.4, 4.6)
# ===========================================================================

class TestUpdateConfig:
    """update_config 함수 테스트"""

    @patch.object(handler, 'dynamodb')
    def test_returns_404_when_config_not_found(self, mock_ddb):
        """존재하지 않는 configId는 404를 반환해야 합니다."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # Item 없음
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            body={'agentName': 'new'},
            path_params={'configId': 'missing-id'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 404
        assert resp_body['error'] == (
            'Agent configuration not found'
        )

    @patch.object(handler, 'dynamodb')
    def test_rejects_missing_config_id(self, mock_ddb):
        """configId 경로 파라미터가 없으면 400을 반환해야 합니다."""
        event = _make_event(
            body={'agentName': 'new'}, path_params=None
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Missing configId'


    @patch.object(handler, 'dynamodb')
    def test_partial_update_preserves_unchanged_fields(
        self, mock_ddb
    ):
        """부분 업데이트 시 명시되지 않은 필드는 보존되어야 합니다."""
        mock_table = MagicMock()
        existing = _make_ddb_item(
            config_id='cfg-1',
            agent_name='기존 이름',
            system_prompt='기존 프롬프트',
            i18n='ko',
        )
        mock_table.get_item.return_value = {'Item': existing}
        mock_ddb.Table.return_value = mock_table

        # agentName만 업데이트
        event = _make_event(
            body={'agentName': '새 이름'},
            path_params={'configId': 'cfg-1'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['agentName'] == '새 이름'
        # 나머지 필드 보존
        assert resp_body['systemPrompt'] == '기존 프롬프트'
        assert resp_body['i18n'] == 'ko'
        assert resp_body['agentRole'] == 'consultation'

    @patch.object(handler, 'dynamodb')
    def test_updates_tools_field(self, mock_ddb):
        """tools 필드 업데이트가 반영되어야 합니다."""
        mock_table = MagicMock()
        existing = _make_ddb_item(config_id='cfg-2', tools='[]')
        mock_table.get_item.return_value = {'Item': existing}
        mock_ddb.Table.return_value = mock_table

        new_tools = [
            {'tool_name': 'current_time'},
            {
                'tool_name': 'retrieve',
                'tool_attributes': {'kb_id': 'KB-99'},
            },
        ]
        event = _make_event(
            body={'tools': new_tools},
            path_params={'configId': 'cfg-2'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert len(resp_body['tools']) == 2
        assert resp_body['tools'][1]['tool_name'] == 'retrieve'


    @patch.object(handler, 'dynamodb')
    def test_updates_i18n_field(self, mock_ddb):
        """i18n 필드 업데이트가 반영되어야 합니다."""
        mock_table = MagicMock()
        existing = _make_ddb_item(config_id='cfg-3', i18n='ko')
        mock_table.get_item.return_value = {'Item': existing}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            body={'i18n': 'en'},
            path_params={'configId': 'cfg-3'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['i18n'] == 'en'

    @patch.object(handler, 'dynamodb')
    def test_update_rejects_invalid_tools_format(self, mock_ddb):
        """업데이트 시 tools가 유효하지 않은 타입이면 400을 반환해야 합니다."""
        mock_table = MagicMock()
        existing = _make_ddb_item(config_id='cfg-4')
        mock_table.get_item.return_value = {'Item': existing}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            body={'tools': 12345},  # int는 허용되지 않음
            path_params={'configId': 'cfg-4'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Invalid tools format'

    @patch.object(handler, 'dynamodb')
    def test_update_rejects_retrieve_without_kb_id(self, mock_ddb):
        """업데이트 시 retrieve 도구에 kb_id가 없으면 400을 반환해야 합니다."""
        mock_table = MagicMock()
        existing = _make_ddb_item(config_id='cfg-5')
        mock_table.get_item.return_value = {'Item': existing}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            body={'tools': [{'tool_name': 'retrieve'}]},
            path_params={'configId': 'cfg-5'},
        )
        response = handler.update_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Validation failed'



# ===========================================================================
# 3. list_configs 테스트 — 역할 필터링 (Requirements 4.2, 15.3)
# ===========================================================================

class TestListConfigs:
    """list_configs 함수 테스트"""

    @patch.object(handler, 'dynamodb')
    def test_lists_all_configs_without_filter(self, mock_ddb):
        """agentRole 필터 없이 전체 조회 시 scan으로 모든 항목 반환."""
        mock_table = MagicMock()
        items = [
            _make_ddb_item(config_id='c1', agent_role='consultation'),
            _make_ddb_item(config_id='c2', agent_role='summary'),
        ]
        mock_table.scan.return_value = {'Items': items}
        mock_ddb.Table.return_value = mock_table

        response = handler.list_configs(_make_event(), None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['count'] == 2
        assert len(resp_body['configs']) == 2
        # scan이 호출되었는지 검증
        mock_table.scan.assert_called_once()

    @patch.object(handler, 'dynamodb')
    def test_filters_by_summary_role(self, mock_ddb):
        """agentRole=summary 필터 시 GSI1로 summary만 조회."""
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [_make_ddb_item(
                config_id='s1', agent_role='summary'
            )]
        }
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            query_params={'agentRole': 'summary'}
        )
        response = handler.list_configs(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['count'] == 1
        assert resp_body['configs'][0]['agentRole'] == 'summary'
        # summary 역할은 레거시 매핑이 없으므로 query 한번만 호출
        assert mock_table.query.call_count == 1


    @patch.object(handler, 'dynamodb')
    def test_consultation_filter_queries_legacy_roles(
        self, mock_ddb
    ):
        """consultation 필터 시 레거시 역할(prechat/planning/ship)도 함께 조회."""
        mock_table = MagicMock()

        # 각 역할별로 다른 아이템 반환
        def query_side_effect(**kwargs):
            pk = kwargs['ExpressionAttributeValues'][':pk']
            role = pk.replace('AGENTCONFIG#', '')
            return {
                'Items': [_make_ddb_item(
                    config_id=f'{role}-1', agent_role=role
                )]
            }

        mock_table.query.side_effect = query_side_effect
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            query_params={'agentRole': 'consultation'}
        )
        response = handler.list_configs(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        # consultation + prechat + planning + ship = 4개 조회
        assert mock_table.query.call_count == 4
        assert resp_body['count'] == 4
        # 레거시 역할은 from_dynamodb_item에서 consultation으로 매핑됨
        returned_roles = {
            c['agentRole'] for c in resp_body['configs']
        }
        assert returned_roles == {'consultation'}

    @patch.object(handler, 'dynamodb')
    def test_consultation_filter_queries_all_legacy_keys(
        self, mock_ddb
    ):
        """consultation 필터 시 4개 GSI 키 모두 쿼리되어야 합니다."""
        mock_table = MagicMock()
        mock_table.query.return_value = {'Items': []}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            query_params={'agentRole': 'consultation'}
        )
        handler.list_configs(event, None)

        # 쿼리된 PK 값 수집
        queried_pks = [
            call.kwargs['ExpressionAttributeValues'][':pk']
            for call in mock_table.query.call_args_list
        ]
        assert 'AGENTCONFIG#consultation' in queried_pks
        assert 'AGENTCONFIG#prechat' in queried_pks
        assert 'AGENTCONFIG#planning' in queried_pks
        assert 'AGENTCONFIG#ship' in queried_pks


    @patch.object(handler, 'dynamodb')
    def test_returns_500_on_scan_error(self, mock_ddb):
        """scan 실패 시 500을 반환해야 합니다."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception('Scan failed')
        mock_ddb.Table.return_value = mock_table

        response = handler.list_configs(_make_event(), None)
        status, resp_body = _parse_response(response)

        assert status == 500
        assert resp_body['error'] == (
            'Failed to list agent configurations'
        )


# ===========================================================================
# 4. get_config 테스트 — 조회 및 404 (Requirements 4.3, 4.7)
# ===========================================================================

class TestGetConfig:
    """get_config 함수 테스트"""

    @patch.object(handler, 'dynamodb')
    def test_returns_config_when_exists(self, mock_ddb):
        """존재하는 configId 조회 시 200과 설정을 반환해야 합니다."""
        mock_table = MagicMock()
        item = _make_ddb_item(
            config_id='cfg-get',
            agent_role='consultation',
            agent_name='조회 테스트',
        )
        mock_table.get_item.return_value = {'Item': item}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(path_params={'configId': 'cfg-get'})
        response = handler.get_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['configId'] == 'cfg-get'
        assert resp_body['agentName'] == '조회 테스트'

    @patch.object(handler, 'dynamodb')
    def test_returns_404_when_not_found(self, mock_ddb):
        """존재하지 않는 configId 조회 시 404를 반환해야 합니다."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(path_params={'configId': 'nope'})
        response = handler.get_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 404
        assert resp_body['error'] == (
            'Agent configuration not found'
        )


    def test_rejects_missing_config_id(self):
        """configId 경로 파라미터 없으면 400을 반환해야 합니다."""
        event = _make_event(path_params=None)
        response = handler.get_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Missing configId'

    @patch.object(handler, 'dynamodb')
    def test_maps_legacy_role_on_get(self, mock_ddb):
        """레거시 역할(prechat)로 저장된 아이템은 consultation으로 매핑."""
        mock_table = MagicMock()
        item = _make_ddb_item(
            config_id='legacy', agent_role='prechat'
        )
        mock_table.get_item.return_value = {'Item': item}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(path_params={'configId': 'legacy'})
        response = handler.get_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        # from_dynamodb_item이 레거시 역할을 자동 매핑
        assert resp_body['agentRole'] == 'consultation'


# ===========================================================================
# 5. delete_config 테스트 — 삭제 및 404 (Requirement 4.5, 4.7)
# ===========================================================================

class TestDeleteConfig:
    """delete_config 함수 테스트"""

    @patch.object(handler, 'dynamodb')
    def test_deletes_existing_config(self, mock_ddb):
        """존재하는 configId 삭제 시 200과 성공 메시지 반환."""
        mock_table = MagicMock()
        item = _make_ddb_item(config_id='to-delete')
        mock_table.get_item.return_value = {'Item': item}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(
            path_params={'configId': 'to-delete'}
        )
        response = handler.delete_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 200
        assert resp_body['configId'] == 'to-delete'
        # delete_item이 올바른 키로 호출됨
        mock_table.delete_item.assert_called_once_with(
            Key={
                'PK': 'AGENTCONFIG#to-delete',
                'SK': 'METADATA',
            }
        )


    @patch.object(handler, 'dynamodb')
    def test_returns_404_when_not_found(self, mock_ddb):
        """존재하지 않는 configId 삭제 시 404를 반환해야 합니다."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_ddb.Table.return_value = mock_table

        event = _make_event(path_params={'configId': 'missing'})
        response = handler.delete_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 404
        assert resp_body['error'] == (
            'Agent configuration not found'
        )
        # 존재하지 않으면 delete_item은 호출되지 않아야 함
        mock_table.delete_item.assert_not_called()

    def test_rejects_missing_config_id(self):
        """configId 경로 파라미터 없으면 400을 반환해야 합니다."""
        event = _make_event(path_params=None)
        response = handler.delete_config(event, None)
        status, resp_body = _parse_response(response)

        assert status == 400
        assert resp_body['error'] == 'Missing configId'
