import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import type { Message, SalesRepInfo } from '../types'
import { replaceSalesRepPlaceholders } from '../utils/placeholderReplacer'

interface ChatMessageProps {
  message: Message
  isCustomer?: boolean
  salesRepInfo?: SalesRepInfo
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCustomer = false, salesRepInfo }) => {
  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'copy':
        navigator.clipboard.writeText(message.content)
        break
      case 'helpful':
        // Success feedback animation
        const button = document.querySelector('[data-testid="helpful-btn"]')
        if (button) button.classList.add('success-animation')
        break
      default:
        break
    }
  }

  if (isCustomer) {
    return (
      <div className="slide-in-right" style={{ maxWidth: '70vw', marginLeft: 'auto' }}>
        <ChatBubble
          type="outgoing"
          ariaLabel={`You at ${new Date(message.timestamp).toLocaleTimeString()}`}
          avatar={
            <Avatar
              initials="U"
              ariaLabel="You"
              tooltipText="You"
            />
          }
        >
          <div style={{
            padding: '12px',
            backgroundColor: '#0073bb',
            color: 'white',
            borderRadius: '8px',
            wordWrap: 'break-word'
          }}>
            {message.content}
          </div>
        </ChatBubble>
      </div>
    )
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
        }
      >
        <ReactMarkdown>{replaceSalesRepPlaceholders(message.content, salesRepInfo)}</ReactMarkdown>
      </ChatBubble>
    </div>
  )
}