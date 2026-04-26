"""
Config Parser — AgentConfig payload 파서

AgentConfig payload를 파싱하여 Agent 초기화 파라미터를
생성합니다. tools JSON 문자열을 파싱하고, 도구별 사용 지침을
시스템 프롬프트에 추가합니다.

사용 예:
    from config_parser import parse_config
    parsed = parse_config({
        'system_prompt': '...',
        'model_id': '...',
        'tools': '[{"tool_name": "retrieve", ...}]',
    })
    agent = Agent(
        model=parsed['model_id'],
        system_prompt=parsed['system_prompt'],
        tools=parsed['tools'],
    )

Requirements: 5.2, 5.3, 13.1, 13.2, 13.3, 13.4, 13.5
"""

import json
import logging
from typing import Any

from tool_registry import resolve_tools

logger = logging.getLogger(__name__)

# ── 도구별 사용 지침 템플릿 ─────────────────────
# 각 도구의 목적과 호출 방법을 설명하는 텍스트입니다.
# retrieve 도구는 {kb_id} 플레이스홀더를 포함하며,
# _build_tool_instructions()에서 실제 값으로 치환됩니다.

TOOL_INSTRUCTIONS: dict[str, str] = {
    'retrieve': (
        '`retrieve`: Bedrock Knowledge Base에서 유사 사례를 검색합니다. '
        '`retrieve(text="키워드", knowledgeBaseId="{kb_id}")` '
        '형태로 호출하세요.'
    ),
    'render_form': (
        '`render_form`: 고객 정보 수집용 HTML Form을 생성합니다.'
    ),
    'aws_docs_mcp': (
        '`aws_docs_mcp`: AWS 공식 문서를 검색합니다.'
    ),
    'http_request': (
        '`http_request`: 외부 HTTP API를 호출합니다.'
    ),
    'extract_a2t_log': (
        '`extract_a2t_log`: A2T 로그를 추출합니다.'
    ),
    'current_time': (
        '`current_time`: 현재 시간을 조회합니다.'
    ),
}


def parse_config(config: dict) -> dict:
    """AgentConfig payload → Agent 초기화 파라미터로 변환합니다.

    config dict에서 system_prompt, model_id, agent_name,
    locale, tools를 추출합니다. tools가 JSON 문자열이면
    파싱하고, 도구 객체를 해석한 뒤 시스템 프롬프트에
    도구 사용 지침을 추가합니다.

    Args:
        config: AgentConfig payload dict.
            - system_prompt (str): 시스템 프롬프트
            - model_id (str): Bedrock 모델 ID
            - agent_name (str): 에이전트 이름
            - locale (str): 언어 코드 (기본 'ko')
            - tools (str|list): JSON 문자열 또는 리스트

    Returns:
        Agent 초기화에 필요한 파라미터 dict:
        {
            'system_prompt': str,
            'model_id': str,
            'agent_name': str,
            'locale': str,
            'tools': list,  # 실제 도구 객체 리스트
        }
    """
    result: dict[str, Any] = {
        'system_prompt': config.get('system_prompt', ''),
        'model_id': config.get('model_id', ''),
        'agent_name': config.get('agent_name', ''),
        'locale': config.get('locale', 'ko'),
        'tools': [],
    }

    # tools JSON 문자열 파싱 (문자열 또는 리스트 모두 지원)
    tools_raw = config.get('tools', '[]')
    if isinstance(tools_raw, str):
        try:
            tool_configs = json.loads(tools_raw)
        except json.JSONDecodeError:
            logger.warning(
                "tools JSON 파싱 실패: %s — "
                "빈 도구 목록으로 폴백합니다.",
                tools_raw,
            )
            tool_configs = []
    else:
        tool_configs = tools_raw

    if tool_configs:
        # 도구 객체 해석
        result['tools'] = resolve_tools(tool_configs)
        # 시스템 프롬프트에 도구 사용 지침 추가
        instructions = _build_tool_instructions(tool_configs)
        if instructions:
            result['system_prompt'] += instructions

    return result


def _build_tool_instructions(tool_configs: list[dict]) -> str:
    """도구 사용 지침 텍스트를 생성합니다.

    각 도구의 TOOL_INSTRUCTIONS 템플릿을 기반으로
    시스템 프롬프트에 추가할 지침 텍스트를 생성합니다.
    retrieve 도구의 경우 tool_attributes.kb_id를
    템플릿에 주입합니다.

    Args:
        tool_configs: AgentConfig의 tools 배열.
            각 요소는 {'tool_name': str,
            'tool_attributes': {...}} 형태.

    Returns:
        도구 지침 텍스트 문자열.
        도구가 없으면 빈 문자열을 반환합니다.
    """
    lines = ['\n\n## 사용 가능한 도구\n']
    for tc in tool_configs:
        name = tc.get('tool_name', '')
        template = TOOL_INSTRUCTIONS.get(name, '')
        if not template:
            continue
        attrs = tc.get('tool_attributes', {})
        # retrieve 도구: kb_id 플레이스홀더를 실제 값으로 치환
        if name == 'retrieve' and 'kb_id' in attrs:
            template = template.replace(
                '{kb_id}', attrs['kb_id']
            )
        lines.append(f'- {template}')
    return '\n'.join(lines) if len(lines) > 1 else ''
