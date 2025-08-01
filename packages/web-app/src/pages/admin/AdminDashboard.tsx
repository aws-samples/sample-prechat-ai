import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Box,
  ButtonDropdown
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { StatusBadge } from '../../components'

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

  useEffect(() => {
    loadSessions()
  }, [])

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

  return (
    <Container>
      <SpaceBetween size="l">
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
                      text: '상세',
                      id: 'view',
                      iconName: 'external'
                    },
                    {
                      text: '진입 URL',
                      id: 'copy',
                      iconName: 'copy'
                    },
                    ...(item.status === 'active' ? [{
                      text: 'Inactivate',
                      id: 'inactivate'
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
                      case 'copy':
                        navigator.clipboard.writeText(`${window.location.origin}/customer/${item.sessionId}`)
                        break
                      case 'inactivate':
                        handleInactivate(item.sessionId)
                        break
                      case 'delete':
                        handleDelete(item.sessionId)
                        break
                    }
                  }}
                >
                  Actions
                </ButtonDropdown>
              )
            }
          ]}
          items={sessions}
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