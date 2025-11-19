import {
  Box,
  Container,
  Header,
  BarChart,
  SpaceBetween
} from '@cloudscape-design/components'
import type { CampaignAnalytics } from '../types'
import { useI18n } from '../i18n'

interface CampaignSessionsChartProps {
  analytics: CampaignAnalytics
  loading?: boolean
}

export function CampaignSessionsChart({ analytics, loading = false }: CampaignSessionsChartProps) {
  const { t } = useI18n()

  // Transform data for LineChart - try string format for better compatibility
  const chartData = analytics.sessionsByDate.map(item => ({
    x: item.date, // Use string date directly
    y: item.count
  }))

  // Calculate Y domain - use total sessions from analytics as max
  const maxY = Math.max(analytics.totalSessions, 1)
  // Ensure we have integer boundaries
  const yDomain = [0, Math.ceil(maxY)]

  // Debug logging
  console.log('Sessions chart data:', {
    sessionsByDate: analytics.sessionsByDate,
    chartData,
    totalSessions: analytics.totalSessions,
    maxY,
    yDomain
  })

  return (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h2">
          {t('completed_sessions_over_time')}
        </Header>
        
        {loading ? (
          <Box textAlign="center" padding="l">
            <Box variant="p">{t('loading')}...</Box>
          </Box>
        ) : chartData.length > 0 && analytics.sessionsByDate.length > 0 ? (
          <BarChart
            series={[
              {
                title: t('completed_sessions_per_day'),
                type: 'bar',
                data: chartData
              }
            ]}
            xScaleType="categorical"
            yDomain={yDomain}
            yScaleType="linear"
            emphasizeBaselineAxis={true}
            i18nStrings={{
              legendAriaLabel: t('chart_legend'),
              chartAriaRoleDescription: t('sessions_timeline_chart'),
              xTickFormatter: (value) => {
                // Format date string for display
                try {
                  const date = new Date(value)
                  return date.toLocaleDateString()
                } catch {
                  return String(value)
                }
              },
              yTickFormatter: (value) => {
                const numValue = Number(value)
                // Only show whole numbers, hide fractional ticks
                if (Number.isInteger(numValue) && numValue >= 0) {
                  return String(numValue)
                }
                return ''
              }
            }}
            ariaLabel={t('sessions_timeline_chart')}
            height={300}
            hideFilter
            hideLegend={false}
            statusType="finished"
          />
        ) : (
          <Box textAlign="center" padding="l">
            <Box variant="h3" color="text-status-inactive">
              {t('no_session_data')}
            </Box>
            <Box variant="p" color="text-status-inactive">
              {t('no_session_data_description')}
            </Box>
          </Box>
        )}
      </SpaceBetween>
    </Container>
  )
}