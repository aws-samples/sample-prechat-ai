// nosemgrep
import { useEffect, useState, useMemo, useRef } from 'react'
import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message, SalesRepInfo } from '../types'
import { replaceSalesRepPlaceholders } from '../utils/placeholderReplacer'
import { DivReturnRenderer } from './DivReturnRenderer'
import { useI18n } from '../i18n'

interface StreamingChatMessageProps {
  message: Message
  isStreaming?: boolean
  salesRepInfo?: SalesRepInfo
  onFormSubmit?: (formData: Record<string, string>) => void
  onRequestForm?: () => void
  onCapture?: () => void
}

// 타이핑 애니메이션 훅: 글자를 점진적으로 표시
function useTypewriter(text: string, enabled: boolean, speed = 12): { displayed: string; isTyping: boolean } {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [isTyping, setIsTyping] = useState(enabled)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      setIsTyping(false)
      return
    }
    indexRef.current = 0
    setDisplayed('')
    setIsTyping(true)
    const interval = setInterval(() => {
      indexRef.current += 1
      if (indexRef.current >= text.length) {
        setDisplayed(text)
        setIsTyping(false)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, indexRef.current))
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, enabled, speed])

  return { displayed, isTyping }
}

export const StreamingChatMessage: React.FC<StreamingChatMessageProps> = ({ 
  message, 
  isStreaming = false,
  salesRepInfo,
  onFormSubmit,
  onRequestForm,
  onCapture,
}) => {
  const { t } = useI18n()
  const [showCursor, setShowCursor] = useState(isStreaming)
  const [formSubmitted, setFormSubmitted] = useState(false)
  // 애니메이션을 한 번만 실행하기 위한 ref
  const hasAnimatedRef = useRef(false)
  const animationClass = hasAnimatedRef.current ? '' : 'slide-in-left'

  useEffect(() => {
    hasAnimatedRef.current = true
  }, [])

  // 타이핑 애니메이션: animate 플래그가 있고 스트리밍이 아닌 완료 메시지에만 적용
  const shouldAnimate = !isStreaming && !!message.animate
  const processedContent = replaceSalesRepPlaceholders(message.content, salesRepInfo)
  const { displayed: typedContent, isTyping } = useTypewriter(processedContent, shouldAnimate)

  // 스트리밍 중: 완성된 줄은 마크다운, 진행 중인 줄은 plain text
  const { completedLines, currentLine } = useMemo(() => {
    if (!isStreaming) return { completedLines: '', currentLine: '' }
    const content = message.content
    const lastNewline = content.lastIndexOf('\n')
    if (lastNewline === -1) {
      return { completedLines: '', currentLine: content }
    }
    return {
      completedLines: content.substring(0, lastNewline + 1),
      currentLine: content.substring(lastNewline + 1),
    }
  }, [message.content, isStreaming])

  useEffect(() => {
    if (isStreaming || isTyping) {
      setShowCursor(true)
    } else {
      setShowCursor(false)
    }
  }, [isStreaming, isTyping])

  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'copy':
        navigator.clipboard.writeText(message.content)
        break
      case 'request-form':
        onRequestForm?.()
        break
      case 'capture':
        onCapture?.()
        break
      default:
        break
    }
  }

  return (
    <div className={animationClass || undefined} style={{ maxWidth: '70vw' }}>
      <ChatBubble
        type="incoming"
        ariaLabel={`Assistant at ${new Date(message.timestamp).toLocaleTimeString()}`}
        avatar={
          <Avatar
            color="gen-ai"
            iconName="gen-ai"
            ariaLabel="AI Assistant"
            tooltipText="AI Assistant"
          />
        }
        actions={
          !isStreaming ? (
            <ButtonGroup
              ariaLabel="Message actions"
              variant="icon"
              items={[
                ...(onRequestForm ? [{
                  type: "icon-button" as const,
                  id: "request-form",
                  iconName: "insert-row" as const,
                  text: t('customer.chat.requestFormButton')
                }] : []),
                {
                  type: "icon-button" as const,
                  id: "copy",
                  iconName: "copy" as const,
                  text: "Copy",
                  popoverFeedback: (
                    <StatusIndicator type="success">
                      Message copied
                    </StatusIndicator>
                  )
                },
                ...(onCapture ? [{
                  type: "icon-button" as const,
                  id: "capture",
                  iconName: "share" as const,
                  text: t('admin.planningChat.captureToDiscussion') || 'Capture to Discussion',
                }] : []),
              ]}
              onItemClick={({ detail }) => handleActionClick(detail.id)}
            />
          ) : undefined
        }
      >
        <div className="chat-bubble-content" style={{ position: 'relative', lineHeight: 1.6 }}>
          {isStreaming ? (
            <>
              {completedLines && (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{replaceSalesRepPlaceholders(completedLines, salesRepInfo)}</ReactMarkdown>
              )}
              {currentLine && <span>{currentLine}</span>}
            </>
          ) : (message.contentType || 'text') === 'div-return' ? (
            <DivReturnRenderer
              htmlContent={message.content}
              onFormSubmit={(formData) => {
                setFormSubmitted(true)
                onFormSubmit?.(formData)
              }}
              disabled={formSubmitted}
            />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{typedContent}</ReactMarkdown>
          )}
          {(isStreaming || isTyping) && showCursor && (
            <span 
              style={{ 
                opacity: 0.6,
                marginLeft: '2px',
                fontWeight: 'bold'
              }}
            >
              |
            </span>
          )}
        </div>
      </ChatBubble>
    </div>
  )
}