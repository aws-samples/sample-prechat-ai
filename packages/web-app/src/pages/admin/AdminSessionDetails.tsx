// nosemgrep
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Spinner,
  Tabs,
  Badge,
  ColumnLayout
} from '@cloudscape-design/components'
import AnimatedButton from '../../components/AnimatedButton'
import MeetingLogView from '../../components/MeetingLogView'
import SessionAttachments from '../../components/SessionAttachments'
import DiscussionTab from '../../components/DiscussionTab'
import { adminApi, chatApi } from '../../services/api'
import { Session } from '../../types'
import { formatPurposesForDisplay } from '../../components/ConsultationPurposeSelector'
import { PlanningChatTab } from '../../components/PlanningChatTab'
import { useI18n } from '../../i18n'


export default function AdminSessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionId) {
      loadSessionData()
    }
  }, [sessionId])

  const loadSessionData = async () => {
    try {
      // Load basic session data for conversation
      const sessionData = await chatApi.getSession(sessionId!)
      setSession(sessionData)

      // Load detailed session info including PIN for admin
      const sessionDetails = await adminApi.getSessionDetails(sessionId!)

      // Load feedback (try regardless of session status)
      let feedbackData = null
      console.log('Session status:', sessionData.status)
      try {
        feedbackData = await adminApi.getSessionFeedback(sessionId!)
        console.log('Feedback data loaded:', feedbackData)
      } catch (error) {
        // Feedback might not exist, which is fine
        console.log('No feedback found for session:', sessionId, error)
      }

      setSession(prev => prev ? {
        ...prev,
        pinNumber: sessionDetails.pinNumber,
        privacyConsentAgreed: sessionDetails.privacyConsentAgreed,
        privacyConsentTimestamp: sessionDetails.privacyConsentTimestamp,
        customerFeedback: feedbackData
      } : null)
    } catch (err) {
      setError(t('adminSessionDetail.alert.failedLoadDetails'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="blue">{t('adminSessionDetail.info.statusActive')}</Badge>
      case 'completed':
        return <Badge color="green">{t('adminSessionDetail.info.statusCompleted')}</Badge>
      case 'expired':
        return <Badge color="red">{t('adminSessionDetail.info.statusExpired')}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }



  if (loading) {
    return (
      <Container>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </Container>
    )
  }

  if (error || !session) {
    return (
      <Container>
        <Alert type="error" header={t('adminSessionDetail.alert.errorOccurred')}>
          {error || t('adminSessionDetail.alert.sessionNotFound')}
        </Alert>
      </Container>
    )
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <AnimatedButton variant="normal" onClick={() => navigate('/admin')} animation="pulse">
                {t('adminSessionDetail.header.backButton')}
              </AnimatedButton>
            </SpaceBetween>
          }
        >
          {t('adminSessionDetail.header.title')}
        </Header>

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.customerLabel')}</Box>
            <Box>{session.customerInfo.name}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{session.customerInfo.email}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.companyLabel')}</Box>
            <Box>{session.customerInfo.company}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.salesRepLabel')}</Box>
            <Box>{session.salesRepInfo?.name} / {session.salesRepEmail}</Box>
          </Box>
        </ColumnLayout>

        {session.consultationPurposes && (
          <ColumnLayout columns={1}>
            <Box>
              <Box variant="awsui-key-label">{t('adminSessionDetail.info.consultationPurposeLabel')}</Box>
              <Box>{formatPurposesForDisplay(session.consultationPurposes)}</Box>
            </Box>
          </ColumnLayout>
        )}

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.statusLabel')}</Box>
            {getStatusBadge(session.status)}
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.pinNumberLabel')}</Box>
            <Box fontWeight="bold" fontSize="body-s">
              {session.pinNumber || 'N/A'}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.createdLabel')}</Box>
            <Box>{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.privacyConsentLabel')}</Box>
            <Box>
              {session.privacyConsentAgreed ? (
                <Badge color="green">{t('adminSessionDetail.info.consentAgreed')}</Badge>
              ) : (
                <Badge color="grey">{t('adminSessionDetail.info.consentNotAgreed')}</Badge>
              )}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminSessionDetail.info.consentTimeLabel')}</Box>
            <Box>
              {session.privacyConsentTimestamp ?
                new Date(session.privacyConsentTimestamp).toLocaleString('ko-KR') :
                '-'
              }
            </Box>
          </Box>
        </ColumnLayout>

        <Tabs
          tabs={[
            {
              label: t('adminSessionDetail.tabs.meetingLog'),
              id: 'meeting-log',
              content: sessionId ? <MeetingLogView sessionId={sessionId} session={session} /> : null
            },
            {
              label: t('adminSessionDetail.tabs.conversation'),
              id: 'conversation',
              content: (
                <SpaceBetween size="l">
                  {/* Customer Feedback Section */}
                  {session.customerFeedback ? (
                    <Container>
                      <Header variant="h3">
                        {t('adminSessionDetail.feedback.sectionTitle')}{' '}
                        <Badge color="green">
                          {t('adminSessionDetail.feedback.available')}
                        </Badge>
                      </Header>
                      <SpaceBetween size="m">
                        <ColumnLayout columns={2}>
                          <Box>
                            <Box variant="awsui-key-label">{t('adminSessionDetail.feedback.satisfactionScoreLabel')}</Box>
                            <Box>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.1rem' }}>
                                  {[1, 2, 3, 4, 5].map((star) => {
                                    const rating = session.customerFeedback!.rating;
                                    return (
                                      <span
                                        key={star}
                                        style={{
                                          position: 'relative',
                                          fontSize: '1.5rem'
                                        }}
                                      >
                                        <span style={{ color: '#ddd' }}>☆</span>
                                        <span
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            color: '#ff9900',
                                            clipPath: rating >= star ? 'none' :
                                              rating >= star - 0.5 ? 'inset(0 50% 0 0)' : 'inset(0 100% 0 0)'
                                          }}
                                        >
                                          ★
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                                <Box fontWeight="bold" fontSize="heading-m">
                                  {session.customerFeedback.rating}/5.0
                                </Box>
                              </div>
                            </Box>
                          </Box>
                          <Box>
                            <Box variant="awsui-key-label">{t('adminSessionDetail.feedback.feedbackTimeLabel')}</Box>
                            <Box>
                              {new Date(session.customerFeedback.timestamp).toLocaleString('ko-KR')}
                            </Box>
                          </Box>
                        </ColumnLayout>

                        {session.customerFeedback.feedback && (
                          <Box>
                            <Box variant="awsui-key-label">{t('adminSessionDetail.feedback.customerOpinionLabel')}</Box>
                            <Box padding="s" variant="awsui-value-large">
                              {session.customerFeedback.feedback}
                            </Box>
                          </Box>
                        )}
                      </SpaceBetween>
                    </Container>
                  ) : (
                    <Container>
                      <Header variant="h3">
                        {t('adminSessionDetail.feedback.sectionTitle')}{' '}
                        <Badge color="grey">
                          {t('adminSessionDetail.feedback.noFeedback')}
                        </Badge>
                      </Header>
                      <Box color="text-status-inactive" textAlign="center" padding="l">
                        {session.status === 'completed' 
                          ? t('adminSessionDetail.feedback.noFeedbackSubmitted')
                          : t('adminSessionDetail.feedback.feedbackAfterCompletion')
                        }
                      </Box>
                    </Container>
                  )}

                  {/* Conversation History */}
                  <Container>
                    <Header variant="h3">{t('adminSessionDetail.conversation.sectionTitle')}</Header>
                    <SpaceBetween size="m">
                      {session.conversationHistory.map((message) => (
                        <Box
                          key={message.id}
                          padding="s"
                        >
                          <SpaceBetween size="xs">
                            <Box fontSize="body-s" color="text-status-inactive">
                              {message.sender === 'customer' ? t('adminSessionDetail.conversation.customerSender') : t('adminSessionDetail.conversation.assistantSender')} •
                              {new Date(message.timestamp).toLocaleString()} •
                              {t('adminSessionDetail.conversation.stageLabel')}: {message.stage?.replace('_', ' ').toUpperCase() || t('adminSessionDetail.conversation.unknownStage')}
                            </Box>
                            <Box>{message.content}</Box>
                          </SpaceBetween>
                        </Box>
                      ))}
                      {session.conversationHistory.length === 0 && (
                        <Box textAlign="center" color="text-status-inactive">
                          {t('adminSessionDetail.conversation.noMessages')}
                        </Box>
                      )}
                    </SpaceBetween>
                  </Container>
                </SpaceBetween>
              )
            },
            {
              label: t('adminSessionDetail.tabs.attachments'),
              id: 'attachments',
              content: sessionId ? <SessionAttachments sessionId={sessionId} /> : null
            },
            {
              label: t('admin.planningChat.tabLabel'),
              id: 'planning-chat',
              content: sessionId ? (
                <PlanningChatTab sessionId={sessionId} session={session} />
              ) : null
            },
            {
              label: t('adminSessionDetail.tabs.discussion'),
              id: 'discussion',
              content: sessionId ? <DiscussionTab sessionId={sessionId} /> : null
            },
          ]}
        />
      </SpaceBetween>
    </Container>
  )
}