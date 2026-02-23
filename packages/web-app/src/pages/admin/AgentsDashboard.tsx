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
import type { AgentConfiguration } from '../../types'
import { useI18n } from '../../i18n'
import { extractModelName } from '../../constants'

const ROLE_LABELS: Record<string, string> = {
  prechat: 'Consultation',
  summary: 'Analysis',
  planning: 'Planning'
}

export default function AgentsDashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [configs, setConfigs] = useState<AgentConfiguration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const response = await adminApi.listAgentConfigs()
      setConfigs(response.configs || [])
    } catch (err) {
      console.error('Failed to load agent configs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (configId: string) => {
    try {
      await adminApi.deleteAgentConfig(configId)
      loadConfigs()
    } catch (err) {
      console.error('Failed to delete agent config:', err)
    }
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={t('adminAgents.header.description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin')}
              >
                {t('adminAgents.header.allSessionsButton')}
              </Button>
              <Button
                variant="normal"
                iconName="refresh"
                onClick={loadConfigs}
                loading={loading}
              >
                {t('adminAgents.header.refreshButton')}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/agents/create')}
              >
                {t('adminAgents.header.createAgentButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('adminAgents.header.title')}
        </Header>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: t('adminAgents.table.agentNameHeader'),
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.agentName || `${ROLE_LABELS[item.agentRole] || item.agentRole} Agent`}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.configId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'role',
                header: t('adminAgents.table.agentRoleHeader'),
                cell: (item) => (
                  <Badge color={
                    item.agentRole === 'prechat' ? 'blue' :
                    item.agentRole === 'summary' ? 'green' : 'grey'
                  }>
                    {ROLE_LABELS[item.agentRole] || item.agentRole}
                  </Badge>
                )
              },
              {
                id: 'model',
                header: t('adminAgents.table.foundationModelHeader'),
                cell: (item) => extractModelName(item.modelId)
              },
              {
                id: 'status',
                header: t('adminAgents.table.statusHeader'),
                cell: (item) => (
                  <Badge color={item.status === 'active' ? 'green' : 'grey'}>
                    {item.status}
                  </Badge>
                )
              },
              {
                id: 'actions',
                header: t('adminAgents.table.actionsHeader'),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: t('adminAgents.table.editAgentItem'),
                        id: 'edit',
                        iconName: 'edit' as const
                      },
                      {
                        text: t('adminAgents.table.removeAgentItem'),
                        id: 'delete',
                        iconName: 'remove' as const
                      }
                    ]}
                    onItemClick={({ detail }) => {
                      switch (detail.id) {
                        case 'edit':
                          navigate(`/admin/agents/${item.configId}/edit`)
                          break
                        case 'delete':
                          handleDelete(item.configId)
                          break
                      }
                    }}
                  >
                    {t('adminAgents.table.actionsButton')}
                  </ButtonDropdown>
                )
              }
            ]}
            items={configs}
            loading={loading}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('adminAgents.empty.noAgentsTitle')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('adminAgents.empty.noAgentsDescription')}
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  {t('adminAgents.empty.createAgentButton')}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}
