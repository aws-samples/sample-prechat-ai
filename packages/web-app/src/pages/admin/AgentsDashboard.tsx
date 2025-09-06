// nosemgrep
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
import type { BedrockAgent } from '../../types'

export default function AgentsDashboard() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<BedrockAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await adminApi.listAgents()
      setAgents(response.agents || [])
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PREPARED':
        return <Badge color="green">Prepared</Badge>
      case 'PREPARING':
        return <Badge color="blue">Preparing</Badge>
      case 'NOT_PREPARED':
        return <Badge color="grey">Not Prepared</Badge>
      case 'CREATING':
        return <Badge color="blue">Creating</Badge>
      case 'UPDATING':
        return <Badge color="blue">Updating</Badge>
      case 'DELETING':
        return <Badge color="red">Deleting</Badge>
      case 'FAILED':
        return <Badge color="red">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handlePrepare = async (agentId: string) => {
    try {
      await adminApi.prepareAgent(agentId)
      loadAgents()
    } catch (err) {
      console.error('Failed to prepare agent:', err)
    }
  }

  const handleDelete = async (agentId: string) => {
    try {
      await adminApi.deleteAgent(agentId)
      loadAgents()
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="고객과 상담을 담당하는 AI 에이전트(Amazon Bedrock Agents)를 관리합니다. 구성한 에이전트는 준비(Prepared)되어야 합니다."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin')}
              >
                PreChat 세션
              </Button>
              <Button
                variant="normal"
                iconName="refresh"
                onClick={loadAgents}
                loading={loading}
              >
                새로고침
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/agents/create')}
              >
                에이전트 생성
              </Button>
            </SpaceBetween>
          }
        >
          PreChat 에이전트 🤖
        </Header>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: '에이전트 이름',
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.agentName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.agentId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'model',
                header: 'Foundation Model',
                cell: (item) => {
                  // Extract model name from ARN
                  const modelArn = item.foundationModel
                  if (modelArn.includes('claude-3-haiku')) return 'Claude 3 Haiku'
                  if (modelArn.includes('claude-3-sonnet')) return 'Claude 3 Sonnet'
                  if (modelArn.includes('claude-3-5-sonnet-20240620')) return 'Claude 3.5 Sonnet (June)'
                  if (modelArn.includes('claude-3-5-sonnet-20241022')) return 'Claude 3.5 Sonnet (Oct)'
                  if (modelArn.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet'
                  if (modelArn.includes('claude-sonnet-4')) return 'Claude Sonnet 4'
                  if (modelArn.includes('nova-micro')) return 'Nova Micro'
                  if (modelArn.includes('nova-lite')) return 'Nova Lite'
                  if (modelArn.includes('nova-pro')) return 'Nova Pro'
                  return 'Unknown Model'
                }
              },
              {
                id: 'status',
                header: '상태',
                cell: (item) => getStatusBadge(item.agentStatus)
              },
              {
                id: 'actions',
                header: '작업',
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      ...(item.agentStatus !== 'DELETING' && item.agentStatus !== 'CREATING' ? [{
                        text: '에이전트 편집',
                        id: 'edit',
                        iconName: 'edit' as const
                      }] : []),
                      ...(item.agentStatus === 'NOT_PREPARED' ? [{
                        text: '에이전트 준비',
                        id: 'prepare',
                        iconName: 'status-positive' as const
                      }] : []),
                      ...(item.agentStatus !== 'DELETING' && item.agentStatus !== 'CREATING' ? [{
                        text: '에이전트 제거',
                        id: 'delete',
                        iconName: 'remove' as const
                      }] : [])
                    ]}
                    onItemClick={({ detail }) => {
                      switch (detail.id) {
                        case 'edit':
                          navigate(`/admin/agents/${item.agentId}/edit`)
                          break
                        case 'prepare':
                          handlePrepare(item.agentId)
                          break
                        case 'delete':
                          handleDelete(item.agentId)
                          break
                      }
                    }}
                  >
                    Actions
                  </ButtonDropdown>
                )
              }
            ]}
            items={agents}
            loading={loading}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  No agents
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  No Bedrock agents found.
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  에이전트 생성
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}