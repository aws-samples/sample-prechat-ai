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
          header: t('adminCampaignDetail.companiesTable.companyNameHeader'),
          cell: (item) => item.company || t('adminCampaignDetail.companiesTable.unknownCompany'),
          sortingField: 'company',
          isRowHeader: true
        },
        {
          id: 'sessionCount',
          header: t('adminCampaignDetail.companiesTable.sessionCountHeader'),
          cell: (item) => item.sessionCount,
          sortingField: 'sessionCount'
        },
        {
          id: 'percentage',
          header: t('adminCampaignDetail.companiesTable.percentageHeader'),
          cell: (item) => {
            const percentage = ((item.sessionCount / analytics.totalSessions) * 100).toFixed(1)
            return `${percentage}%`
          }
        },
        {
          id: 'progress',
          header: t('adminCampaignDetail.companiesTable.relativeVolumeHeader'),
          cell: (item) => (
            <ProgressBar
              value={(item.sessionCount / maxSessions) * 100}
              additionalInfo={`${item.sessionCount} ${t('adminCampaignDetail.companiesTable.sessionsLabel')}`}
              description={`${((item.sessionCount / analytics.totalSessions) * 100).toFixed(1)}% ${t('adminCampaignDetail.companiesTable.ofTotalLabel')}`}
            />
          )
        }
      ]}
      items={analytics.customerCompanies}
      loading={loading}
      loadingText={t('adminCampaignDetail.companiesTable.loadingText')}
      sortingDisabled={loading}
      empty={
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <Box variant="strong" color="inherit">
              {t('adminCampaignDetail.companiesTable.noDataTitle')}
            </Box>
            <Box variant="p" color="inherit">
              {t('adminCampaignDetail.companiesTable.noDataDescription')}
            </Box>
          </SpaceBetween>
        </Box>
      }
      header={
        <Header
          counter={`(${analytics.customerCompanies.length})`}
          description={t('adminCampaignDetail.companiesTable.description')}
        >
          {t('adminCampaignDetail.companiesTable.title')}
        </Header>
      }
    />
  )
}