"""AgentConfiguration 모델 속성 기반 테스트 (Property-Based Tests)

Task 1.3: AgentConfiguration 모델 속성 기반 테스트 작성

테스트 대상 속성:
  - Property 1: AgentConfig 직렬화 라운드트립
  - Property 2: agent_role 검증
  - Property 11: 레거시 역할 매핑

Validates: Requirements 1.4, 1.5, 3.4, 3.5, 3.6, 15.1

Feature: agent-config-revamp

테스트 프레임워크: pytest + hypothesis
최소 반복 횟수: 100회 per property (@settings(max_examples=100))
"""

import json
import os
import sys

# shared 모듈 경로를 sys.path에 추가하여 models 임포트 허용
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), '..'),
)

from hypothesis import given, settings, strategies as st

from models.agent_config import (
    AgentConfiguration,
    LEGACY_ROLE_MAP,
    VALID_AGENT_ROLES,
)


# ---------------------------------------------------------------------------
# Hypothesis 전략(strategies) — 생성기 정의
# ---------------------------------------------------------------------------

# config_id: UUID 형식이 아니더라도 임의의 비어있지 않은 문자열이면 충분
# DynamoDB 키에 들어가므로 제어 문자는 제외
_config_id_strategy = st.text(
    alphabet=st.characters(
        blacklist_categories=('Cs',),
        blacklist_characters=('\x00',),
    ),
    min_size=1,
    max_size=64,
)

# 일반 문자열 필드 (agent_name, system_prompt 등)
_text_strategy = st.text(
    alphabet=st.characters(
        blacklist_categories=('Cs',),
        blacklist_characters=('\x00',),
    ),
    min_size=0,
    max_size=200,
)

# model_id: Bedrock 모델 식별자 형태를 닮은 임의 문자열
_model_id_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll', 'Lu', 'Nd'),
        whitelist_characters='.-_:',
    ),
    min_size=0,
    max_size=80,
)

# i18n locale 코드: 전형적인 locale은 'ko', 'en' 등이지만
# 모델은 임의 문자열을 허용하므로 ASCII 소문자 위주로 생성
_i18n_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll',),
        whitelist_characters='-_',
    ),
    min_size=0,
    max_size=10,
)

# agent_role: 신규 유효 역할 중 하나를 균일 샘플링
_valid_role_strategy = st.sampled_from(sorted(VALID_AGENT_ROLES))

# 레거시 역할: LEGACY_ROLE_MAP의 키만 샘플링
_legacy_role_strategy = st.sampled_from(sorted(LEGACY_ROLE_MAP.keys()))

# 유효한 ToolConfig 딕셔너리 생성기
# retrieve 도구는 kb_id가 필수이므로 별도 처리


def _tool_config_strategy():
    """단일 ToolConfig 딕셔너리 생성기.

    retrieve 도구는 항상 kb_id를 포함하도록 구성하여
    validate() 오류 없이 라운드트립 테스트에 사용할 수 있게 한다.
    """
    # retrieve 이외 도구 이름 (모델에는 열거형이 없으므로 임의 문자열)
    non_retrieve_tool_name = st.sampled_from(
        [
            'current_time',
            'render_form',
            'aws_docs_mcp',
            'http_request',
            'extract_a2t_log',
        ]
    )

    retrieve_tool = st.fixed_dictionaries(
        {
            'tool_name': st.just('retrieve'),
            'tool_attributes': st.fixed_dictionaries(
                {
                    'kb_id': st.text(
                        alphabet=st.characters(
                            whitelist_categories=(
                                'Ll',
                                'Lu',
                                'Nd',
                            ),
                        ),
                        min_size=1,
                        max_size=16,
                    ),
                }
            ),
        }
    )

    other_tool = st.fixed_dictionaries(
        {'tool_name': non_retrieve_tool_name}
    )

    return st.one_of(retrieve_tool, other_tool)


# tools 필드는 JSON 직렬화된 문자열이어야 하므로
# 리스트 → JSON 문자열로 매핑한다.
_tools_json_strategy = st.lists(
    _tool_config_strategy(),
    min_size=0,
    max_size=6,
).map(lambda configs: json.dumps(configs))


def _build_arbitrary_valid_config(
    config_id: str,
    agent_role: str,
    agent_name: str,
    system_prompt: str,
    tools: str,
    model_id: str,
    i18n: str,
) -> AgentConfiguration:
    """임의 파라미터로부터 AgentConfiguration을 조립한다."""
    return AgentConfiguration(
        config_id=config_id,
        agent_role=agent_role,
        agent_name=agent_name,
        system_prompt=system_prompt,
        tools=tools,
        model_id=model_id,
        i18n=i18n,
    )


