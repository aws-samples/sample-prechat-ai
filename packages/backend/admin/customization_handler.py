"""
UI Customization 핸들러

관리자가 고객 대면 채팅 인터페이스의 시각적 요소를 동적으로 구성할 수 있도록
Customizing Set(JSON)을 S3에서 읽고 쓰는 Lambda 함수들을 제공합니다.
"""

import json
import os
import base64
import time
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from utils import lambda_response

s3_client = boto3.client('s3')

CUSTOMIZATION_KEY = 'customization/customizing-set.json'
LOGO_PREFIX = 'customization/logos/'
LEGAL_PREFIX = 'customization/legal/'

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.svg', '.webp'}
ALLOWED_DOC_EXTENSIONS = {'.md'}
ALLOWED_DOC_TYPES = {'privacy', 'service'}
ALLOWED_LOCALES = {'ko', 'en'}

MAX_LOGO_SIZE = 2 * 1024 * 1024       # 2MB
MAX_LEGAL_DOC_SIZE = 1 * 1024 * 1024   # 1MB

CACHE_CONTROL_NO_CACHE = 'no-cache, no-store, must-revalidate'

# MIME 타입 매핑
CONTENT_TYPE_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.md': 'text/markdown',
}

DEFAULT_CUSTOMIZING_SET = {
    "header": {
        "logoUrl": None,
        "logoLink": None,
        "label": None,
        "labelLink": None
    },
    "welcome": {
        "logoUrl": None,
        "logoLink": None,
        "title": None,
        "subtitle": None
    },
    "background": {
        "startColor": None,
        "endColor": None
    },
    "legal": {
        "privacyTermUrl": None,
        "serviceTermUrl": None,
        "supportChannel": None
    },
    "meta": {
        "updatedAt": None,
        "version": "1.0"
    }
}


def _get_bucket_name():
    """환경 변수에서 S3 버킷명을 가져옵니다."""
    bucket_name = os.environ.get('WEBSITE_BUCKET')
    if not bucket_name:
        raise ValueError('WEBSITE_BUCKET environment variable not set')
    return bucket_name


def _get_file_extension(filename):
    """파일명에서 확장자를 소문자로 추출합니다."""
    if '.' not in filename:
        return ''
    return '.' + filename.rsplit('.', 1)[-1].lower()


def parse_multipart(event):
    """multipart/form-data에서 파일 데이터와 파일명을 추출합니다.

    Args:
        event: API Gateway Lambda proxy 이벤트

    Returns:
        tuple: (file_data: bytes, filename: str)

    Raises:
        ValueError: 파싱 실패 시
    """
    # body 디코딩
    body = event.get('body', '')
    if not body:
        raise ValueError('Empty request body')

    if event.get('isBase64Encoded', False):
        body_bytes = base64.b64decode(body)
    else:
        # API Gateway가 바이너리를 base64로 보내지만 isBase64Encoded가 누락될 수 있음
        # base64 디코딩을 먼저 시도하고, 실패하면 원본 사용
        if isinstance(body, str):
            try:
                body_bytes = base64.b64decode(body)
            except Exception:
                body_bytes = body.encode('latin-1')
        else:
            body_bytes = body

    # Content-Type 헤더에서 boundary 추출
    headers = event.get('headers', {})
    content_type = ''
    for key, value in headers.items():
        if key.lower() == 'content-type':
            content_type = value
            break

    if 'boundary=' not in content_type:
        raise ValueError('Missing boundary in Content-Type header')

    boundary = content_type.split('boundary=')[-1].strip()
    if boundary.startswith('"') and boundary.endswith('"'):
        boundary = boundary[1:-1]

    boundary_bytes = ('--' + boundary).encode('utf-8')

    # boundary로 파트 분리
    parts = body_bytes.split(boundary_bytes)

    for part in parts:
        # 빈 파트 또는 종료 마커 건너뛰기
        if not part or part.strip() == b'--' or part.strip() == b'':
            continue

        # 헤더와 본문 분리 (빈 줄로 구분)
        if b'\r\n\r\n' in part:
            header_section, file_content = part.split(b'\r\n\r\n', 1)
        elif b'\n\n' in part:
            header_section, file_content = part.split(b'\n\n', 1)
        else:
            continue

        header_text = header_section.decode('utf-8', errors='replace')

        # filename이 포함된 파트 찾기
        if 'filename=' not in header_text:
            continue

        # 파일명 추출
        filename = ''
        for line in header_text.split('\n'):
            if 'filename=' in line:
                # filename="example.png" 형태에서 추출
                parts_line = line.split('filename=')
                if len(parts_line) > 1:
                    fname = parts_line[1].strip().strip('"').strip("'")
                    # 세미콜론 이후 제거
                    if ';' in fname:
                        fname = fname.split(';')[0].strip().strip('"')
                    filename = fname
                    break

        if not filename:
            raise ValueError('Could not extract filename from multipart data')

        # 후행 CRLF 제거
        if file_content.endswith(b'\r\n'):
            file_content = file_content[:-2]
        elif file_content.endswith(b'\n'):
            file_content = file_content[:-1]

        return file_content, filename

    raise ValueError('No file found in multipart data')


