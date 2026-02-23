// nosemgrep
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Grid,
  Modal,
  Input,
  Button,
  FormField,
  Checkbox,
  Link,
  StatusIndicator,
} from '@cloudscape-design/components'
import Avatar from '@cloudscape-design/chat-components/avatar'
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble'
import ReactMarkdown from 'react-markdown'

import { useSession, useChat } from '../../hooks'
import { LoadingSpinner, ChatMessage, PrivacyTermsModal, StreamingChatMessage, FileUpload, MultilineChatInput, FeedbackModal, ConsultationPurposeSelector } from '../../components'
import { MESSAGES } from '../../constants'
import { chatApi } from '../../services/api'
import { useI18n } from '../../i18n'
import {
  storePinForSession,
  getStoredPinForSession,
  storePrivacyConsentForSession,
  getStoredPrivacyConsentForSession,
  removePinForSession,
  storeConsultationPurposesForSession,
  getStoredConsultationPurposesForSession
} from '../../utils/sessionStorage'
import {
  ConsultationPurposeEnum,
  formatPurposesForDisplay,
  formatPurposesForStorage,
  parsePurposesFromStorage
} from '../../components/ConsultationPurposeSelector'

export default function CustomerChat() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { t, locale } = useI18n()
  const [showPinModal, setShowPinModal] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [isCheckingStoredPin, setIsCheckingStoredPin] = useState(true)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [selectedPurposes, setSelectedPurposes] = useState<ConsultationPurposeEnum[]>([])
  const [showPurposeSelector, setShowPurposeSelector] = useState(false)
  const [submittedFormIds, setSubmittedFormIds] = useState<Set<string>>(new Set())

  const {
    sessionData,
    messages,
    loading: sessionLoading,
    error: sessionError,
    isComplete,
    addMessage,
    updateSessionComplete,
  } = useSession(sessionId, !showPinModal && !isCheckingStoredPin) // Only load session after PIN verification

  // PIN 검증 후 저장된 PIN을 useChat에 전달
  const verifiedPin = sessionId ? getStoredPinForSession(sessionId) : undefined

  const {
    inputValue,
    setInputValue,
    loading: chatLoading,
    sendMessage,
    sendDirectMessage,
    sendFormSubmission,
    clearInput,
    streamingMessage,
    connectionState,
  } = useChat(sessionId, verifiedPin || undefined, locale)

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
    // Check for stored purposes and show selector if needed
    if (sessionData && messages.length === 0 && selectedPurposes.length === 0 && sessionId) {
      const storedPurposes = getStoredConsultationPurposesForSession(sessionId)
      if (storedPurposes) {
        const purposes = parsePurposesFromStorage(storedPurposes)
        if (purposes.length > 0) {
          setSelectedPurposes(purposes)
        }
      } else {
        setShowPurposeSelector(true)
      }
    }
  }, [sessionData, messages.length, selectedPurposes.length, sessionId])

  useEffect(() => {
    // If no conversation history and purposes are selected, pre-fill the input with greeting message
    if (sessionData && messages.length === 0 && selectedPurposes.length > 0 && !inputValue) {
      const customerInfo = sessionData.customerInfo
      const company = customerInfo.company || '회사'
      const title = customerInfo.title || '담당자'
      const name = customerInfo.name || '고객'

      const greetingMessage = t('customer_greeting_message', {
        companyName: company,
        customerTitle: title,
        customerName: name
      })
      setInputValue(greetingMessage)
    }
  }, [sessionData, messages.length, selectedPurposes, inputValue, setInputValue, t])



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
      setPinError(error.response?.data?.error || t('pin_error_message'))
    } finally {
      setPinLoading(false)
    }
  }

  const handleSendMessage = () => {
    sendMessage(addMessage, updateSessionComplete)
  }

  const handleFormSubmit = (messageId: string) => (formData: Record<string, string>) => {
    setSubmittedFormIds(prev => new Set(prev).add(messageId))
    sendFormSubmission(formData, addMessage, updateSessionComplete)
  }

  const handleRequestForm = () => {
    sendDirectMessage(t('request_form_message'), addMessage, updateSessionComplete)
  }

  const handleFeedbackSubmit = async (rating: number, feedback: string) => {
    try {
      // Submit feedback to API
      await chatApi.submitFeedback(sessionId!, rating, feedback)
      setFeedbackSubmitted(true)
      setShowFeedbackModal(false)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      // Still close modal even if submission fails
      setFeedbackSubmitted(true)
      setShowFeedbackModal(false)
    }
  }

  const handlePurposesSelect = async (purposes: ConsultationPurposeEnum[]) => {
    setSelectedPurposes(purposes)
    setShowPurposeSelector(false)

    // Store purposes in session storage and server
    if (sessionId) {
      const purposesString = formatPurposesForStorage(purposes)
      storeConsultationPurposesForSession(sessionId, purposesString)

      // Also save to server
      try {
        await chatApi.updateConsultationPurposes(sessionId, purposesString)
      } catch (error) {
        console.error('Failed to save consultation purposes to server:', error)
        // Continue anyway since it's stored locally
      }
    }
  }

  // Show feedback modal when consultation is complete
  useEffect(() => {
    if (isComplete && !feedbackSubmitted && !showFeedbackModal) {
      // Small delay to let the completion message show first
      const timer = setTimeout(() => {
        setShowFeedbackModal(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isComplete, feedbackSubmitted, showFeedbackModal])



  // 저장된 PIN 확인 중일 때 로딩 표시
  if (isCheckingStoredPin) {
    return <LoadingSpinner />
  }

  if (showPinModal) {
    return (
      <Modal
        onDismiss={() => { }} // Prevent closing
        visible={true}
        header={t('text_6_pin_mixed_1d6166')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={handlePinSubmit}
                loading={pinLoading}
                disabled={!pinInput || pinInput.length !== 6 || !privacyAgreed}
              >
                {t('confirm_button')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            {t('text_6_pin_mixed_1d6166')}
          </Box>

          {pinError && (
            <Alert type="error">
              {pinError}
            </Alert>
          )}

          <FormField label={t('pin_mixed_56d5a8')}>
            <Input
              value={pinInput}
              onChange={({ detail }) => {
                // 숫자만 허용하고 최대 6자리까지만
                const numericValue = detail.value.replace(/\D/g, '').slice(0, 6)
                setPinInput(numericValue)
              }}
              placeholder={t('korean_33fc10eb')}
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
                  {t('service_bece43ab')}
                </Link>
                {t('korean_b1f9a872')}
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

  // Show purpose selector modal
  if (showPurposeSelector) {
    return (
      <Modal
        onDismiss={() => setShowPurposeSelector(false)} // Allow closing when editing
        visible={true}
        header={t('consultation_5e21ae53')}
        size="large"
      >
        <ConsultationPurposeSelector
          onSelect={handlePurposesSelect}
          selectedPurposes={selectedPurposes}
          allowEdit={true}
          onCancel={() => setShowPurposeSelector(false)}
        />
      </Modal>
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
              description={
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  {selectedPurposes.length > 0 && (
                    <span>{`${t('chat_purpose')}: ${formatPurposesForDisplay(formatPurposesForStorage(selectedPurposes))}`}</span>
                  )}
                  {!selectedPurposes.length && (
                    <span>{t('consultation_5e21ae53')}</span>
                  )}
                  {/* WebSocket 연결 상태 인디케이터 */}
                  {connectionState === 'connected' && (
                    <StatusIndicator type="success">{t('ws_connected') || 'Connected'}</StatusIndicator>
                  )}
                  {connectionState === 'connecting' && (
                    <StatusIndicator type="in-progress">{t('ws_connecting') || 'Connecting...'}</StatusIndicator>
                  )}
                  {connectionState === 'disconnected' && (
                    <StatusIndicator type="warning">{t('ws_reconnecting') || 'Reconnecting...'}</StatusIndicator>
                  )}
                  {connectionState === 'error' && (
                    <StatusIndicator type="error">{t('ws_error') || 'Connection error'}</StatusIndicator>
                  )}
                </SpaceBetween>
              }
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="normal"
                    iconName={selectedPurposes.length > 0 ? "edit" : "add-plus"}
                    onClick={() => setShowPurposeSelector(true)}
                  >
                    {selectedPurposes.length > 0 ? t('consultation_purpose_edit') : t('consultation_purpose_select')}
                  </Button>
                  <Button
                    variant="normal"
                    iconName="upload"
                    onClick={() => setShowFileUpload(true)}
                  >
                    {t('btn_file_attach')}
                  </Button>
                </SpaceBetween>
              }
            >
              {t('chat_title')}
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
              {t('aws_prechat_aws_mixed_3049d8')}
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
                  const isFormSubmitted = submittedFormIds.has(message.id)

                  if (message.sender === 'customer') {
                    return (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isCustomer={true}
                        salesRepInfo={sessionData?.salesRepInfo}
                      />
                    )
                  } else {
                    return (
                      <StreamingChatMessage
                        key={message.id}
                        message={isCurrentlyStreaming && streamingMessage ? streamingMessage : message}
                        isStreaming={isCurrentlyStreaming}
                        salesRepInfo={sessionData?.salesRepInfo}
                        onFormSubmit={!isFormSubmitted ? handleFormSubmit(message.id) : undefined}
                        onRequestForm={!isComplete && !chatLoading ? handleRequestForm : undefined}
                      />
                    )
                  }
                })}
                {/* 고객 타이핑 인디케이터 — 입력 중이고 봇 응답 대기 아닐 때 */}
                {inputValue.trim() && !streamingMessage && (
                  <div className="slide-in-right" style={{ maxWidth: '70vw', marginLeft: 'auto' }}>
                    <ChatBubble
                      type="outgoing"
                      ariaLabel="You are typing"
                      avatar={
                        <Avatar
                          initials="U"
                          ariaLabel="You"
                          tooltipText="You"
                        />
                      }
                    >
                      <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#0073bb',
                        borderRadius: '8px',
                      }}>
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </ChatBubble>
                  </div>
                )}
                {/* 스트리밍 중인 봇 메시지 — status가 single source of truth */}
                {streamingMessage && streamingMessage.status === 'streaming' && (
                  <StreamingChatMessage
                    key={`streaming-${streamingMessage.id}`}
                    message={streamingMessage}
                    isStreaming={true}
                    salesRepInfo={sessionData?.salesRepInfo}
                  />
                )}
                {streamingMessage && (streamingMessage.status === 'thinking' || streamingMessage.status === 'tool-use') && (
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
                        {streamingMessage.status === 'tool-use' && streamingMessage.toolInfo ? (
                          <StatusIndicator type={streamingMessage.toolInfo.status === 'running' ? 'in-progress' : 'success'}>
                            {streamingMessage.toolInfo.status === 'running'
                              ? `🔧 ${streamingMessage.toolInfo.toolName} 실행 중...`
                              : `✅ ${streamingMessage.toolInfo.toolName} 완료`}
                          </StatusIndicator>
                        ) : (
                          <>
                            <div className="loading-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                            <Box margin={{ left: 's' }} display="inline-block">
                              {t(MESSAGES.AI_THINKING)}
                            </Box>
                          </>
                        )}
                      </Box>
                    </ChatBubble>
                  </div>
                )}
              </SpaceBetween>
            </div>
          </Box>

          {!isComplete && (
            <MultilineChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              placeholder={t(MESSAGES.CHAT_PLACEHOLDER)}
              disabled={chatLoading}
              onClear={clearInput}
            />
          )}

          {isComplete && (
            <div className="fade-in-up success-animation">
              <Alert
                type="success"
                header={t(MESSAGES.CONSULTATION_COMPLETE)}
              >
                {t(MESSAGES.CONSULTATION_COMPLETE_DESC)}
              </Alert>
            </div>
          )}
        </SpaceBetween>
      </Container>
      <Container>
        {sessionData?.salesRepInfo && (
          <Box margin={{ top: 'm' }}>
            <Header variant="h3">{t('chat_sales_rep_info')}</Header>
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
                  <Box display="inline" fontWeight="bold">{t('sales_rep')} </Box>
                  <Box display="inline">{sessionData.salesRepInfo.name}</Box>
                </Box>
                <Box>
                  <Box display="inline" fontWeight="bold">{t('email')} </Box>
                  <Box display="inline">{sessionData.salesRepInfo.email}</Box>
                </Box>
                <Box>
                  <Box display="inline" fontWeight="bold">{t('contact')} </Box>
                  <Box display="inline">{sessionData.salesRepInfo.phone}</Box>
                </Box>
                <Box fontSize="body-s" color="text-status-inactive">
                  {t('chat_sales_rep_cta')}
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

      {sessionId && (
        <FileUpload
          sessionId={sessionId}
          visible={showFileUpload}
          onDismiss={() => setShowFileUpload(false)}
        />
      )}

      <FeedbackModal
        visible={showFeedbackModal}
        onSubmit={handleFeedbackSubmit}
      />
    </Grid>
  )
}