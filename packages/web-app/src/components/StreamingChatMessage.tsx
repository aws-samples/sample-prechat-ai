// nosemgrep
import { useEffect, useState, useMemo } from 'react'
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
    if (isStreaming) {
      setShowCursor(true)
    } else {
      setShowCursor(false)
    }
  }, [isStreaming])

  // Cursor blinking effect
  useEffect(() => {
    if (!showCursor) return

    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => clearInterval(interval)
  }, [showCursor])

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
    <div className="slide-in-left" style={{ maxWidth: '70vw' }}>
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
        <div style={{ position: 'relative', lineHeight: 1.6 }}>
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{replaceSalesRepPlaceholders(message.content, salesRepInfo)}</ReactMarkdown>
          )}
          {isStreaming && (
            <span 
              style={{ 
                opacity: showCursor ? 1 : 0,
                transition: 'opacity 0.1s',
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