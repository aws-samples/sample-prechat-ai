/**
 * CaptureDiscussionModal 컴포넌트 단위 테스트
 *
 * node 환경에서 컴포넌트의 핵심 로직을 순수 함수로 추출하여 테스트합니다.
 * - 캡처 콘텐츠 포맷팅 (formatCaptureContent)
 * - 주석 입력 유효성 검증
 * - API 호출 파라미터 구성
 * - 성공/실패 시 동작 검증
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  formatCaptureContent,
  buildDiscussionPayload,
  validateAnnotation,
  createCaptureHandler,
} from '../CaptureDiscussionModal';

describe('CaptureDiscussionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 캡처 콘텐츠 포맷팅 ---
  describe('formatCaptureContent', () => {
    it('주석과 메시지 내용을 "<주석>: <메시지>" 형식으로 결합한다', () => {
      const result = formatCaptureContent(
        '중요한 인사이트',
        'AWS Lambda를 추천합니다.'
      );
      expect(result).toBe('중요한 인사이트: AWS Lambda를 추천합니다.');
    });

    it('빈 주석이면 ": <메시지>" 형식으로 반환한다', () => {
      const result = formatCaptureContent('', '응답 내용');
      expect(result).toBe(': 응답 내용');
    });

    it('주석과 응답 내용이 정확히 보존된다', () => {
      const annotation = '특수문자 !@#$%';
      const content = '마크다운 **볼드** `코드`';
      const result = formatCaptureContent(annotation, content);
      expect(result).toContain(annotation);
      expect(result).toContain(content);
    });

    it('긴 텍스트도 정확히 보존된다', () => {
      const annotation = '분석 결과 요약';
      const content = 'A'.repeat(1000);
      const result = formatCaptureContent(annotation, content);
      expect(result).toBe(`${annotation}: ${content}`);
    });
  });

  // --- 주석 입력 유효성 검증 ---
  describe('validateAnnotation', () => {
    it('비어있지 않은 문자열은 유효하다', () => {
      expect(validateAnnotation('주석 내용')).toBe(true);
    });

    it('빈 문자열은 유효하지 않다', () => {
      expect(validateAnnotation('')).toBe(false);
    });

    it('공백만 있는 문자열은 유효하지 않다', () => {
      expect(validateAnnotation('   ')).toBe(false);
    });

    it('앞뒤 공백이 있어도 내용이 있으면 유효하다', () => {
      expect(validateAnnotation('  주석  ')).toBe(true);
    });
  });

  // --- Discussion 페이로드 구성 ---
  describe('buildDiscussionPayload', () => {
    it('sessionId와 포맷된 content를 포함하는 페이로드를 구성한다', () => {
      const payload = buildDiscussionPayload(
        'session-123',
        '주석',
        '응답 내용'
      );
      expect(payload.sessionId).toBe('session-123');
      expect(payload.content).toBe('주석: 응답 내용');
    });

    it('주석의 앞뒤 공백을 제거한다', () => {
      const payload = buildDiscussionPayload(
        'session-456',
        '  주석  ',
        '응답'
      );
      expect(payload.content).toBe('주석: 응답');
    });
  });

  // --- 캡처 핸들러 ---
  describe('createCaptureHandler', () => {
    it('API 호출 성공 시 onSuccess 콜백을 호출한다', async () => {
      const mockApi = vi.fn().mockResolvedValue({ success: true });
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handler = createCaptureHandler({
        apiCall: mockApi,
        onSuccess,
        onError,
      });

      await handler('session-123', '주석', '응답 내용');

      expect(mockApi).toHaveBeenCalledWith('session-123', '주석: 응답 내용');
      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('API 호출 실패 시 onError 콜백을 호출한다', async () => {
      const mockApi = vi.fn().mockRejectedValue(new Error('Network error'));
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handler = createCaptureHandler({
        apiCall: mockApi,
        onSuccess,
        onError,
      });

      await handler('session-123', '주석', '응답 내용');

      expect(mockApi).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('주석의 앞뒤 공백을 제거하여 API를 호출한다', async () => {
      const mockApi = vi.fn().mockResolvedValue({ success: true });
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const handler = createCaptureHandler({
        apiCall: mockApi,
        onSuccess,
        onError,
      });

      await handler('session-123', '  주석  ', '응답');

      expect(mockApi).toHaveBeenCalledWith('session-123', '주석: 응답');
    });
  });
});
