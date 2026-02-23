"""
도메인 이벤트 정의

PreChat 시스템의 도메인 이벤트를 정의합니다.
DynamoDB Streams를 통해 감지되고 Trigger 시스템에 의해 처리됩니다.

모든 이벤트는 동일한 통합 스키마를 사용합니다:
  event_type, session_id, campaign_id, campaign_name,
  customer_name, customer_company, customer_email,
  sales_rep_email, message_count, duration_minutes,
  admin_url, event_time
"""

from dataclasses import dataclass, field
from typing import Optional


# 통합 이벤트 스키마 key 목록
UNIFIED_EVENT_KEYS = [
    'event_type', 'session_id', 'campaign_id', 'campaign_name',
    'customer_name', 'customer_company', 'customer_email',
    'sales_rep_email', 'message_count', 'duration_minutes',
    'admin_url', 'event_time',
]


@dataclass
class DomainEvent:
    """도메인 이벤트 기본 클래스 - 통합 스키마"""
    event_type: str
    session_id: str = ''
    campaign_id: str = ''
    campaign_name: str = ''
    customer_name: str = ''
    customer_company: str = ''
    customer_email: str = ''
    sales_rep_email: str = ''
    message_count: str = ''
    duration_minutes: str = ''
    admin_url: str = ''
    event_time: str = ''

    def to_context(self) -> dict:
        """트리거 메시지 템플릿에서 사용할 컨텍스트를 반환합니다."""
        return {key: getattr(self, key, '') for key in UNIFIED_EVENT_KEYS}