# ---------------------------------------------------------------------------
# Property 1: AgentConfig 직렬화 라운드트립
# ---------------------------------------------------------------------------
# Feature: agent-config-revamp, Property 1: AgentConfig 직렬화 라운드트립
#
# 임의의 유효한 AgentConfiguration 객체에 대해
# to_dynamodb_item() 후 from_dynamodb_item()이 동등한 객체를
# 생성해야 한다. (status/created_at/updated_at/created_by는
# 모델에 존재하지 않으므로 대상에서 제외)
#
# Validates: Requirements 3.4, 3.5, 3.6


class TestAgentConfigSerializationRoundTrip:
    """Property 1: AgentConfig 직렬화 라운드트립."""


    @given(
        config_id=_config_id_strategy,
        agent_role=_valid_role_strategy,
        agent_name=_text_strategy,
        system_prompt=_text_strategy,
        tools=_tools_json_strategy,
        model_id=_model_id_strategy,
        i18n=_i18n_strategy,
    )
    @settings(max_examples=100, deadline=None)
    def test_property_roundtrip_preserves_all_fields(
        self,
        config_id,
        agent_role,
        agent_name,
        system_prompt,
        tools,
        model_id,
        i18n,
    ):
        """Property 1: 직렬화 후 역직렬화 시 모든 필드가 보존된다.

        새 역할("consultation", "summary")에 대해서는
        agent_role이 원본과 동일해야 한다. 레거시 역할 매핑은
        Property 11에서 별도로 검증한다.
        """
        original = _build_arbitrary_valid_config(
            config_id=config_id,
            agent_role=agent_role,
            agent_name=agent_name,
            system_prompt=system_prompt,
            tools=tools,
            model_id=model_id,
            i18n=i18n,
        )

        # DynamoDB 아이템으로 직렬화 → 다시 객체로 역직렬화
        item = original.to_dynamodb_item()
        restored = AgentConfiguration.from_dynamodb_item(item)

        # 모델에 존재하는 7개 필드가 모두 보존되어야 함
        assert restored.config_id == original.config_id
        assert restored.agent_role == original.agent_role
        assert restored.agent_name == original.agent_name
        assert restored.system_prompt == original.system_prompt
        assert restored.tools == original.tools
        assert restored.model_id == original.model_id
        assert restored.i18n == original.i18n


    @given(
        config_id=_config_id_strategy,
        agent_role=_valid_role_strategy,
        agent_name=_text_strategy,
        system_prompt=_text_strategy,
        tools=_tools_json_strategy,
        model_id=_model_id_strategy,
        i18n=_i18n_strategy,
    )
    @settings(max_examples=100, deadline=None)
    def test_property_gsi1_keys_reflect_role_and_id(
        self,
        config_id,
        agent_role,
        agent_name,
        system_prompt,
        tools,
        model_id,
        i18n,
    ):
        """Property 1 보조: GSI1PK/GSI1SK는 역할 및 config_id를 반영한다.

        Single Table Design에서 agent_role 기반 조회를 지원하기 위한
        GSI 키가 직렬화 시 올바른 형식으로 생성되어야 한다.
        """
        config = _build_arbitrary_valid_config(
            config_id=config_id,
            agent_role=agent_role,
            agent_name=agent_name,
            system_prompt=system_prompt,
            tools=tools,
            model_id=model_id,
            i18n=i18n,
        )

        item = config.to_dynamodb_item()

        assert item['PK'] == f'AGENTCONFIG#{config_id}'
        assert item['SK'] == 'METADATA'
        assert item['GSI1PK'] == f'AGENTCONFIG#{agent_role}'
        assert item['GSI1SK'] == f'AGENTCONFIG#{config_id}'


# ---------------------------------------------------------------------------
# Property 2: agent_role 검증
# ---------------------------------------------------------------------------
# Feature: agent-config-revamp, Property 2: agent_role 검증
#
# 임의의 문자열에 대해 "consultation" 또는 "summary"인 경우에만
# validate()가 빈 리스트를 반환하고, 그 외 모든 문자열은
# 유효한 역할 목록이 포함된 검증 오류를 반환해야 한다.
#
# Validates: Requirements 1.4, 1.5



