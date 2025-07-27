import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button,
  Alert,
  Spinner,
  Tabs,
  Badge,
  ColumnLayout,
  Select
} from '@cloudscape-design/components'
import ReactMarkdown from 'react-markdown'
import LoadingBar from '@cloudscape-design/chat-components/loading-bar'
import { adminApi, chatApi } from '../../services/api'
import { Session, BEDROCK_MODELS } from '../../types'

export default function AdminSessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState(BEDROCK_MODELS[0])
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (sessionId) {
      loadSessionData()
    }
  }, [sessionId])

  const loadSessionData = async () => {
    try {
      const sessionData = await chatApi.getSession(sessionId!)
      setSession(sessionData)
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
            <Button variant="normal" onClick={() => navigate('/admin')}>
              Back to Dashboard
            </Button>
          }
        >
          Session Details
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
            <Box>{session.salesRepId}</Box>
          </Box>
        </ColumnLayout>
        
        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label">Status</Box>
            {getStatusBadge(session.status)}
          </Box>
          <Box>
            <Box variant="awsui-key-label">Current Stage</Box>
            <Box>{session.currentStage.replace('_', ' ').toUpperCase()}</Box>
          </Box>
        </ColumnLayout>

        <Tabs
          tabs={[
            {
              label: 'Conversation',
              id: 'conversation',
              content: (
                <SpaceBetween size="m">
                  {session.conversationHistory.map((message) => (
                    <Box
                      key={message.id}
                      padding="s"
                      backgroundColor={
                        message.sender === 'customer' 
                          ? 'background-status-info' 
                          : 'background-container-header'
                      }
                    >
                      <SpaceBetween size="xs">
                        <Box fontSize="body-s" color="text-status-inactive">
                          {message.sender === 'customer' ? 'Customer' : 'Assistant'} • 
                          {new Date(message.timestamp).toLocaleString()} • 
                          Stage: {message.stage.replace('_', ' ').toUpperCase()}
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
              )
            },
            {
              label: 'Report',
              id: 'report',
              content: (
                <SpaceBetween size="m">
                  <Header 
                    variant="h3"
                    actions={
                      <SpaceBetween size="s" direction="horizontal">
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
                        />
                        <Button
                          variant="primary"
                          iconName="refresh"
                          loading={reportLoading}
                          onClick={async () => {
                            setReportLoading(true)
                            try {
                              const reportData = await adminApi.getSessionReport(sessionId!)
                              setReport(reportData)
                            } catch (err) {
                              setError('Failed to generate report')
                            } finally {
                              setReportLoading(false)
                            }
                          }}
                        >
                          Generate Report
                        </Button>
                      </SpaceBetween>
                    }
                  >
                    AI-Generated Summary
                  </Header>
                  {reportLoading ? (
                    <LoadingBar variant="gen-ai" />
                  ) : report ? (
                    <Box padding="m" backgroundColor="background-container-content" borderRadius="8px">
                      <ReactMarkdown>{report.summary}</ReactMarkdown>
                    </Box>
                  ) : (
                    <Alert type="info">
                      Click "Generate Report" to create an AI-based summary of this session
                    </Alert>
                  )}
                </SpaceBetween>
              )
            }
          ]}
        />
      </SpaceBetween>
    </Container>
  )
}