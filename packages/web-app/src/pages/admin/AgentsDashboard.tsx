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
                onClick={loadConfigs}
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
                    <Box fontWeight="bold">{item.agentName || `${ROLE_LABELS[item.agentRole] || item.agentRole} Agent`}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.configId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'role',
                header: t('agent_role'),
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
                header: t('foundation_model'),
                cell: (item) => extractModelName(item.modelId)
              },
              {
                id: 'status',
                header: t('status'),
                cell: (item) => (
                  <Badge color={item.status === 'active' ? 'green' : 'grey'}>
                    {item.status}
                  </Badge>
                )
              },
              {
                id: 'actions',
                header: t('admin_actions'),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: t('agents_edit_agent'),
                        id: 'edit',
                        iconName: 'edit' as const
                      },
                      {
                        text: t('agents_remove_agent'),
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
                    {t('admin_actions')}
                  </ButtonDropdown>
                )
              }
            ]}
            items={configs}
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
      </SpaceBetween>
    </Container>
  )
}
