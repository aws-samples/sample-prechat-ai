"""
agent_config_handler.py 통합 테스트 (moto 기반)

moto의 @mock_aws 데코레이터를 사용하여 실제 in-memory DynamoDB를
스핀업하고, CRUD API 엔드포인트의 전체 플로우를 검증합니다.

테스트 시나리오:
1. CRUD 전체 플로우: create → get → list → update → delete
2. 캠페인 생성 시 AgentConfig 참조 검증 (validate_agent_configurations)
3. 레거시 역할 필터링 end-to-end (prechat/planning/ship → consultation)

Requirements: 4.1-4.7, 11.2, 11.3
"""

import json
import os
import sys

import boto3
import pytest
from moto import mock_aws

# shared 모듈 경로 추가 (agent_config 모델 임포트용)
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
)
# agent 도메인 경로 추가 (agent_config_handler 임포트용)
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), '..')
)
# campaign 도메인 경로 추가 (validate_agent_configurations 임포트용)
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), '..', '..', 'campaign'),
)

# 핸들러 임포트 전 환경변수 설정 (moto가 실제 AWS 호출을 가로채도록)
os.environ['SESSIONS_TABLE'] = 'test-sessions-table'
os.environ['CAMPAIGNS_TABLE'] = 'test-campaigns-table'
os.environ['AWS_REGION'] = 'us-east-1'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
os.environ['AWS_SESSION_TOKEN'] = 'testing'


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


