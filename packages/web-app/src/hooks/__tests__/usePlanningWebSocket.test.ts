/**
 * usePlanningWebSocket 훅 단위 테스트
 *
 * node 환경에서 훅의 핵심 로직을 순수 함수로 추출하여 테스트합니다.
 * - WebSocket URL 구성 (sessionId + Cognito idToken 쿼리 파라미터)
 * - sendPlanningMessage 페이로드 구성 (action, sessionId, message, locale)
 * - 서버 메시지 파싱 및 콜백 라우팅 (chunk, tool, done, error)
 * - 지수 백오프 재연결 딜레이 계산
 * - 메시지 큐잉 로직
 * - 연결 조건 검증 (wsUrl, sessionId 필수)
 *
 * **Validates: Requirements 5.4, 5.5, 6.3**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- 훅 내부 로직을 재현하는 순수 함수들 ---

import {
  buildWebSocketUrl,
  canConnect,
  buildPlanningMessagePayload,
  calculateReconnectDelay,
  isMaxReconnectExceeded,
  dispatchServerMessage,
  MAX_RECONNECT_ATTEMPTS,
  BASE_RECONNECT_DELAY_MS,
} from '../usePlanningWebSocket';

describe('usePlanningWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- WebSocket URL 구성 ---
  describe('buildWebSocketUrl', () => {
    it('sessionId와 idToken이 쿼리 파라미터로 포함된다', () => {
      const url = buildWebSocketUrl(
        'wss://api.example.com/ws',
        'session-123',
        'my-cognito-token'
      );
      expect(url).toBe(
        'wss://api.example.com/ws?sessionId=session-123&token=my-cognito-token'
      );
    });

    it('idToken이 null이면 token 파라미터가 포함되지 않는다', () => {
      const url = buildWebSocketUrl(
        'wss://api.example.com/ws',
        'session-123',
        null
      );
      expect(url).toBe(
        'wss://api.example.com/ws?sessionId=session-123'
      );
    });

    it('sessionId에 특수문자가 있으면 인코딩된다', () => {
      const url = buildWebSocketUrl(
        'wss://api.example.com/ws',
        'session 123&foo=bar',
        null
      );
      expect(url).toContain(
        'sessionId=session+123%26foo%3Dbar'
      );
    });
  });

  // --- 연결 조건 검증 ---
  describe('canConnect', () => {
    it('wsUrl과 sessionId가 모두 있으면 true를 반환한다', () => {
      expect(canConnect('wss://example.com', 'session-1')).toBe(
        true
      );
    });

    it('wsUrl이 비어있으면 false를 반환한다', () => {
      expect(canConnect('', 'session-1')).toBe(false);
    });

    it('sessionId가 비어있으면 false를 반환한다', () => {
      expect(canConnect('wss://example.com', '')).toBe(false);
    });

    it('둘 다 비어있으면 false를 반환한다', () => {
      expect(canConnect('', '')).toBe(false);
    });
  });

  // --- 메시지 페이로드 구성 ---
  describe('buildPlanningMessagePayload', () => {
    it('올바른 action과 필수 필드를 포함한다', () => {
      const payload = buildPlanningMessagePayload(
        'session-123',
        '서비스 추천해줘'
      );
      expect(payload).toEqual({
        action: 'sendPlanningMessage',
        sessionId: 'session-123',
        message: '서비스 추천해줘',
      });
    });

    it('locale이 제공되면 페이로드에 포함된다', () => {
      const payload = buildPlanningMessagePayload(
        'session-123',
        '서비스 추천해줘',
        'ko'
      );
      expect(payload).toEqual({
        action: 'sendPlanningMessage',
        sessionId: 'session-123',
        message: '서비스 추천해줘',
        locale: 'ko',
      });
    });

    it('locale이 undefined이면 페이로드에 포함되지 않는다', () => {
      const payload = buildPlanningMessagePayload(
        'session-123',
        'test',
        undefined
      );
      expect(payload).not.toHaveProperty('locale');
    });
  });

  // --- 지수 백오프 재연결 ---
  describe('calculateReconnectDelay', () => {
    it('attempt 0일 때 BASE_RECONNECT_DELAY_MS를 반환한다', () => {
      expect(calculateReconnectDelay(0)).toBe(
        BASE_RECONNECT_DELAY_MS
      );
    });

    it('attempt 1일 때 2배 딜레이를 반환한다', () => {
      expect(calculateReconnectDelay(1)).toBe(
        BASE_RECONNECT_DELAY_MS * 2
      );
    });

    it('attempt 4일 때 16배 딜레이를 반환한다', () => {
      expect(calculateReconnectDelay(4)).toBe(
        BASE_RECONNECT_DELAY_MS * 16
      );
    });

    it('지수 백오프 패턴을 따른다 (delay = base * 2^attempt)', () => {
      for (let i = 0; i < 5; i++) {
        expect(calculateReconnectDelay(i)).toBe(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, i)
        );
      }
    });
  });

  describe('isMaxReconnectExceeded', () => {
    it('MAX_RECONNECT_ATTEMPTS 미만이면 false를 반환한다', () => {
      expect(isMaxReconnectExceeded(0)).toBe(false);
      expect(
        isMaxReconnectExceeded(MAX_RECONNECT_ATTEMPTS - 1)
      ).toBe(false);
    });

    it('MAX_RECONNECT_ATTEMPTS 이상이면 true를 반환한다', () => {
      expect(
        isMaxReconnectExceeded(MAX_RECONNECT_ATTEMPTS)
      ).toBe(true);
      expect(
        isMaxReconnectExceeded(MAX_RECONNECT_ATTEMPTS + 1)
      ).toBe(true);
    });
  });

  // --- 서버 메시지 파싱 및 콜백 라우팅 ---
  describe('dispatchServerMessage', () => {
    it('chunk 이벤트 수신 시 onChunk 콜백을 호출한다', () => {
      const onChunk = vi.fn();
      const callbacks = {
        onChunk,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const result = dispatchServerMessage(
        JSON.stringify({ type: 'chunk', content: '분석 결과' }),
        callbacks
      );

      expect(result).toBe(true);
      expect(onChunk).toHaveBeenCalledWith('분석 결과');
    });

    it('tool 이벤트 수신 시 onTool 콜백을 호출한다', () => {
      const onTool = vi.fn();
      const callbacks = {
        onChunk: vi.fn(),
        onTool,
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      dispatchServerMessage(
        JSON.stringify({
          type: 'tool',
          toolName: 'retrieve',
          toolUseId: 'tool-123',
          status: 'running',
          input: { query: '유사 사례' },
        }),
        callbacks
      );

      expect(onTool).toHaveBeenCalledWith({
        toolName: 'retrieve',
        toolUseId: 'tool-123',
        status: 'running',
        input: { query: '유사 사례' },
        output: undefined,
      });
    });

    it('done 이벤트 수신 시 onComplete 콜백을 호출한다', () => {
      const onComplete = vi.fn();
      const callbacks = {
        onChunk: vi.fn(),
        onComplete,
        onError: vi.fn(),
      };

      dispatchServerMessage(
        JSON.stringify({ type: 'done' }),
        callbacks
      );

      expect(onComplete).toHaveBeenCalled();
    });

    it('error 이벤트 수신 시 onError 콜백을 호출한다', () => {
      const onError = vi.fn();
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError,
      };

      dispatchServerMessage(
        JSON.stringify({
          type: 'error',
          message: 'Planning Agent가 구성되지 않았습니다.',
        }),
        callbacks
      );

      expect(onError).toHaveBeenCalledWith(
        'Planning Agent가 구성되지 않았습니다.'
      );
    });

    it('잘못된 JSON 수신 시 false를 반환한다', () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const result = dispatchServerMessage(
        'invalid-json',
        callbacks
      );

      expect(result).toBe(false);
      expect(callbacks.onChunk).not.toHaveBeenCalled();
    });

    it('onTool이 없어도 tool 이벤트를 안전하게 처리한다', () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const result = dispatchServerMessage(
        JSON.stringify({
          type: 'tool',
          toolName: 'retrieve',
          toolUseId: 'tool-1',
          status: 'complete',
        }),
        callbacks
      );

      expect(result).toBe(true);
    });

    it('알 수 없는 type은 무시하고 true를 반환한다', () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const result = dispatchServerMessage(
        JSON.stringify({ type: 'unknown', data: 'test' }),
        callbacks
      );

      expect(result).toBe(true);
      expect(callbacks.onChunk).not.toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });
  });
});
