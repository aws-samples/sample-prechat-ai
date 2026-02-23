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
      setError(t('adminCampaignDetail.overview.failedLoad'))
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
      setError(t('adminCampaignDetail.deleteModal.failedDelete'))
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const getStatusBadge = (status: Campaign['status']) => {
    const statusConfig = {
      active: { type: 'green' as const, text: t('adminCampaignDetail.status.active') },
      completed: { type: 'blue' as const, text: t('adminCampaignDetail.status.completed') },
      paused: { type: 'grey' as const, text: t('adminCampaignDetail.status.paused') },
      cancelled: { type: 'red' as const, text: t('adminCampaignDetail.status.cancelled') }
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
        <Alert type="error" header={t('adminCampaignDetail.overview.errorHeader')}>
          {error || t('adminCampaignDetail.overview.notFound')}
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
                {t('adminCampaignDetail.header.backButton')}
              </Button>
              <ButtonDropdown
                items={[
                  {
                    text: t('adminCampaignDetail.header.editAction'),
                    id: 'edit',
                    iconName: 'edit'
                  },
                  {
                    text: t('adminCampaignDetail.header.viewSessionsAction'),
                    id: 'sessions',
                    iconName: 'view-horizontal'
                  },
                  {
                    text: t('adminCampaignDetail.header.deleteAction'),
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
                {t('adminCampaignDetail.header.actionsLabel')}
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          {t('adminCampaignDetail.header.title')}
        </Header>

        {/* Campaign Overview */}
        <ColumnLayout columns={3}>
          <Box>
            <Box variant="awsui-key-label">{t('adminCampaignDetail.overview.campaignNameLabel')}</Box>
            <Box fontWeight="bold">{campaign.campaignName}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{campaign.campaignCode}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminCampaignDetail.overview.ownerLabel')}</Box>
            <Box>{campaign.ownerName}</Box>
            <Box fontSize="body-s" color="text-status-inactive">{campaign.ownerEmail}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">{t('adminCampaignDetail.overview.statusLabel')}</Box>
            {getStatusBadge(campaign.status)}
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={1}>
          <Box>
            <Box variant="awsui-key-label">{t('adminCampaignDetail.overview.descriptionLabel')}</Box>
            <Box>{campaign.description}</Box>
          </Box>
        </ColumnLayout>

        <ColumnLayout columns={1}>
          <Box>
            <Box variant="awsui-key-label">{t('adminCampaignDetail.overview.periodLabel')}</Box>
            <Box>{new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</Box>
          </Box>
        </ColumnLayout>

        <Tabs
          tabs={[
            {
              label: t('adminCampaignDetail.tabs.analyticsLabel'),
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
              label: t('adminCampaignDetail.tabs.sessionsLabel'),
              id: 'sessions',
              content: (
                <Box textAlign="center" padding="l">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/admin?mySession=n&campaignCode=${campaign.campaignCode}`)}
                      iconName="external"
                    >
                      {t('adminCampaignDetail.tabs.viewAllSessionsButton')}
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
          closeAriaLabel={t('adminCampaignDetail.deleteModal.closeAriaLabel')}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDeleteModal(false)}>
                  {t('adminCampaignDetail.deleteModal.cancelButton')}
                </Button>
                <Button variant="primary" onClick={handleDeleteCampaign} loading={deleting}>
                  {t('adminCampaignDetail.deleteModal.confirmButton')}
                </Button>
              </SpaceBetween>
            </Box>
          }
          header={t('adminCampaignDetail.deleteModal.header')}
        >
          <SpaceBetween size="m">
            <Box variant="span">
              {t('adminCampaignDetail.deleteModal.warningMessage')}
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