# ---------------------------------------------------------------------------
# 1.1 GET /api/admin/customization
# ---------------------------------------------------------------------------

def get_customization(event, context):
    """S3에서 Customizing Set을 조회합니다.

    파일이 없으면 기본 Customizing Set을 반환합니다.
    Cognito JWT 인증은 API Gateway Authorizer가 처리합니다.
    """
    try:
        bucket_name = _get_bucket_name()
    except ValueError as e:
        print(f"Configuration error: {str(e)}")
        return lambda_response(500, {'error': 'Server configuration error'})

    try:
        response = s3_client.get_object(
            Bucket=bucket_name,
            Key=CUSTOMIZATION_KEY
        )
        body = response['Body'].read().decode('utf-8')
        customizing_set = json.loads(body)
        print(f"Customizing Set loaded from S3: {CUSTOMIZATION_KEY}")
        return lambda_response(200, customizing_set)

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            print("Customizing Set not found in S3, returning defaults")
            return lambda_response(200, DEFAULT_CUSTOMIZING_SET)
        print(f"S3 ClientError reading customization: {error_code} - {str(e)}")
        return lambda_response(500, {'error': 'Failed to read customization'})

    except json.JSONDecodeError as e:
        print(f"Invalid JSON in customizing-set.json: {str(e)}")
        return lambda_response(200, DEFAULT_CUSTOMIZING_SET)

    except Exception as e:
        print(f"Unexpected error in get_customization: {str(e)}")
        return lambda_response(500, {'error': 'Failed to read customization'})



# ---------------------------------------------------------------------------
# 1.2 POST /api/admin/customization
# ---------------------------------------------------------------------------

def save_customization(event, context):
    """Customizing Set을 S3에 저장합니다.

    요청 본문의 JSON을 파싱하여 S3에 저장하며,
    Cache-Control 메타데이터를 포함하여 즉시 반영을 보장합니다.
    meta.updatedAt은 현재 UTC ISO 8601 타임스탬프로 자동 설정됩니다.
    """
    try:
        bucket_name = _get_bucket_name()
    except ValueError as e:
        print(f"Configuration error: {str(e)}")
        return lambda_response(500, {'error': 'Server configuration error'})

    # 요청 본문 파싱
    try:
        body = event.get('body', '')
        if not body:
            return lambda_response(400, {'error': 'Invalid request body'})

        if isinstance(body, str):
            customizing_set = json.loads(body)
        else:
            customizing_set = body

        if not isinstance(customizing_set, dict):
            return lambda_response(400, {'error': 'Invalid request body'})

    except (json.JSONDecodeError, TypeError):
        return lambda_response(400, {'error': 'Invalid request body'})

    # meta.updatedAt을 현재 UTC ISO 8601 타임스탬프로 자동 설정
    if 'meta' not in customizing_set:
        customizing_set['meta'] = {}
    customizing_set['meta']['updatedAt'] = datetime.now(timezone.utc).strftime(
        '%Y-%m-%dT%H:%M:%SZ'
    )
    if 'version' not in customizing_set['meta']:
        customizing_set['meta']['version'] = '1.0'

    # S3에 저장
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=CUSTOMIZATION_KEY,
            Body=json.dumps(customizing_set, ensure_ascii=False),
            ContentType='application/json',
            CacheControl=CACHE_CONTROL_NO_CACHE
        )
        print(f"Customizing Set saved to S3: {CUSTOMIZATION_KEY}")
        return lambda_response(200, customizing_set)

    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"S3 ClientError saving customization: {error_code} - {str(e)}")
        return lambda_response(500, {'error': 'Failed to save customization'})

    except Exception as e:
        print(f"Unexpected error in save_customization: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save customization'})

# ---------------------------------------------------------------------------
# DELETE /api/admin/customization — 초기화
# ---------------------------------------------------------------------------

def reset_customization(event, context):
    """Customizing Set을 초기 상태로 복원합니다.

    S3에서 customizing-set.json을 삭제하여 기본값으로 되돌립니다.
    이후 get_customization 호출 시 DEFAULT_CUSTOMIZING_SET이 반환됩니다.
    """
    try:
        bucket_name = _get_bucket_name()
    except ValueError as e:
        print(f"Configuration error: {str(e)}")
        return lambda_response(500, {'error': 'Server configuration error'})

    try:
        s3_client.delete_object(
            Bucket=bucket_name,
            Key=CUSTOMIZATION_KEY
        )
        print(f"Customizing Set reset: {CUSTOMIZATION_KEY} deleted from S3")
        return lambda_response(200, DEFAULT_CUSTOMIZING_SET)

    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"S3 ClientError resetting customization: {error_code} - {str(e)}")
        return lambda_response(500, {'error': 'Failed to reset customization'})

    except Exception as e:
        print(f"Unexpected error in reset_customization: {str(e)}")
        return lambda_response(500, {'error': 'Failed to reset customization'})




# ---------------------------------------------------------------------------
# 1.3 POST /api/admin/customization/upload/logo
# ---------------------------------------------------------------------------

