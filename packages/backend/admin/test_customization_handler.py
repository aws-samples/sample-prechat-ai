"""
customization_handler.py 단위 테스트

테스트 시나리오:
1. get_customization: S3 파일 없을 때 기본값 폴백 (LocalizedString 기본값 포함)
2. save_customization: Cache-Control 메타데이터 포함 여부
3. upload_logo: 파일 크기/확장자 검증 에러 응답
4. upload_legal_doc: 잘못된 locale 파라미터 에러 응답, 파일 크기/확장자 검증

Requirements: 1.2, 2.3, 6.5, 7.1
"""

import json
import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# shared 모듈 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.dirname(__file__))

# WEBSITE_BUCKET 환경 변수 설정 (모듈 임포트 전)
os.environ['WEBSITE_BUCKET'] = 'test-bucket'
os.environ['AWS_REGION'] = 'ap-northeast-2'

from botocore.exceptions import ClientError

import customization_handler as handler


# ---------------------------------------------------------------------------
# 헬퍼 함수
# ---------------------------------------------------------------------------

def _make_api_event(body=None, path_params=None, query_params=None,
                    headers=None, is_base64=False):
    """API Gateway Lambda proxy 이벤트를 생성합니다."""
    event = {
        'headers': headers or {'content-type': 'application/json'},
        'pathParameters': path_params,
        'queryStringParameters': query_params,
        'isBase64Encoded': is_base64,
    }
    if body is not None:
        event['body'] = body
    return event


def _make_multipart_event(file_content, filename, path_params=None,
                          query_params=None):
    """multipart/form-data 이벤트를 생성합니다."""
    boundary = '----TestBoundary'
    if isinstance(file_content, str):
        file_content = file_content.encode('utf-8')

    body_parts = [
        f'------TestBoundary\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: application/octet-stream\r\n'
        f'\r\n'
    ]
    body_bytes = body_parts[0].encode('utf-8') + file_content + b'\r\n------TestBoundary--\r\n'

    import base64
    body_b64 = base64.b64encode(body_bytes).decode('utf-8')

    return {
        'headers': {
            'content-type': f'multipart/form-data; boundary=----TestBoundary',
        },
        'body': body_b64,
        'isBase64Encoded': True,
        'pathParameters': path_params,
        'queryStringParameters': query_params,
    }


def _parse_response(response):
    """Lambda 응답에서 statusCode와 body를 파싱합니다."""
    status = response['statusCode']
    body = json.loads(response['body'])
    return status, body


def _no_such_key_error():
    """S3 NoSuchKey ClientError를 생성합니다."""
    return ClientError(
        {'Error': {'Code': 'NoSuchKey', 'Message': 'Not Found'}},
        'GetObject'
    )


# ===========================================================================
# 1. get_customization 테스트 — 기본값 폴백 (Requirement 1.2)
# ===========================================================================

