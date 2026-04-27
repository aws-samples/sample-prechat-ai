"""
pytest 공용 fixture.

summary-agent 디렉터리의 모듈(agent.py)을 임포트 가능하도록
sys.path에 추가합니다.
"""

import os
import sys

# summary-agent 루트를 sys.path에 추가 (conftest 기준 상위 디렉터리)
_AGENT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir)
)
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)
