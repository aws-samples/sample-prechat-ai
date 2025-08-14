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
import { adminApi, chatApi } from '../../services/api'
import { Session } from '../../types'


export default function AdminSessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
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
      setError('Failed to load session details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="blue">Active</Badge>
      case 'completed':
        return <Badge color="green">Completed</Badge>
      case 'expired':
        return <Badge color="red">Expired</Badge>
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
        <Alert type="error" header="Error">
          {error || 'Session not found'}
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
                대시보드로
              </AnimatedButton>
            </SpaceBetween>
          }
        >
          사전상담 내용을 확인합니다
        </Header>

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">Customer</Box>
            <Box>{session.customerInfo.name}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{session.customerInfo.email}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Company</Box>
            <Box>{session.customerInfo.company}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Sales Rep</Box>
            <Box>{session.salesRepInfo?.name} / {session.salesRepEmail}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">Status</Box>
            {getStatusBadge(session.status)}
          </Box>
          <Box>
            <Box variant="awsui-key-label">PIN 번호</Box>
            <Box fontWeight="bold" fontSize="body-s">
              {session.pinNumber || 'N/A'}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Created</Box>
            <Box>{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label">개인정보 동의</Box>
            <Box>
              {session.privacyConsentAgreed ? (
                <Badge color="green">동의 완료</Badge>
              ) : (
                <Badge color="grey">미동의</Badge>
              )}
            </Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">동의 시간</Box>
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
              label: '미팅 로그',
              id: 'meeting-log',
              content: sessionId ? <MeetingLogView sessionId={sessionId} session={session} /> : null
            },
            {
              label: '첨부 파일',
              id: 'attachments',
              content: sessionId ? <SessionAttachments sessionId={sessionId} /> : null
            },
            {
              label: 'Conversation',
              id: 'conversation',
              content: (
                <SpaceBetween size="l">
                  {/* Customer Feedback Section */}
                  {session.customerFeedback ? (
                    <Container>
                      <Header variant="h3">
                        고객 피드백 (CSAT){' '}
                        <Badge color="green">
                          피드백 있음
                        </Badge>
                      </Header>
                      <SpaceBetween size="m">
                        <ColumnLayout columns={2}>
                          <Box>
                            <Box variant="awsui-key-label">만족도 점수</Box>
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
                            <Box variant="awsui-key-label">피드백 제출 시간</Box>
                            <Box>
                              {new Date(session.customerFeedback.timestamp).toLocaleString('ko-KR')}
                            </Box>
                          </Box>
                        </ColumnLayout>

                        {session.customerFeedback.feedback && (
                          <Box>
                            <Box variant="awsui-key-label">고객 의견</Box>
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
                        고객 피드백 (CSAT){' '}
                        <Badge color="grey">
                          피드백 없음
                        </Badge>
                      </Header>
                      <Box color="text-status-inactive" textAlign="center" padding="l">
                        {session.status === 'completed' 
                          ? '고객이 아직 피드백을 제출하지 않았습니다.'
                          : '세션이 완료되면 고객 피드백을 확인할 수 있습니다.'
                        }
                      </Box>
                    </Container>
                  )}

                  {/* Conversation History */}
                  <Container>
                    <Header variant="h3">대화 내역</Header>
                    <SpaceBetween size="m">
                      {session.conversationHistory.map((message) => (
                        <Box
                          key={message.id}
                          padding="s"
                        >
                          <SpaceBetween size="xs">
                            <Box fontSize="body-s" color="text-status-inactive">
                              {message.sender === 'customer' ? 'Customer' : 'Assistant'} •
                              {new Date(message.timestamp).toLocaleString()} •
                              Stage: {message.stage?.replace('_', ' ').toUpperCase() || 'Unknown'}
                            </Box>
                            <Box>{message.content}</Box>
                          </SpaceBetween>
                        </Box>
                      ))}
                      {session.conversationHistory.length === 0 && (
                        <Box textAlign="center" color="text-status-inactive">
                          No messages yet
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