import {
  Container,
  Header,
  SpaceBetween,
  Box
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'

export default function CampaignAnalytics() {
  const { t } = useI18n()

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="View analytics and performance metrics across all campaigns"
        >
          {t('campaign_analytics')}
        </Header>

        <Box textAlign="center" padding="xxl">
          <Box variant="h2" color="text-status-info">
            {t('campaign_analytics')} - Coming Soon
          </Box>
          <Box variant="p" padding={{ top: 's' }}>
            Campaign analytics and reporting features will be available here.
          </Box>
        </Box>
      </SpaceBetween>
    </Container>
  )
}