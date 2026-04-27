"""
Tool Registry & Config Parser 속성 기반 테스트.

Feature: agent-config-revamp
- Property 3: current_time 도구 항상 포함 (Req 2.2, 8.3)
- Property 4: resolve_tools 정확한 부분집합 반환 (Req 8.2, 13.4)
- Property 5: 미인식 도구 건너뛰기 (Req 8.4)
- Property 6: Config Parser 구성 필드 보존 (Req 5.1, 5.4)
- Property 7: Config Parser 도구 지침 생성 (Req 5.2, 13.1, 13.2)
- Property 8: Config Parser kb_id 주입 (Req 5.3, 13.3)
- Property 9: 도구 파싱 멱등성 (Req 13.5)

실행:
    cd packages/strands-agents/consultation-agent
    python -m pytest __tests__/test_config_parser_property.py -v
"""

import json

import pytest
from hypothesis import given, settings, strategies as st

# conftest.py가 sys.path 추가와 TOOL_REGISTRY 스텁 주입을 담당합니다.
import tool_registry as tr
import config_parser as cp


# 테스트 전략에서 공통으로 사용하는 도구 이름 풀.
# conftest의 SUPPORTED_TOOLS와 동일하게 유지합니다.
_SUPPORTED_TOOL_NAMES = [
    'retrieve',
    'current_time',
    'render_form',
    'aws_docs_mcp',
    'http_request',
    'extract_a2t_log',
]

# ── 생성기 전략 ────────────────────────────────────

# 유효한 도구 이름 전략 (TOOL_REGISTRY에 있는 이름만).
_valid_tool_name = st.sampled_from(_SUPPORTED_TOOL_NAMES)

# 미인식 도구 이름 전략: 지원 목록에 없고 공백/특수문자도 없는 문자열.
_unknown_tool_name = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll', 'Lu', 'Nd'),
        whitelist_characters='_',
    ),
    min_size=1,
    max_size=16,
).filter(lambda s: s not in _SUPPORTED_TOOL_NAMES)


def _tool_config(name: str, kb_id: str | None = None) -> dict:
    """tool_configs 배열의 단일 요소를 생성하는 헬퍼."""
    entry: dict = {'tool_name': name}
    if name == 'retrieve' and kb_id is not None:
        entry['tool_attributes'] = {'kb_id': kb_id}
    return entry


# 유효 도구로만 구성된 tool_configs 리스트 (중복 허용 X).
_valid_tool_configs = st.lists(
    _valid_tool_name, min_size=0, max_size=6, unique=True
).map(lambda names: [_tool_config(n) for n in names])


