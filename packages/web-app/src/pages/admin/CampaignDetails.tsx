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
  ColumnLayout,
  Button,
  Table,
  ButtonDropdown,
  Modal,
  BarChart,
  PieChart,
  LineChart
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'
import type { Campaign, CampaignAnalytics, SessionSummary } from '../../types'

// Mock API functions - will be replaced with actual API calls
const mockCampaignApi = {
  getCampaign: async (_campaignId: string): Promise<Campaign> => {
    return {
      campaignId: 'camp-001',
      campaignName: 'Q1 2025 Enterprise Migration',
      campaignCode: 'Q1-ENT-MIG',
      description: 'Enterprise customer migration campaign for Q1 2025. This campaign focuses on helping large enterprise customers migrate their existing infrastructure to AWS cloud services.',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      ownerId: 'user-001',
      ownerEmail: 'john.doe@company.com',
      ownerName: 'John Doe',
      status: 'active',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
      sessionCount: 15,
      completedSessionCount: 8
    }
  },

  getCampaignAnalytics: async (campaignId: string): Promise<CampaignAnalytics> => {
    return {
      campaignId: campaignId,
      totalSessions: 15,
      activeSessions: 7,
      completedSessions: 8,
      completionRate: 53.3,
      averageSessionDuration: 45.2,
      topConsultationPurposes: [
        { purpose: 'Migration Consultation', count: 8 },
        { purpose: 'Cost Optimization', count: 4 },
        { purpose: 'Technical Support', count: 3 }
      ],
      sessionsByDate: [
        { date: '2025-01-01', count: 2 },
        { date: '2025-01-02', count: 3 },
        { date: '2025-01-03', count: 1 },
        { date: '2025-01-04', count: 4 },
        { date: '2025-01-05', count: 2 },
        { date: '2025-01-06', count: 3 }
      ],
      customerCompanies: [
        { company: 'TechCorp Inc', sessionCount: 5 },
        { company: 'Global Solutions Ltd', sessionCount: 3 },
        { company: 'Enterprise Systems', sessionCount: 4 },
        { company: 'Digital Innovations', sessionCount: 3 }
      ]
    }
  },

  getCampaignSessions: async (_campaignId: string): Promise<SessionSummary[]> => {
    return [
      {
        sessionId: 'sess-001',
        status: 'completed',
        customerInfo: {
          name: 'John Smith',
          email: 'john.smith@techcorp.com',
          company: 'TechCorp Inc'
        },
        createdAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T11:30:00Z',
        consultationPurposes: 'Migration Consultation'
      },
      {
        sessionId: 'sess-002',
        status: 'active',
        customerInfo: {
          name: 'Sarah Johnson',
          email: 'sarah.j@globalsolutions.com',
          company: 'Global Solutions Ltd'
        },
        createdAt: '2025-01-02T14:00:00Z',
        consultationPurposes: 'Cost Optimization'
      },
      {
        sessionId: 'sess-003',
        status: 'completed',
        customerInfo: {
          name: 'Mike Wilson',
          email: 'mike.w@enterprise.com',
          company: 'Enterprise Systems'
        },
        createdAt: '2025-01-03T09:00:00Z',
        completedAt: '2025-01-03T10:45:00Z',
        consultationPurposes: 'Technical Support'
      }
    ]
  },

  deleteCampaign: async (campaignId: string) => {
    console.log('Deleting campaign:', campaignId)
    return { success: true }
  }
}

