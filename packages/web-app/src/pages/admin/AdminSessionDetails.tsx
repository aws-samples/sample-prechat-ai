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
      setError(t('session_failed_load_details'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="blue">{t('active')}</Badge>
      case 'completed':
        return <Badge color="green">{t('completed')}</Badge>
      case 'expired':
        return <Badge color="red">{t('expired')}</Badge>
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
        <Alert type="error" header={t('error_occurred')}>
          {error || t('session_not_found')}
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
                {t('admin_to_dashboard')}
              </AnimatedButton>
            </SpaceBetween>
          }
        >
          {t('session_review_consultation')}
        </Header>

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('customer')}</Box>
            <Box>{session.customerInfo.name}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{session.customerInfo.email}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('company')}</Box>
            <Box>{session.customerInfo.company}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('sales_rep')}</Box>
            <Box>{session.salesRepInfo?.name} / {session.salesRepEmail}</Box>
          </Box>
        </ColumnLayout>

        {session.consultationPurposes && (
          <ColumnLayout columns={1}>
            <Box>
              <Box variant="awsui-key-label">{t('admin_consultation_purpose')}</Box>
              <Box>{formatPurposesForDisplay(session.consultationPurposes)}</Box>
            </Box>
          </ColumnLayout>
        )}

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('status')}</Box>
            {getStatusBadge(session.status)}
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('admin_pin_number')}</Box>
            <Box fontWeight="bold" fontSize="body-s">
              {session.pinNumber || 'N/A'}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('created')}</Box>
            <Box>{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label">{t('session_privacy_consent')}</Box>
            <Box>
              {session.privacyConsentAgreed ? (
                <Badge color="green">{t('session_consent_agreed')}</Badge>
              ) : (
                <Badge color="grey">{t('session_consent_not_agreed')}</Badge>
              )}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('session_consent_time')}</Box>
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
              label: t('session_meeting_log'),
              id: 'meeting-log',
              content: sessionId ? <MeetingLogView sessionId={sessionId} session={session} /> : null
            },
            {
              label: t('discussion'),
              id: 'discussion',
              content: sessionId ? <DiscussionTab sessionId={sessionId} /> : null
            },
            {
              label: t('session_attachments'),
              id: 'attachments',
              content: sessionId ? <SessionAttachments sessionId={sessionId} /> : null
            },
            {
              label: t('conversation'),
              id: 'conversation',
              content: (
                <SpaceBetween size="l">
                  {/* Customer Feedback Section */}
                  {session.customerFeedback ? (
                    <Container>
                      <Header variant="h3">
                        {t('session_customer_feedback')}{' '}
                        <Badge color="green">
                          {t('session_feedback_available')}
                        </Badge>
                      </Header>
                      <SpaceBetween size="m">
                        <ColumnLayout columns={2}>
                          <Box>
                            <Box variant="awsui-key-label">{t('session_satisfaction_score')}</Box>
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
                            <Box variant="awsui-key-label">{t('session_feedback_time')}</Box>
                            <Box>
                              {new Date(session.customerFeedback.timestamp).toLocaleString('ko-KR')}
                            </Box>
                          </Box>
                        </ColumnLayout>

                        {session.customerFeedback.feedback && (
                          <Box>
                            <Box variant="awsui-key-label">{t('session_customer_opinion')}</Box>
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
                        {t('session_customer_feedback')}{' '}
                        <Badge color="grey">
                          {t('session_no_feedback')}
                        </Badge>
                      </Header>
                      <Box color="text-status-inactive" textAlign="center" padding="l">
                        {session.status === 'completed' 
                          ? t('session_no_feedback_submitted')
                          : t('session_feedback_after_completion')
                        }
                      </Box>
                    </Container>
                  )}

                  {/* Conversation History */}
                  <Container>
                    <Header variant="h3">{t('session_conversation_history')}</Header>
                    <SpaceBetween size="m">
                      {session.conversationHistory.map((message) => (
                        <Box
                          key={message.id}
                          padding="s"
                        >
                          <SpaceBetween size="xs">
                            <Box fontSize="body-s" color="text-status-inactive">
                              {message.sender === 'customer' ? t('customer') : t('assistant')} •
                              {new Date(message.timestamp).toLocaleString()} •
                              {t('session_stage')}: {message.stage?.replace('_', ' ').toUpperCase() || t('unknown')}
                            </Box>
                            <Box>{message.content}</Box>
                          </SpaceBetween>
                        </Box>
                      ))}
                      {session.conversationHistory.length === 0 && (
                        <Box textAlign="center" color="text-status-inactive">
                          {t('no_messages_yet')}
                        </Box>
                      )}
                    </SpaceBetween>
                  </Container>
                </SpaceBetween>
              )
            }
          ]}
        />
      </SpaceBetween>
    </Container>
  )
}