import { useState, useEffect, useRef, useCallback } from 'react'
import type { WebSocketServerMessage, WebSocketClientMessage, MessageContentType } from '../types'

// 재연결 설정 상수
const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

// 연결 상태 타입
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseWebSocketOptions {
  sessionId: string
  pin: string
  wsUrl: string
  onChunk: (chunk: string) => void
  onTool?: (tool: {
    toolName: string
    toolUseId: string
    status: 'running' | 'complete'
    input?: Record<string, unknown>
    output?: string
  }) => void
  onComplete: (metadata: {
    contentType: MessageContentType
    isComplete: boolean
    messageId: string
  }) => void
  onError: (error: string) => void
}

export interface UseWebSocketReturn {
  sendMessage: (message: string, messageId: string, contentType?: MessageContentType) => void
  connectionState: ConnectionState
  isConnected: boolean
}

/**
 * WebSocket 연결을 관리하는 커스텀 훅
 *
 * - sessionId, pin을 쿼리 파라미터로 전달하여 연결 수립
 * - 지수 백오프 재연결 (최대 5회)
 * - 연결 끊김 시 메시지 큐잉 및 재연결 후 재전송
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { sessionId, pin, wsUrl, onChunk, onTool, onComplete, onError } = options

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // ref로 관리하여 콜백 내에서 최신 값 참조
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageQueueRef = useRef<WebSocketClientMessage[]>([])
  const isMountedRef = useRef(true)
  const isIntentionalCloseRef = useRef(false)

  // 콜백 ref (최신 콜백 참조 보장)
  const onChunkRef = useRef(onChunk)
  const onToolRef = useRef(onTool)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  onChunkRef.current = onChunk
  onToolRef.current = onTool
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  // 큐에 쌓인 메시지를 전송
  const flushMessageQueue = useCallback((ws: WebSocket) => {
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift()
      if (msg && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg))
      }
    }
  }, [])

  // WebSocket 메시지 수신 핸들러
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: WebSocketServerMessage = JSON.parse(event.data)

      switch (data.type) {
        case 'chunk':
          onChunkRef.current(data.content)
          break
        case 'tool':
          onToolRef.current?.({
            toolName: data.toolName,
            toolUseId: data.toolUseId,
            status: data.status,
            input: data.input,
            output: data.output,
          })
          break
        case 'done':
          onCompleteRef.current({
            contentType: data.contentType,
            isComplete: data.isComplete,
            messageId: data.messageId,
          })
          break
        case 'error':
          onErrorRef.current(data.message)
          break
      }
    } catch {
      console.error('[useWebSocket] 메시지 파싱 실패:', event.data)
    }
  }, [])

  // WebSocket 연결 수립
  const connect = useCallback(() => {
    if (!wsUrl || !sessionId || !pin) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // 기존 연결 정리
    if (wsRef.current) {
      isIntentionalCloseRef.current = true
      wsRef.current.close()
      wsRef.current = null
    }

    setConnectionState('connecting')
    isIntentionalCloseRef.current = false

    const url = `${wsUrl}?sessionId=${encodeURIComponent(sessionId)}&pin=${encodeURIComponent(pin)}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      if (!isMountedRef.current) return
      setConnectionState('connected')
      reconnectAttemptRef.current = 0
      // 재연결 성공 시 큐에 쌓인 메시지 전송
      flushMessageQueue(ws)
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      if (!isMountedRef.current) return
      wsRef.current = null

      // 의도적 종료가 아닌 경우에만 재연결 시도
      if (!isIntentionalCloseRef.current) {
        setConnectionState('disconnected')
        attemptReconnect()
      } else {
        setConnectionState('disconnected')
      }
    }

    ws.onerror = () => {
      if (!isMountedRef.current) return
      // onerror 후 onclose가 호출되므로 상태 전환은 onclose에서 처리
    }

    wsRef.current = ws
  }, [wsUrl, sessionId, pin, handleMessage, flushMessageQueue])

  // 지수 백오프 재연결
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState('error')
      onErrorRef.current(
        '서버 연결에 실패했습니다. 페이지를 새로고침해 주세요.'
      )
      return
    }

    const attempt = reconnectAttemptRef.current
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt)
    reconnectAttemptRef.current = attempt + 1

    reconnectTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connect()
      }
    }, delay)
  }, [connect])

  // 메시지 전송
  const sendMessage = useCallback(
    (message: string, messageId: string, contentType?: MessageContentType) => {
      const payload: WebSocketClientMessage = {
        action: 'sendMessage',
        sessionId,
        message,
        messageId,
        ...(contentType && { contentType }),
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload))
      } else {
        // 연결이 끊어진 상태면 큐에 보관
        messageQueueRef.current.push(payload)
      }
    },
    [sessionId]
  )

  // 연결 수립 및 정리
  useEffect(() => {
    isMountedRef.current = true
    connect()

    return () => {
      isMountedRef.current = false
      isIntentionalCloseRef.current = true

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return {
    sendMessage,
    connectionState,
    isConnected: connectionState === 'connected',
  }
}
