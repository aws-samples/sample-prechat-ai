"""
SHIP SATv2 Assessment Handler

SHIP Assessment 관련 API 핸들러.
법적 규약 동의, Role ARN 제출, Assessment 상태 조회,
레포트 다운로드 URL 생성, A2T 로그 조회를 처리한다.
"""

import json
import re
import hmac
import boto3
import os
from utils import (
    lambda_response,
    parse_body,
    get_timestamp,
    get_ttl_timestamp,
)

dynamodb = boto3.resource('dynamodb')
codebuild = boto3.client('codebuild')
s3_client = boto3.client('s3')

SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
CODEBUILD_PROJECT_NAME = os.environ.get('CODEBUILD_PROJECT_NAME')
PROWLER_FINDINGS_BUCKET = os.environ.get('PROWLER_FINDINGS_BUCKET')
PROWLER_CODEBUILD_ROLE_ARN = os.environ.get('PROWLER_CODEBUILD_ROLE_ARN', '')

ROLE_ARN_PATTERN = re.compile(r'^arn:aws:iam::\d{12}:role/.+$')
SESSION_ID_PATTERN = re.compile(r'^[a-zA-Z0-9\-]+$')

# Assessment 상태 전이 규칙
VALID_TRANSITIONS = {
    'pending': ['legal_agreed'],
    'legal_agreed': ['role_submitted'],
    'role_submitted': ['scanning'],
    'scanning': ['completed', 'failed'],
    'failed': ['role_submitted'],
}

PRESIGNED_URL_EXPIRY = 900  # 15분 (초)


def _get_session(session_id):
    """세션 레코드를 조회한다."""
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    resp = sessions_table.get_item(
        Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
    )
    return resp.get('Item')


def _validate_session_id(session_id):
    """세션 ID 형식을 검증한다."""
    if not session_id or len(session_id) > 128:
        return False
    return bool(SESSION_ID_PATTERN.match(session_id))


def _verify_pin(event, session):
    """요청의 PIN을 세션 PIN과 비교하여 인증한다. (타이밍 안전)"""
    headers = event.get('headers', {})
    headers_lower = {k.lower(): v for k, v in (headers or {}).items()}
    pin = headers_lower.get('x-pin-number', '')

    if not pin:
        body = parse_body(event)
        pin = body.get('pinNumber', '')

    stored = session.get('pinNumber', '')
    if not pin or not stored:
        return False
    return hmac.compare_digest(pin, stored)


def _record_assessment_event(session_id, event_type, details=None, ttl=None):
    """Assessment 이벤트 이력을 기록한다. SK: ASSESSMENT#{timestamp}"""
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    timestamp = get_timestamp()
    item = {
        'PK': f'SESSION#{session_id}',
        'SK': f'ASSESSMENT#{timestamp}',
        'eventType': event_type,
        'timestamp': timestamp,
        'details': details or {},
    }
    if ttl:
        item['ttl'] = ttl
    sessions_table.put_item(Item=item)


def _update_assessment_status(session_id, new_status, extra_updates=None):
    """assessmentStatus를 업데이트하고 이벤트 이력을 기록한다."""
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    timestamp = get_timestamp()

    update_expr = 'SET assessmentStatus = :status, updatedAt = :ts'
    expr_values = {':status': new_status, ':ts': timestamp}

    if extra_updates:
        for key, val in extra_updates.items():
            update_expr += f', {key} = :{key}'
            expr_values[f':{key}'] = val

    sessions_table.update_item(
        Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
    )

    # 세션의 TTL을 가져와서 이벤트에도 동일하게 적용
    session = _get_session(session_id)
    ttl = session.get('ttl') if session else None
    _record_assessment_event(session_id, new_status, ttl=ttl)


