"""
Agent Configuration 도메인 모델

캠페인별 에이전트 설정을 관리합니다.
Dependency Injection 패턴으로 에이전트의 모델, 프롬프트,
도구(tools), 다국어(i18n) 등의 구성 요소를 런타임에 동적 주입합니다.

DynamoDB Schema (SessionsTable - Single Table Design):
  PK: AGENTCONFIG#{configId}
  SK: METADATA
  GSI1PK: AGENTCONFIG#{agentRole}
  GSI1SK: AGENTCONFIG#{configId}
"""

import json
from dataclasses import dataclass
from enum import Enum


class AgentRole(str, Enum):
    """에이전트 역할 (2가지)"""
    CONSULTATION = 'consultation'
    SUMMARY = 'summary'


VALID_AGENT_ROLES = {r.value for r in AgentRole}

# 레거시 역할 → 신규 역할 매핑 (하위 호환성)
LEGACY_ROLE_MAP = {
    'prechat': 'consultation',
    'planning': 'consultation',
    'ship': 'consultation',
}


@dataclass
class AgentConfiguration:
    """Agent Configuration 엔티티

    PreChat User가 배포된 Strands Agent에 구성을 주입하여
    정의하는 개체입니다.
    구성 가능한 요소: system_prompt, tools, model_id, i18n, name
    """
    config_id: str
    agent_role: str          # "consultation" | "summary"
    agent_name: str = ''
    system_prompt: str = ''
    tools: str = '[]'        # JSON 직렬화된 ToolConfig 객체 배열
    model_id: str = 'global.amazon.nova-2-lite-v1:0'
    i18n: str = 'ko'         # locale 코드

    def validate(self) -> list[str]:
        """설정을 검증합니다."""
        errors = []

        if not self.config_id:
            errors.append('config_id is required')

        # agent_role 검증: consultation 또는 summary만 허용
        if self.agent_role not in VALID_AGENT_ROLES:
            errors.append(
                f'Invalid agent_role: {self.agent_role}. '
                f'Must be one of {VALID_AGENT_ROLES}'
            )

        # tools JSON 파싱 및 retrieve 도구 kb_id 검증
        if self.tools and self.tools != '[]':
            try:
                tool_configs = json.loads(self.tools)
                if not isinstance(tool_configs, list):
                    errors.append(
                        'tools must be a JSON array'
                    )
                else:
                    for tc in tool_configs:
                        if tc.get('tool_name') == 'retrieve':
                            attrs = tc.get(
                                'tool_attributes', {}
                            )
                            if not attrs.get('kb_id'):
                                errors.append(
                                    'retrieve tool requires '
                                    'kb_id in tool_attributes'
                                )
            except (json.JSONDecodeError, TypeError):
                errors.append('Invalid tools JSON format')

        return errors

    def to_dynamodb_item(self) -> dict:
        """DynamoDB 아이템으로 변환합니다."""
        item = {
            'PK': f'AGENTCONFIG#{self.config_id}',
            'SK': 'METADATA',
            'configId': self.config_id,
            'agentRole': self.agent_role,
            'modelId': self.model_id,
            'systemPrompt': self.system_prompt,
            'agentName': self.agent_name,
            'tools': self.tools,
            'i18n': self.i18n,
            # GSI1: 역할별 조회용
            'GSI1PK': f'AGENTCONFIG#{self.agent_role}',
            'GSI1SK': f'AGENTCONFIG#{self.config_id}',
        }
        return item

    @classmethod
    def from_dynamodb_item(
        cls, item: dict
    ) -> 'AgentConfiguration':
        """DynamoDB 아이템에서 생성합니다.

        레거시 역할값(prechat, planning, ship)은
        LEGACY_ROLE_MAP을 통해 자동으로
        consultation으로 매핑됩니다.
        """
        raw_role = item.get('agentRole', '')
        # 레거시 역할 자동 매핑 (하위 호환성)
        agent_role = LEGACY_ROLE_MAP.get(
            raw_role, raw_role
        )
        return cls(
            config_id=item.get('configId', ''),
            agent_role=agent_role,
            model_id=item.get(
                'modelId',
                'global.amazon.nova-2-lite-v1:0',
            ),
            system_prompt=item.get('systemPrompt', ''),
            agent_name=item.get('agentName', ''),
            tools=item.get('tools', '[]'),
            i18n=item.get('i18n', 'ko'),
        )

    def to_api_response(self) -> dict:
        """API 응답용 딕셔너리로 변환합니다."""
        return {
            'configId': self.config_id,
            'agentRole': self.agent_role,
            'agentName': self.agent_name,
            'systemPrompt': self.system_prompt,
            'tools': json.loads(self.tools),
            'modelId': self.model_id,
            'i18n': self.i18n,
        }
