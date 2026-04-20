import { useState, useEffect, useRef } from 'react'
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
  Modal,
  CopyToClipboard,
  Grid
} from '@cloudscape-design/components'
import QRCode from 'qrcode'
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
  const [activeTabId, setActiveTabId] = useState('analytics')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const isInbound = campaign?.campaignType === 'inbound'
  const inboundUrl = isInbound && campaign
    ? `${window.location.origin}/inbound/${campaign.campaignCode}`
    : ''

  useEffect(() => {
    if (campaignId) {
      loadCampaignData()
    }
  }, [campaignId])

  // 인바운드 캠페인 QR 코드 렌더링
  // activeTabId를 의존성에 포함하여 'access' 탭 활성화 시 canvas DOM mount 후 실행
  useEffect(() => {
    if (!isInbound || activeTabId !== 'access' || !inboundUrl) return
    // canvas가 DOM에 mount될 때까지 대기
    const timer = setTimeout(() => {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, inboundUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        }).catch(err => console.error('QR render failed:', err))
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [isInbound, activeTabId, inboundUrl])

  const downloadQR = () => {
    const canvas = qrCanvasRef.current
    if (!canvas || !campaign) return
    const safeName = (campaign.campaignCode || 'campaign').replace(/[^A-Za-z0-9_-]/g, '_')
    const link = document.createElement('a')
    link.download = `qr-${safeName}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

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
          <SpaceBetween direction="horizontal" size="s">
            {t('adminCampaignDetail.header.title')}
            {isInbound && <Badge color="blue">{t('inboundDetails.header.inboundBadge')}</Badge>}
          </SpaceBetween>
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
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
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
            },
            ...(isInbound ? [{
              label: t('inboundDetails.tabs.access'),
              id: 'access',
              content: (
                <SpaceBetween size="l">
                  <Alert type="info">
                    {t('inboundDetails.access.description')}
                  </Alert>

                  <Grid
                    gridDefinition={[
                      { colspan: { default: 12, xs: 8 } },
                      { colspan: { default: 12, xs: 4 } },
                    ]}
                  >
                    <Container
                      header={<Header variant="h3">{t('inboundDetails.access.urlLabel')}</Header>}
                    >
                      <SpaceBetween size="s">
                        <Box fontSize="body-m" fontWeight="bold" color="text-status-info">
                          {inboundUrl}
                        </Box>
                        <CopyToClipboard
                          copyButtonText={t('inboundDetails.access.copyButton')}
                          copySuccessText={t('inboundDetails.access.copySuccess')}
                          copyErrorText={t('inboundDetails.access.copyError')}
                          textToCopy={inboundUrl}
                        />
                      </SpaceBetween>
                    </Container>

                    <Container
                      header={<Header variant="h3">{t('inboundDetails.access.qrLabel')}</Header>}
                    >
                      <SpaceBetween size="s" alignItems="center">
                        <canvas ref={qrCanvasRef} />
                        <Button onClick={downloadQR} iconName="download">
                          {t('inboundDetails.access.qrDownload')}
                        </Button>
                      </SpaceBetween>
                    </Container>
                  </Grid>

                </SpaceBetween>
              )
            }] : [])
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