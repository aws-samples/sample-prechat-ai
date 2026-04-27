"""
pytest 공용 fixture.

consultation-agent 디렉터리의 모듈을 임포트 가능하도록
sys.path에 추가하고, TOOL_REGISTRY에 테스트용 도구 스텁을
주입/복구하는 autouse fixture를 제공합니다.
"""

import os
import sys
from typing import Any

import pytest

# consultation-agent 루트를 sys.path에 추가 (conftest 기준 상위 디렉터리)
_AGENT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir)
)
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)


# 테스트에서 참조하는 6개 도구 이름 (설계 문서 기준).
# TOOL_REGISTRY에 없는 도구는 테스트에서 더미 객체로 보강합니다.
SUPPORTED_TOOLS: tuple[str, ...] = (
    'retrieve',
    'current_time',
    'render_form',
    'aws_docs_mcp',
    'http_request',
    'extract_a2t_log',
)


class _DummyTool:
    """TOOL_REGISTRY에 주입할 도구 스텁.

    실제 Strands @tool 객체를 import 없이 흉내 내기 위한
    해시 가능한 경량 placeholder입니다.
    """

    def __init__(self, name: str) -> None:
        self.name = name

    def __repr__(self) -> str:  # pragma: no cover - 디버그용
        return f'<DummyTool {self.name}>'


@pytest.fixture(autouse=True)
def _patched_tool_registry(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """TOOL_REGISTRY를 6개 도구 모두 포함하도록 재구성합니다.

    실제 환경에서는 agent.py 순환 임포트 때문에 render_form,
    aws_docs_mcp 등이 누락될 수 있습니다. 테스트에서는 레지스트리
    전체 경로를 안정적으로 검증하기 위해 6개 도구 모두 더미
    객체로 덮어씁니다. config_parser는 import time에 resolve_tools
    심볼을 바인딩하므로 dict 내용을 in-place로 교체합니다.
    """
    import tool_registry as tr

    original = dict(tr.TOOL_REGISTRY)
    # dict 자체를 교체하지 않고 내용을 갈아끼워 resolve_tools가
    # 참조하는 TOOL_REGISTRY 객체와 동일 참조를 유지합니다.
    tr.TOOL_REGISTRY.clear()
    for name in SUPPORTED_TOOLS:
        tr.TOOL_REGISTRY[name] = _DummyTool(name)

    yield tr.TOOL_REGISTRY

    tr.TOOL_REGISTRY.clear()
    tr.TOOL_REGISTRY.update(original)
