// nosemgrep
import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import type { Message, SalesRepInfo } from '../types'
import { replaceSalesRepPlaceholders } from '../utils/placeholderReplacer'
import { DivReturnRenderer } from './DivReturnRenderer'
import { FormSubmissionSummary } from './FormSubmissionSummary'
import { useI18n } from '../i18n'

interface ChatMessageProps {
  message: Message
  isCustomer?: boolean
  salesRepInfo?: SalesRepInfo
  onFormSubmit?: (formData: Record<string, string>) => void
  onRequestForm?: () => void
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCustomer = false, salesRepInfo, onFormSubmit, onRequestForm }) => {
  const { t } = useI18n()
  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'copy':
        navigator.clipboard.writeText(message.content)
        break
      case 'request-form':
        onRequestForm?.()
        break
      default:
        break
    }
  }

  // contentType 기반 렌더링 분기
  const renderContent = () => {
    const contentType = message.contentType || 'text';
    switch (contentType) {
      case 'div-return':
        return (
          <DivReturnRenderer
            htmlContent={message.content}
            onFormSubmit={onFormSubmit || (() => {})}
            disabled={!onFormSubmit}
          />
        );
      case 'form-submission':
        return <FormSubmissionSummary content={message.content} />;
      case 'text':
      default:
        return <ReactMarkdown>{replaceSalesRepPlaceholders(message.content, salesRepInfo)}</ReactMarkdown>;
    }
  };

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
            {message.contentType === 'form-submission'
              ? <FormSubmissionSummary content={message.content} />
              : message.content}
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
              }
            ]}
            onItemClick={({ detail }) => handleActionClick(detail.id)}
          />
        }
      >
        {renderContent()}
      </ChatBubble>
    </div>
  )
}