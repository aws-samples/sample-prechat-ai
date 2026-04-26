"""
Tool Registry — 에이전트 도구 레지스트리

지원되는 모든 도구를 사전 임포트하고 이름으로 조회하는
레지스트리입니다. AgentConfig의 tools 배열에서 실제 도구
객체를 해석(resolve)하는 역할을 합니다.

사용 예:
    from tool_registry import resolve_tools
    tools = resolve_tools([
        {'tool_name': 'retrieve'},
        {'tool_name': 'render_form'},
    ])

Requirements: 8.1, 8.2, 8.3, 8.4
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── 도구 임포트 ──────────────────────────────────
# strands_tools에서 직접 임포트 (항상 사용 가능)
from strands_tools import retrieve, current_time


# render_form: agent.py에 @tool로 정의됨
# 순환 임포트를 피하기 위해 try/except 사용
_render_form = None
try:
    from agent import render_form as _render_form_import
    _render_form = _render_form_import
except ImportError:
    logger.warning(
        "render_form 도구를 임포트할 수 없습니다. "
        "agent 모듈이 로드되지 않았습니다."
    )

# aws_docs_mcp_client: agent.py에 MCPClient로 정의됨
_aws_docs_mcp_client = None
try:
    from agent import aws_docs_mcp_client as _mcp_import
    _aws_docs_mcp_client = _mcp_import
except ImportError:
    logger.warning(
        "aws_docs_mcp_client를 임포트할 수 없습니다. "
        "agent 모듈이 로드되지 않았습니다."
    )


# http_request: 아직 구현되지 않은 도구 (향후 추가)
_http_request = None
try:
    from tools.http_request import http_request as _hr
    _http_request = _hr
except ImportError:
    logger.info(
        "http_request 도구를 찾을 수 없습니다. "
        "향후 추가될 예정입니다."
    )

# extract_a2t_log: 아직 구현되지 않은 도구 (향후 추가)
_extract_a2t_log = None
try:
    from tools.extract_a2t_log import (
        extract_a2t_log as _a2t,
    )
    _extract_a2t_log = _a2t
except ImportError:
    logger.info(
        "extract_a2t_log 도구를 찾을 수 없습니다. "
        "향후 추가될 예정입니다."
    )


# ── 도구 레지스트리 ──────────────────────────────
# 지원되는 모든 도구를 이름→객체로 매핑합니다.
# 임포트에 실패한 도구(None)는 레지스트리에서 제외됩니다.

def _build_registry() -> dict[str, Any]:
    """임포트 성공한 도구만 레지스트리에 등록합니다."""
    candidates = {
        'retrieve': retrieve,
        'current_time': current_time,
        'render_form': _render_form,
        'aws_docs_mcp': _aws_docs_mcp_client,
        'http_request': _http_request,
        'extract_a2t_log': _extract_a2t_log,
    }
    return {
        name: obj
        for name, obj in candidates.items()
        if obj is not None
    }


TOOL_REGISTRY: dict[str, Any] = _build_registry()


# 항상 포함되는 도구 목록
# resolve_tools()가 호출될 때 tool_configs에 없더라도
# 자동으로 추가됩니다.
ALWAYS_INCLUDED: list[str] = ['current_time']


def resolve_tools(tool_configs: list[dict]) -> list:
    """AgentConfig의 tools 배열에서 실제 도구 객체를 반환합니다.

    tool_configs의 각 tool_name을 TOOL_REGISTRY에서 조회하고,
    ALWAYS_INCLUDED 도구를 자동으로 추가합니다.
    레지스트리에 없는 도구는 경고 로그 후 건너뜁니다.

    Args:
        tool_configs: AgentConfig의 tools 배열.
            각 요소는 {'tool_name': str, ...} 형태.

    Returns:
        해석된 도구 객체 리스트.
    """
    names = {t['tool_name'] for t in tool_configs}
    names.update(ALWAYS_INCLUDED)
    tools = []
    for name in names:
        if name in TOOL_REGISTRY:
            tools.append(TOOL_REGISTRY[name])
        else:
            logger.warning(
                "Unknown tool: %s — "
                "레지스트리에 등록되지 않은 도구입니다.",
                name,
            )
    return tools
