import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Box,
  ButtonDropdown,
  Toggle,
  FormField
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { StatusBadge, BedrockQuotaNotification } from '../../components'
import { generateSessionCSV, downloadCSV, generateCSVFilename } from '../../utils/csvExport'
import { authService } from '../../services/auth'

interface SessionSummary {
  sessionId: string
  customerName: string
  customerEmail: string
  customerCompany: string
  customerTitle?: string
  status: 'active' | 'completed' | 'expired' | 'inactive'
  createdAt: string
  completedAt?: string
  salesRepEmail: string
  agentId: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showMySessionsOnly, setShowMySessionsOnly] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')

  useEffect(() => {
    loadCurrentUser()
    loadSessions()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setCurrentUserEmail(user.email)
    } catch (err) {
      console.error('Failed to get current user:', err)
    }
  }

  const loadSessions = async () => {
    try {
      const response = await adminApi.listSessions()
      setSessions(response.sessions || [])
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInactivate = async (sessionId: string) => {
    try {
      await adminApi.inactivateSession(sessionId)
      loadSessions()
    } catch (err) {
      console.error('Failed to inactivate session:', err)
    }
  }

  const handleDelete = async (sessionId: string) => {
    try {
      await adminApi.deleteSession(sessionId)
      loadSessions()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleDownloadCSV = (session: SessionSummary) => {
    const csvData = {
      customerCompany: session.customerCompany || '미입력',
      customerName: session.customerName,
      customerTitle: session.customerTitle || '미입력',
      chatUrl: `${window.location.origin}/customer/${session.sessionId}`,
      pinNumber: `PIN 정보는 영업 담당(${session.salesRepEmail})에게 확인하세요`,
      createdAt: new Date(session.createdAt).toLocaleString('ko-KR')
    }

    const csvContent = generateSessionCSV(csvData)
    const filename = generateCSVFilename(session.customerCompany || 'Unknown')

    downloadCSV(csvContent, filename)
  }

  // Filter sessions based on toggle state
  const filteredSessions = showMySessionsOnly 
    ? sessions.filter(session => session.salesRepEmail === currentUserEmail)
    : sessions

  return (
    <Container>
      <SpaceBetween size="l">
        <BedrockQuotaNotification />
        <Header
          variant="h1"
          description="고객이 AI 에이전트와 대화할 수 있는 상담 세션을 관리합니다. 필요 정보가 획득되면 세션이 완료되고, 30일이 경과한 모든 세션은 파기됩니다."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin/agents')}
              >
                PreChat 에이전트
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/sessions/create')}
              >
                세션 추가
              </Button>
            </SpaceBetween>
          }
        >
          PreChat 세션 💬
        </Header>

        <Box>
          <FormField
            label=""
            description="본인이 생성한 세션만 표시하기"
          >
            <Toggle
              checked={showMySessionsOnly}
              onChange={({ detail }) => setShowMySessionsOnly(detail.checked)}
            />
          </FormField>
        </Box>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'customer',
                header: '고객사/담당자명',
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.customerCompany}/{item.customerName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      {item.customerTitle && `${item.customerTitle} • `}{item.customerEmail}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'agent',
                header: '대화 에이전트',
                cell: (item) => (
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.agentId ? `Agent: ${item.agentId}` : 'No agent assigned'}
                  </Box>
                )
              },
              {
                id: 'status',
                header: '세션 상태',
                cell: (item) => <StatusBadge status={item.status} type="session" />
              },
              {
                id: 'created',
                header: '생성일',
                cell: (item) => new Date(item.createdAt).toLocaleDateString()
              },
              {
                id: 'completed',
                header: '완료일',
                cell: (item) => item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'
              },
              {
                id: 'actions',
                header: '작업',
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: '대화 분석',
                        id: 'view',
                        iconName: 'external'
                      },
                      {
                        text: '진입 정보 CSV',
                        id: 'download-csv',
                        iconName: 'download'
                      },
                      ...(item.status === 'active' ? [{
                        text: 'Inactivate',
                        id: 'inactivate', 
                      }] : []),
                      ...(item.status === 'inactive' ? [{
                        text: 'Delete',
                        id: 'delete'
                      }] : [])
                    ]}
                    onItemClick={({ detail }) => {
                      switch (detail.id) {
                        case 'view':
                          navigate(`/admin/sessions/${item.sessionId}`)
                          break
                        case 'inactivate':
                          handleInactivate(item.sessionId)
                          break
                        case 'delete':
                          handleDelete(item.sessionId)
                          break
                        case 'download-csv':
                          handleDownloadCSV(item)
                          break
                      }
                    }}
                  >
                    Actions
                  </ButtonDropdown>
                )
              }
            ]}
            items={filteredSessions}
            loading={loading}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  No sessions
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  No pre-consultation sessions found.
                </Box>
                <Button onClick={() => navigate('/admin/sessions/create')}>
                  세션 추가
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}