def upload_logo(event, context):
    """헤더 로고 이미지를 S3에 업로드합니다.

    multipart/form-data로 전송된 이미지 파일을 파싱하여
    확장자 및 크기를 검증한 후 S3에 저장합니다.
    업로드된 S3 URL을 반환합니다.
    """
    try:
        bucket_name = _get_bucket_name()
    except ValueError as e:
        print(f"Configuration error: {str(e)}")
        return lambda_response(500, {'error': 'Server configuration error'})

    # multipart/form-data 파싱
    try:
        file_data, filename = parse_multipart(event)
    except ValueError as e:
        print(f"Multipart parse error in upload_logo: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})

    # 파일 확장자 검증
    ext = _get_file_extension(filename)
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return lambda_response(400, {
            'error': 'Unsupported image type. Allowed: png, jpg, jpeg, svg, webp'
        })

    # 파일 크기 검증
    if len(file_data) > MAX_LOGO_SIZE:
        return lambda_response(400, {'error': 'File size exceeds 2MB limit'})

    # S3에 업로드
    try:
        timestamp = int(time.time() * 1000)
        # 파일명에서 안전하지 않은 문자 제거
        safe_filename = ''.join(
            c for c in filename if c.isalnum() or c in '.-_'
        )
        if not safe_filename:
            safe_filename = f'logo{ext}'

        s3_key = f"{LOGO_PREFIX}{timestamp}-{safe_filename}"
        content_type = CONTENT_TYPE_MAP.get(ext, 'application/octet-stream')

        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_data,
            ContentType=content_type
        )

        # 상대 경로 반환 (프론트엔드에서 CloudFront origin과 조합)
        relative_url = f"/{s3_key}"

        print(f"Logo uploaded to S3: {s3_key} ({len(file_data)} bytes)")
        return lambda_response(200, {
            'url': relative_url,
            'key': s3_key,
            'filename': filename,
            'size': len(file_data)
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"S3 ClientError uploading logo: {error_code} - {str(e)}")
        return lambda_response(500, {'error': 'Failed to upload logo'})

    except Exception as e:
        print(f"Unexpected error in upload_logo: {str(e)}")
        return lambda_response(500, {'error': 'Failed to upload logo'})



# ---------------------------------------------------------------------------
# 1.4 POST /api/admin/customization/upload/legal/{docType}
# ---------------------------------------------------------------------------

def upload_legal_doc(event, context):
    """리갈 마크다운 문서를 S3에 업로드합니다.

    docType 경로 파라미터(privacy 또는 service)와
    locale 쿼리 파라미터(ko 또는 en)를 받아
    S3 customization/legal/{docType}-term.{locale}.md 경로에 저장합니다.
    """
    try:
        bucket_name = _get_bucket_name()
    except ValueError as e:
        print(f"Configuration error: {str(e)}")
        return lambda_response(500, {'error': 'Server configuration error'})

    # docType 경로 파라미터 검증
    path_params = event.get('pathParameters', {}) or {}
    doc_type = path_params.get('docType', '')
    if doc_type not in ALLOWED_DOC_TYPES:
        return lambda_response(400, {
            'error': 'Invalid document type. Allowed: privacy, service'
        })

    # locale 쿼리 파라미터 검증
    query_params = event.get('queryStringParameters', {}) or {}
    locale = query_params.get('locale', '')
    if locale not in ALLOWED_LOCALES:
        return lambda_response(400, {
            'error': 'Invalid locale. Allowed: ko, en'
        })

    # multipart/form-data 파싱
    try:
        file_data, filename = parse_multipart(event)
    except ValueError as e:
        print(f"Multipart parse error in upload_legal_doc: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})

    # 파일 확장자 검증
    ext = _get_file_extension(filename)
    if ext not in ALLOWED_DOC_EXTENSIONS:
        return lambda_response(400, {
            'error': 'Unsupported file type. Only .md files are allowed'
        })

    # 파일 크기 검증
    if len(file_data) > MAX_LEGAL_DOC_SIZE:
        return lambda_response(400, {'error': 'File size exceeds 1MB limit'})

    # S3에 업로드
    try:
        s3_key = f"{LEGAL_PREFIX}{doc_type}-term.{locale}.md"

        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_data,
            ContentType='text/markdown',
            CacheControl=CACHE_CONTROL_NO_CACHE
        )

        # 상대 경로 반환 (프론트엔드에서 CloudFront origin과 조합)
        relative_url = f"/{s3_key}"

        print(f"Legal doc uploaded to S3: {s3_key} ({len(file_data)} bytes)")
        return lambda_response(200, {
            'url': relative_url,
            'key': s3_key,
            'docType': doc_type,
            'locale': locale,
            'filename': filename,
            'size': len(file_data)
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"S3 ClientError uploading legal doc: {error_code} - {str(e)}")
        return lambda_response(500, {'error': 'Failed to upload legal document'})

    except Exception as e:
        print(f"Unexpected error in upload_legal_doc: {str(e)}")
        return lambda_response(500, {'error': 'Failed to upload legal document'})
