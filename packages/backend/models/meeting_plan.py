"""
Meeting Plan 도메인 모델

세션 완료 후 Planning Agent가 생성하는 미팅 준비 문서입니다.
Comments, References, AI Suggestions를 포함합니다.

DynamoDB Schema (SessionsTable - Single Table Design):
  PK: SESSION#{sessionId}
  SK: MEETINGPLAN
  GSI1PK: CAMPAIGN#{campaignId}
  GSI1SK: MEETINGPLAN#{createdAt}
"""

from dataclasses import dataclass, field


@dataclass
class MeetingPlanReference:
    """고객 레퍼런스 / 참고 자료"""
    summary: str = ''
    source: str = ''
    relevance_score: float = 0.0

    def to_dict(self) -> dict:
        return {
            'summary': self.summary,
            'source': self.source,
            'relevanceScore': self.relevance_score,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'MeetingPlanReference':
        return cls(
            summary=data.get('summary', ''),
            source=data.get('source', ''),
            relevance_score=float(data.get('relevanceScore', 0)),
        )


@dataclass
class MeetingPlanComment:
    """이해관계자 코멘트"""
    comment_id: str = ''
    author: str = ''
    content: str = ''
    created_at: str = ''

    def to_dict(self) -> dict:
        return {
            'commentId': self.comment_id,
            'author': self.author,
            'content': self.content,
            'createdAt': self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'MeetingPlanComment':
        return cls(
            comment_id=data.get('commentId', ''),
            author=data.get('author', ''),
            content=data.get('content', ''),
            created_at=data.get('createdAt', ''),
        )


@dataclass
class MeetingPlan:
    """Meeting Plan 엔티티"""
    session_id: str = ''
    campaign_id: str = ''
    agenda: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    recommended_services: list[str] = field(default_factory=list)
    ai_suggestions: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)
    references: list[MeetingPlanReference] = field(default_factory=list)
    comments: list[MeetingPlanComment] = field(default_factory=list)
    status: str = 'draft'  # draft, reviewed, finalized
    created_at: str = ''
    updated_at: str = ''
    generated_by: str = ''  # planning agent config id

    def to_dynamodb_item(self) -> dict:
        item = {
            'PK': f'SESSION#{self.session_id}',
            'SK': 'MEETINGPLAN',
            'sessionId': self.session_id,
            'campaignId': self.campaign_id,
            'agenda': self.agenda,
            'topics': self.topics,
            'recommendedServices': self.recommended_services,
            'aiSuggestions': self.ai_suggestions,
            'nextSteps': self.next_steps,
            'references': [r.to_dict() for r in self.references],
            'comments': [c.to_dict() for c in self.comments],
            'status': self.status,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'generatedBy': self.generated_by,
        }
        if self.campaign_id:
            item['GSI1PK'] = f'CAMPAIGN#{self.campaign_id}'
            item['GSI1SK'] = f'MEETINGPLAN#{self.created_at}'
        return item

    @classmethod
    def from_dynamodb_item(cls, item: dict) -> 'MeetingPlan':
        return cls(
            session_id=item.get('sessionId', ''),
            campaign_id=item.get('campaignId', ''),
            agenda=item.get('agenda', []),
            topics=item.get('topics', []),
            recommended_services=item.get('recommendedServices', []),
            ai_suggestions=item.get('aiSuggestions', []),
            next_steps=item.get('nextSteps', []),
            references=[MeetingPlanReference.from_dict(r) for r in item.get('references', [])],
            comments=[MeetingPlanComment.from_dict(c) for c in item.get('comments', [])],
            status=item.get('status', 'draft'),
            created_at=item.get('createdAt', ''),
            updated_at=item.get('updatedAt', ''),
            generated_by=item.get('generatedBy', ''),
        )

    def to_api_response(self) -> dict:
        return {
            'sessionId': self.session_id,
            'campaignId': self.campaign_id,
            'agenda': self.agenda,
            'topics': self.topics,
            'recommendedServices': self.recommended_services,
            'aiSuggestions': self.ai_suggestions,
            'nextSteps': self.next_steps,
            'references': [r.to_dict() for r in self.references],
            'comments': [c.to_dict() for c in self.comments],
            'status': self.status,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
        }
