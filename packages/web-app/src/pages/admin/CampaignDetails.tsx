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
  ButtonDropdown,
  Modal
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'
import { campaignApi } from '../../services/api'
import {
  CampaignMetricsCards,
  CampaignSessionsChart,
  CampaignPurposesChart,
  CampaignCompaniesTable,
  CampaignCSATTable,
  CampaignReportExport
} from '../../components'
import type { Campaign, CampaignAnalytics, SessionSummary } from '../../types'



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
        campaignApi.getCampaign(campaignId),
        campaignApi.getCampaignAnalytics(campaignId),
        campaignApi.getCampaignSessions(campaignId)
      ])

      setCampaign(campaignData)
      setAnalytics(analyticsData)
      setSessions(sessionsData.sessions || [])
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
      await campaignApi.deleteCampaign(campaignId)
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
              {analytics && (
                <CampaignReportExport 
                  campaign={campaign}
                  analytics={analytics}
                  sessions={sessions}
                />
              )}
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

        <ColumnLayout columns={1}>
          <Box>
            <Box variant="awsui-key-label">Campaign Period</Box>
            <Box>{new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</Box>
          </Box>
        </ColumnLayout>

        <Tabs
          tabs={[
            {
              label: t('campaign_analytics'),
              id: 'analytics',
              content: analytics ? (
                <SpaceBetween size="l">
                  <CampaignMetricsCards analytics={analytics} loading={loading} />
                  
                  <ColumnLayout columns={2}>
                    <CampaignSessionsChart analytics={analytics} loading={loading} />
                    <CampaignPurposesChart analytics={analytics} loading={loading} />
                  </ColumnLayout>
                  
                  <CampaignCompaniesTable analytics={analytics} loading={loading} />
                  
                  <CampaignCSATTable analytics={analytics} loading={loading} />
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
                <Box textAlign="center" padding="l">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/admin?mySession=n&campaignCode=${campaign.campaignCode}`)}
                      iconName="external"
                    >
                      {t('view_all_sessions_for_campaign')}
                    </Button>
                </Box>
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