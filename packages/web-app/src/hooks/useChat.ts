import { useState, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'
import { WS_URL } from '../config/api'
import type { Message, MessageContentType } from '../types'
import { MESSAGES } from '../constants'

/**
 * WebSocket 기반 채팅 훅
 *
 * REST API 호출을 완전히 제거하고 WebSocket only로 메시지를 전송합니다.
 * - 스트리밍 청크 → streamingMessage 상태 업데이트
 * - tool 이벤트 → toolStatus 상태로 도구 사용 표시
 * - 완료 시 최종 메시지 확정 및 streamingMessage 초기화
 * - Div Return contentType 처리 유지
 * - form-submission 메시지 WebSocket 전송 지원
 */
export const useChat = (sessionId: string | undefined, pin?: string) => {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)
  const [toolStatus, setToolStatus] = useState<{
    toolName: string
    status: 'running' | 'complete'
  } | null>(null)

  // 콜백에서 최신 상태를 참조하기 위한 ref
  const streamingContentRef = useRef('')
  const currentMessageIdRef = useRef<string | null>(null)
  const onMessageAddRef = useRef<((message: Message) => void) | null>(null)
  const onCompleteRef = useRef<((complete: boolean) => void) | null>(null)
  const streamingContentTypeRef = useRef<MessageContentType>('text')

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
      }
    })
  }, [])

  // tool 이벤트 수신 콜백
  const lastToolNameRef = useRef<string>('')
  const handleTool = useCallback((tool: {
    toolName: string
    toolUseId: string
    status: 'running' | 'complete'
    input?: Record<string, unknown>
    output?: string
  }) => {
    // running 이벤트에서 toolName을 기억 (complete 이벤트에서 빈 문자열이 올 수 있음)
    const displayName = tool.toolName || lastToolNameRef.current || 'tool'
    if (tool.toolName) {
      lastToolNameRef.current = tool.toolName
    }

    setToolStatus({
      toolName: displayName,
      status: tool.status,
    })

    // 도구 실행 완료 시 상태 초기화
    if (tool.status === 'complete') {
      setTimeout(() => {
        setToolStatus(null)
        lastToolNameRef.current = ''
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

    // 최종 메시지 확정
    const botMessage: Message = {
      id: metadata.messageId || (currentMessageIdRef.current
        ? (parseInt(currentMessageIdRef.current) + 1).toString()
        : Date.now().toString()),
      content: finalContent,
      contentType: finalContentType,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation',
    }

    // 스트리밍 메시지를 최종 메시지로 교체
    setStreamingMessage(null)
    onMessageAddRef.current?.(botMessage)
    onCompleteRef.current?.(metadata.isComplete)

    // 상태 초기화
    setLoading(false)
    setToolStatus(null)
    streamingContentRef.current = ''
    currentMessageIdRef.current = null
    streamingContentTypeRef.current = 'text'
  }, [])

  // 에러 수신 콜백
  const handleError = useCallback((errorMsg: string) => {
    console.error('[useChat] WebSocket 에러:', errorMsg)
    setError(errorMsg)

    // 에러 메시지를 채팅에 표시
    const errorMessage: Message = {
      id: Date.now().toString(),
      content: MESSAGES.FAILED_TO_SEND,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation',
    }

    setStreamingMessage(null)
    onMessageAddRef.current?.(errorMessage)
    setLoading(false)
    streamingContentRef.current = ''
    currentMessageIdRef.current = null
    streamingContentTypeRef.current = 'text'
  }, [])

  // WebSocket 연결
  const { sendMessage: wsSendMessage, connectionState, isConnected } = useWebSocket({
    sessionId: sessionId || '',
    pin: pin || '',
    wsUrl: WS_URL,
    onChunk: handleChunk,
    onTool: handleTool,
    onComplete: handleComplete,
    onError: handleError,
  })

  // 텍스트 메시지 전송
  const sendMessage = useCallback(
    (
      onMessageAdd: (message: Message) => void,
      onComplete: (complete: boolean) => void
    ) => {
      if (!inputValue.trim() || loading || !sessionId) return

      const messageId = Date.now().toString()
      const userMessage: Message = {
        id: messageId,
        content: inputValue,
        sender: 'customer',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      }

      // 콜백 ref 저장
      onMessageAddRef.current = onMessageAdd
      onCompleteRef.current = onComplete
      currentMessageIdRef.current = messageId

      onMessageAdd(userMessage)
      setInputValue('')
      setLoading(true)
      setError('')

      // 스트리밍 메시지 플레이스홀더 생성
      const botMessageId = (parseInt(messageId) + 1).toString()
      streamingContentRef.current = ''
      streamingContentTypeRef.current = 'text'
      setStreamingMessage({
        id: botMessageId,
        content: '',
        contentType: 'text',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      })

      // WebSocket으로 메시지 전송
      wsSendMessage(inputValue, messageId)
    },
    [inputValue, loading, sessionId, wsSendMessage]
  )

  // 폼 제출 메시지 전송
  const sendFormSubmission = useCallback(
    (
      formData: Record<string, string>,
      onMessageAdd: (message: Message) => void,
      onComplete: (complete: boolean) => void
    ) => {
      if (loading || !sessionId) return

      const messageId = Date.now().toString()
      const userMessage: Message = {
        id: messageId,
        content: JSON.stringify(formData),
        contentType: 'form-submission',
        sender: 'customer',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      }

      // 콜백 ref 저장
      onMessageAddRef.current = onMessageAdd
      onCompleteRef.current = onComplete
      currentMessageIdRef.current = messageId

      onMessageAdd(userMessage)
      setLoading(true)
      setError('')

      // 스트리밍 메시지 플레이스홀더 생성
      const botMessageId = (parseInt(messageId) + 1).toString()
      streamingContentRef.current = ''
      streamingContentTypeRef.current = 'text'
      setStreamingMessage({
        id: botMessageId,
        content: '',
        contentType: 'text',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation',
      })

      // WebSocket으로 form-submission 메시지 전송
      wsSendMessage(JSON.stringify(formData), messageId, 'form-submission')
    },
    [loading, sessionId, wsSendMessage]
  )

  const clearInput = useCallback(() => {
    setInputValue('')
  }, [])

  return {
    inputValue,
    setInputValue,
    loading,
    error,
    sendMessage,
    sendFormSubmission,
    clearInput,
    streamingMessage,
    // WebSocket 관련 상태 추가 노출
    connectionState,
    isConnected,
    toolStatus,
  }
}