class TestResolveToolsProperties:
    """tool_registry.resolve_tools에 대한 속성 테스트."""

    @given(tool_configs=_valid_tool_configs)
    @settings(max_examples=100, deadline=None)
    def test_property_3_current_time_always_included(
        self, tool_configs: list[dict]
    ) -> None:
        """Property 3: current_time 도구 항상 포함.

        Feature: agent-config-revamp, Property 3:
        current_time 도구 항상 포함.
        Validates: Requirements 2.2, 8.3.

        임의의 tool_configs 배열(빈 배열 포함, current_time을
        포함하지 않는 배열 포함)에 대해, resolve_tools 결과에는
        항상 TOOL_REGISTRY['current_time'] 객체가 포함되어야
        합니다.
        """
        tools = tr.resolve_tools(tool_configs)
        current_time_tool = tr.TOOL_REGISTRY['current_time']
        assert current_time_tool in tools, (
            'current_time 도구가 ALWAYS_INCLUDED 규칙에 의해 '
            '항상 포함되어야 합니다.'
        )


    @given(tool_configs=_valid_tool_configs)
    @settings(max_examples=100, deadline=None)
    def test_property_4_exact_subset_returned(
        self, tool_configs: list[dict]
    ) -> None:
        """Property 4: resolve_tools 정확한 부분집합 반환.

        Feature: agent-config-revamp, Property 4:
        resolve_tools 정확한 부분집합 반환.
        Validates: Requirements 8.2, 13.4.

        resolve_tools 결과는 "요청된 도구 이름 + ALWAYS_INCLUDED"
        집합과 정확히 일치해야 합니다. 추가 도구가 포함되어서도,
        요청된 도구가 누락되어서도 안 됩니다.
        """
        requested_names = {tc['tool_name'] for tc in tool_configs}
        expected_names = requested_names | set(tr.ALWAYS_INCLUDED)

        tools = tr.resolve_tools(tool_configs)

        # 반환된 도구 객체 → 레지스트리의 이름으로 역매핑합니다.
        name_by_obj = {v: k for k, v in tr.TOOL_REGISTRY.items()}
        returned_names = {name_by_obj[t] for t in tools}

        assert returned_names == expected_names, (
            f'반환 집합이 기대 집합과 다릅니다. '
            f'expected={sorted(expected_names)}, '
            f'returned={sorted(returned_names)}'
        )
        # 도구 객체 중복 반환이 없어야 합니다 (set 크기와 리스트 길이 동일).
        assert len(tools) == len(returned_names)


    @given(
        valid_names=st.lists(
            _valid_tool_name, min_size=0, max_size=4, unique=True
        ),
        unknown_names=st.lists(
            _unknown_tool_name, min_size=1, max_size=4, unique=True
        ),
    )
    @settings(max_examples=100, deadline=None)
    def test_property_5_unknown_tools_skipped(
        self,
        valid_names: list[str],
        unknown_names: list[str],
    ) -> None:
        """Property 5: 미인식 도구 건너뛰기.

        Feature: agent-config-revamp, Property 5:
        미인식 도구 건너뛰기.
        Validates: Requirements 8.4.

        TOOL_REGISTRY에 없는 도구 이름이 섞인 tool_configs에
        대해 resolve_tools는:
        1. 미인식 도구로 인해 예외를 던지지 않아야 한다
        2. 반환된 도구는 모두 레지스트리에 등록된 객체여야 한다
        3. 미인식 이름은 반환 집합에 포함되지 않아야 한다
        """
        # 유효+미인식 도구를 섞어 tool_configs 구성
        mixed = [_tool_config(n) for n in valid_names + unknown_names]

        # 예외 없이 처리되어야 합니다.
        tools = tr.resolve_tools(mixed)

        registry_values = set(tr.TOOL_REGISTRY.values())
        name_by_obj = {v: k for k, v in tr.TOOL_REGISTRY.items()}

        # 반환된 모든 도구가 레지스트리 값이어야 합니다.
        assert all(t in registry_values for t in tools)

        returned_names = {name_by_obj[t] for t in tools}
        # 미인식 도구는 결코 반환되어선 안 됩니다.
        assert returned_names.isdisjoint(set(unknown_names))
        # 유효 + ALWAYS_INCLUDED만 포함되어야 합니다.
        expected = set(valid_names) | set(tr.ALWAYS_INCLUDED)
        assert returned_names == expected



# ── parse_config용 공용 전략 ─────────────────────

# 시스템 프롬프트 및 model_id는 임의 문자열을 허용합니다.
# 제어문자(\x00-\x1f 중 탭/개행 제외)는 배제하여 텍스트 일관성 확보.
_prompt_text = st.text(
    alphabet=st.characters(
        blacklist_categories=('Cs',),  # surrogate 제외
        blacklist_characters='\x00',
    ),
    min_size=0,
    max_size=200,
)
_model_id_text = st.text(
    alphabet=st.characters(
        whitelist_categories=('Ll', 'Lu', 'Nd'),
        whitelist_characters='.-_:/',
    ),
    min_size=1,
    max_size=80,
)
_agent_name_text = st.text(min_size=0, max_size=40)


