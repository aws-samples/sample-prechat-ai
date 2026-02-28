import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConnectionState } from './useWebSocket';

// 재연결 설정 상수
export const MAX_RECONNECT_ATTEMPTS = 5;
export const BASE_RECONNECT_DELAY_MS = 1000;

export type { ConnectionState };

export interface UsePlanningWebSocketOptions {
  sessionId: string;
  wsUrl: string;
  locale?: string;
  onChunk: (chunk: string) => void;
  onTool?: (tool: {
    toolName: string;
    toolUseId: string;
    status: 'running' | 'complete';
    input?: Record<string, unknown>;
    output?: string;
  }) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export interface UsePlanningWebSocketReturn {
  sendPlanningMessage: (message: string) => void;
  connectionState: ConnectionState;
  isConnected: boolean;
}

export interface PlanningWebSocketClientMessage {
  action: 'sendPlanningMessage';
  sessionId: string;
  message: string;
  locale?: string;
}

// --- 테스트 가능한 순수 함수들 ---

/**
 * WebSocket 연결 URL을 구성합니다.
 * sessionId와 Cognito idToken을 쿼리 파라미터로 포함합니다.
 */
export function buildWebSocketUrl(
  wsUrl: string,
  sessionId: string,
  idToken: string | null
): string {
  const params = new URLSearchParams({ sessionId });
  if (idToken) {
    params.set('token', idToken);
  }
  return `${wsUrl}?${params.toString()}`;
}

/**
 * 연결 시도 가능 여부를 검증합니다.
 */
export function canConnect(
  wsUrl: string,
  sessionId: string
): boolean {
  return !!(wsUrl && sessionId);
}

/**
 * sendPlanningMessage 페이로드를 구성합니다.
 */
export function buildPlanningMessagePayload(
  sessionId: string,
  message: string,
  locale?: string
): PlanningWebSocketClientMessage {
  const payload: PlanningWebSocketClientMessage = {
    action: 'sendPlanningMessage',
    sessionId,
    message,
  };
  if (locale) {
    payload.locale = locale;
  }
  return payload;
}

/**
 * 지수 백오프 재연결 딜레이를 계산합니다.
 */
export function calculateReconnectDelay(attempt: number): number {
  return BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt);
}

/**
 * 최대 재연결 횟수 초과 여부를 확인합니다.
 */
export function isMaxReconnectExceeded(attempt: number): boolean {
  return attempt >= MAX_RECONNECT_ATTEMPTS;
}

/**
 * 서버 메시지를 파싱하고 적절한 콜백을 호출합니다.
 * 파싱 실패 시 false를 반환합니다.
 */
export function dispatchServerMessage(
  rawData: string,
  callbacks: {
    onChunk: (chunk: string) => void;
    onTool?: (tool: {
      toolName: string;
      toolUseId: string;
      status: 'running' | 'complete';
      input?: Record<string, unknown>;
      output?: string;
    }) => void;
    onComplete: () => void;
    onError: (error: string) => void;
  }
): boolean {
  try {
    const data = JSON.parse(rawData);

    switch (data.type) {
      case 'chunk':
        callbacks.onChunk(data.content);
        break;
      case 'tool':
        callbacks.onTool?.({
          toolName: data.toolName,
          toolUseId: data.toolUseId,
          status: data.status,
          input: data.input,
          output: data.output,
        });
        break;
      case 'done':
        callbacks.onComplete();
        break;
      case 'error':
        callbacks.onError(data.message);
        break;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Planning Agent 전용 WebSocket 통신 훅
 *
 * - Cognito idToken 기반 인증 (PIN 불필요)
 * - sendPlanningMessage action으로 메시지 전송
 * - 지수 백오프 재연결 (최대 5회)
 * - 연결 끊김 시 메시지 큐잉 및 재연결 후 재전송
 */
export function usePlanningWebSocket(
  options: UsePlanningWebSocketOptions
): UsePlanningWebSocketReturn {
  const {
    sessionId,
    wsUrl,
    locale,
    onChunk,
    onTool,
    onComplete,
    onError,
  } = options;

  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const messageQueueRef = useRef<
    PlanningWebSocketClientMessage[]
  >([]);
  const isMountedRef = useRef(true);
  const isIntentionalCloseRef = useRef(false);

  // 콜백 ref (최신 콜백 참조 보장)
  const onChunkRef = useRef(onChunk);
  const onToolRef = useRef(onTool);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  onChunkRef.current = onChunk;
  onToolRef.current = onTool;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  // 큐에 쌓인 메시지를 전송
  const flushMessageQueue = useCallback((ws: WebSocket) => {
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift();
      if (msg && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }
  }, []);

  // WebSocket 메시지 수신 핸들러
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const success = dispatchServerMessage(event.data, {
        onChunk: onChunkRef.current,
        onTool: onToolRef.current,
        onComplete: onCompleteRef.current,
        onError: onErrorRef.current,
      });
      if (!success) {
        console.error(
          '[usePlanningWebSocket] 메시지 파싱 실패:',
          event.data
        );
      }
    },
    []
  );

  // WebSocket 연결 수립
  const connect = useCallback(() => {
    if (!canConnect(wsUrl, sessionId)) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const idToken = localStorage.getItem('accessToken');

    // 기존 연결 정리
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState('connecting');
    isIntentionalCloseRef.current = false;

    const url = buildWebSocketUrl(wsUrl, sessionId, idToken);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
      flushMessageQueue(ws);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      wsRef.current = null;

      if (!isIntentionalCloseRef.current) {
        setConnectionState('disconnected');
        attemptReconnect();
      } else {
        setConnectionState('disconnected');
      }
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
    };

    wsRef.current = ws;
  }, [wsUrl, sessionId, handleMessage, flushMessageQueue]);

  // 지수 백오프 재연결
  const attemptReconnect = useCallback(() => {
    if (isMaxReconnectExceeded(reconnectAttemptRef.current)) {
      setConnectionState('error');
      onErrorRef.current(
        '서버 연결에 실패했습니다. 페이지를 새로고침해 주세요.'
      );
      return;
    }

    const attempt = reconnectAttemptRef.current;
    const delay = calculateReconnectDelay(attempt);
    reconnectAttemptRef.current = attempt + 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  // 메시지 전송
  const sendPlanningMessage = useCallback(
    (message: string) => {
      const payload = buildPlanningMessagePayload(
        sessionId,
        message,
        locale
      );

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        messageQueueRef.current.push(payload);
      }
    },
    [sessionId, locale]
  );

  // 연결 수립 및 정리
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      isIntentionalCloseRef.current = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    sendPlanningMessage,
    connectionState,
    isConnected: connectionState === 'connected',
  };
}
