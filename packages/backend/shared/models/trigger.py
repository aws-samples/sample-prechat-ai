"""
Trigger 도메인 모델

도메인 이벤트에 반응하여 외부 시스템(Slack, SNS 등)으로 알림을 전송하는
Trigger 엔티티를 정의합니다.

모든 이벤트는 동일한 고정 스키마(12개 key)의 dict를 그대로 JSON 전송합니다.
Jinja2 템플릿 렌더링 없이 event_data dict를 직접 사용합니다.
"""

from dataclasses import dataclass
from typing import Optional
from enum import Enum


class TriggerType(str, Enum):
    """지원되는 트리거 유형"""
    SLACK = 'slack'
    SNS = 'sns'
    WEBHOOK = 'webhook'


class EventType(str, Enum):
    """지원되는 도메인 이벤트 유형"""
    SESSION_CREATED = 'SessionCreated'
    SESSION_COMPLETED = 'SessionCompleted'
    SESSION_INACTIVATED = 'SessionInactivated'
    CAMPAIGN_CREATED = 'CampaignCreated'
    CAMPAIGN_CLOSED = 'CampaignCompleted'


class TriggerStatus(str, Enum):
    """트리거 상태"""
    ACTIVE = 'active'
    INACTIVE = 'inactive'


VALID_TRIGGER_TYPES = {t.value for t in TriggerType}
VALID_EVENT_TYPES = {e.value for e in EventType}
VALID_TRIGGER_STATUSES = {s.value for s in TriggerStatus}


@dataclass
class Trigger:
    """Trigger 엔티티"""
    trigger_id: str
    trigger_type: str
    event_type: str
    delivery_endpoint: str
    status: str = TriggerStatus.ACTIVE.value
    campaign_id: Optional[str] = None
    is_global: bool = False
    created_at: str = ''
    updated_at: str = ''
    created_by: str = ''

    def validate(self) -> list[str]:
        """트리거 설정을 검증하고 에러 목록을 반환합니다."""
        errors = []

        if not self.trigger_id:
            errors.append('trigger_id is required')

        if self.trigger_type not in VALID_TRIGGER_TYPES:
            errors.append(f'Invalid trigger_type: {self.trigger_type}. Must be one of {VALID_TRIGGER_TYPES}')

        if self.event_type not in VALID_EVENT_TYPES:
            errors.append(f'Invalid event_type: {self.event_type}. Must be one of {VALID_EVENT_TYPES}')

        if not self.delivery_endpoint:
            errors.append('delivery_endpoint is required')

        if self.trigger_type == TriggerType.SLACK.value:
            if not (self.delivery_endpoint.startswith('https://hooks.slack.com/')
                    or self.delivery_endpoint.startswith('https://hooks.slack.com/triggers/')):
                errors.append('Slack delivery_endpoint must start with https://hooks.slack.com/')

        if self.trigger_type == TriggerType.SNS.value:
            if not self.delivery_endpoint.startswith('arn:aws:sns:'):
                errors.append('SNS delivery_endpoint must be a valid SNS Topic ARN')

        if self.status not in VALID_TRIGGER_STATUSES:
            errors.append(f'Invalid status: {self.status}. Must be one of {VALID_TRIGGER_STATUSES}')

        if not self.is_global and not self.campaign_id:
            errors.append('campaign_id is required for non-global triggers')

        return errors

    def to_dynamodb_item(self) -> dict:
        """DynamoDB 아이템으로 변환합니다."""
        item = {
            'PK': f'TRIGGER#{self.trigger_id}',
            'SK': 'METADATA',
            'triggerId': self.trigger_id,
            'triggerType': self.trigger_type,
            'eventType': self.event_type,
            'deliveryEndpoint': self.delivery_endpoint,
            'status': self.status,
            'isGlobal': self.is_global,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'createdBy': self.created_by,
            'GSI1PK': f'EVENT#{self.event_type}',
            'GSI1SK': f'TRIGGER#{self.trigger_id}',
        }

        if self.campaign_id:
            item['campaignId'] = self.campaign_id
            item['GSI2PK'] = f'CAMPAIGN#{self.campaign_id}'
            item['GSI2SK'] = f'TRIGGER#{self.trigger_id}'

        return item

    @classmethod
    def from_dynamodb_item(cls, item: dict) -> 'Trigger':
        """DynamoDB 아이템에서 Trigger를 생성합니다."""
        return cls(
            trigger_id=item.get('triggerId', ''),
            trigger_type=item.get('triggerType', ''),
            event_type=item.get('eventType', ''),
            delivery_endpoint=item.get('deliveryEndpoint', ''),
            status=item.get('status', TriggerStatus.ACTIVE.value),
            campaign_id=item.get('campaignId'),
            is_global=item.get('isGlobal', False),
            created_at=item.get('createdAt', ''),
            updated_at=item.get('updatedAt', ''),
            created_by=item.get('createdBy', ''),
        )

    def to_api_response(self) -> dict:
        """API 응답용 딕셔너리로 변환합니다."""
        result = {
            'triggerId': self.trigger_id,
            'triggerType': self.trigger_type,
            'eventType': self.event_type,
            'deliveryEndpoint': self.delivery_endpoint,
            'status': self.status,
            'isGlobal': self.is_global,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'createdBy': self.created_by,
        }
        if self.campaign_id:
            result['campaignId'] = self.campaign_id
        return result
