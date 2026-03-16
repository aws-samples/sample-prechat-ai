// nosemgrep
import { useEffect, useRef, useState } from 'react'
import { ButtonGroup, StatusIndicator } from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message, SalesRepInfo } from '../types'
import { replaceSalesRepPlaceholders } from '../utils/placeholderReplacer'
import { DivReturnRenderer } from './DivReturnRenderer'
import { FormSubmissionSummary } from './FormSubmissionSummary'
import { useI18n } from '../i18n'

// 타이핑 애니메이션 훅: 글자를 점진적으로 표시
function useTypewriter(text: string, enabled: boolean, speed = 12): string {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text)
      return
    }
    indexRef.current = 0
    setDisplayed('')
    const interval = setInterval(() => {
      indexRef.current += 1
      if (indexRef.current >= text.length) {
        setDisplayed(text)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, indexRef.current))
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, enabled, speed])

  return displayed
}

interface ChatMessageProps {
  message: Message
  isCustomer?: boolean
  salesRepInfo?: SalesRepInfo
  onFormSubmit?: (formData: Record<string, string>) => void
  onRequestForm?: () => void
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCustomer = false, salesRepInfo, onFormSubmit, onRequestForm }) => {
  const { t } = useI18n()
  // 애니메이션을 한 번만 실행하기 위한 ref
  const hasAnimatedRef = useRef(false)
  const animationClass = hasAnimatedRef.current
    ? ''
    : isCustomer ? 'slide-in-right' : 'slide-in-left'

  useEffect(() => {
    hasAnimatedRef.current = true
  }, [])

  // 타이핑 애니메이션: animate 플래그가 있는 봇 메시지에만 적용
  const processedContent = replaceSalesRepPlaceholders(message.content, salesRepInfo)
  const typedContent = useTypewriter(processedContent, !!message.animate)
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
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{typedContent}</ReactMarkdown>;
    }
  };

  if (isCustomer) {
    return (
      <div className={animationClass || undefined} style={{ maxWidth: '70vw', marginLeft: 'auto' }}>
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
        <div className="chat-bubble-content">
          {renderContent()}
        </div>
      </ChatBubble>
    </div>
  )
}