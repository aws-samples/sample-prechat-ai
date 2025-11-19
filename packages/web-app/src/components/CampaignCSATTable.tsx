import {
  Box,
  Container,
  Header,
  Table,
  SpaceBetween,
  Badge
} from '@cloudscape-design/components'
import type { CampaignAnalytics } from '../types'
import { useI18n } from '../i18n'

interface CampaignCSATTableProps {
  analytics: CampaignAnalytics
  loading?: boolean
}

interface CSATFeedback {
  sessionId: string
  customerName: string
  customerCompany: string
  rating: number
  narrative: string
  completedAt: string
}

export function CampaignCSATTable({ analytics, loading = false }: CampaignCSATTableProps) {
  const { t } = useI18n()

  const getRatingBadge = (rating: number) => {
    if (rating >= 4) {
      return <Badge color="green">{rating}/5</Badge>
    } else if (rating >= 3) {
      return <Badge color="blue">{rating}/5</Badge>
    } else {
      return <Badge color="red">{rating}/5</Badge>
    }
  }

  const csatData = (analytics as any).csatFeedback || []
  const averageCSAT = (analytics as any).averageCSAT || 0
  const totalResponses = (analytics as any).totalCSATResponses || 0

  return (
    <Container>
      <SpaceBetween size="l">
        <Header 
          variant="h2"
          description={t('csat_feedback_description')}
          info={
            <Box>
              <Box variant="awsui-key-label">{t('average_csat_rating')}</Box>
              <Box fontWeight="bold" fontSize="heading-m">
                {averageCSAT > 0 ? `${averageCSAT}/5` : t('no_ratings')}
              </Box>
              <Box fontSize="body-s" color="text-status-inactive">
                {t('total_responses', { count: totalResponses })}
              </Box>
            </Box>
          }
        >
          {t('customer_satisfaction_feedback')}
        </Header>
        
        {loading ? (
          <Box textAlign="center" padding="l">
            <Box variant="p">{t('loading')}...</Box>
          </Box>
        ) : csatData.length > 0 ? (
          <Table
            columnDefinitions={[
              {
                id: 'customer',
                header: t('customer'),
                cell: (item: CSATFeedback) => (
                  <Box>
                    <Box fontWeight="bold">{item.customerName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      {item.customerCompany}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'rating',
                header: t('csat_rating'),
                cell: (item: CSATFeedback) => getRatingBadge(item.rating)
              },
              {
                id: 'narrative',
                header: t('feedback_narrative'),
                cell: (item: CSATFeedback) => (
                  <Box>
                    {item.narrative || (
                      <Box color="text-status-inactive">{t('no_narrative_provided')}</Box>
                    )}
                  </Box>
                )
              },
              {
                id: 'completedAt',
                header: t('completion_date'),
                cell: (item: CSATFeedback) => 
                  item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'
              }
            ]}
            items={csatData}
            loading={loading}
            sortingDisabled
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('no_csat_feedback')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('no_csat_feedback_description')}
                </Box>
              </Box>
            }
          />
        ) : (
          <Box textAlign="center" padding="l">
            <Box variant="h3" color="text-status-inactive">
              {t('no_csat_feedback')}
            </Box>
            <Box variant="p" color="text-status-inactive">
              {t('no_csat_feedback_description')}
            </Box>
          </Box>
        )}
      </SpaceBetween>
    </Container>
  )
}