def submit_legal_consent(event, context):
    """법적 규약 동의 기록 - assessmentStatus를 'legal_agreed'로 업데이트"""
    session_id = event['pathParameters']['sessionId']

    if not _validate_session_id(session_id):
        return lambda_response(400, {'error': 'Invalid session ID'})

    session = _get_session(session_id)
    if not session:
        return lambda_response(404, {'error': 'Session not found'})

    if not _verify_pin(event, session):
        return lambda_response(403, {'error': 'Invalid PIN number'})

    body = parse_body(event)
    agreed = body.get('agreed', False)

    if not agreed:
        return lambda_response(400, {'error': 'Legal consent must be agreed'})

    current_status = session.get('assessmentStatus', 'pending')

    # 이미 동의 완료된 상태면 멱등적으로 성공 반환
    if current_status != 'pending':
        return lambda_response(200, {
            'message': 'Legal consent already recorded',
            'assessmentStatus': current_status,
            'legalConsentTimestamp': session.get('legalConsentTimestamp', ''),
        })

    timestamp = get_timestamp()
    _update_assessment_status(session_id, 'legal_agreed', {
        'legalConsentTimestamp': timestamp,
        'legalConsentAgreed': True,
    })

    return lambda_response(200, {
        'message': 'Legal consent recorded',
        'assessmentStatus': 'legal_agreed',
        'legalConsentTimestamp': timestamp,
    })


def submit_role_arn(event, context):
    """Role ARN 제출, 형식 검증, CodeBuild StartBuild 트리거"""
    session_id = event['pathParameters']['sessionId']

    if not _validate_session_id(session_id):
        return lambda_response(400, {'error': 'Invalid session ID'})

    session = _get_session(session_id)
    if not session:
        return lambda_response(404, {'error': 'Session not found'})

    if not _verify_pin(event, session):
        return lambda_response(403, {'error': 'Invalid PIN number'})

    current_status = session.get('assessmentStatus', '')
    if current_status not in ('legal_agreed', 'failed'):
        if current_status == 'pending':
            return lambda_response(400, {'error': 'Legal consent required'})
        if current_status in ('scanning', 'role_submitted'):
            return lambda_response(409, {'error': 'Assessment already in progress'})
        return lambda_response(400, {'error': f'Cannot submit role ARN in status: {current_status}'})

    body = parse_body(event)
    role_arn = body.get('roleArn', '').strip()

    if not ROLE_ARN_PATTERN.match(role_arn):
        return lambda_response(400, {'error': 'Invalid Role ARN format'})

    timestamp = get_timestamp()

    # role_submitted 상태로 전이
    _update_assessment_status(session_id, 'role_submitted', {
        'roleArn': role_arn,
        'assessmentRequestedAt': timestamp,
    })

    # CodeBuild StartBuild 트리거
    try:
        build_response = codebuild.start_build(
            projectName=CODEBUILD_PROJECT_NAME,
            environmentVariablesOverride=[
                {'name': 'SCAN_SESSION_ID', 'value': session_id, 'type': 'PLAINTEXT'},
                {'name': 'TARGET_ROLE_ARN', 'value': role_arn, 'type': 'PLAINTEXT'},
                {'name': 'EXTERNAL_ID', 'value': session_id, 'type': 'PLAINTEXT'},
            ],
        )
        build_id = build_response['build']['id']

        # scanning 상태로 전이
        _update_assessment_status(session_id, 'scanning', {
            'codeBuildId': build_id,
        })

        return lambda_response(200, {
            'message': 'Assessment scan started',
            'assessmentStatus': 'scanning',
            'codeBuildId': build_id,
        })
    except Exception as e:
        print(f"Failed to start CodeBuild: {str(e)}")
        _update_assessment_status(session_id, 'failed')
        return lambda_response(500, {'error': 'Failed to start scan'})


