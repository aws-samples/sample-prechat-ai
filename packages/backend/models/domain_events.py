"""
도메인 이벤트 정의

PreChat 시스템의 도메인 이벤트를 정의합니다.
DynamoDB Streams를 통해 감지되고 Trigger 시스템에 의해 처리됩니다.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DomainEvent:
    """도메인 이벤트 기본 클래스"""
    event_type: str
    timestamp: str = ''

    def to_context(self) -> dict:
        """트리거 메시지 템플릿에서 사용할 컨텍스트를 반환합니다."""
        return {'event_type': self.event_type, 'timestamp': self.timestamp}


@dataclass
class SessionCreatedEvent(DomainEvent):
    """세션 생성 이벤트"""
    event_type: str = 'SessionCreated'
    session_id: str = ''
    campaign_id: str = ''
    campaign_name: str = ''
    customer_name: str = ''
    customer_email: str = ''
    customer_company: str = ''
    created_at: str = ''
    admin_url: str = ''

    def to_context(self) -> dict:
        ctx = super().to_context()
        ctx.update({
            'session_id': self.session_id,
            'campaign_id': self.campaign_id,
            'campaign_name': self.campaign_name,
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_company': self.customer_company,
            'created_at': self.created_at,
            'admin_url': self.admin_url,
        })
        return ctx


@dataclass
class SessionCompletedEvent(DomainEvent):
    """세션 완료 이벤트"""
    event_type: str = 'SessionCompleted'
    session_id: str = ''
    campaign_id: str = ''
    campaign_name: str = ''
    customer_name: str = ''
    customer_email: str = ''
    customer_company: str = ''
    sales_rep_email: str = ''
    completed_at: str = ''
    created_at: str = ''
    duration_minutes: int = 0
    message_count: int = 0
    admin_url: str = ''

    def to_context(self) -> dict:
        ctx = super().to_context()
        ctx.update({
            'session_id': self.session_id,
            'campaign_id': self.campaign_id,
            'campaign_name': self.campaign_name,
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_company': self.customer_company,
            'sales_rep_email': self.sales_rep_email,
            'completed_at': self.completed_at,
            'created_at': self.created_at,
            'duration_minutes': self.duration_minutes,
            'message_count': self.message_count,
            'admin_url': self.admin_url,
        })
        return ctx


@dataclass
class SessionInactivatedEvent(DomainEvent):
    """세션 비활성화 이벤트"""
    event_type: str = 'SessionInactivated'
    session_id: str = ''
    campaign_id: str = ''
    customer_name: str = ''
    inactivated_at: str = ''

    def to_context(self) -> dict:
        ctx = super().to_context()
        ctx.update({
            'session_id': self.session_id,
            'campaign_id': self.campaign_id,
            'customer_name': self.customer_name,
            'inactivated_at': self.inactivated_at,
        })
        return ctx


@dataclass
class CampaignCreatedEvent(DomainEvent):
    """캠페인 생성 이벤트"""
    event_type: str = 'CampaignCreated'
    campaign_id: str = ''
    campaign_name: str = ''
    campaign_code: str = ''
    owner_email: str = ''
    created_at: str = ''

    def to_context(self) -> dict:
        ctx = super().to_context()
        ctx.update({
            'campaign_id': self.campaign_id,
            'campaign_name': self.campaign_name,
            'campaign_code': self.campaign_code,
            'owner_email': self.owner_email,
            'created_at': self.created_at,
        })
        return ctx


@dataclass
class CampaignClosedEvent(DomainEvent):
    """캠페인 종료 이벤트"""
    event_type: str = 'CampaignClosed'
    campaign_id: str = ''
    campaign_name: str = ''
    closed_at: str = ''
    total_sessions: int = 0

    def to_context(self) -> dict:
        ctx = super().to_context()
        ctx.update({
            'campaign_id': self.campaign_id,
            'campaign_name': self.campaign_name,
            'closed_at': self.closed_at,
            'total_sessions': self.total_sessions,
        })
        return ctx
