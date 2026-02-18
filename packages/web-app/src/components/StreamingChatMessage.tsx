// nosemgrep
import { useEffect, useState, useMemo } from 'react'
import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import type { Message, SalesRepInfo } from '../types'
import { replaceSalesRepPlaceholders } from '../utils/placeholderReplacer'
import { DivReturnRenderer } from './DivReturnRenderer'

interface StreamingChatMessageProps {
  message: Message
  isStreaming?: boolean
  salesRepInfo?: SalesRepInfo
  onFormSubmit?: (formData: Record<string, string>) => void
}

export const StreamingChatMessage: React.FC<StreamingChatMessageProps> = ({ 
  message, 
  isStreaming = false,
  salesRepInfo,
  onFormSubmit,
}) => {
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
      case 'helpful':
        const button = document.querySelector('[data-testid="helpful-btn"]')
        if (button) button.classList.add('success-animation')
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
                {
                  type: "group",
                  text: "Feedback",
                  items: [
                    {
                      type: "icon-button",
                      id: "helpful",
                      iconName: "thumbs-up",
                      text: "Helpful"
                    },
                    {
                      type: "icon-button",
                      id: "not-helpful",
                      iconName: "thumbs-down",
                      text: "Not helpful"
                    }
                  ]
                },
                {
                  type: "icon-button",
                  id: "copy",
                  iconName: "copy",
                  text: "Copy",
                  popoverFeedback: (
                    <StatusIndicator type="success">
                      Message copied
                    </StatusIndicator>
                  )
                }
              ]}
              onItemClick={({ detail }) => handleActionClick(detail.id)}
            />
          ) : undefined
        }
      >
        <div style={{ position: 'relative' }}>
          {isStreaming ? (
            <>
              {completedLines && (
                <ReactMarkdown>{replaceSalesRepPlaceholders(completedLines, salesRepInfo)}</ReactMarkdown>
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
            <ReactMarkdown>{replaceSalesRepPlaceholders(message.content, salesRepInfo)}</ReactMarkdown>
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