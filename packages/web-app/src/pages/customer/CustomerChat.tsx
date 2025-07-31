import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Spinner,
  ButtonGroup,
  PromptInput,
  StatusIndicator,
  Grid
} from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'


import { chatApi } from '../../services/api'
import { Message } from '../../types'

export default function CustomerChat() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)

  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const session = await chatApi.getSession(sessionId!)
      setSessionData(session)
      setMessages(session.conversationHistory)
      setIsComplete(session.status === 'completed')

      // If no conversation history, pre-fill the input with greeting message
      if (session.conversationHistory.length === 0 && !inputValue) {
        const customerInfo = session.customerInfo
        const company = customerInfo.company || '회사'
        const title = customerInfo.title || '담당자'
        const name = customerInfo.name || '고객'
        
        const greetingMessage = `안녕하세요, 저는 ${company}에서 ${title}로 있는 ${name}이라 합니다. 사전에 논의할 내용과 기대사항을 공유드리기 위해 PreChat 사전채팅에 참가하였습니다!`
        setInputValue(greetingMessage)
      }
    } catch (err) {
      setError('Session not found or expired')
    } finally {
      setSessionLoading(false)
    }
  }



  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const messageId = Date.now().toString()
    const userMessage: Message = {
      id: messageId,
      content: inputValue,
      sender: 'customer',
      timestamp: new Date().toISOString(),
      stage: 'conversation'
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      const response = await chatApi.sendMessage({
        sessionId: sessionId!,
        message: inputValue,
        messageId
      })

      // Clean up EOF token from response
      const cleanedResponse = response.response.replace('EOF', '').trim()

      const botMessage: Message = {
        id: (parseInt(messageId) + 1).toString(),  // Match backend bot response ID
        content: cleanedResponse,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation'
      }

      setMessages(prev => [...prev, botMessage])
      setIsComplete(response.isComplete)

      if (response.salesRepInfo) {
        const contactMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `🎯 **Consultation Complete!**\n\nYour AWS sales representative will contact you:\n\n👤 **${response.salesRepInfo.name}**\n📧 ${response.salesRepInfo.email}\n📞 ${response.salesRepInfo.phone}\n\n✅ Next steps will be shared via email within 24 hours.`,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          stage: 'conversation'
        }
        setTimeout(() => setMessages(prev => [...prev, contactMessage]), 500)
      }
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError(err.response?.data?.error || 'Failed to send message')

      // Add error message to chat
      const errorMessage: Message = {
        id: (parseInt(messageId) + 1).toString(),
        content: '죄송합니다. 메시지 전송 중 오류가 발생했습니다. 다시 시도해 주세요.',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }



  if (sessionLoading) {
    return (
      <Container>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <Alert type="error" header="Session Error">
          {error}
        </Alert>
      </Container>
    )
  }

  return (
    <Grid gridDefinition={[{colspan: 1}, {colspan: 8}]}>
      <div></div>
      <>
        <Container>
          <SpaceBetween size="l">
            <div className="fade-in-up">
              <Header
                variant="h1"
                description=""
              >
                PreChat 에게 고민을 말씀해 보세요.
              </Header>
            </div>

              <ChatBubble
                type="incoming"
                ariaLabel={`temp`}
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
                  />
                }
              >
                <ReactMarkdown>
                  {
    `안녕하세요 저는 AWS PreChat 입니다. 저는 고객님의 클라우드 사용을 성공적으로 돕기위해 얘기를 나누고 싶습니다.

    저희와 만남전에 논의할 내용과 기대하시는 내용을 알려주세요! 적합한 AWS 담당자께 전달해 드리겠습니다.`}
                  </ReactMarkdown>
              </ChatBubble>



            <Box padding="s" backgroundColor="background-container-content" minHeight="400px">
              <SpaceBetween size="m">
                {messages.map((message) => (
                  message.sender === 'customer' ? (
                    <div key={message.id} className="slide-in-right" style={{ maxWidth: '70vw', marginLeft: 'auto' }}>
                      <ChatBubble
                        type="outgoing"
                        ariaLabel={`You at ${new Date(message.timestamp).toLocaleTimeString()}`}
                        avatar={
                          <Avatar
                            initials="U"
                            color="blue"
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
                  ) : (
                    <div key={message.id} className="slide-in-left" style={{ maxWidth: '70vw' }}>
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
                                    text: "Helpful",
                                    onClick: () => {
                                      // Success feedback animation
                                      const button = document.querySelector('[data-testid="helpful-btn"]')
                                      if (button) button.classList.add('success-animation')
                                    }
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
                                  <StatusIndicator type="success" className="success-animation">
                                    Message copied
                                  </StatusIndicator>
                                ),
                                onClick: () => navigator.clipboard.writeText(message.content)
                              }
                            ]}
                          />
                        }
                      >
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </ChatBubble>
                    </div>
                  )
                ))}
                {loading && (
                  <div className="slide-in-left" style={{ maxWidth: '70vw' }}>
                    <ChatBubble
                      type="incoming"
                      ariaLabel="Assistant is thinking"
                      avatar={
                        <Avatar
                          color="gen-ai"
                          iconName="gen-ai"
                          ariaLabel="AI Assistant"
                          tooltipText="AI Assistant"
                        />
                      }
                    >
                      <Box>
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <Box margin={{ left: 's' }} display="inline-block">
                          AI is thinking...
                        </Box>
                      </Box>
                    </ChatBubble>
                  </div>
                )}
              </SpaceBetween>
            </Box>

            {!isComplete && (
              <PromptInput
                value={inputValue}
                onChange={({ detail }) => setInputValue(detail.value)}
                onAction={sendMessage}
                actionButtonAriaLabel="Send message"
                actionButtonIconName="send"
                placeholder="💬 Tell me about your business goals, technical challenges, or AWS requirements... I'm here to help!"
                disabled={loading}
                disableSecondaryActionsPaddings
                secondaryActions={
                  <Box padding={{ left: "xxs", top: "xs" }}>
                    <ButtonGroup
                      ariaLabel="Chat actions"
                      items={[
                        {
                          type: "icon-button",
                          id: "clear",
                          iconName: "close",
                          text: "Clear input",
                          disabled: !inputValue || loading,
                          onClick: () => setInputValue('')
                        }
                      ]}
                      variant="icon"
                    />
                  </Box>
                }
              />
            )}

            {isComplete && (
              <div className="fade-in-up success-animation">
                <Alert
                  type="success"
                  header="✅ 상담이 완료되었습니다"
                >
                  감사합니다. 귀하의 응답이 기록되었습니다. 담당자가 연락드릴 예정입니다.
                </Alert>
              </div>
            )}
          </SpaceBetween>
        </Container>
        <Container>
          {sessionData?.salesRepInfo && (
            <Box margin={{ top: 'm' }}>
              <Header variant="h3">담당자 정보</Header>
              <Box padding="s" backgroundColor="background-container-content">
                <SpaceBetween size="s">
                  <Box>
                    <Box display="inline" fontWeight="bold">담당자: </Box>
                    <Box display="inline">{sessionData.salesRepInfo.name}</Box>
                  </Box>
                  <Box>
                    <Box display="inline" fontWeight="bold">이메일: </Box>
                    <Box display="inline">{sessionData.salesRepInfo.email}</Box>
                  </Box>
                  <Box>
                    <Box display="inline" fontWeight="bold">연락처: </Box>
                    <Box display="inline">{sessionData.salesRepInfo.phone}</Box>
                  </Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    추가 문의사항이 있으시면 위 담당자에게 직접 연락해 주세요.
                  </Box>
                </SpaceBetween>
              </Box>
            </Box>
          )}
        </Container>
      </>
    </Grid>
  )
}