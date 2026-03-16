"""
SHIP SATv2 Assessment Callback Handler

EventBridge CodeBuild 상태 변경 이벤트를 처리한다.
SUCCEEDED → assessmentStatus='completed', reportS3Key 설정, roleArn 삭제
FAILED/STOPPED → assessmentStatus='failed'
멱등성 보장: 이미 completed/failed 상태인 세션에 대한 콜백 무시
"""

import boto3
import os
from utils import lambda_response, get_timestamp

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
PROWLER_FINDINGS_BUCKET = os.environ.get('PROWLER_FINDINGS_BUCKET')


def _get_session(session_id):
    """세션 레코드를 조회한다."""
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    resp = sessions_table.get_item(
        Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
    )
    return resp.get('Item')


def _record_assessment_event(session_id, event_type, details=None, ttl=None):
    """Assessment 이벤트 이력을 기록한다."""
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


def _find_report_key(session_id, folder, extension):
    """S3에서 해당 세션의 특정 형식 레포트 키를 찾는다."""
    prefix = f'assessments/{session_id}/{folder}/'
    try:
        resp = s3_client.list_objects_v2(
            Bucket=PROWLER_FINDINGS_BUCKET,
            Prefix=prefix,
            MaxKeys=10,
        )
        for obj in resp.get('Contents', []):
            key = obj['Key']
            if key.endswith(extension):
                return key
    except Exception as e:
        print(f"Error listing S3 objects for session {session_id}/{folder}: {str(e)}")
    return None


def _find_all_report_keys(session_id):
    """세션의 HTML, CSV, JSON 레포트 키를 모두 찾는다."""
    return {
        'reportHtmlKey': _find_report_key(session_id, 'html', '.html'),
        'reportCsvKey': _find_report_key(session_id, 'csv', '.csv'),
        'reportJsonKey': _find_report_key(session_id, 'json', '.json'),
    }


def handle_codebuild_event(event, context):
    """EventBridge CodeBuild 상태 변경 이벤트를 처리한다.

    SUCCEEDED → assessmentStatus='completed', reportS3Key 설정, roleArn 삭제
    FAILED/STOPPED → assessmentStatus='failed'
    """
    detail = event.get('detail', {})
    build_status = detail.get('build-status', '')
    project_name = detail.get('project-name', '')

    # 환경변수에서 세션 ID 추출
    env_vars = (
        detail.get('additional-information', {})
        .get('environment', {})
        .get('environment-variables', [])
    )
    session_id = ''
    for var in env_vars:
        if var.get('name') == 'SCAN_SESSION_ID':
            session_id = var.get('value', '')
            break

    if not session_id:
        print(f"No SCAN_SESSION_ID in CodeBuild event for project {project_name}")
        return lambda_response(400, {'error': 'Missing session ID'})

    print(f"CodeBuild callback: session={session_id}, status={build_status}")

    session = _get_session(session_id)
    if not session:
        print(f"Session not found: {session_id}")
        return lambda_response(404, {'error': 'Session not found'})

    current_status = session.get('assessmentStatus', '')

    # 멱등성: 이미 최종 상태인 세션은 무시
    if current_status in ('completed', 'failed'):
        print(f"Session {session_id} already in terminal state: {current_status}")
        return lambda_response(200, {'message': 'Already processed'})

    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    timestamp = get_timestamp()
    ttl = session.get('ttl')

    if build_status == 'SUCCEEDED':
        # HTML, CSV, JSON 레포트 키 탐색
        report_keys = _find_all_report_keys(session_id)
        html_key = report_keys.get('reportHtmlKey')
        csv_key = report_keys.get('reportCsvKey')
        json_key = report_keys.get('reportJsonKey')

        # completed 상태로 전이, roleArn 삭제
        update_expr = (
            'SET assessmentStatus = :status, '
            'assessmentCompletedAt = :completed_at, '
            'updatedAt = :ts'
        )
        expr_values = {
            ':status': 'completed',
            ':completed_at': timestamp,
            ':ts': timestamp,
        }

        # 레포트 키가 존재하면 각각 저장
        if html_key:
            update_expr += ', reportHtmlKey = :html_key'
            expr_values[':html_key'] = html_key
        if csv_key:
            update_expr += ', reportCsvKey = :csv_key'
            expr_values[':csv_key'] = csv_key
        if json_key:
            update_expr += ', reportJsonKey = :json_key'
            expr_values[':json_key'] = json_key

        # 하위 호환: reportS3Key에 HTML 키 유지
        if html_key:
            update_expr += ', reportS3Key = :report_key'
            expr_values[':report_key'] = html_key

        update_expr += ' REMOVE roleArn'

        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )

        _record_assessment_event(
            session_id, 'completed',
            details={
                'reportHtmlKey': html_key or '',
                'reportCsvKey': csv_key or '',
                'reportJsonKey': json_key or '',
                'buildStatus': build_status,
            },
            ttl=ttl,
        )

        print(f"Session {session_id} assessment completed. HTML: {html_key}, CSV: {csv_key}, JSON: {json_key}")

    else:
        # FAILED 또는 STOPPED → failed 상태
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET assessmentStatus = :status, updatedAt = :ts',
            ExpressionAttributeValues={
                ':status': 'failed',
                ':ts': timestamp,
            },
        )

        _record_assessment_event(
            session_id, 'failed',
            details={'buildStatus': build_status},
            ttl=ttl,
        )

        print(f"Session {session_id} assessment failed: {build_status}")

    return lambda_response(200, {'message': f'Callback processed: {build_status}'})
