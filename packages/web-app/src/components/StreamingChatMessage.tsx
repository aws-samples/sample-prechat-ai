import { useEffect, useState } from 'react'
import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import { Message } from '../types'

interface StreamingChatMessageProps {
  message: Message
  isStreaming?: boolean
}

export const StreamingChatMessage: React.FC<StreamingChatMessageProps> = ({ 
  message, 
  isStreaming = false 
}) => {
  const [displayedContent, setDisplayedContent] = useState('')
  const [showCursor, setShowCursor] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setDisplayedContent(message.content)
      setShowCursor(true)
    } else {
      setDisplayedContent(message.content)
      setShowCursor(false)
    }
  }, [message.content, isStreaming])

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
          <ReactMarkdown>{displayedContent}</ReactMarkdown>
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