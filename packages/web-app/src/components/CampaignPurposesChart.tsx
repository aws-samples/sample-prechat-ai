import {
  Box,
  Container,
  Header,
  PieChart,
  SpaceBetween
} from '@cloudscape-design/components'
import type { CampaignAnalytics } from '../types'
import { useI18n } from '../i18n'

interface CampaignPurposesChartProps {
  analytics: CampaignAnalytics
  loading?: boolean
}

export function CampaignPurposesChart({ analytics, loading = false }: CampaignPurposesChartProps) {
  const { t } = useI18n()

  // Hash function to generate consistent colors from strings
  const stringToColor = (str: string): string => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    // Convert hash to HSL color for better visual distribution
    const hue = Math.abs(hash) % 360
    const saturation = 65 + (Math.abs(hash) % 20) // 65-85%
    const lightness = 45 + (Math.abs(hash) % 15)  // 45-60%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  // Transform data for PieChart
  const chartData = analytics.topConsultationPurposes.map((item) => ({
    title: item.purpose,
    value: item.count,
    color: stringToColor(item.purpose)
  }))

  return (
    <Container>
      <SpaceBetween size="l">
        <Header 
          variant="h2"
          description={t('top_consultation_purposes_description')}
        >
          {t('top_consultation_purposes')}
        </Header>
        
        {loading ? (
          <Box textAlign="center" padding="l">
            <Box variant="p">{t('loading')}...</Box>
          </Box>
        ) : chartData.length > 0 ? (
          <PieChart
            data={chartData}
            detailPopoverContent={(datum) => [
              { key: t('purpose'), value: datum.title },
              { key: t('sessions'), value: datum.value },
              { 
                key: t('percentage'), 
                value: `${((datum.value / analytics.totalSessions) * 100).toFixed(1)}%` 
              }
            ]}
            segmentDescription={(datum, sum) => 
              `${datum.value} ${t('sessions')} (${((datum.value / sum) * 100).toFixed(1)}%)`
            }
            i18nStrings={{
              detailsValue: t('sessions'),
              detailsPercentage: t('percentage'),
              filterLabel: t('filter'),
              filterPlaceholder: t('filter_purposes'),
              filterSelectedAriaLabel: `${t('purposes_selected')}`,
              detailPopoverDismissAriaLabel: t('dismiss'),
              legendAriaLabel: t('chart_legend'),
              chartAriaRoleDescription: t('consultation_purposes_chart'),
              segmentAriaRoleDescription: t('consultation_purposes_chart')
            }}
            ariaLabel={t('consultation_purposes_chart')}
            errorText={t('chart_error')}
            loadingText={t('loading_chart')}
            recoveryText={t('retry')}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" color="inherit">
                  {t('no_purposes_data')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('no_purposes_data_description')}
                </Box>
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" padding="l">
            <Box variant="h3" color="text-status-inactive">
              {t('no_purposes_data')}
            </Box>
            <Box variant="p" color="text-status-inactive">
              {t('no_purposes_data_description')}
            </Box>
          </Box>
        )}
      </SpaceBetween>
    </Container>
  )
}