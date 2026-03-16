import { useState, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'
import { WS_URL } from '../config/api'
import type { Message, MessageContentType } from '../types'
import { MESSAGES } from '../constants'

/**
 * WebSocket 기반 채팅 훅
 *
 * streamingMessage가 봇 응답 상태의 single source of truth입니다.
 * - streamingMessage === null → 대기 상태
 * - streamingMessage.status === 'thinking' → AI 응답 대기 중
 * - streamingMessage.status === 'tool-use' → 도구 실행 중
 * - streamingMessage.status === 'streaming' → 텍스트 스트리밍 중
 * - streamingMessage.status === 'complete' → 응답 완료 (messages로 이동)
 * - streamingMessage.status === 'error' → 에러 발생
 */
export const useChat = (sessionId: string | undefined, pin?: string, locale?: string, agentRole?: string) => {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)

  // 콜백에서 최신 상태를 참조하기 위한 ref
  const streamingContentRef = useRef('')
  const currentMessageIdRef = useRef<string | null>(null)
  const onMessageAddRef = useRef<((message: Message) => void) | null>(null)
  const onCompleteRef = useRef<((complete: boolean) => void) | null>(null)
  const streamingContentTypeRef = useRef<MessageContentType>('text')
  const lastToolNameRef = useRef<string>('')
  // 의미론적 말풍선: boundary 이벤트마다 증가하는 카운터
  const bubbleCounterRef = useRef(0)

  // 스트리밍 청크 수신 콜백
  const handleChunk = useCallback((chunk: string) => {
    streamingContentRef.current += chunk

    // Div Return 마커 감지
    const content = streamingContentRef.current
    if (content.includes('<div') || content.includes('<!--div-return-->')) {
      streamingContentTypeRef.current = 'div-return'
    }

    setStreamingMessage((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        content: streamingContentRef.current,
        contentType: streamingContentTypeRef.current,
        status: 'streaming',
        toolInfo: undefined,
      }
    })
  }, [])

  // 의미론적 말풍선 경계 수신 콜백: 현재 스트리밍 콘텐츠를 확정된 말풍선으로 분리
  const handleBoundary = useCallback(() => {
    const currentContent = streamingContentRef.current.trim()
    if (!currentContent || !currentMessageIdRef.current) return

    // 현재 콘텐츠를 완성된 말풍선으로 확정
    const bubbleMessage: Message = {
      id: `${currentMessageIdRef.current}-b${bubbleCounterRef.current}`,
      content: currentContent,
      contentType: streamingContentTypeRef.current,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation',
      status: 'complete',
    }
    bubbleCounterRef.current += 1

    onMessageAddRef.current?.(bubbleMessage)

    // 스트리밍 버퍼 초기화 후 새 말풍선 시작
    streamingContentRef.current = ''
    streamingContentTypeRef.current = 'text'
    setStreamingMessage((prev) => {
      if (!prev) return prev
      return { ...prev, content: '', contentType: 'text', status: 'streaming' }
    })
  }, [])

  // tool 이벤트 수신 콜백
  const handleTool = useCallback((tool: {
    toolName: string
    toolUseId: string
    status: 'running' | 'complete'
    input?: Record<string, unknown>
    output?: string
  }) => {
    const displayName = tool.toolName || lastToolNameRef.current || 'tool'
    if (tool.toolName) {
      lastToolNameRef.current = tool.toolName
    }

    setStreamingMessage((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        status: 'tool-use',
        toolInfo: { toolName: displayName, status: tool.status },
      }
    })

    // 도구 실행 완료 시 thinking으로 복귀
    if (tool.status === 'complete') {
      setTimeout(() => {
        lastToolNameRef.current = ''
        setStreamingMessage((prev) => {
          if (!prev || prev.status === 'streaming' || prev.status === 'complete') return prev
          return { ...prev, status: 'thinking', toolInfo: undefined }
        })
      }, 1000)
    }
  }, [])

  // 스트리밍 완료 콜백
  const handleComplete = useCallback((metadata: {
    contentType: MessageContentType
    isComplete: boolean
    messageId: string
  }) => {
    const finalContent = streamingContentRef.current.replace('EOF', '').trim()
    const finalContentType = metadata.contentType || streamingContentTypeRef.current

    // boundary로 이미 분리된 후 잔여 콘텐츠가 있는 경우에만 최종 메시지 추가
    if (finalContent) {
      const botMessage: Message = {
        id: metadata.messageId || (currentMessageIdRef.current
          ? (parseInt(currentMessageIdRef.current) + 1).toString()
          : Date.now().toString()),
        content: finalContent,
        contentType: finalContentType,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
        status: 'complete',
      }
      onMessageAddRef.current?.(botMessage)
    }

    setStreamingMessage(null)
    onCompleteRef.current?.(metadata.isComplete)

    // ref 초기화
    streamingContentRef.current = ''
    currentMessageIdRef.current = null
    streamingContentTypeRef.current = 'text'
    bubbleCounterRef.current = 0
  }, [])

  // 에러 수신 콜백
  const handleError = useCallback((errorMsg: string) => {
    console.error('[useChat] WebSocket 에러:', errorMsg)
    setError(errorMsg)

    const errorMessage: Message = {
      id: Date.now().toString(),
      content: MESSAGES.FAILED_TO_SEND,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation',
      status: 'error',
    }

    setStreamingMessage(null)
    onMessageAddRef.current?.(errorMessage)
    streamingContentRef.current = ''
    currentMessageIdRef.current = null
    streamingContentTypeRef.current = 'text'
  }, [])

  // WebSocket 연결
  const { sendMessage: wsSendMessage, connectionState, isConnected } = useWebSocket({
    sessionId: sessionId || '',
    pin: pin || '',
    wsUrl: WS_URL,
    locale,
    onChunk: handleChunk,
    onBoundary: handleBoundary,
    onTool: handleTool,
    onComplete: handleComplete,
    onError: handleError,
  })

  // 봇 메시지 플레이스홀더 생성 (thinking 상태)
  const createBotPlaceholder = useCallback((messageId: string): Message => {
    const botMessageId = (parseInt(messageId) + 1).toString()
    streamingContentRef.current = ''
    streamingContentTypeRef.current = 'text'
    bubbleCounterRef.current = 0
    return {
      id: botMessageId,
      content: '',
      contentType: 'text',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation',
      status: 'thinking',
    }
  }, [])

  // 텍스트 메시지 전송
  const sendMessage = useCallback(
    (
      onMessageAdd: (message: Message) => void,
      onComplete: (complete: boolean) => void
    ) => {
      if (!inputValue.trim() || streamingMessage || !sessionId) return

      const messageId = Date.now().toString()
      const userMessage: Message = {
        id: messageId,
        content: inputValue,
        sender: 'customer',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      }

      onMessageAddRef.current = onMessageAdd
      onCompleteRef.current = onComplete
      currentMessageIdRef.current = messageId

      onMessageAdd(userMessage)
      setInputValue('')
      setError('')
      setStreamingMessage(createBotPlaceholder(messageId))

      wsSendMessage(inputValue, messageId, undefined, agentRole)
    },
    [inputValue, streamingMessage, sessionId, wsSendMessage, createBotPlaceholder, agentRole]
  )

  // 프로그래밍 방식 텍스트 메시지 전송 (입력 폼 요청 등)
  const sendDirectMessage = useCallback(
    (
      text: string,
      onMessageAdd: (message: Message) => void,
      onComplete: (complete: boolean) => void
    ) => {
      if (!text.trim() || streamingMessage || !sessionId) return

      const messageId = Date.now().toString()
      const userMessage: Message = {
        id: messageId,
        content: text,
        sender: 'customer',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      }

      onMessageAddRef.current = onMessageAdd
      onCompleteRef.current = onComplete
      currentMessageIdRef.current = messageId

      onMessageAdd(userMessage)
      setError('')
      setStreamingMessage(createBotPlaceholder(messageId))

      wsSendMessage(text, messageId, undefined, agentRole)
    },
    [streamingMessage, sessionId, wsSendMessage, createBotPlaceholder, agentRole]
  )

  // 폼 제출 메시지 전송
  const sendFormSubmission = useCallback(
    (
      formData: Record<string, string>,
      onMessageAdd: (message: Message) => void,
      onComplete: (complete: boolean) => void
    ) => {
      if (streamingMessage || !sessionId) return

      const messageId = Date.now().toString()
      const userMessage: Message = {
        id: messageId,
        content: JSON.stringify(formData),
        contentType: 'form-submission',
        sender: 'customer',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      }

      onMessageAddRef.current = onMessageAdd
      onCompleteRef.current = onComplete
      currentMessageIdRef.current = messageId

      onMessageAdd(userMessage)
      setError('')
      setStreamingMessage(createBotPlaceholder(messageId))

      wsSendMessage(JSON.stringify(formData), messageId, 'form-submission', agentRole)
    },
    [streamingMessage, sessionId, wsSendMessage, createBotPlaceholder, agentRole]
  )

  const clearInput = useCallback(() => {
    setInputValue('')
  }, [])

  // loading은 streamingMessage에서 파생
  const loading = streamingMessage !== null

  return {
    inputValue,
    setInputValue,
    loading,
    error,
    sendMessage,
    sendDirectMessage,
    sendFormSubmission,
    clearInput,
    streamingMessage,
    connectionState,
    isConnected,
  }
}
