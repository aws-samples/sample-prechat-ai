import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Badge,
  Box,
  ButtonDropdown
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'

interface SessionSummary {
  sessionId: string
  customerName: string
  customerCompany: string
  status: 'active' | 'completed' | 'expired' | 'inactive'
  createdAt: string
  completedAt?: string
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="blue">Active</Badge>
      case 'completed':
        return <Badge color="green">Completed</Badge>
      case 'expired':
        return <Badge color="red">Expired</Badge>
      case 'inactive':
        return <Badge color="grey">Inactive</Badge>
      default:
        return <Badge>{status}</Badge>
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
          actions={
            <Button
              variant="primary"
              onClick={() => navigate('/admin/sessions/create')}
            >
              Create Session
            </Button>
          }
        >
          MTE Pre-consultation Sessions
        </Header>

        <Box minHeight="50vh">
          <Table
          columnDefinitions={[
            {
              id: 'customer',
              header: 'Customer',
              cell: (item) => (
                <Box>
                  <Box fontWeight="bold">{item.customerCompany}/{item.customerName}</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    ({item.customerEmail})
                  </Box>
                </Box>
              )
            },
            {
              id: 'status',
              header: 'Status',
              cell: (item) => getStatusBadge(item.status)
            },
            {
              id: 'created',
              header: 'Created',
              cell: (item) => new Date(item.createdAt).toLocaleDateString()
            },
            {
              id: 'completed',
              header: 'Completed',
              cell: (item) => item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: (item) => (
                <ButtonDropdown
                  expandToViewport
                  items={[
                    {
                      text: 'View Details',
                      id: 'view',
                      iconName: 'external'
                    },
                    {
                      text: 'Copy URL',
                      id: 'copy',
                      iconName: 'copy'
                    },
                    ...(item.status === 'active' ? [{
                      text: 'Inactivate',
                      id: 'inactivate',
                      iconName: 'status-stopped'
                    }] : []),
                    ...(item.status === 'inactive' ? [{
                      text: 'Delete',
                      id: 'delete',
                      iconName: 'remove'
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
                Create Session
              </Button>
            </Box>
          }
          />
        </Box>
      </SpaceBetween>
    </Container>
  )
}