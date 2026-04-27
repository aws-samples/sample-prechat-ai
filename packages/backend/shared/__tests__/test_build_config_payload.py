"""_build_config_payload 함수 단위 테스트

Task 4.1: config.tools와 config.i18n을 payload에 포함하는
_build_config_payload 수정 사항을 검증합니다.

Validates: Requirements 5.1, 5.4, 5.5
"""

import os
import sys

# shared 모듈 경로 추가
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__), '..'
    ),
)

from unittest.mock import patch
from models.agent_config import AgentConfiguration
from agent_runtime import _build_config_payload


class TestBuildConfigPayloadNoConfig:
    """config가 None인 경우 테스트"""

    def test_none_config_with_locale(self):
        result = _build_config_payload(None, 'en')
        assert result == {'locale': 'en'}

    def test_none_config_default_locale(self):
        result = _build_config_payload(None)
        assert result == {'locale': 'ko'}


    def test_none_config_empty_locale(self):
        result = _build_config_payload(None, '')
        assert result == {}


class TestBuildConfigPayloadBasicFields:
    """기본 필드(system_prompt, model_id, agent_name) 테스트"""

    def test_system_prompt_included(self):
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            system_prompt='You are helpful.',
        )
        result = _build_config_payload(config)
        assert result['system_prompt'] == 'You are helpful.'

    def test_model_id_included(self):
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            model_id='anthropic.claude-3',
        )
        result = _build_config_payload(config)
        assert result['model_id'] == 'anthropic.claude-3'

    def test_agent_name_included(self):
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            agent_name='TestBot',
        )
        result = _build_config_payload(config)
        assert result['agent_name'] == 'TestBot'

    def test_empty_fields_excluded(self):
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            system_prompt='',
            model_id='',
            agent_name='',
        )
        result = _build_config_payload(config)
        assert 'system_prompt' not in result
        assert 'model_id' not in result
        assert 'agent_name' not in result


class TestBuildConfigPayloadTools:
    """tools 필드 포함 로직 테스트"""

    def test_tools_included_when_not_empty(self):
        """tools가 유효한 JSON 배열이면 포함"""
        tools_json = '[{"tool_name": "retrieve"}]'
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            tools=tools_json,
        )
        result = _build_config_payload(config)
        assert result['tools'] == tools_json

    def test_tools_excluded_when_empty_array(self):
        """tools가 '[]'이면 제외"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            tools='[]',
        )
        result = _build_config_payload(config)
        assert 'tools' not in result

    def test_tools_excluded_when_empty_string(self):
        """tools가 빈 문자열이면 제외"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            tools='',
        )
        result = _build_config_payload(config)
        assert 'tools' not in result

    def test_tools_with_multiple_items(self):
        """여러 도구가 포함된 tools 배열"""
        tools_json = (
            '[{"tool_name": "retrieve",'
            '"tool_attributes": {"kb_id": "KB-1"}},'
            '{"tool_name": "render_form"}]'
        )
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            tools=tools_json,
        )
        result = _build_config_payload(config)
        assert result['tools'] == tools_json


class TestBuildConfigPayloadLocale:
    """locale/i18n 우선순위 테스트"""

    def test_i18n_takes_priority_over_locale(self):
        """config.i18n이 파라미터 locale보다 우선"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            i18n='en',
        )
        result = _build_config_payload(config, 'ko')
        assert result['locale'] == 'en'

    def test_locale_fallback_when_i18n_empty(self):
        """config.i18n이 빈 문자열이면 locale 사용"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            i18n='',
        )
        result = _build_config_payload(config, 'ko')
        assert result['locale'] == 'ko'

    def test_default_locale_when_both_empty(self):
        """i18n과 locale 모두 빈 문자열이면 빈 문자열"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
            i18n='',
        )
        result = _build_config_payload(config, '')
        assert result['locale'] == ''

    def test_locale_always_present_with_config(self):
        """config가 있으면 locale은 항상 포함"""
        config = AgentConfiguration(
            config_id='test-1',
            agent_role='consultation',
        )
        result = _build_config_payload(config)
        assert 'locale' in result


class TestBuildConfigPayloadIntegration:
    """전체 필드 조합 통합 테스트"""

    def test_full_config_payload(self):
        """모든 필드가 포함된 완전한 config"""
        tools_json = '[{"tool_name": "retrieve"}]'
        config = AgentConfiguration(
            config_id='test-full',
            agent_role='consultation',
            agent_name='FullBot',
            system_prompt='Be helpful.',
            tools=tools_json,
            model_id='anthropic.claude-3',
            i18n='en',
        )
        result = _build_config_payload(config, 'ko')
        assert result == {
            'system_prompt': 'Be helpful.',
            'model_id': 'anthropic.claude-3',
            'agent_name': 'FullBot',
            'tools': tools_json,
            'locale': 'en',
        }

    def test_summary_agent_no_tools(self):
        """Summary Agent는 tools가 없으므로 제외"""
        config = AgentConfiguration(
            config_id='test-summary',
            agent_role='summary',
            model_id='amazon.nova-pro',
            i18n='ko',
        )
        result = _build_config_payload(config)
        assert 'tools' not in result
        assert result['model_id'] == 'amazon.nova-pro'
        assert result['locale'] == 'ko'