export default function CampaignDetails() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (campaignId) {
      loadCampaignData()
    }
  }, [campaignId])

  const loadCampaignData = async () => {
    if (!campaignId) return

    try {
      setLoading(true)
      const [campaignData, analyticsData, sessionsData] = await Promise.all([
        mockCampaignApi.getCampaign(campaignId),
        mockCampaignApi.getCampaignAnalytics(campaignId),
        mockCampaignApi.getCampaignSessions(campaignId)
      ])

      setCampaign(campaignData)
      setAnalytics(analyticsData)
      setSessions(sessionsData)
    } catch (err) {
      console.error('Failed to load campaign data:', err)
      setError('Failed to load campaign details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!campaignId) return

    try {
      setDeleting(true)
      await mockCampaignApi.deleteCampaign(campaignId)
      navigate('/admin/campaigns')
    } catch (err) {
      console.error('Failed to delete campaign:', err)
      setError('Failed to delete campaign. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const getStatusBadge = (status: Campaign['status']) => {
    const statusConfig = {
      active: { type: 'green' as const, text: t('campaign_status_active') },
      completed: { type: 'blue' as const, text: t('campaign_status_completed') },
      paused: { type: 'grey' as const, text: t('campaign_status_paused') },
      cancelled: { type: 'red' as const, text: t('campaign_status_cancelled') }
    }
    
    const config = statusConfig[status]
    return <Badge color={config.type}>{config.text}</Badge>
  }

  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="blue">{t('active')}</Badge>
      case 'completed':
        return <Badge color="green">{t('completed')}</Badge>
      case 'expired':
        return <Badge color="red">{t('expired')}</Badge>
      case 'inactive':
        return <Badge color="grey">{t('inactive')}</Badge>
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

  if (error || !campaign) {
    return (
      <Container>
        <Alert type="error" header="Error occurred">
          {error || 'Campaign not found'}
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
              <Button variant="normal" onClick={() => navigate('/admin/campaigns')}>
                Back to Campaigns
              </Button>
              <ButtonDropdown
                items={[
                  {
                    text: t('edit_campaign'),
                    id: 'edit',
                    iconName: 'edit'
                  },
                  {
                    text: t('view_sessions'),
                    id: 'sessions',
                    iconName: 'view-horizontal'
                  },
                  {
                    text: t('delete_campaign'),
                    id: 'delete',
                    iconName: 'remove'
                  }
                ]}
                onItemClick={({ detail }) => {
                  switch (detail.id) {
                    case 'edit':
                      navigate(`/admin/campaigns/${campaignId}/edit`)
                      break
                    case 'sessions':
                      navigate(`/admin/campaigns/${campaignId}/sessions`)
                      break
                    case 'delete':
                      setShowDeleteModal(true)
                      break
                  }
                }}
              >
                Actions
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          {t('campaign_details_title')}
        </Header>

        {/* Campaign Overview */}
        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('campaign_name')}</Box>
            <Box fontWeight="bold">{campaign.campaignName}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{campaign.campaignCode}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('campaign_owner')}</Box>
            <Box>{campaign.ownerName}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{campaign.ownerEmail}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('campaign_status')}</Box>
            {getStatusBadge(campaign.status)}
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={1}>
          <Box>
            <Box variant="awsui-key-label">Description</Box>
            <Box>{campaign.description}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">Campaign Period</Box>
            <Box>{new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('total_sessions')}</Box>
            <Box fontWeight="bold" fontSize="heading-m">{campaign.sessionCount}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('completion_rate')}</Box>
            <Box fontWeight="bold" fontSize="heading-m">
              {campaign.sessionCount > 0 
                ? Math.round((campaign.completedSessionCount / campaign.sessionCount) * 100)
                : 0}%
            </Box>
          </Box>
        </ColumnLayout>

        <Tabs
          tabs={[
            {
              label: t('campaign_analytics'),
              id: 'analytics',
              content: analytics ? (
                <SpaceBetween size="l">
                  {/* Key Metrics */}
                  <ColumnLayout columns={4}>
                    <Box>
                      <Box variant="awsui-key-label">{t('total_sessions')}</Box>
                      <Box fontWeight="bold" fontSize="display-l">{analytics.totalSessions}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">{t('active_sessions')}</Box>
                      <Box fontWeight="bold" fontSize="display-l">{analytics.activeSessions}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">{t('completed_sessions')}</Box>
                      <Box fontWeight="bold" fontSize="display-l">{analytics.completedSessions}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">{t('average_session_duration')}</Box>
                      <Box fontWeight="bold" fontSize="display-l">{analytics.averageSessionDuration}min</Box>
                    </Box>
                  </ColumnLayout>

                  {/* Charts */}
                  <ColumnLayout columns={2}>
                    <Container header={<Header variant="h3">{t('top_consultation_purposes')}</Header>}>
                      <PieChart
                        data={analytics.topConsultationPurposes.map(item => ({
                          title: item.purpose,
                          value: item.count
                        }))}
                        detailPopoverContent={(datum) => [
                          { key: "Purpose", value: datum.title },
                          { key: "Sessions", value: datum.value }
                        ]}
                        segmentDescription={(datum, sum) => 
                          `${datum.value} sessions, ${((datum.value / sum) * 100).toFixed(0)}%`
                        }
                        i18nStrings={{
                          filterLabel: "Filter displayed data",
                          filterPlaceholder: "Filter data",
                          filterSelectedAriaLabel: "selected",
                          detailPopoverDismissAriaLabel: "Dismiss",
                          legendAriaLabel: "Legend",
                          chartAriaRoleDescription: "pie chart",
                          segmentAriaRoleDescription: "segment"
                        }}
                        ariaDescription="Pie chart showing distribution of consultation purposes"
                        ariaLabel="Consultation purposes distribution"
                        errorText="Error loading chart"
                        loadingText="Loading chart"
                        recoveryText="Retry"
                        empty={
                          <Box textAlign="center" color="inherit">
                            <b>No data available</b>
                            <Box variant="p" color="inherit">
                              There is no data available
                            </Box>
                          </Box>
                        }
                        noMatch={
                          <Box textAlign="center" color="inherit">
                            <b>No matching data</b>
                            <Box variant="p" color="inherit">
                              There is no matching data to display
                            </Box>
                          </Box>
                        }
                      />
                    </Container>

                    <Container header={<Header variant="h3">{t('customer_companies')}</Header>}>
                      <BarChart
                        series={[
                          {
                            title: "Sessions",
                            type: "bar",
                            data: analytics.customerCompanies.map(item => ({
                              x: item.company,
                              y: item.sessionCount
                            }))
                          }
                        ]}
                        xDomain={analytics.customerCompanies.map(item => item.company)}
                        yDomain={[0, Math.max(...analytics.customerCompanies.map(item => item.sessionCount)) + 1]}
                        i18nStrings={{
                          filterLabel: "Filter displayed data",
                          filterPlaceholder: "Filter data",
                          filterSelectedAriaLabel: "selected",
                          detailPopoverDismissAriaLabel: "Dismiss",
                          legendAriaLabel: "Legend",
                          chartAriaRoleDescription: "bar chart",
                          xTickFormatter: (e) => e.toString(),
                          yTickFormatter: (e) => e.toString()
                        }}
                        ariaLabel="Sessions by customer company"
                        errorText="Error loading chart"
                        loadingText="Loading chart"
                        recoveryText="Retry"
                        empty={
                          <Box textAlign="center" color="inherit">
                            <b>No data available</b>
                            <Box variant="p" color="inherit">
                              There is no data available
                            </Box>
                          </Box>
                        }
                        noMatch={
                          <Box textAlign="center" color="inherit">
                            <b>No matching data</b>
                            <Box variant="p" color="inherit">
                              There is no matching data to display
                            </Box>
                          </Box>
                        }
                      />
                    </Container>
                  </ColumnLayout>

                  {/* Sessions Timeline */}
                  <Container header={<Header variant="h3">{t('sessions_by_date')}</Header>}>
                    <LineChart
                      series={[
                        {
                          title: "Sessions",
                          type: "line",
                          data: analytics.sessionsByDate.map(item => ({
                            x: new Date(item.date),
                            y: item.count
                          }))
                        }
                      ]}
                      xDomain={[
                        new Date(Math.min(...analytics.sessionsByDate.map(item => new Date(item.date).getTime()))),
                        new Date(Math.max(...analytics.sessionsByDate.map(item => new Date(item.date).getTime())))
                      ]}
                      yDomain={[0, Math.max(...analytics.sessionsByDate.map(item => item.count)) + 1]}
                      i18nStrings={{
                        filterLabel: "Filter displayed data",
                        filterPlaceholder: "Filter data",
                        filterSelectedAriaLabel: "selected",
                        detailPopoverDismissAriaLabel: "Dismiss",
                        legendAriaLabel: "Legend",
                        chartAriaRoleDescription: "line chart",
                        xTickFormatter: (e) => 
                          e.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric"
                          }),
                        yTickFormatter: (e) => e.toString()
                      }}
                      ariaLabel="Sessions over time"
                      errorText="Error loading chart"
                      loadingText="Loading chart"
                      recoveryText="Retry"
                      empty={
                        <Box textAlign="center" color="inherit">
                          <b>No data available</b>
                          <Box variant="p" color="inherit">
                            There is no data available
                          </Box>
                        </Box>
                      }
                      noMatch={
                        <Box textAlign="center" color="inherit">
                          <b>No matching data</b>
                          <Box variant="p" color="inherit">
                            There is no matching data to display
                          </Box>
                        </Box>
                      }
                    />
                  </Container>
                </SpaceBetween>
              ) : (
                <Box textAlign="center" padding="l">
                  <Spinner size="large" />
                </Box>
              )
            },
            {
              label: t('associated_sessions'),
              id: 'sessions',
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'customer',
                      header: 'Customer',
                      cell: (item) => (
                        <Box>
                          <Box fontWeight="bold">{item.customerInfo.name}</Box>
                          <Box fontSize="body-s" color="text-status-inactive">
                            {item.customerInfo.company}
                          </Box>
                          <Box fontSize="body-s" color="text-status-inactive">
                            {item.customerInfo.email}
                          </Box>
                        </Box>
                      )
                    },
                    {
                      id: 'purpose',
                      header: 'Consultation Purpose',
                      cell: (item) => item.consultationPurposes || '-'
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (item) => getSessionStatusBadge(item.status)
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
                        <Button
                          variant="normal"
                          onClick={() => navigate(`/admin/sessions/${item.sessionId}`)}
                          iconName="external"
                        >
                          View Details
                        </Button>
                      )
                    }
                  ]}
                  items={sessions}
                  loading={false}
                  empty={
                    <Box textAlign="center" color="inherit">
                      <Box variant="strong" textAlign="center" color="inherit">
                        {t('no_sessions_found')}
                      </Box>
                      <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                        No sessions are associated with this campaign yet.
                      </Box>
                    </Box>
                  }
                />
              )
            }
          ]}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          onDismiss={() => setShowDeleteModal(false)}
          visible={showDeleteModal}
          closeAriaLabel="Close modal"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDeleteModal(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" onClick={handleDeleteCampaign} loading={deleting}>
                  {t('delete_campaign')}
                </Button>
              </SpaceBetween>
            </Box>
          }
          header={t('confirm_delete_campaign')}
        >
          <SpaceBetween size="m">
            <Box variant="span">
              {t('delete_campaign_warning')}
            </Box>
            <Alert type="warning">
              Campaign: <strong>{campaign.campaignName}</strong> ({campaign.campaignCode})
            </Alert>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </Container>
  )
}