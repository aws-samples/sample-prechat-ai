"""
Legacy Compatibility Handler

레거시 엔드포인트를 새 도메인 기반 엔드포인트로 내부 리다이렉트합니다.
Deprecation 헤더를 추가하여 클라이언트에게 마이그레이션을 안내합니다.

레거시 엔드포인트:
  POST /api/chat/message → POST /api/sessions/{sessionId}/messages
  POST /api/chat/stream  → POST /api/sessions/{sessionId}/messages/stream
  GET  /api/chat/session/{sessionId} → GET /api/sessions/{sessionId}
"""

import json
from utils import parse_body
from session_messages_handler import send_message as domain_send_message
from session_handler import get_session as domain_get_session


def _add_deprecation_headers(response, new_endpoint):
    """응답에 deprecation 헤더를 추가합니다."""
    if not response.get('headers'):
        response['headers'] = {}
    response['headers']['X-Deprecated'] = 'true'
    response['headers']['X-New-Endpoint'] = new_endpoint
    response['headers']['X-Deprecation-Notice'] = (
        'This endpoint is deprecated. Please migrate to the new domain-based endpoint.'
    )
    return response


def handle_legacy_chat(event, context):
    """
    레거시 POST /api/chat/message 엔드포인트

    요청 본문의 sessionId를 추출하여 새 엔드포인트로 내부 리다이렉트합니다.
    """
    body = parse_body(event)
    session_id = body.get('sessionId', '')

    if not session_id:
        return _add_deprecation_headers({
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': 'Missing sessionId'})
        }, '/api/sessions/{sessionId}/messages')

    print(f"[DEPRECATED] Legacy /api/chat/message called for session {session_id}")

    # pathParameters를 주입하여 새 핸들러 호출
    if not event.get('pathParameters'):
        event['pathParameters'] = {}
    event['pathParameters']['sessionId'] = session_id

    response = domain_send_message(event, context)
    new_endpoint = f'/api/sessions/{session_id}/messages'
    return _add_deprecation_headers(response, new_endpoint)


def handle_legacy_get_session(event, context):
    """
    레거시 GET /api/chat/session/{sessionId} 엔드포인트

    새 GET /api/sessions/{sessionId} 엔드포인트로 내부 리다이렉트합니다.
    """
    session_id = event.get('pathParameters', {}).get('sessionId', '')

    print(f"[DEPRECATED] Legacy /api/chat/session/{session_id} called")

    response = domain_get_session(event, context)
    new_endpoint = f'/api/sessions/{session_id}'
    return _add_deprecation_headers(response, new_endpoint)
