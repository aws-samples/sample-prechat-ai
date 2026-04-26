// nosemgrep
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Badge,
  Box,
  ButtonDropdown,
  Select,
} from '@cloudscape-design/components';
import type { SelectProps } from '@cloudscape-design/components';
import { adminApi } from '../../services/api';
import type { AgentConfiguration, AgentRole } from '../../types';
import { useI18n } from '../../i18n';
import { extractModelName } from '../../constants';

// 레거시 역할을 Consultation으로 매핑
const LEGACY_ROLES = ['prechat', 'planning', 'ship'];

const getDisplayRole = (role: string): string => {
  if (role === 'summary') return 'Summary';
  // consultation 또는 레거시 역할 모두 Consultation
  return 'Consultation';
};

const getRoleBadgeColor = (
  role: string
): 'blue' | 'green' => {
  if (role === 'summary') return 'green';
  return 'blue';
};

// 역할 필터 옵션
const ROLE_FILTER_OPTIONS: SelectProps.Option[] = [
  { label: 'All Roles', value: 'all' },
  { label: 'Consultation', value: 'consultation' },
  { label: 'Summary', value: 'summary' },
];

export default function AgentsDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [configs, setConfigs] = useState<AgentConfiguration[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] =
    useState<SelectProps.Option>(ROLE_FILTER_OPTIONS[0]);

  useEffect(() => {
    loadConfigs();
  }, [roleFilter]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const filterValue = roleFilter.value;
      const params =
        filterValue && filterValue !== 'all'
          ? { agentRole: filterValue as AgentRole }
          : undefined;
      const response =
        await adminApi.listAgentConfigs(params);
      setConfigs(response.configs || []);
    } catch (err) {
      console.error('Failed to load agent configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      await adminApi.deleteAgentConfig(configId);
      loadConfigs();
    } catch (err) {
      console.error('Failed to delete agent config:', err);
    }
  };

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
                onClick={() =>
                  navigate('/admin/agents/create')
                }
              >
                {t('adminAgents.header.createAgentButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('adminAgents.header.title')}
        </Header>

        <Box>
          <Select
            selectedOption={roleFilter}
            onChange={({ detail }) =>
              setRoleFilter(detail.selectedOption)
            }
            options={ROLE_FILTER_OPTIONS}
            placeholder="Filter by role"
          />
        </Box>

        <div style={{ minHeight: '50vh' }}>
          <Table
            onRowClick={({ detail }) =>
              navigate(
                `/admin/agents/${detail.item.configId}/edit`
              )
            }
            columnDefinitions={[
              {
                id: 'name',
                header: t(
                  'adminAgents.table.agentNameHeader'
                ),
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">
                      {item.agentName ||
                        `${getDisplayRole(item.agentRole)} Agent`}
                    </Box>
                    <Box
                      fontSize="body-s"
                      color="text-status-inactive"
                    >
                      ID: {item.configId}
                    </Box>
                  </Box>
                ),
              },
              {
                id: 'role',
                header: t(
                  'adminAgents.table.agentRoleHeader'
                ),
                cell: (item) => (
                  <Badge
                    color={getRoleBadgeColor(
                      item.agentRole
                    )}
                  >
                    {getDisplayRole(item.agentRole)}
                  </Badge>
                ),
              },
              {
                id: 'model',
                header: t(
                  'adminAgents.table.foundationModelHeader'
                ),
                cell: (item) =>
                  extractModelName(item.modelId),
              },
              {
                id: 'tools',
                header: 'Tools',
                cell: (item) => {
                  const role = item.agentRole;
                  const isConsultation =
                    role === 'consultation' ||
                    LEGACY_ROLES.includes(role);
                  if (
                    !isConsultation ||
                    !item.tools ||
                    item.tools.length === 0
                  ) {
                    return <Box color="text-status-inactive">—</Box>;
                  }
                  return (
                    <SpaceBetween
                      direction="horizontal"
                      size="xxs"
                    >
                      {item.tools.map((tool) => (
                        <Badge
                          key={tool.tool_name}
                          color="blue"
                        >
                          {tool.tool_name}
                        </Badge>
                      ))}
                    </SpaceBetween>
                  );
                },
              },
              {
                id: 'actions',
                header: t(
                  'adminAgents.table.actionsHeader'
                ),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: t(
                          'adminAgents.table.editAgentItem'
                        ),
                        id: 'edit',
                        iconName: 'edit' as const,
                      },
                      {
                        text: t(
                          'adminAgents.table.removeAgentItem'
                        ),
                        id: 'delete',
                        iconName: 'remove' as const,
                      },
                    ]}
                    onItemClick={({ detail }) => {
                      switch (detail.id) {
                        case 'edit':
                          navigate(
                            `/admin/agents/${item.configId}/edit`
                          );
                          break;
                        case 'delete':
                          handleDelete(item.configId);
                          break;
                      }
                    }}
                  >
                    {t('adminAgents.table.actionsButton')}
                  </ButtonDropdown>
                ),
              },
            ]}
            items={configs}
            loading={loading}
            empty={
              <Box
                textAlign="center"
                color="inherit"
              >
                <Box
                  variant="strong"
                  textAlign="center"
                  color="inherit"
                >
                  {t('adminAgents.empty.noAgentsTitle')}
                </Box>
                <Box
                  variant="p"
                  padding={{ bottom: 's' }}
                  color="inherit"
                >
                  {t(
                    'adminAgents.empty.noAgentsDescription'
                  )}
                </Box>
                <Button
                  onClick={() =>
                    navigate('/admin/agents/create')
                  }
                >
                  {t(
                    'adminAgents.empty.createAgentButton'
                  )}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  );
}