class TestGetCustomization:
    """get_customization 함수 테스트"""

    @patch.object(handler, 's3_client')
    def test_returns_default_when_s3_file_not_found(self, mock_s3):
        """S3에 파일이 없으면 기본 Customizing Set을 반환해야 합니다."""
        mock_s3.get_object.side_effect = _no_such_key_error()

        event = _make_api_event()
        response = handler.get_customization(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert body == handler.DEFAULT_CUSTOMIZING_SET

    @patch.object(handler, 's3_client')
    def test_default_has_all_categories(self, mock_s3):
        """기본값에 header, welcome, background, legal, meta 카테고리가 모두 존재해야 합니다."""
        mock_s3.get_object.side_effect = _no_such_key_error()

        event = _make_api_event()
        response = handler.get_customization(event, None)
        _, body = _parse_response(response)

        assert 'header' in body
        assert 'welcome' in body
        assert 'background' in body
        assert 'legal' in body
        assert 'meta' in body

    @patch.object(handler, 's3_client')
    def test_default_localized_string_fields_are_null(self, mock_s3):
        """기본값의 LocalizedString 필드(label, title, subtitle, privacyTermUrl, serviceTermUrl)는 null이어야 합니다."""
        mock_s3.get_object.side_effect = _no_such_key_error()

        event = _make_api_event()
        response = handler.get_customization(event, None)
        _, body = _parse_response(response)

        # LocalizedString 필드들이 null(None)
        assert body['header']['label'] is None
        assert body['welcome']['title'] is None
        assert body['welcome']['subtitle'] is None
        assert body['legal']['privacyTermUrl'] is None
        assert body['legal']['serviceTermUrl'] is None

    @patch.object(handler, 's3_client')
    def test_default_meta_version(self, mock_s3):
        """기본값의 meta.version은 '1.0'이어야 합니다."""
        mock_s3.get_object.side_effect = _no_such_key_error()

        event = _make_api_event()
        response = handler.get_customization(event, None)
        _, body = _parse_response(response)

        assert body['meta']['version'] == '1.0'
        assert body['meta']['updatedAt'] is None

    @patch.object(handler, 's3_client')
    def test_returns_stored_customizing_set(self, mock_s3):
        """S3에 저장된 Customizing Set을 정상적으로 반환해야 합니다."""
        stored_data = {
            "header": {"logoUrl": "https://example.com/logo.png",
                       "logoLink": None, "label": {"ko": "테스트", "en": "Test"},
                       "labelLink": None},
            "welcome": {"title": {"ko": "환영", "en": "Welcome"},
                        "subtitle": None},
            "background": {"color": "#FF9900"},
            "legal": {"privacyTermUrl": None, "serviceTermUrl": None,
                      "supportChannel": None},
            "meta": {"updatedAt": "2025-01-15T09:30:00Z", "version": "1.0"}
        }
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps(stored_data).encode('utf-8')
        mock_s3.get_object.return_value = {'Body': mock_body}

        event = _make_api_event()
        response = handler.get_customization(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert body['header']['logoUrl'] == 'https://example.com/logo.png'
        assert body['header']['label'] == {"ko": "테스트", "en": "Test"}

    @patch.object(handler, 's3_client')
    def test_returns_default_on_invalid_json(self, mock_s3):
        """S3에 잘못된 JSON이 있으면 기본값을 반환해야 합니다."""
        mock_body = MagicMock()
        mock_body.read.return_value = b'not valid json {'
        mock_s3.get_object.return_value = {'Body': mock_body}

        event = _make_api_event()
        response = handler.get_customization(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert body == handler.DEFAULT_CUSTOMIZING_SET


# ===========================================================================
# 2. save_customization 테스트 — Cache-Control 메타데이터 (Requirement 7.1)
# ===========================================================================

class TestSaveCustomization:
    """save_customization 함수 테스트"""

    @patch.object(handler, 's3_client')
    def test_saves_with_cache_control_metadata(self, mock_s3):
        """저장 시 Cache-Control: no-cache, no-store, must-revalidate 메타데이터가 포함되어야 합니다."""
        mock_s3.put_object.return_value = {}

        data = {"header": {"logoUrl": None}, "welcome": {"title": None}}
        event = _make_api_event(body=json.dumps(data))
        response = handler.save_customization(event, None)
        status, _ = _parse_response(response)

        assert status == 200
        # put_object 호출 인자 검증
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['CacheControl'] == 'no-cache, no-store, must-revalidate'

    @patch.object(handler, 's3_client')
    def test_saves_with_correct_content_type(self, mock_s3):
        """저장 시 ContentType이 application/json이어야 합니다."""
        mock_s3.put_object.return_value = {}

        data = {"header": {"logoUrl": None}}
        event = _make_api_event(body=json.dumps(data))
        handler.save_customization(event, None)

        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['ContentType'] == 'application/json'

    @patch.object(handler, 's3_client')
    def test_saves_to_correct_s3_key(self, mock_s3):
        """저장 시 올바른 S3 키에 저장되어야 합니다."""
        mock_s3.put_object.return_value = {}

        data = {"header": {"logoUrl": None}}
        event = _make_api_event(body=json.dumps(data))
        handler.save_customization(event, None)

        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['Key'] == 'customization/customizing-set.json'
        assert call_kwargs['Bucket'] == 'test-bucket'

    @patch.object(handler, 's3_client')
    def test_auto_sets_updated_at(self, mock_s3):
        """저장 시 meta.updatedAt이 자동으로 설정되어야 합니다."""
        mock_s3.put_object.return_value = {}

        data = {"header": {"logoUrl": None}}
        event = _make_api_event(body=json.dumps(data))
        response = handler.save_customization(event, None)
        _, body = _parse_response(response)

        assert body['meta']['updatedAt'] is not None
        assert 'T' in body['meta']['updatedAt']  # ISO 8601 형식

    def test_rejects_empty_body(self):
        """빈 요청 본문은 400 에러를 반환해야 합니다."""
        event = _make_api_event(body='')
        response = handler.save_customization(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid request body'

    def test_rejects_invalid_json(self):
        """잘못된 JSON 본문은 400 에러를 반환해야 합니다."""
        event = _make_api_event(body='not json {')
        response = handler.save_customization(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid request body'

    def test_rejects_non_dict_body(self):
        """dict가 아닌 JSON 본문은 400 에러를 반환해야 합니다."""
        event = _make_api_event(body=json.dumps([1, 2, 3]))
        response = handler.save_customization(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid request body'

    @patch.object(handler, 's3_client')
    def test_returns_500_on_s3_error(self, mock_s3):
        """S3 쓰기 실패 시 500 에러를 반환해야 합니다."""
        mock_s3.put_object.side_effect = ClientError(
            {'Error': {'Code': 'InternalError', 'Message': 'S3 Error'}},
            'PutObject'
        )

        data = {"header": {"logoUrl": None}}
        event = _make_api_event(body=json.dumps(data))
        response = handler.save_customization(event, None)
        status, body = _parse_response(response)

        assert status == 500
        assert body['error'] == 'Failed to save customization'


# ===========================================================================
# 3. upload_logo 테스트 — 파일 크기/확장자 검증 (Requirements 2.3)
# ===========================================================================

class TestUploadLogo:
    """upload_logo 함수 테스트"""

    @patch.object(handler, 's3_client')
    def test_rejects_oversized_file(self, mock_s3):
        """2MB를 초과하는 파일은 400 에러를 반환해야 합니다."""
        # 2MB + 1 byte
        large_content = b'x' * (2 * 1024 * 1024 + 1)
        event = _make_multipart_event(large_content, 'big-logo.png')
        response = handler.upload_logo(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'File size exceeds 2MB limit'

    @patch.object(handler, 's3_client')
    def test_accepts_exactly_2mb_file(self, mock_s3):
        """정확히 2MB 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        content = b'x' * (2 * 1024 * 1024)
        event = _make_multipart_event(content, 'logo.png')
        response = handler.upload_logo(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert 'url' in body

    @patch.object(handler, 's3_client')
    def test_rejects_unsupported_extension(self, mock_s3):
        """허용되지 않은 확장자(.gif)는 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(b'GIF89a', 'logo.gif')
        response = handler.upload_logo(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert 'Unsupported image type' in body['error']

    @patch.object(handler, 's3_client')
    def test_rejects_txt_extension(self, mock_s3):
        """텍스트 파일(.txt)은 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(b'hello', 'file.txt')
        response = handler.upload_logo(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert 'Unsupported image type' in body['error']

    @patch.object(handler, 's3_client')
    def test_rejects_no_extension(self, mock_s3):
        """확장자 없는 파일은 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(b'data', 'noextension')
        response = handler.upload_logo(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert 'Unsupported image type' in body['error']

    @patch.object(handler, 's3_client')
    def test_accepts_png(self, mock_s3):
        """PNG 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'PNG_DATA', 'logo.png')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_accepts_jpg(self, mock_s3):
        """JPG 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'JPG_DATA', 'logo.jpg')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_accepts_jpeg(self, mock_s3):
        """JPEG 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'JPEG_DATA', 'photo.jpeg')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_accepts_svg(self, mock_s3):
        """SVG 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'<svg></svg>', 'icon.svg')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_accepts_webp(self, mock_s3):
        """WebP 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'WEBP_DATA', 'image.webp')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_accepts_uppercase_extension(self, mock_s3):
        """대문자 확장자(.PNG)도 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(b'PNG_DATA', 'logo.PNG')
        response = handler.upload_logo(event, None)
        status, _ = _parse_response(response)
        assert status == 200

    @patch.object(handler, 's3_client')
    def test_upload_returns_url_and_metadata(self, mock_s3):
        """업로드 성공 시 url, key, filename, size를 반환해야 합니다."""
        mock_s3.put_object.return_value = {}
        content = b'PNG_DATA_HERE'
        event = _make_multipart_event(content, 'brand-logo.png')
        response = handler.upload_logo(event, None)
        _, body = _parse_response(response)

        assert 'url' in body
        assert 'key' in body
        assert body['filename'] == 'brand-logo.png'
        assert body['size'] == len(content)


# ===========================================================================
# 4. upload_legal_doc 테스트 — locale/확장자/크기 검증 (Requirements 6.5, 7.1)
# ===========================================================================

class TestUploadLegalDoc:
    """upload_legal_doc 함수 테스트"""

    # --- locale 파라미터 검증 ---

    def test_rejects_invalid_locale(self):
        """잘못된 locale 파라미터(ja)는 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'# Privacy', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ja'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid locale. Allowed: ko, en'

    def test_rejects_empty_locale(self):
        """빈 locale 파라미터는 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'# Privacy', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': ''}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid locale. Allowed: ko, en'

    def test_rejects_missing_locale(self):
        """locale 파라미터가 없으면 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'# Privacy', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid locale. Allowed: ko, en'

    def test_rejects_null_query_params(self):
        """queryStringParameters가 None이면 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'# Privacy', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params=None
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid locale. Allowed: ko, en'

    # --- docType 파라미터 검증 ---

    def test_rejects_invalid_doc_type(self):
        """잘못된 docType 파라미터(terms)는 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'# Terms', 'terms.md',
            path_params={'docType': 'terms'},
            query_params={'locale': 'ko'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Invalid document type. Allowed: privacy, service'

    # --- 파일 확장자 검증 ---

    @patch.object(handler, 's3_client')
    def test_rejects_non_md_extension(self, mock_s3):
        """.txt 파일은 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'plain text', 'document.txt',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ko'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Unsupported file type. Only .md files are allowed'

    @patch.object(handler, 's3_client')
    def test_rejects_pdf_extension(self, mock_s3):
        """.pdf 파일은 400 에러를 반환해야 합니다."""
        event = _make_multipart_event(
            b'%PDF-1.4', 'document.pdf',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'en'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'Unsupported file type. Only .md files are allowed'

    # --- 파일 크기 검증 ---

    @patch.object(handler, 's3_client')
    def test_rejects_oversized_md_file(self, mock_s3):
        """1MB를 초과하는 마크다운 파일은 400 에러를 반환해야 합니다."""
        large_content = b'#' * (1 * 1024 * 1024 + 1)
        event = _make_multipart_event(
            large_content, 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ko'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 400
        assert body['error'] == 'File size exceeds 1MB limit'

    @patch.object(handler, 's3_client')
    def test_accepts_exactly_1mb_md_file(self, mock_s3):
        """정확히 1MB 마크다운 파일은 허용되어야 합니다."""
        mock_s3.put_object.return_value = {}
        content = b'#' * (1 * 1024 * 1024)
        event = _make_multipart_event(
            content, 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ko'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert 'url' in body

    # --- 정상 업로드 ---

    @patch.object(handler, 's3_client')
    def test_uploads_privacy_ko_successfully(self, mock_s3):
        """privacy/ko 조합으로 정상 업로드되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(
            b'# Privacy Policy KO', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ko'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert body['docType'] == 'privacy'
        assert body['locale'] == 'ko'
        # S3 키 검증
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['Key'] == 'customization/legal/privacy-term.ko.md'

    @patch.object(handler, 's3_client')
    def test_uploads_service_en_successfully(self, mock_s3):
        """service/en 조합으로 정상 업로드되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(
            b'# Service Terms EN', 'service.md',
            path_params={'docType': 'service'},
            query_params={'locale': 'en'}
        )
        response = handler.upload_legal_doc(event, None)
        status, body = _parse_response(response)

        assert status == 200
        assert body['docType'] == 'service'
        assert body['locale'] == 'en'
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['Key'] == 'customization/legal/service-term.en.md'

    @patch.object(handler, 's3_client')
    def test_legal_doc_has_cache_control(self, mock_s3):
        """리갈 문서 업로드 시 Cache-Control 메타데이터가 포함되어야 합니다."""
        mock_s3.put_object.return_value = {}
        event = _make_multipart_event(
            b'# Privacy', 'privacy.md',
            path_params={'docType': 'privacy'},
            query_params={'locale': 'ko'}
        )
        handler.upload_legal_doc(event, None)

        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs['CacheControl'] == 'no-cache, no-store, must-revalidate'
