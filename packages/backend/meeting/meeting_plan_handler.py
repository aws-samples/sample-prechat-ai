"""
Meeting Plan API Handler

미팅 플랜 CRUD 및 Planning Agent 호출 엔드포인트입니다.

Endpoints:
  POST /api/admin/sessions/{sessionId}/meeting-plan          - 미팅 플랜 생성 (AI)
  GET  /api/admin/sessions/{sessionId}/meeting-plan          - 미팅 플랜 조회
  PUT  /api/admin/sessions/{sessionId}/meeting-plan          - 미팅 플랜 수정
  POST /api/admin/sessions/{sessionId}/meeting-plan/comments - 코멘트 추가
"""

import json
import boto3
import os

from utils import lambda_response, parse_body, get_timestamp, generate_id
from models.meeting_plan import MeetingPlan, MeetingPlanComment, MeetingPlanReference

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')


def generate_meeting_plan(event, context):
    """
    Planning Agent를 호출하여 미팅 플랜을 생성합니다.

    POST /api/admin/sessions/{sessionId}/meeting-plan
    """
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})

    table = dynamodb.Table(SESSIONS_TABLE)

    # 세션 조회
    try:
        session_resp = table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        session = session_resp['Item']
    except Exception as e:
        return lambda_response(500, {'error': 'Database error'})

    # 대화 히스토리 조회
    messages_table = dynamodb.Table(MESSAGES_TABLE)
    try:
        msg_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        messages = msg_resp.get('Items', [])
    except Exception:
        messages = []

    # KB RAG 검색은 이제 Planning Agent 내부의 @tool로 수행됨
    # AgentCore Planning Agent가 배포되어 있으면 호출
    from agent_runtime import AgentCoreClient, get_agent_config_for_session

    campaign_id = session.get('campaignId', '')
    planning_arn, planning_config = get_agent_config_for_session(session_id, 'planning')

    if not planning_arn:
        return lambda_response(400, {'error': 'No planning agent configured'})

    # Planning Agent 호출 (Structured Output → PlanningOutput dict)
    try:
        client = AgentCoreClient()
        conversation_text = ' '.join([m.get('content', '') for m in messages])
        locale = session.get('locale', 'ko')
        plan_result = client.invoke_planning(
            agent_runtime_arn=planning_config.agent_runtime_arn if planning_config else planning_arn,
            session_id=session_id,
            session_summary=conversation_text[:3000],
            config=planning_config,
            locale=locale,
        )

        # Structured Output 결과 파싱
        raw = plan_result.get('result', {})
        if isinstance(raw, str):
            import json as json_mod
            try:
                raw = json_mod.loads(raw)
            except (json_mod.JSONDecodeError, TypeError):
                raw = {}

        if not isinstance(raw, dict):
            raw = {}

    except Exception as e:
        print(f"Planning agent call failed: {str(e)}")
        raw = {}

    # Meeting Plan 생성 — 에이전트 결과를 직접 매핑
    timestamp = get_timestamp()
    campaign_id = campaign_id or session.get('campaignId', '')
    customer_info = session.get('customerInfo', {})
    purposes = session.get('consultationPurposes', '')

    references = [
        MeetingPlanReference(
            summary=ref.get('summary', ''),
            source=ref.get('source', ''),
            relevance_score=0,
        )
        for ref in raw.get('customer_references', [])
    ]

    plan = MeetingPlan(
        session_id=session_id,
        campaign_id=campaign_id,
        agenda=raw.get('agenda', []),
        topics=raw.get('topics', _extract_topics(messages, purposes)),
        recommended_services=raw.get('recommended_services', []),
        ai_suggestions=[s for s in raw.get('ai_suggestions', []) if s],
        next_steps=raw.get('next_steps', []),
        references=references,
        status='draft',
        created_at=timestamp,
        updated_at=timestamp,
    )

    try:
        table.put_item(Item=plan.to_dynamodb_item())
        print(f"Meeting plan created for session {session_id}")
        return lambda_response(201, plan.to_api_response())
    except Exception as e:
        print(f"Failed to save meeting plan: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create meeting plan'})


def get_meeting_plan(event, context):
    """미팅 플랜을 조회합니다."""
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})

    try:
        table = dynamodb.Table(SESSIONS_TABLE)
        resp = table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'MEETINGPLAN'})

        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Meeting plan not found'})

        plan = MeetingPlan.from_dynamodb_item(resp['Item'])
        return lambda_response(200, plan.to_api_response())
    except Exception as e:
        print(f"Failed to get meeting plan: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get meeting plan'})


def update_meeting_plan(event, context):
    """미팅 플랜을 수정합니다."""
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})

    body = parse_body(event)
    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        resp = table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'MEETINGPLAN'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Meeting plan not found'})

        plan = MeetingPlan.from_dynamodb_item(resp['Item'])

        # 업데이트 가능한 필드
        if 'agenda' in body:
            plan.agenda = body['agenda']
        if 'topics' in body:
            plan.topics = body['topics']
        if 'recommendedServices' in body:
            plan.recommended_services = body['recommendedServices']
        if 'nextSteps' in body:
            plan.next_steps = body['nextSteps']
        if 'status' in body:
            plan.status = body['status']

        plan.updated_at = get_timestamp()
        table.put_item(Item=plan.to_dynamodb_item())

        return lambda_response(200, plan.to_api_response())
    except Exception as e:
        print(f"Failed to update meeting plan: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update meeting plan'})


def add_comment(event, context):
    """미팅 플랜에 코멘트를 추가합니다."""
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})

    body = parse_body(event)
    content = body.get('content', '')
    if not content:
        return lambda_response(400, {'error': 'Missing comment content'})

    table = dynamodb.Table(SESSIONS_TABLE)

    try:
        resp = table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'MEETINGPLAN'})
        if 'Item' not in resp:
            return lambda_response(404, {'error': 'Meeting plan not found'})

        plan = MeetingPlan.from_dynamodb_item(resp['Item'])

        # Cognito 사용자 정보
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        author = claims.get('email', claims.get('sub', 'unknown'))

        comment = MeetingPlanComment(
            comment_id=generate_id(),
            author=author,
            content=content,
            created_at=get_timestamp(),
        )

        plan.comments.append(comment)
        plan.updated_at = get_timestamp()
        table.put_item(Item=plan.to_dynamodb_item())

        return lambda_response(201, comment.to_dict())
    except Exception as e:
        print(f"Failed to add comment: {str(e)}")
        return lambda_response(500, {'error': 'Failed to add comment'})


def _extract_topics(messages: list, purposes: str) -> list[str]:
    """대화 내용과 상담 목적에서 주요 토픽을 추출합니다 (에이전트 폴백용)."""
    topics = []
    if purposes:
        topics.extend([p.strip() for p in purposes.split(',') if p.strip()])
    if not topics:
        topics = ['고객 요구사항 확인', 'AWS 솔루션 논의']
    return topics[:5]
