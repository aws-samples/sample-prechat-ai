import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  ButtonGroup,
  PromptInput,
  Grid,
  Modal,
  Input,
  Button,
  FormField,
  Checkbox,
  Link
} from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'

import { useSession, useChat } from '../../hooks'
import { LoadingSpinner, ChatMessage, PrivacyTermsModal, StreamingChatMessage } from '../../components'
import { MESSAGES } from '../../constants'
import { chatApi } from '../../services/api'
import { 
  storePinForSession, 
  getStoredPinForSession, 
  storePrivacyConsentForSession,
  getStoredPrivacyConsentForSession,
  removePinForSession
} from '../../utils/sessionStorage'

export default function CustomerChat() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [showPinModal, setShowPinModal] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [isCheckingStoredPin, setIsCheckingStoredPin] = useState(true)
  
  const {
    sessionData,
    messages,
    loading: sessionLoading,
    error: sessionError,
    isComplete,
    addMessage,
    updateMessage,
    updateSessionComplete,
  } = useSession(sessionId, !showPinModal && !isCheckingStoredPin) // Only load session after PIN verification

  const {
    inputValue,
    setInputValue,
    loading: chatLoading,
    sendMessage,
    clearInput,
    streamingMessage
  } = useChat(sessionId)

  // 컴포넌트 로드 시 저장된 PIN 확인
  useEffect(() => {
    const checkStoredPin = async () => {
      if (!sessionId) {
        setIsCheckingStoredPin(false)
        return
      }

      const storedPin = getStoredPinForSession(sessionId)
      const storedPrivacyConsent = getStoredPrivacyConsentForSession(sessionId)

      if (storedPin && storedPrivacyConsent) {
        // 저장된 PIN으로 자동 검증 시도
        try {
          await chatApi.verifySessionPin(sessionId, storedPin, true)
          setShowPinModal(false) // 모달 건너뛰기
        } catch (error) {
          // 저장된 PIN이 유효하지 않으면 저장소에서 제거하고 모달 표시
          console.warn('Stored PIN is no longer valid:', error)
          storePinForSession(sessionId, '') // 잘못된 PIN 제거
          // 모달에 이전 PIN을 미리 채워주기 (사용자 편의성)
          setPinInput(storedPin)
        }
      } else if (storedPin) {
        // PIN은 있지만 개인정보 동의가 없는 경우, PIN만 미리 채워주기
        setPinInput(storedPin)
      }
      
      setIsCheckingStoredPin(false)
    }

    checkStoredPin()
  }, [sessionId])

  useEffect(() => {
    // If no conversation history, pre-fill the input with greeting message
    if (sessionData && messages.length === 0 && !inputValue) {
      const customerInfo = sessionData.customerInfo
      const company = customerInfo.company || '회사'
      const title = customerInfo.title || '담당자'
      const name = customerInfo.name || '고객'

      const greetingMessage = `안녕하세요, 저는 ${company}에서 ${title}로 있는 ${name}이라 합니다. 사전에 논의할 내용과 기대사항을 공유드리기 위해 PreChat 사전채팅에 참가하였습니다!`
      setInputValue(greetingMessage)
    }
  }, [sessionData, messages.length, inputValue, setInputValue])



  const handlePinSubmit = async () => {
    if (!sessionId || !pinInput || !privacyAgreed) return
    
    setPinLoading(true)
    setPinError('')
    
    try {
      await chatApi.verifySessionPin(sessionId, pinInput, privacyAgreed)
      
      // PIN 검증 성공 시 세션 저장소에 저장
      storePinForSession(sessionId, pinInput)
      storePrivacyConsentForSession(sessionId)
      
      setShowPinModal(false)
    } catch (error: any) {
      setPinError(error.response?.data?.error || 'PIN 번호가 올바르지 않습니다.')
    } finally {
      setPinLoading(false)
    }
  }

  const handleSendMessage = () => {
    sendMessage(addMessage, updateSessionComplete, updateMessage)
  }



  // 저장된 PIN 확인 중일 때 로딩 표시
  if (isCheckingStoredPin) {
    return <LoadingSpinner />
  }

  if (showPinModal) {
    return (
      <Modal
        onDismiss={() => {}} // Prevent closing
        visible={true}
        header="PIN 번호 입력"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={handlePinSubmit}
                loading={pinLoading}
                disabled={!pinInput || pinInput.length !== 6 || !privacyAgreed}
              >
                확인
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            영업 담당자로부터 받은 6자리 PIN 번호를 입력해주세요.
          </Box>
          
          {pinError && (
            <Alert type="error">
              {pinError}
            </Alert>
          )}
          
          <FormField label="PIN 번호">
            <Input
              value={pinInput}
              onChange={({ detail }) => {
                // 숫자만 허용하고 최대 6자리까지만
                const numericValue = detail.value.replace(/\D/g, '').slice(0, 6)
                setPinInput(numericValue)
              }}
              placeholder="6자리 숫자 입력"
              type="password"
              inputMode="numeric"
              onKeyDown={(e) => {
                if ((e as any).key === 'Enter' && pinInput.length === 6 && privacyAgreed) {
                  handlePinSubmit()
                }
              }}
            />
          </FormField>
          
          <FormField>
            <Checkbox
              checked={privacyAgreed}
              onChange={({ detail }) => setPrivacyAgreed(detail.checked)}
            >
              <Box>
                <Link
                  href="#"
                  onFollow={(e) => {
                    e.preventDefault()
                    setShowPrivacyModal(true)
                  }}
                >
                  개인정보 처리방침 및 서비스 이용약관
                </Link>
                에 동의합니다. (필수)
              </Box>
            </Checkbox>
          </FormField>
        </SpaceBetween>
      </Modal>
    )
  }

  if (sessionLoading) {
    return <LoadingSpinner />
  }

  if (sessionError) {
    // 세션 오류 시 저장된 PIN 정리
    if (sessionId) {
      removePinForSession(sessionId)
    }
    
    return (
      <Container>
        <Alert type="error" header="Session Error">
          {sessionError}
        </Alert>
      </Container>
    )
  }

  return (
    <Grid gridDefinition={[
      { colspan: { default: 12, m: 10, l: 9 } },
      { colspan: { default: 0, m: 2, l: 3 } },
    ]}>
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
          >
            <ReactMarkdown>
              {
                `안녕하세요 저는 AWS PreChat 입니다. 저는 고객님의 클라우드 사용을 성공적으로 돕기위해 얘기를 나누고 싶습니다.

  저희와 만남전에 논의할 내용과 기대하시는 내용을 알려주세요! 적합한 AWS 담당자께 전달해 드리겠습니다.`}
            </ReactMarkdown>
          </ChatBubble>



          <Box padding="s">
            <div
              style={{
                backgroundColor: 'var(--awsui-color-background-container-content)',
                minHeight: '400px',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--awsui-color-border-divider-default)'
              }}
            >
              <SpaceBetween size="m">
                {messages.map((message) => {
                  // Check if this message is currently being streamed
                  const isCurrentlyStreaming = Boolean(streamingMessage && streamingMessage.id === message.id)
                  
                  if (message.sender === 'customer') {
                    return (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isCustomer={true}
                      />
                    )
                  } else {
                    return (
                      <StreamingChatMessage
                        key={message.id}
                        message={isCurrentlyStreaming && streamingMessage ? streamingMessage : message}
                        isStreaming={isCurrentlyStreaming}
                      />
                    )
                  }
                })}
                {chatLoading && (
                  <div className="slide-in-left" style={{ maxWidth: '70vw' }}>
                    <ChatBubble
                      type="incoming"
                      ariaLabel="Assistant is thinking"
                      avatar={
                        <Avatar
                          color="gen-ai"
                          iconName="angle-right-double"
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
                          {MESSAGES.AI_THINKING}
                        </Box>
                      </Box>
                    </ChatBubble>
                  </div>
                )}
              </SpaceBetween>
            </div>
          </Box>

          {!isComplete && (
            <PromptInput
              value={inputValue}
              onChange={({ detail }) => setInputValue(detail.value)}
              onAction={handleSendMessage}
              actionButtonAriaLabel="Send message"
              actionButtonIconName="send"
              placeholder={MESSAGES.CHAT_PLACEHOLDER}
              disabled={chatLoading}
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
                        disabled: !inputValue || chatLoading
                      }
                    ]}
                    variant="icon"
                    onItemClick={({ detail }) => {
                      if (detail.id === 'clear') {
                        clearInput()
                      }
                    }}
                  />
                </Box>
              }
            />
          )}

          {isComplete && (
            <div className="fade-in-up success-animation">
              <Alert
                type="success"
                header={MESSAGES.CONSULTATION_COMPLETE}
              >
                {MESSAGES.CONSULTATION_COMPLETE_DESC}
              </Alert>
            </div>
          )}
        </SpaceBetween>
      </Container>
      <Container>
        {sessionData?.salesRepInfo && (
          <Box margin={{ top: 'm' }}>
            <Header variant="h3">담당자 정보</Header>
            <div
              style={{
                backgroundColor: 'var(--awsui-color-background-container-content)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--awsui-color-border-divider-default)'
              }}
            >
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
            </div>
          </Box>
        )}
      </Container>
      
      <PrivacyTermsModal
        visible={showPrivacyModal}
        onDismiss={() => setShowPrivacyModal(false)}
        initialTab="privacy"
      />
    </Grid>
  )
}