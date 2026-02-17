"""
Agent Configuration 도메인 모델

캠페인별 에이전트 설정을 관리합니다.
Dependency Injection 패턴으로 에이전트의 모델, 프롬프트, Capability를 구성합니다.

DynamoDB Schema (SessionsTable - Single Table Design):
  PK: AGENTCONFIG#{configId}
  SK: METADATA
  GSI1PK: CAMPAIGN#{campaignId}
  GSI1SK: AGENTCONFIG#{agentRole}
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class AgentRole(str, Enum):
    """에이전트 역할"""
    PRECHAT = 'prechat'
    SUMMARY = 'summary'
    PLANNING = 'planning'


class CapabilityType(str, Enum):
    """에이전트 Capability 유형"""
    MEMORY = 'memory'
    TRACING = 'tracing'
    RAG = 'rag'
    TOOLS = 'tools'


VALID_AGENT_ROLES = {r.value for r in AgentRole}

SUPPORTED_MODELS = {
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'amazon.nova-pro-v1:0',
    'amazon.nova-lite-v1:0',
    'amazon.nova-micro-v1:0',
}


@dataclass
class AgentCapabilities:
    """에이전트 Capability 설정"""
    memory_enabled: bool = False
    memory_type: str = 'SESSION_SUMMARY'
    tracing_enabled: bool = True
    rag_enabled: bool = False
    rag_knowledge_base_id: str = ''
    tools_enabled: bool = False

    def to_dict(self) -> dict:
        return {
            'memoryEnabled': self.memory_enabled,
            'memoryType': self.memory_type,
            'tracingEnabled': self.tracing_enabled,
            'ragEnabled': self.rag_enabled,
            'ragKnowledgeBaseId': self.rag_knowledge_base_id,
            'toolsEnabled': self.tools_enabled,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AgentCapabilities':
        if not data:
            return cls()
        return cls(
            memory_enabled=data.get('memoryEnabled', False),
            memory_type=data.get('memoryType', 'SESSION_SUMMARY'),
            tracing_enabled=data.get('tracingEnabled', True),
            rag_enabled=data.get('ragEnabled', False),
            rag_knowledge_base_id=data.get('ragKnowledgeBaseId', ''),
            tools_enabled=data.get('toolsEnabled', False),
        )


@dataclass
class AgentConfiguration:
    """Agent Configuration 엔티티

    PreChat User가 배포된 Strands Agent에 구성을 주입하여 정의하는 개체입니다.
    구성 가능한 요소: system_prompt, model_id, name
    """
    config_id: str
    agent_role: str
    campaign_id: str
    agent_runtime_arn: str = ''  # AgentCore Runtime에 배포된 에이전트 ARN
    model_id: str = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    system_prompt: str = ''
    agent_name: str = ''  # PreChat User가 정의하는 에이전트 이름
    capabilities: AgentCapabilities = field(default_factory=AgentCapabilities)
    status: str = 'active'
    created_at: str = ''
    updated_at: str = ''
    created_by: str = ''

    def validate(self) -> list[str]:
        """설정을 검증합니다."""
        errors = []

        if not self.config_id:
            errors.append('config_id is required')
        if self.agent_role not in VALID_AGENT_ROLES:
            errors.append(f'Invalid agent_role: {self.agent_role}. Must be one of {VALID_AGENT_ROLES}')
        if not self.campaign_id:
            errors.append('campaign_id is required')
        if self.model_id and self.model_id not in SUPPORTED_MODELS:
            errors.append(f'Unsupported model_id: {self.model_id}')

        return errors

    def to_dynamodb_item(self) -> dict:
        """DynamoDB 아이템으로 변환합니다."""
        return {
            'PK': f'AGENTCONFIG#{self.config_id}',
            'SK': 'METADATA',
            'configId': self.config_id,
            'agentRole': self.agent_role,
            'campaignId': self.campaign_id,
            'agentRuntimeArn': self.agent_runtime_arn,
            'modelId': self.model_id,
            'systemPrompt': self.system_prompt,
            'agentName': self.agent_name,
            'capabilities': self.capabilities.to_dict(),
            'status': self.status,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'createdBy': self.created_by,
            'GSI1PK': f'CAMPAIGN#{self.campaign_id}',
            'GSI1SK': f'AGENTCONFIG#{self.agent_role}',
        }

    @classmethod
    def from_dynamodb_item(cls, item: dict) -> 'AgentConfiguration':
        """DynamoDB 아이템에서 생성합니다."""
        return cls(
            config_id=item.get('configId', ''),
            agent_role=item.get('agentRole', ''),
            campaign_id=item.get('campaignId', ''),
            agent_runtime_arn=item.get('agentRuntimeArn', ''),
            model_id=item.get('modelId', 'us.anthropic.claude-sonnet-4-20250514-v1:0'),
            system_prompt=item.get('systemPrompt', ''),
            agent_name=item.get('agentName', ''),
            capabilities=AgentCapabilities.from_dict(item.get('capabilities', {})),
            status=item.get('status', 'active'),
            created_at=item.get('createdAt', ''),
            updated_at=item.get('updatedAt', ''),
            created_by=item.get('createdBy', ''),
        )

    def to_api_response(self) -> dict:
        """API 응답용 딕셔너리로 변환합니다."""
        return {
            'configId': self.config_id,
            'agentRole': self.agent_role,
            'campaignId': self.campaign_id,
            'agentRuntimeArn': self.agent_runtime_arn,
            'modelId': self.model_id,
            'systemPrompt': self.system_prompt,
            'agentName': self.agent_name,
            'capabilities': self.capabilities.to_dict(),
            'status': self.status,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'createdBy': self.created_by,
        }
