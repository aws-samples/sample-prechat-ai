"""
Summary Agent 속성 기반 테스트.

Feature: agent-config-revamp
- Property 10: Summary Agent 도구/프롬프트 무시 (Req 9.3)

실행:
    cd packages/strands-agents/summary-agent
    python -m pytest __tests__/test_summary_agent_property.py -v
"""

import json

import pytest
from hypothesis import given, settings, strategies as st

# conftest.py가 sys.path 추가를 담당합니다.
import agent as summary_agent_module


# ── 생성기 전략 ────────────────────────────────────

# 임의의 도구 이름 (Summary Agent는 모두 무시해야 함).
_tool_name = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll', 'Lu', 'Nd'),
        whitelist_characters='_-',
    ),
    min_size=1,
    max_size=24,
)


def _tool_config(name: str) -> dict:
    """tool_configs 배열의 단일 요소 헬퍼."""
    return {'tool_name': name}


# 임의의 tool_configs 배열 (빈 배열 포함).
_arbitrary_tool_configs = st.lists(
    _tool_name, min_size=0, max_size=6
).map(lambda names: [_tool_config(n) for n in names])

# 임의의 system_prompt 문자열 (오버라이드 시도용).
_override_prompt = st.text(
    alphabet=st.characters(
        blacklist_categories=('Cs',),  # surrogate 제외
        blacklist_characters='\x00',
    ),
    min_size=1,
    max_size=200,
)

# 임의의 model_id 문자열.
_model_id_text = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll', 'Lu', 'Nd'),
        whitelist_characters='.-_:/',
    ),
    min_size=1,
    max_size=80,
)

# locale 코드 (ko/en 지원, 그 외는 영어 기본).
_locale_code = st.sampled_from(['ko', 'en', 'ja', ''])


class TestSummaryAgentIgnoresToolsAndPrompt:
    """create_summary_agent는 tools/system_prompt 오버라이드를
    무시해야 한다는 속성을 검증합니다."""

    @given(
        tool_configs=_arbitrary_tool_configs,
        override_prompt=_override_prompt,
        model_id=_model_id_text,
        locale=_locale_code,
    )
    @settings(max_examples=100, deadline=None)
    def test_property_10_summary_agent_ignores_tools_and_prompt(
        self,
        tool_configs: list[dict],
        override_prompt: str,
        model_id: str,
        locale: str,
    ) -> None:
        """Property 10: Summary Agent 도구/프롬프트 무시.

        Feature: agent-config-revamp, Property 10:
        Summary Agent 도구/프롬프트 무시.
        Validates: Requirements 9.3.

        AgentConfig payload에 tools 배열이나 system_prompt가
        포함되어 있더라도, Summary Agent는 이를 무시하고:
        1. 항상 빈 도구 리스트(tools=[])를 사용해야 한다
        2. 항상 DEFAULT_SYSTEM_PROMPT를 접두사로 하는
           시스템 프롬프트를 사용해야 한다 (override_prompt 미반영)
        3. model_id와 locale만 AgentConfig에서 수용되어야 한다
        """
        config = {
            'tools': json.dumps(tool_configs),
            'system_prompt': override_prompt,
            'model_id': model_id,
            'locale': locale,
        }

        result_agent = summary_agent_module.create_summary_agent(
            config=config
        )

        # (1) tools 리스트는 항상 빈 상태여야 합니다.
        assert result_agent.tool_names == [], (
            f'Summary Agent는 tools 배열을 무시하고 항상 빈 '
            f'도구 리스트를 사용해야 합니다. '
            f'tool_names={result_agent.tool_names!r}'
        )

        # (2) override_prompt는 시스템 프롬프트에 반영되지 않아야
        # 하며, DEFAULT_SYSTEM_PROMPT가 접두사로 보존되어야 합니다.
        default_prompt = summary_agent_module.DEFAULT_SYSTEM_PROMPT
        assert result_agent.system_prompt.startswith(
            default_prompt
        ), (
            'DEFAULT_SYSTEM_PROMPT가 시스템 프롬프트의 접두사로 '
            '유지되어야 합니다.'
        )
        # override_prompt는 포함되어서는 안 됩니다.
        # 단, override_prompt가 우연히 default prompt나 locale
        # instruction의 부분 문자열인 경우는 제외합니다.
        locale_instruction = (
            summary_agent_module._get_locale_instruction(locale)
        )
        expected_full = default_prompt + locale_instruction
        assert result_agent.system_prompt == expected_full, (
            f'시스템 프롬프트는 DEFAULT_SYSTEM_PROMPT와 locale '
            f'instruction의 조합이어야 하며, 입력 system_prompt '
            f'오버라이드는 무시되어야 합니다.'
        )

        # (3) model_id만 config에서 수용되어야 합니다.
        # strands BedrockModel의 config dict에서 model_id 확인.
        model_config = result_agent.model.config
        assert model_config.get('model_id') == model_id, (
            f'AgentConfig의 model_id는 그대로 에이전트 모델에 '
            f'적용되어야 합니다. expected={model_id!r}, '
            f'got={model_config.get("model_id")!r}'
        )

    @given(override_prompt=_override_prompt)
    @settings(max_examples=100, deadline=None)
    def test_property_10_empty_tools_in_config(
        self, override_prompt: str
    ) -> None:
        """Property 10 보조: tools 필드 자체를 생략해도 동일한
        불변 조건(빈 도구, 기본 프롬프트)이 유지되는지 검증.

        Feature: agent-config-revamp, Property 10:
        Summary Agent 도구/프롬프트 무시.
        Validates: Requirements 9.3.
        """
        config = {
            'system_prompt': override_prompt,
            # tools 키 없음
        }
        result_agent = summary_agent_module.create_summary_agent(
            config=config
        )

        assert result_agent.tool_names == []
        assert result_agent.system_prompt.startswith(
            summary_agent_module.DEFAULT_SYSTEM_PROMPT
        )