def _create_sessions_table(dynamodb_resource):
    """production과 동일한 스키마로 SessionsTable을 생성합니다.

    PK, SK, GSI1(PK/SK) 스키마를 모방합니다.
    (GSI2, GSI3는 AgentConfig 테스트와 무관하므로 생략)
    """
    table = dynamodb_resource.create_table(
        TableName='test-sessions-table',
        KeySchema=[
            {'AttributeName': 'PK', 'KeyType': 'HASH'},
            {'AttributeName': 'SK', 'KeyType': 'RANGE'},
        ],
        AttributeDefinitions=[
            {'AttributeName': 'PK', 'AttributeType': 'S'},
            {'AttributeName': 'SK', 'AttributeType': 'S'},
            {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
            {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'GSI1',
                'KeySchema': [
                    {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
                ],
                'Projection': {'ProjectionType': 'ALL'},
            },
        ],
        BillingMode='PAY_PER_REQUEST',
    )
    table.wait_until_exists()
    return table


def _put_agentconfig_item(
    table,
    config_id,
    agent_role,
    agent_name='Test Agent',
    tools='[]',
    i18n='ko',
):
    """테스트용 AgentConfig 아이템을 직접 DynamoDB에 삽입합니다.

    레거시 역할 테스트에서 핸들러를 거치지 않고 직접
    prechat/planning/ship 역할 아이템을 넣기 위해 사용합니다.
    """
    table.put_item(
        Item={
            'PK': f'AGENTCONFIG#{config_id}',
            'SK': 'METADATA',
            'configId': config_id,
            'agentRole': agent_role,
            'agentName': agent_name,
            'systemPrompt': 'test prompt',
            'tools': tools,
            'modelId': 'global.amazon.nova-2-lite-v1:0',
            'i18n': i18n,
            'GSI1PK': f'AGENTCONFIG#{agent_role}',
            'GSI1SK': f'AGENTCONFIG#{config_id}',
        }
    )


# ---------------------------------------------------------------------------
# pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def aws_mock():
    """moto @mock_aws 컨텍스트를 fixture로 노출합니다."""
    with mock_aws():
        yield


@pytest.fixture
def sessions_table(aws_mock):
    """in-memory DynamoDB에 SessionsTable을 생성합니다."""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = _create_sessions_table(dynamodb)
    yield table


@pytest.fixture
def handler(sessions_table):
    """agent_config_handler를 임포트하고 모듈의 dynamodb 리소스를
    moto 리소스로 재바인딩합니다.

    agent_config_handler는 모듈 로드 시 dynamodb = boto3.resource(...)로
    초기화되지만, 모듈이 처음 로드될 때는 moto context가 없을 수 있으므로
    fixture에서 moto 활성 상태에서 다시 로드/재바인딩합니다.
    """
    # 이미 로드된 경우 캐시 제거
    for mod_name in list(sys.modules.keys()):
        if mod_name == 'agent_config_handler':
            del sys.modules[mod_name]

    import agent_config_handler as h

    # moto의 dynamodb resource로 재바인딩
    h.dynamodb = boto3.resource(
        'dynamodb', region_name='us-east-1'
    )
    yield h


# ===========================================================================
# 1. CRUD 전체 플로우 통합 테스트 (Requirements 4.1, 4.2, 4.3, 4.4, 4.5)
# ===========================================================================

class TestCrudEndToEnd:
    """create → get → list → update → delete 전체 플로우 통합 테스트.

    실제 moto DynamoDB를 사용하여 핸들러가 DB 상태와 올바르게
    상호작용하는지 검증합니다.
    """

    def test_full_crud_lifecycle(self, handler, sessions_table):
        """CRUD 생명주기 전체가 올바르게 동작해야 합니다."""
        # ---------- 1) CREATE ----------
        create_body = {
            'agentRole': 'consultation',
            'agentName': '통합 테스트 에이전트',
            'systemPrompt': '당신은 상담사입니다.',
            'tools': [
                {'tool_name': 'current_time'},
                {
                    'tool_name': 'retrieve',
                    'tool_attributes': {'kb_id': 'KB-INT-1'},
                },
            ],
            'modelId': 'global.amazon.nova-2-lite-v1:0',
            'i18n': 'ko',
        }
        create_resp = handler.create_config(
            _make_event(create_body), None
        )
        status, created = _parse_response(create_resp)
        assert status == 201
        config_id = created['configId']
        assert created['agentRole'] == 'consultation'
        assert created['agentName'] == '통합 테스트 에이전트'
        assert len(created['tools']) == 2

        # DB에 실제 아이템이 저장되었는지 직접 확인
        db_item = sessions_table.get_item(
            Key={
                'PK': f'AGENTCONFIG#{config_id}',
                'SK': 'METADATA',
            }
        ).get('Item')
        assert db_item is not None
        assert db_item['agentRole'] == 'consultation'
        # GSI1 키가 올바르게 저장되었는지 확인
        assert (
            db_item['GSI1PK'] == 'AGENTCONFIG#consultation'
        )

        # ---------- 2) GET ----------
        get_resp = handler.get_config(
            _make_event(path_params={'configId': config_id}),
            None,
        )
        status, fetched = _parse_response(get_resp)
        assert status == 200
        assert fetched['configId'] == config_id
        assert fetched['agentName'] == '통합 테스트 에이전트'
        assert fetched['i18n'] == 'ko'
        # retrieve 도구의 kb_id가 보존되어야 함
        retrieve_tool = next(
            t for t in fetched['tools']
            if t['tool_name'] == 'retrieve'
        )
        assert retrieve_tool['tool_attributes']['kb_id'] == (
            'KB-INT-1'
        )

        # ---------- 3) LIST ----------
        list_resp = handler.list_configs(_make_event(), None)
        status, listed = _parse_response(list_resp)
        assert status == 200
        assert listed['count'] == 1
        assert listed['configs'][0]['configId'] == config_id

        # ---------- 4) UPDATE ----------
        update_body = {
            'agentName': '업데이트된 이름',
            'i18n': 'en',
        }
        update_resp = handler.update_config(
            _make_event(
                body=update_body,
                path_params={'configId': config_id},
            ),
            None,
        )
        status, updated = _parse_response(update_resp)
        assert status == 200
        assert updated['agentName'] == '업데이트된 이름'
        assert updated['i18n'] == 'en'
        # 미수정 필드는 보존되어야 함
        assert updated['agentRole'] == 'consultation'
        assert len(updated['tools']) == 2

        # DB에도 반영되었는지 확인
        db_item_after_update = sessions_table.get_item(
            Key={
                'PK': f'AGENTCONFIG#{config_id}',
                'SK': 'METADATA',
            }
        ).get('Item')
        assert db_item_after_update['agentName'] == (
            '업데이트된 이름'
        )
        assert db_item_after_update['i18n'] == 'en'

        # ---------- 5) DELETE ----------
        delete_resp = handler.delete_config(
            _make_event(path_params={'configId': config_id}),
            None,
        )
        status, del_body = _parse_response(delete_resp)
        assert status == 200
        assert del_body['configId'] == config_id

        # DB에서 실제로 삭제되었는지 확인
        db_item_after_delete = sessions_table.get_item(
            Key={
                'PK': f'AGENTCONFIG#{config_id}',
                'SK': 'METADATA',
            }
        ).get('Item')
        assert db_item_after_delete is None

        # 삭제 후 get/delete는 404를 반환해야 함
        second_get = handler.get_config(
            _make_event(path_params={'configId': config_id}),
            None,
        )
        assert second_get['statusCode'] == 404


    def test_create_summary_and_consultation_separately(
        self, handler, sessions_table
    ):
        """서로 다른 역할의 설정이 독립적으로 저장되어야 합니다."""
        # consultation 생성
        c_resp = handler.create_config(
            _make_event({
                'agentRole': 'consultation',
                'agentName': '상담',
                'tools': [{'tool_name': 'current_time'}],
            }),
            None,
        )
        _, c_created = _parse_response(c_resp)

        # summary 생성
        s_resp = handler.create_config(
            _make_event({
                'agentRole': 'summary',
                'agentName': '요약',
            }),
            None,
        )
        _, s_created = _parse_response(s_resp)

        # 전체 list는 2개
        _, all_configs = _parse_response(
            handler.list_configs(_make_event(), None)
        )
        assert all_configs['count'] == 2

        # summary 필터 → summary만
        _, summary_only = _parse_response(
            handler.list_configs(
                _make_event(
                    query_params={'agentRole': 'summary'}
                ),
                None,
            )
        )
        assert summary_only['count'] == 1
        assert (
            summary_only['configs'][0]['configId']
            == s_created['configId']
        )

        # consultation 필터 → consultation만
        _, consult_only = _parse_response(
            handler.list_configs(
                _make_event(
                    query_params={
                        'agentRole': 'consultation'
                    }
                ),
                None,
            )
        )
        assert consult_only['count'] == 1
        assert (
            consult_only['configs'][0]['configId']
            == c_created['configId']
        )


# ===========================================================================
# 2. 레거시 역할 필터링 end-to-end 통합 테스트 (Requirement 11.3, 15.3)
# ===========================================================================

class TestLegacyRoleFiltering:
    """레거시 역할(prechat/planning/ship) 아이템을 직접 DB에 삽입한 뒤,
    consultation 필터로 조회 시 포함되는지 end-to-end로 검증합니다.
    """

    def test_consultation_filter_includes_all_legacy_roles(
        self, handler, sessions_table
    ):
        """consultation 필터 시 prechat/planning/ship 아이템이
        모두 포함되어 반환되고, agentRole은 consultation으로
        정규화되어야 합니다.
        """
        # 레거시 역할 아이템 각각 직접 삽입
        _put_agentconfig_item(
            sessions_table, 'legacy-prechat-1', 'prechat',
            agent_name='레거시 prechat'
        )
        _put_agentconfig_item(
            sessions_table, 'legacy-planning-1', 'planning',
            agent_name='레거시 planning'
        )
        _put_agentconfig_item(
            sessions_table, 'legacy-ship-1', 'ship',
            agent_name='레거시 ship'
        )
        # 신규 역할 아이템도 같이 삽입
        _put_agentconfig_item(
            sessions_table, 'new-consultation-1', 'consultation',
            agent_name='신규 consultation'
        )
        _put_agentconfig_item(
            sessions_table, 'new-summary-1', 'summary',
            agent_name='신규 summary'
        )

        # consultation 필터로 조회
        resp = handler.list_configs(
            _make_event(
                query_params={'agentRole': 'consultation'}
            ),
            None,
        )
        status, body = _parse_response(resp)

        assert status == 200
        # prechat + planning + ship + consultation = 4개
        assert body['count'] == 4

        returned_ids = {
            c['configId'] for c in body['configs']
        }
        assert returned_ids == {
            'legacy-prechat-1',
            'legacy-planning-1',
            'legacy-ship-1',
            'new-consultation-1',
        }

        # 모든 아이템의 agentRole이 consultation으로 정규화되어야 함
        returned_roles = {
            c['agentRole'] for c in body['configs']
        }
        assert returned_roles == {'consultation'}

        # summary 아이템은 포함되지 않아야 함
        assert 'new-summary-1' not in returned_ids

    def test_summary_filter_excludes_legacy_items(
        self, handler, sessions_table
    ):
        """summary 필터는 legacy 역할을 포함하지 않아야 합니다."""
        _put_agentconfig_item(
            sessions_table, 'legacy-prechat-2', 'prechat'
        )
        _put_agentconfig_item(
            sessions_table, 'new-summary-2', 'summary'
        )

        resp = handler.list_configs(
            _make_event(
                query_params={'agentRole': 'summary'}
            ),
            None,
        )
        status, body = _parse_response(resp)

        assert status == 200
        assert body['count'] == 1
        assert (
            body['configs'][0]['configId']
            == 'new-summary-2'
        )
        assert body['configs'][0]['agentRole'] == 'summary'

    def test_list_without_filter_includes_all_legacy(
        self, handler, sessions_table
    ):
        """필터 없이 전체 조회 시 모든 레거시 아이템이 반환되고
        agentRole이 consultation으로 정규화되어야 합니다.
        """
        _put_agentconfig_item(
            sessions_table, 'legacy-prechat-3', 'prechat'
        )
        _put_agentconfig_item(
            sessions_table, 'legacy-planning-3', 'planning'
        )
        _put_agentconfig_item(
            sessions_table, 'new-summary-3', 'summary'
        )

        resp = handler.list_configs(_make_event(), None)
        status, body = _parse_response(resp)

        assert status == 200
        assert body['count'] == 3

        # legacy 아이템의 agentRole은 consultation으로 매핑됨
        legacy_items = [
            c for c in body['configs']
            if c['configId'].startswith('legacy-')
        ]
        assert len(legacy_items) == 2
        for item in legacy_items:
            assert item['agentRole'] == 'consultation'

        # summary는 그대로 유지
        summary_item = next(
            c for c in body['configs']
            if c['configId'] == 'new-summary-3'
        )
        assert summary_item['agentRole'] == 'summary'


# ===========================================================================
# 3. 캠페인의 AgentConfig 참조 검증 통합 테스트 (Requirement 11.2, 11.3)
# ===========================================================================

class TestCampaignAgentConfigValidation:
    """캠페인 생성/수정 시 agentConfigurations 참조가
    실제 AgentConfig의 존재 여부와 역할 일치를 검증하는지
    end-to-end로 테스트합니다.

    validate_agent_configurations 함수만 검증 대상으로 하며,
    캠페인의 다른 로직(Cognito, CampaignCode 중복 검증 등)은
    이 테스트의 관심 대상이 아닙니다.
    """

    @pytest.fixture
    def campaign_validator(self, sessions_table):
        """campaign_handler의 validate_agent_configurations 함수를
        moto 컨텍스트에서 로드하여 반환합니다.
        """
        # 이미 로드된 경우 캐시 제거
        for mod_name in list(sys.modules.keys()):
            if mod_name == 'campaign_handler':
                del sys.modules[mod_name]

        import campaign_handler as ch

        # moto의 dynamodb resource로 재바인딩
        ch.dynamodb = boto3.resource(
            'dynamodb', region_name='us-east-1'
        )
        yield ch.validate_agent_configurations

    def test_rejects_non_dict_agent_configurations(
        self, campaign_validator
    ):
        """agentConfigurations가 dict가 아니면 400 반환해야 함."""
        is_valid, err = campaign_validator(
            ['not-a-dict'], 'test-sessions-table'
        )
        assert is_valid is False
        assert err['statusCode'] == 400

    def test_rejects_invalid_role_keys(
        self, campaign_validator
    ):
        """consultation/summary 외의 키는 거부되어야 함."""
        is_valid, err = campaign_validator(
            {'prechat': 'some-id', 'planning': 'other-id'},
            'test-sessions-table',
        )
        assert is_valid is False
        assert err['statusCode'] == 400
        body = json.loads(err['body'])
        assert 'Invalid agentConfigurations keys' in (
            body['error']
        )

    def test_accepts_empty_string_config_id(
        self, campaign_validator
    ):
        """빈 문자열 config_id는 연결 해제로 허용되어야 함."""
        is_valid, err = campaign_validator(
            {'consultation': '', 'summary': ''},
            'test-sessions-table',
        )
        assert is_valid is True
        assert err is None

    def test_rejects_nonexistent_config_id(
        self, campaign_validator, sessions_table
    ):
        """존재하지 않는 configId는 400을 반환해야 함."""
        is_valid, err = campaign_validator(
            {'consultation': 'does-not-exist'},
            'test-sessions-table',
        )
        assert is_valid is False
        assert err['statusCode'] == 400
        body = json.loads(err['body'])
        assert 'Referenced AgentConfig not found' in (
            body['error']
        )

    def test_accepts_valid_config_id_with_matching_role(
        self, campaign_validator, sessions_table
    ):
        """존재하는 AgentConfig + 역할 일치 시 검증 통과해야 함."""
        _put_agentconfig_item(
            sessions_table, 'valid-consult', 'consultation'
        )
        _put_agentconfig_item(
            sessions_table, 'valid-summary', 'summary'
        )

        is_valid, err = campaign_validator(
            {
                'consultation': 'valid-consult',
                'summary': 'valid-summary',
            },
            'test-sessions-table',
        )
        assert is_valid is True
        assert err is None

    def test_rejects_role_mismatch(
        self, campaign_validator, sessions_table
    ):
        """summary AgentConfig를 consultation 슬롯에 지정하면 거부."""
        _put_agentconfig_item(
            sessions_table, 'summary-cfg', 'summary'
        )

        is_valid, err = campaign_validator(
            {'consultation': 'summary-cfg'},
            'test-sessions-table',
        )
        assert is_valid is False
        assert err['statusCode'] == 400
        body = json.loads(err['body'])
        assert 'role mismatch' in body['error']

    def test_legacy_prechat_role_resolves_to_consultation(
        self, campaign_validator, sessions_table
    ):
        """레거시 prechat 역할 AgentConfig를 consultation 슬롯에
        참조하면 LEGACY_ROLE_MAP으로 자동 해석되어 통과해야 함.
        (Requirement 15.4)
        """
        _put_agentconfig_item(
            sessions_table, 'legacy-prechat', 'prechat'
        )

        is_valid, err = campaign_validator(
            {'consultation': 'legacy-prechat'},
            'test-sessions-table',
        )
        assert is_valid is True
        assert err is None

    def test_legacy_planning_and_ship_resolve_to_consultation(
        self, campaign_validator, sessions_table
    ):
        """planning, ship 역시 consultation으로 해석되어야 함."""
        _put_agentconfig_item(
            sessions_table, 'legacy-planning', 'planning'
        )
        _put_agentconfig_item(
            sessions_table, 'legacy-ship', 'ship'
        )

        # planning 아이템을 consultation 슬롯에 참조
        is_valid1, _ = campaign_validator(
            {'consultation': 'legacy-planning'},
            'test-sessions-table',
        )
        assert is_valid1 is True

        # ship 아이템을 consultation 슬롯에 참조
        is_valid2, _ = campaign_validator(
            {'consultation': 'legacy-ship'},
            'test-sessions-table',
        )
        assert is_valid2 is True
