import {
  Box,
  Header,
  Table,
  SpaceBetween,
  ProgressBar
} from '@cloudscape-design/components'
import type { CampaignAnalytics } from '../types'
import { useI18n } from '../i18n'

interface CampaignCompaniesTableProps {
  analytics: CampaignAnalytics
  loading?: boolean
}

export function CampaignCompaniesTable({ analytics, loading = false }: CampaignCompaniesTableProps) {
  const { t } = useI18n()

  const maxSessions = Math.max(...analytics.customerCompanies.map(c => c.sessionCount), 1)

  return (
    <Table
      columnDefinitions={[
        {
          id: 'company',
          header: t('company_name'),
          cell: (item) => item.company || t('unknown_company'),
          sortingField: 'company',
          isRowHeader: true
        },
        {
          id: 'sessionCount',
          header: t('session_count'),
          cell: (item) => item.sessionCount,
          sortingField: 'sessionCount'
        },
        {
          id: 'percentage',
          header: t('percentage_of_total'),
          cell: (item) => {
            const percentage = ((item.sessionCount / analytics.totalSessions) * 100).toFixed(1)
            return `${percentage}%`
          }
        },
        {
          id: 'progress',
          header: t('relative_volume'),
          cell: (item) => (
            <ProgressBar
              value={(item.sessionCount / maxSessions) * 100}
              additionalInfo={`${item.sessionCount} ${t('sessions')}`}
              description={`${((item.sessionCount / analytics.totalSessions) * 100).toFixed(1)}% ${t('of_total')}`}
            />
          )
        }
      ]}
      items={analytics.customerCompanies}
      loading={loading}
      loadingText={t('loading_companies')}
      sortingDisabled={loading}
      empty={
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <Box variant="strong" color="inherit">
              {t('no_companies_data')}
            </Box>
            <Box variant="p" color="inherit">
              {t('no_companies_data_description')}
            </Box>
          </SpaceBetween>
        </Box>
      }
      header={
        <Header
          counter={`(${analytics.customerCompanies.length})`}
          description={t('companies_participating_in_campaign')}
        >
          {t('customer_companies')}
        </Header>
      }
    />
  )
}