class TestConfigParserProperties:
    """config_parser.parse_config에 대한 속성 테스트."""


    @given(
        prompt=_prompt_text,
        model_id=_model_id_text,
        tool_configs=_valid_tool_configs,
    )
    @settings(max_examples=100, deadline=None)
    def test_property_6_config_fields_preserved(
        self,
        prompt: str,
        model_id: str,
        tool_configs: list[dict],
    ) -> None:
        """Property 6: Config Parser 구성 필드 보존.

        Feature: agent-config-revamp, Property 6:
        Config Parser 구성 필드 보존.
        Validates: Requirements 5.1, 5.4.

        parse_config 결과의 model_id는 입력과 동일해야 하며,
        system_prompt는 원본 텍스트를 접두사(prefix)로
        보존해야 합니다 (도구 지침이 뒤에 추가될 수는 있음).
        """
        config = {
            'system_prompt': prompt,
            'model_id': model_id,
            'tools': json.dumps(tool_configs),
        }
        result = cp.parse_config(config)

        assert result['model_id'] == model_id, (
            'model_id 필드는 변형 없이 보존되어야 합니다.'
        )
        # system_prompt는 원본을 접두사로 포함해야 합니다.
        assert result['system_prompt'].startswith(prompt), (
            f'원본 system_prompt가 접두사로 보존되지 않았습니다. '
            f'original={prompt!r}, '
            f'got={result["system_prompt"][:120]!r}...'
        )


    @given(
        prompt=_prompt_text,
        tool_configs=_valid_tool_configs.filter(lambda xs: len(xs) >= 1),
    )
    @settings(max_examples=100, deadline=None)
    def test_property_7_tool_instructions_appended(
        self,
        prompt: str,
        tool_configs: list[dict],
    ) -> None:
        """Property 7: Config Parser 도구 지침 생성.

        Feature: agent-config-revamp, Property 7:
        Config Parser 도구 지침 생성.
        Validates: Requirements 5.2, 13.1, 13.2.

        tools가 하나 이상 포함된 경우, 시스템 프롬프트에
        도구 사용 지침 섹션 헤더가 추가되고 tools 리스트에
        도구 객체가 포함되어야 합니다.
        """
        config = {
            'system_prompt': prompt,
            'model_id': 'm',
            'tools': json.dumps(tool_configs),
        }
        result = cp.parse_config(config)

        # 지침 섹션 헤더 (config_parser._build_tool_instructions 참조)
        assert '## 사용 가능한 도구' in result['system_prompt'], (
            '유효 도구가 있을 때 시스템 프롬프트에 도구 지침 '
            '섹션이 추가되어야 합니다.'
        )
        # tools 리스트에 도구 객체가 담겨야 합니다 (빈 배열 X).
        assert len(result['tools']) >= 1, (
            '유효 도구가 있으면 tools 리스트에 최소 한 개의 '
            '도구 객체가 포함되어야 합니다.'
        )


    @given(
        prompt=_prompt_text,
        kb_id=st.text(
            alphabet=st.characters(
                whitelist_categories=('Ll', 'Lu', 'Nd'),
                whitelist_characters='-_',
            ),
            min_size=1,
            max_size=30,
        ),
    )
    @settings(max_examples=100, deadline=None)
    def test_property_8_kb_id_injected(
        self,
        prompt: str,
        kb_id: str,
    ) -> None:
        """Property 8: Config Parser kb_id 주입.

        Feature: agent-config-revamp, Property 8:
        Config Parser kb_id 주입.
        Validates: Requirements 5.3, 13.3.

        retrieve 도구의 tool_attributes.kb_id가 주어지면
        생성된 시스템 프롬프트(도구 지침 텍스트)에 해당
        kb_id 값이 정확히 포함되어야 합니다.
        """
        tool_configs = [
            {
                'tool_name': 'retrieve',
                'tool_attributes': {'kb_id': kb_id},
            }
        ]
        config = {
            'system_prompt': prompt,
            'model_id': 'm',
            'tools': json.dumps(tool_configs),
        }
        result = cp.parse_config(config)

        assert kb_id in result['system_prompt'], (
            f'시스템 프롬프트에 kb_id={kb_id!r}가 주입되어야 합니다.'
        )
        # 플레이스홀더가 치환되지 않고 남아있으면 안 됩니다.
        assert '{kb_id}' not in result['system_prompt'], (
            'kb_id 플레이스홀더가 치환되지 않은 채로 남아있습니다.'
        )


    @given(
        prompt=_prompt_text,
        model_id=_model_id_text,
        agent_name=_agent_name_text,
        tool_configs=_valid_tool_configs,
    )
    @settings(max_examples=100, deadline=None)
    def test_property_9_parse_config_idempotent(
        self,
        prompt: str,
        model_id: str,
        agent_name: str,
        tool_configs: list[dict],
    ) -> None:
        """Property 9: 도구 파싱 멱등성 (Idempotence).

        Feature: agent-config-revamp, Property 9:
        도구 파싱 멱등성.
        Validates: Requirements 13.5.

        동일한 config 입력에 대해 parse_config를 두 번 호출하면
        동일한 결과(도구 객체 집합, system_prompt, model_id,
        agent_name, locale)가 반환되어야 합니다.
        """
        config = {
            'system_prompt': prompt,
            'model_id': model_id,
            'agent_name': agent_name,
            'tools': json.dumps(tool_configs),
        }

        r1 = cp.parse_config(config)
        r2 = cp.parse_config(config)

        # 도구 객체 집합이 동일해야 합니다 (참조 동일성으로 비교).
        name_by_obj = {v: k for k, v in tr.TOOL_REGISTRY.items()}
        names1 = {name_by_obj[t] for t in r1['tools']}
        names2 = {name_by_obj[t] for t in r2['tools']}
        assert names1 == names2

        # 나머지 스칼라 필드도 모두 동일해야 합니다.
        assert r1['system_prompt'] == r2['system_prompt']
        assert r1['model_id'] == r2['model_id']
        assert r1['agent_name'] == r2['agent_name']
        assert r1['locale'] == r2['locale']
