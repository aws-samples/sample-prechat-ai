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
  ButtonDropdown,
  Modal,
  FormField,
  Input
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import type { BedrockAgent } from '../../types'
import { useI18n } from '../../i18n'

export default function AgentsDashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [agents, setAgents] = useState<BedrockAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [memoryStorageDays, setMemoryStorageDays] = useState(30)

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
        return <Badge color="green">{t('prepared')}</Badge>
      case 'PREPARING':
        return <Badge color="blue">{t('preparing')}</Badge>
      case 'NOT_PREPARED':
        return <Badge color="grey">{t('not_prepared')}</Badge>
      case 'CREATING':
        return <Badge color="blue">{t('creating')}</Badge>
      case 'UPDATING':
        return <Badge color="blue">{t('updating')}</Badge>
      case 'DELETING':
        return <Badge color="red">{t('deleting')}</Badge>
      case 'FAILED':
        return <Badge color="red">{t('failed')}</Badge>
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

  const handleEnableMemory = (agentId: string) => {
    setSelectedAgentId(agentId)
    setShowMemoryModal(true)
  }

  const confirmEnableMemory = async () => {
    try {
      await adminApi.enableAgentMemory(selectedAgentId, memoryStorageDays)
      alert(t('agents_memory_success', { days: memoryStorageDays }))
      setShowMemoryModal(false)
      loadAgents()
    } catch (err) {
      console.error('Failed to enable memory:', err)
      alert(t('agents_memory_failed'))
    }
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={t('agents_dashboard_description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin')}
              >
                {t('admin_prechat_sessions')}
              </Button>
              <Button
                variant="normal"
                iconName="refresh"
                onClick={loadAgents}
                loading={loading}
              >
                {t('agents_refresh')}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/agents/create')}
              >
                {t('admin_create_agent')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('admin_prechat_agents')}
        </Header>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: t('admin_agent_name'),
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
                header: t('foundation_model'),
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
                  return t('unknown')
                }
              },
              {
                id: 'status',
                header: t('status'),
                cell: (item) => getStatusBadge(item.agentStatus)
              },
              {
                id: 'memory',
                header: t('agents_memory'),
                cell: (item) => (
                  <Box>
                    <Box>{item.memoryStorageDays}{t('agents_days')}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      {t('storage_days')}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'actions',
                header: t('admin_actions'),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      ...(item.agentStatus !== 'DELETING' && item.agentStatus !== 'CREATING' ? [{
                        text: t('agents_edit_agent'),
                        id: 'edit',
                        iconName: 'edit' as const
                      }] : []),
                      ...(item.agentStatus === 'NOT_PREPARED' ? [{
                        text: t('agents_prepare_agent'),
                        id: 'prepare',
                        iconName: 'status-positive' as const
                      }] : []),
                      ...(item.agentStatus !== 'DELETING' && item.agentStatus !== 'CREATING' ? [{
                        text: t('agents_enable_memory'),
                        id: 'enable-memory',
                        iconName: 'refresh' as const
                      }] : []),
                      ...(item.agentStatus !== 'DELETING' && item.agentStatus !== 'CREATING' ? [{
                        text: t('agents_remove_agent'),
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
                        case 'enable-memory':
                          handleEnableMemory(item.agentId)
                          break
                      }
                    }}
                  >
                    {t('admin_actions')}
                  </ButtonDropdown>
                )
              }
            ]}
            items={agents}
            loading={loading}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('no_agents')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('no_bedrock_agents_found')}
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  {t('admin_create_agent')}
                </Button>
              </Box>
            }
          />
        </div>

        <Modal
          visible={showMemoryModal}
          onDismiss={() => setShowMemoryModal(false)}
          header={t('agents_memory_settings')}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowMemoryModal(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" onClick={confirmEnableMemory}>
                  {t('agents_enable_memory')}
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Box>
              {t('agents_memory_description')}
            </Box>
            <FormField 
              label={t('memory_storage_days')} 
              description={t('admin_memory_storage_description')}
            >
              <Input
                type="number"
                value={memoryStorageDays.toString()}
                onChange={({ detail }) => {
                  const days = parseInt(detail.value) || 30
                  if (days >= 1 && days <= 365) {
                    setMemoryStorageDays(days)
                  }
                }}
                placeholder="30"
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </Container>
  )
}