def get_assessment_status(event, context):
    """현재 Assessment 상태 조회"""
    session_id = event['pathParameters']['sessionId']

    if not _validate_session_id(session_id):
        return lambda_response(400, {'error': 'Invalid session ID'})

    session = _get_session(session_id)
    if not session:
        return lambda_response(404, {'error': 'Session not found'})

    if not _verify_pin(event, session):
        return lambda_response(403, {'error': 'Invalid PIN number'})

    assessment_status = session.get('assessmentStatus', 'pending')
    response_data = {
        'assessmentStatus': assessment_status,
        'assessmentRequestedAt': session.get('assessmentRequestedAt', ''),
        'assessmentCompletedAt': session.get('assessmentCompletedAt', ''),
        'hasReport': bool(session.get('reportHtmlKey') or session.get('reportS3Key')),
        'hasHtmlReport': bool(session.get('reportHtmlKey') or session.get('reportS3Key')),
        'hasCsvReport': assessment_status == 'completed',
        'codeBuildRoleArn': PROWLER_CODEBUILD_ROLE_ARN,
    }

    # scanning 상태일 때 CodeBuild 빌드 진행 상태 조회
    if assessment_status == 'scanning' and session.get('codeBuildId'):
        try:
            build_resp = codebuild.batch_get_builds(
                ids=[session['codeBuildId']]
            )
            builds = build_resp.get('builds', [])
            if builds:
                build = builds[0]
                response_data['buildStatus'] = build.get('buildStatus', '')
                response_data['buildPhase'] = build.get('currentPhase', '')
        except Exception as e:
            print(f"CodeBuild status query failed: {str(e)}")

    return lambda_response(200, response_data)


def get_report_download_url(event, context):
    """SHIP Report Pre-signed URL 생성 (15분 유효)

    쿼리 파라미터 reportType으로 다운로드 대상을 선택한다.
    - html (기본값): Prowler HTML 레포트
    - csv: Athena 집계 CSV 레포트
    """
    session_id = event['pathParameters']['sessionId']

    if not _validate_session_id(session_id):
        return lambda_response(400, {'error': 'Invalid session ID'})

    session = _get_session(session_id)
    if not session:
        return lambda_response(404, {'error': 'Session not found'})

    if not _verify_pin(event, session):
        return lambda_response(403, {'error': 'Invalid PIN number'})

    # reportType 쿼리 파라미터 (기본: html)
    query_params = event.get('queryStringParameters') or {}
    report_type = query_params.get('reportType', 'html')

    if report_type not in ('html', 'csv'):
        return lambda_response(400, {
            'error': f'Invalid reportType: {report_type}. Must be one of: html, csv',
        })

    # reportType에 따라 S3 키 결정
    if report_type == 'csv':
        # Athena 집계 CSV — 결정론적 경로
        report_key = f'assessments/{session_id}/reports/'
        # reports/ 하위에서 .csv 파일 탐색
        try:
            resp = s3_client.list_objects_v2(
                Bucket=PROWLER_FINDINGS_BUCKET,
                Prefix=report_key,
                MaxKeys=10,
            )
            csv_keys = [
                obj['Key'] for obj in resp.get('Contents', [])
                if obj['Key'].endswith('.csv')
            ]
            report_key = csv_keys[0] if csv_keys else f'assessments/{session_id}/reports/results.csv'
        except Exception:
            report_key = f'assessments/{session_id}/reports/results.csv'
    else:
        # html — DynamoDB에서 키 조회
        report_key = session.get('reportHtmlKey')
        if not report_key:
            report_key = session.get('reportS3Key')
        if not report_key:
            return lambda_response(404, {'error': f'Report not found for type: {report_type}'})

    try:
        from datetime import datetime, timezone, timedelta

        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': PROWLER_FINDINGS_BUCKET,
                'Key': report_key,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY,
        )

        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=PRESIGNED_URL_EXPIRY)
        ).isoformat()

        file_name = report_key.split('/')[-1] if '/' in report_key else report_key

        return lambda_response(200, {
            'downloadUrl': download_url,
            'expiresAt': expires_at,
            'fileName': file_name,
            'reportType': report_type,
        })
    except Exception as e:
        print(f"Failed to generate pre-signed URL for {report_type}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to generate download URL'})


