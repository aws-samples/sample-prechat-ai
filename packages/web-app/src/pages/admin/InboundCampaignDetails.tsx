import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Alert,
  Box,
  ColumnLayout,
  Badge,
  Spinner,
  CopyToClipboard,
  Tabs,
} from '@cloudscape-design/components';
import QRCode from 'qrcode';
import { useI18n } from '../../i18n';
import { campaignApi } from '../../services/api';
import type { Campaign, CampaignAnalytics } from '../../types';

export default function InboundCampaignDetails() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const inboundUrl = campaign
    ? `${window.location.origin}/inbound/${campaign.campaignCode}`
    : '';

  useEffect(() => {
    if (campaignId) loadData();
  }, [campaignId]);

  useEffect(() => {
    if (campaign && qrCanvasRef.current && inboundUrl) {
      QRCode.toCanvas(qrCanvasRef.current, inboundUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    }
  }, [campaign, inboundUrl]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campaignData, analyticsData] = await Promise.allSettled([
        campaignApi.getCampaign(campaignId!),
        campaignApi.getCampaignAnalytics(campaignId!),
      ]);
      if (campaignData.status === 'fulfilled') {
        setCampaign(campaignData.value);
      } else {
        setError(t('inboundDetails.error.loadFailed'));
      }
      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !campaign) return;
    // 파일명 인젝션 방어: 영숫자/대시/언더스코어만 허용
    const safeName = (campaign.campaignCode || 'campaign').replace(/[^A-Za-z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.download = `qr-${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const getStatusBadge = (status: Campaign['status']) => {
    const map = {
      active: 'green' as const,
      completed: 'blue' as const,
      paused: 'grey' as const,
      cancelled: 'red' as const,
    };
    return <Badge color={map[status]}>{t(`adminCampaigns.status.${status}`)}</Badge>;
  };

  if (loading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !campaign) {
    return (
      <Container>
        <Alert type="error">{error || t('inboundDetails.error.notFound')}</Alert>
      </Container>
    );
  }

  const overviewTab = (
    <SpaceBetween size="l">
      <ColumnLayout columns={2} variant="text-grid">
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">{t('inboundDetails.overview.campaignCode')}</Box>
          <Box>{campaign.campaignCode}</Box>
        </SpaceBetween>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">{t('inboundDetails.overview.owner')}</Box>
          <Box>{campaign.ownerName} ({campaign.ownerEmail})</Box>
        </SpaceBetween>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">{t('inboundDetails.overview.period')}</Box>
          <Box>
            {new Date(campaign.startDate).toLocaleDateString()} ~ {new Date(campaign.endDate).toLocaleDateString()}
          </Box>
        </SpaceBetween>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">{t('inboundDetails.overview.sessions')}</Box>
          <Box>{t('inboundDetails.overview.totalSessions', { count: String(campaign.sessionCount) })}</Box>
        </SpaceBetween>
      </ColumnLayout>
      {analytics && (
        <ColumnLayout columns={3} variant="text-grid">
          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">{t('inboundDetails.analytics.total')}</Box>
            <Box fontSize="display-l" fontWeight="bold">{analytics.totalSessions}</Box>
          </SpaceBetween>
          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">{t('inboundDetails.analytics.completed')}</Box>
            <Box fontSize="display-l" fontWeight="bold">{analytics.completedSessions}</Box>
          </SpaceBetween>
          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">{t('inboundDetails.analytics.completionRate')}</Box>
            <Box fontSize="display-l" fontWeight="bold">{analytics.completionRate.toFixed(1)}%</Box>
          </SpaceBetween>
        </ColumnLayout>
      )}
    </SpaceBetween>
  );

  const accessTab = (
    <SpaceBetween size="l">
      <Box variant="h3">{t('inboundDetails.access.title')}</Box>
      <Box color="text-body-secondary">{t('inboundDetails.access.description')}</Box>
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">{t('inboundDetails.access.urlLabel')}</Box>
        <CopyToClipboard
          copyButtonText={t('inboundDetails.access.copyButton')}
          copySuccessText={t('inboundDetails.access.copySuccess')}
          copyErrorText={t('inboundDetails.access.copyError')}
          textToCopy={inboundUrl}
        />
        <Box fontSize="body-s" color="text-status-info">{inboundUrl}</Box>
      </SpaceBetween>
      <SpaceBetween size="m">
        <Box variant="awsui-key-label">{t('inboundDetails.access.qrLabel')}</Box>
        <canvas ref={qrCanvasRef} />
        <Button onClick={downloadQR} iconName="download">
          {t('inboundDetails.access.qrDownload')}
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={campaign.description}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => navigate('/admin/campaigns')}>
                {t('inboundDetails.header.backButton')}
              </Button>
              <Button variant="normal" onClick={() => navigate(`/admin/campaigns/${campaignId}/edit`)}>
                {t('inboundDetails.header.editButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="horizontal" size="s">
            {campaign.campaignName}
            <Badge color="blue">{t('inboundDetails.header.inboundBadge')}</Badge>
            {getStatusBadge(campaign.status)}
          </SpaceBetween>
        </Header>
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          tabs={[
            { id: 'overview', label: t('inboundDetails.tabs.overview'), content: overviewTab },
            { id: 'access', label: t('inboundDetails.tabs.access'), content: accessTab },
          ]}
        />
      </SpaceBetween>
    </Container>
  );
}
