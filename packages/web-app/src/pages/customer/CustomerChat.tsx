import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button,
  Input,
  Alert,
  Spinner,
  ProgressBar,
  Select,
  ButtonGroup,
  PromptInput,
  StatusIndicator
} from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import LoadingBar from '@cloudscape-design/chat-components/loading-bar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'

import { chatApi } from '../../services/api'
import { Message, ConversationStage, BEDROCK_MODELS } from '../../types'

export default function CustomerChat() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(`chat-${sessionId}`)
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentStage, setCurrentStage] = useState<ConversationStage>(ConversationStage.AUTHORITY)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedModel, setSelectedModel] = useState(BEDROCK_MODELS[0])

  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const session = await chatApi.getSession(sessionId!)
      const serverMessages = session.conversationHistory
      const localMessages = JSON.parse(sessionStorage.getItem(`chat-${sessionId}`) || '[]')
      
      // Use server messages if more recent, otherwise use local
      const useMessages = serverMessages.length >= localMessages.length ? serverMessages : localMessages
      setMessages(useMessages)
      sessionStorage.setItem(`chat-${sessionId}`, JSON.stringify(useMessages))
      
      setCurrentStage(session.currentStage)
      setIsComplete(session.status === 'completed')
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
      stage: currentStage
    }

    setMessages(prev => {
      const updated = [...prev, userMessage]
      sessionStorage.setItem(`chat-${sessionId}`, JSON.stringify(updated))
      return updated
    })
    setInputValue('')
    setLoading(true)

    try {
      const response = await chatApi.sendMessage({
        sessionId: sessionId!,
        message: inputValue,
        messageId,
        selectedModel: selectedModel.id
      })

      const botMessage: Message = {
        id: Date.now().toString(),
        content: response.response,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: response.stage
      }

      setMessages(prev => {
        const updated = [...prev, botMessage]
        sessionStorage.setItem(`chat-${sessionId}`, JSON.stringify(updated))
        return updated
      })
      setCurrentStage(response.stage)
      setIsComplete(response.isComplete)
      
      if (response.salesRepInfo) {
        const contactMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `🎯 **Consultation Complete!**\n\nYour AWS sales representative will contact you:\n\n👤 **${response.salesRepInfo.name}**\n📧 ${response.salesRepInfo.email}\n📞 ${response.salesRepInfo.phone}\n\n✅ Next steps will be shared via email within 24 hours.`,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          stage: response.stage
        }
        setTimeout(() => setMessages(prev => {
          const updated = [...prev, contactMessage]
          sessionStorage.setItem(`chat-${sessionId}`, JSON.stringify(updated))
          return updated
        }), 500)
      }
    } catch (err) {
      setError('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const getStageProgress = () => {
    const stages = Object.values(ConversationStage)
    const currentIndex = stages.indexOf(currentStage)
    return ((currentIndex + 1) / stages.length) * 100
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
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="🤖 AI-powered consultation to understand your AWS requirements and connect you with the right solutions team."
        >
          🚀 MTE Pre-consultation Chat
        </Header>
        
        <Box>
          <SpaceBetween size="s">
            <Header variant="h3">🧠 AI Model Selection</Header>
            <Select
              selectedOption={{ label: selectedModel.name, value: selectedModel.id }}
              onChange={({ detail }) => {
                const model = BEDROCK_MODELS.find(m => m.id === detail.selectedOption.value)
                if (model) setSelectedModel(model)
              }}
              options={BEDROCK_MODELS.map(model => ({
                label: `${model.name} (${model.provider})`,
                value: model.id
              }))}
              disabled={loading}
            />
          </SpaceBetween>
        </Box>

        <Box>
          <SpaceBetween size="s">
            <Header variant="h3">📈 Conversation Progress</Header>
            <ProgressBar
              value={getStageProgress()}
              label={`Stage: ${currentStage.replace('_', ' ').toUpperCase()}`}
              variant={isComplete ? 'success' : 'in-progress'}
              resultText={isComplete ? 'Consultation completed successfully!' : undefined}
            />
          </SpaceBetween>
        </Box>

        <Box padding="s" backgroundColor="background-container-content" minHeight="400px">
          <SpaceBetween size="m">
            {messages.map((message) => (
              message.sender === 'customer' ? (
                <ChatBubble
                  key={message.id}
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
                  {message.content}
                </ChatBubble>
              ) : (
                <ChatBubble
                  key={message.id}
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
                          ),
                          onClick: () => navigator.clipboard.writeText(message.content)
                        }
                      ]}
                    />
                  }
                >
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </ChatBubble>
              )
            ))}
            {loading && (
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
                <LoadingBar variant="gen-ai" />
              </ChatBubble>
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
          <Alert
            type="success"
            header="✅ Pre-consultation Complete!"
            action={
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Start New Session
              </Button>
            }
          >
            🎉 Excellent! Your responses have been recorded and analyzed. Your dedicated AWS sales representative will reach out within 24 hours with personalized recommendations and next steps.
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  )
}