class TestAgentRoleValidation:
    """Property 2: agent_role 검증."""

    @given(agent_role=_valid_role_strategy)
    @settings(max_examples=100, deadline=None)
    def test_property_valid_roles_produce_no_role_error(
        self, agent_role
    ):
        """Property 2 (유효 케이스): 유효 역할은 역할 관련 오류가 없다.

        config_id를 고정된 유효값으로 두고 tools는 '[]'로 비워
        다른 검증 오류가 섞이지 않도록 한 뒤,
        agent_role 관련 오류가 발생하지 않음을 확인한다.
        """
        config = AgentConfiguration(
            config_id='test-config-id',
            agent_role=agent_role,
            tools='[]',
        )

        errors = config.validate()

        # 유효 역할이면 "Invalid agent_role" 오류가 없어야 한다
        role_errors = [
            e for e in errors if 'Invalid agent_role' in e
        ]
        assert role_errors == []

    @given(
        invalid_role=st.text(
            alphabet=st.characters(
                blacklist_categories=('Cs',),
                blacklist_characters=('\x00',),
            ),
            min_size=0,
            max_size=40,
        ).filter(lambda s: s not in VALID_AGENT_ROLES)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_invalid_roles_fail_with_valid_list(
        self, invalid_role
    ):
        """Property 2 (무효 케이스): 무효 역할은 유효 목록을 포함한 오류를 반환한다.

        무효 역할에 대해서는:
          1) 역할 관련 오류 메시지가 최소 1개 이상 존재하고
          2) 해당 메시지에 유효한 역할 값들이 모두 포함되어야 한다.
        """
        config = AgentConfiguration(
            config_id='test-config-id',
            agent_role=invalid_role,
            tools='[]',
        )

        errors = config.validate()

        role_errors = [
            e for e in errors if 'Invalid agent_role' in e
        ]
        assert len(role_errors) >= 1, (
            f'무효 역할 {invalid_role!r}에 대해 오류가 발생해야 함'
        )

        # 유효 역할 목록이 오류 메시지에 모두 포함되어야 한다
        error_text = ' '.join(role_errors)
        for valid_role in VALID_AGENT_ROLES:
            assert valid_role in error_text, (
                f"오류 메시지에 유효 역할 '{valid_role}'이 포함돼야 함"
            )


# ---------------------------------------------------------------------------
# Property 11: 레거시 역할 매핑
# ---------------------------------------------------------------------------
# Feature: agent-config-revamp, Property 11: 레거시 역할 매핑
#
# 레거시 agent_role 값("prechat", "planning", "ship")이 저장된
# DynamoDB 아이템에 대해 from_dynamodb_item()은 agent_role을
# "consultation"으로 매핑해야 한다.
#
# Validates: Requirements 15.1


class TestLegacyRoleMapping:
    """Property 11: 레거시 역할 매핑."""

    @given(
        legacy_role=_legacy_role_strategy,
        config_id=_config_id_strategy,
    )
    @settings(max_examples=100, deadline=None)

    def test_property_legacy_role_maps_to_consultation(
        self, legacy_role, config_id
    ):
        """Property 11: 레거시 역할은 consultation으로 매핑된다.

        LEGACY_ROLE_MAP의 모든 키(prechat, planning, ship)에 대해
        from_dynamodb_item()의 결과 agent_role이
        "consultation"이어야 한다.
        """
        item = {
            'PK': f'AGENTCONFIG#{config_id}',
            'SK': 'METADATA',
            'configId': config_id,
            'agentRole': legacy_role,
            'modelId': 'global.amazon.nova-2-lite-v1:0',
            'systemPrompt': '',
            'agentName': '',
            'tools': '[]',
            'i18n': 'ko',
            # 레거시 아이템은 GSI1PK에 옛 역할값을 가질 수 있다
            'GSI1PK': f'AGENTCONFIG#{legacy_role}',
            'GSI1SK': f'AGENTCONFIG#{config_id}',
        }

        restored = AgentConfiguration.from_dynamodb_item(item)

        assert restored.agent_role == 'consultation', (
            f"레거시 역할 '{legacy_role}'은 'consultation'으로 "
            f"매핑되어야 하지만 '{restored.agent_role}'이 반환됨"
        )
        # config_id 등 다른 필드는 원본 그대로 복원되어야 함
        assert restored.config_id == config_id

    @given(new_role=_valid_role_strategy)
    @settings(max_examples=100, deadline=None)
    def test_property_new_roles_are_not_remapped(
        self, new_role
    ):
        """Property 11 보조: 신규 역할값은 매핑 대상이 아니다.

        LEGACY_ROLE_MAP은 레거시 값에만 적용되어야 하며,
        "consultation" 및 "summary"는 원본 그대로 보존된다.
        """
        item = {
            'PK': 'AGENTCONFIG#test-id',

            'SK': 'METADATA',
            'configId': 'test-id',
            'agentRole': new_role,
            'modelId': 'global.amazon.nova-2-lite-v1:0',
            'systemPrompt': '',
            'agentName': '',
            'tools': '[]',
            'i18n': 'ko',
            'GSI1PK': f'AGENTCONFIG#{new_role}',
            'GSI1SK': 'AGENTCONFIG#test-id',
        }

        restored = AgentConfiguration.from_dynamodb_item(item)

        assert restored.agent_role == new_role, (
            f"신규 역할 '{new_role}'은 매핑되지 않고 "
            f"그대로 유지되어야 함"
        )
