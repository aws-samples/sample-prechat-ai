import {
  Box,
  ColumnLayout,
  Container,

  SpaceBetween
} from '@cloudscape-design/components'
import type { CampaignAnalytics } from '../types'
import { useI18n } from '../i18n'
import { formatDuration } from '../utils'

interface CampaignMetricsCardsProps {
  analytics: CampaignAnalytics
  loading?: boolean
}

export function CampaignMetricsCards({ analytics, loading = false }: CampaignMetricsCardsProps) {
  const { t } = useI18n()

  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    variant = 'default' 
  }: { 
    title: string
    value: string | number
    subtitle?: string
    variant?: 'default' | 'success' | 'warning' | 'error'
  }) => (
    <Container>
      <SpaceBetween size="xs">
        <Box variant="awsui-key-label">{title}</Box>
        <Box 
          variant="h1" 
          color={
            variant === 'success' ? 'text-status-success' :
            variant === 'warning' ? 'text-status-warning' :
            variant === 'error' ? 'text-status-error' :
            'inherit'
          }
        >
          {loading ? '...' : value}
        </Box>
        {subtitle && (
          <Box variant="small" color="text-status-inactive">
            {subtitle}
          </Box>
        )}
      </SpaceBetween>
    </Container>
  )

  const completionRateVariant = 
    analytics.completionRate >= 80 ? 'success' :
    analytics.completionRate >= 60 ? 'warning' : 'error'

  return (
    <ColumnLayout columns={4} variant="text-grid">
      <MetricCard
        title={t('adminCampaignDetail.metrics.totalSessions')}
        value={analytics.totalSessions}
        subtitle={`${analytics.activeSessions} ${t('adminCampaignDetail.metrics.activeSessions').toLowerCase()}, ${analytics.completedSessions} ${t('adminCampaignDetail.metrics.completedSessions').toLowerCase()}`}
      />
      
      <MetricCard
        title={t('adminCampaignDetail.metrics.completionRate')}
        value={`${analytics.completionRate}%`}
        variant={completionRateVariant}
        subtitle={`${analytics.completedSessions} of ${analytics.totalSessions} sessions`}
      />
      
      <MetricCard
        title={t('adminCampaignDetail.metrics.averageDuration')}
        value={formatDuration(analytics.averageSessionDuration)}
        subtitle={t('adminCampaignDetail.metrics.completedSessionsOnly')}
      />
      
      <MetricCard
        title={t('adminCampaignDetail.metrics.customerCompanies')}
        value={analytics.customerCompanies.length}
        subtitle={analytics.customerCompanies.length > 0 
          ? `${t('adminCampaignDetail.metrics.topCompany')}: ${analytics.customerCompanies[0]?.company}` 
          : t('adminCampaignDetail.metrics.noData')
        }
      />
    </ColumnLayout>
  )
}