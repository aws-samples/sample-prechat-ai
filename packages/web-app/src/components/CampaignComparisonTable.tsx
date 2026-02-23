import {
  Box,
  Container,
  Header,
  Table,
  SpaceBetween,
  StatusIndicator,
  Badge,
  Button,
  Multiselect,
  FormField
} from '@cloudscape-design/components'
import { useState } from 'react'
import type { Campaign } from '../types'
import { useI18n } from '../i18n'
import { campaignApi } from '../services/api'


interface CampaignComparisonData {
  campaignId: string
  campaignName: string
  campaignCode: string
  status: string
  startDate: string
  endDate: string
  totalSessions: number
  completedSessions: number
  completionRate: number
  ownerName: string
}

interface CampaignComparisonTableProps {
  campaigns: Campaign[]
  loading?: boolean
}

export function CampaignComparisonTable({ campaigns, loading = false }: CampaignComparisonTableProps) {
  const { t } = useI18n()
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<CampaignComparisonData[]>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)

  const campaignOptions = campaigns.map(campaign => ({
    label: `${campaign.campaignName} (${campaign.campaignCode})`,
    value: campaign.campaignId,
    description: `${campaign.status} - ${campaign.startDate} ~ ${campaign.endDate}`
  }))

  const handleCompare = async () => {
    if (selectedCampaigns.length < 2) return

    setComparisonLoading(true)
    try {
      const result = await campaignApi.getCampaignComparisonAnalytics(selectedCampaigns)
      setComparisonData(result.campaigns || [])
    } catch (error) {
      console.error('Error fetching comparison data:', error)
      setComparisonData([])
    } finally {
      setComparisonLoading(false)
    }
  }

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return <StatusIndicator type="success">{t('adminCampaignDetail.comparisonTable.statusActive')}</StatusIndicator>
      case 'completed':
        return <StatusIndicator type="info">{t('adminCampaignDetail.comparisonTable.statusCompleted')}</StatusIndicator>
      case 'paused':
        return <StatusIndicator type="warning">{t('adminCampaignDetail.comparisonTable.statusPaused')}</StatusIndicator>
      case 'cancelled':
        return <StatusIndicator type="error">{t('adminCampaignDetail.comparisonTable.statusCancelled')}</StatusIndicator>
      default:
        return <StatusIndicator type="pending">{status}</StatusIndicator>
    }
  }

  const getCompletionRateBadge = (rate: number) => {
    if (rate >= 80) return <Badge color="green">{rate}%</Badge>
    if (rate >= 60) return <Badge color="blue">{rate}%</Badge>
    if (rate >= 40) return <Badge color="grey">{rate}%</Badge>
    return <Badge color="red">{rate}%</Badge>
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header 
          variant="h2"
          description={t('adminCampaignDetail.comparisonTable.description')}
          actions={
            <Button
              variant="primary"
              onClick={handleCompare}
              disabled={selectedCampaigns.length < 2 || comparisonLoading}
              loading={comparisonLoading}
            >
              {t('adminCampaignDetail.comparisonTable.compareButton')}
            </Button>
          }
        >
          {t('adminCampaignDetail.comparisonTable.title')}
        </Header>

        <FormField
          label={t('adminCampaignDetail.comparisonTable.selectLabel')}
          description={t('adminCampaignDetail.comparisonTable.selectDescription')}
        >
          <Multiselect
            selectedOptions={selectedCampaigns.map(id => 
              campaignOptions.find(opt => opt.value === id)!
            ).filter(Boolean)}
            onChange={({ detail }) => 
              setSelectedCampaigns(detail.selectedOptions.map(opt => opt.value!))
            }
            options={campaignOptions}
            placeholder={t('adminCampaignDetail.comparisonTable.choosePlaceholder')}
            selectedAriaLabel={t('adminCampaignDetail.comparisonTable.selectedAriaLabel')}
            deselectAriaLabel={(option) => `${t('adminCampaignDetail.comparisonTable.removeAriaLabel')} ${option.label}`}
            filteringType="auto"
            filteringPlaceholder={t('adminCampaignDetail.comparisonTable.filterPlaceholder')}
            filteringAriaLabel={t('adminCampaignDetail.comparisonTable.filterAriaLabel')}
            statusType={loading ? 'loading' : 'finished'}
            loadingText={t('adminCampaignDetail.comparisonTable.loadingText')}
            errorText={t('adminCampaignDetail.comparisonTable.errorText')}
            recoveryText={t('adminCampaignDetail.comparisonTable.retryText')}
            empty={t('adminCampaignDetail.comparisonTable.emptyText')}
          />
        </FormField>
        
        {comparisonData.length > 0 && (
          <Table
            columnDefinitions={[
              {
                id: 'rank',
                header: t('adminCampaignDetail.comparisonTable.rankHeader'),
                cell: (item: CampaignComparisonData) => (comparisonData.indexOf(item) + 1),
                width: 60
              },
              {
                id: 'campaignName',
                header: t('adminCampaignDetail.comparisonTable.campaignNameHeader'),
                cell: (item) => (
                  <SpaceBetween size="xs" direction="vertical">
                    <Box variant="strong">{item.campaignName}</Box>
                    <Box variant="small" color="text-status-inactive">
                      {item.campaignCode}
                    </Box>
                  </SpaceBetween>
                ),
                sortingField: 'campaignName',
                isRowHeader: true
              },
              {
                id: 'status',
                header: t('adminCampaignDetail.comparisonTable.statusHeader'),
                cell: (item) => getStatusIndicator(item.status),
                sortingField: 'status'
              },
              {
                id: 'totalSessions',
                header: t('adminCampaignDetail.comparisonTable.totalSessionsHeader'),
                cell: (item) => item.totalSessions,
                sortingField: 'totalSessions'
              },
              {
                id: 'completedSessions',
                header: t('adminCampaignDetail.comparisonTable.completedSessionsHeader'),
                cell: (item) => item.completedSessions,
                sortingField: 'completedSessions'
              },
              {
                id: 'completionRate',
                header: t('adminCampaignDetail.comparisonTable.completionRateHeader'),
                cell: (item) => getCompletionRateBadge(item.completionRate),
                sortingField: 'completionRate'
              },
              {
                id: 'dateRange',
                header: t('adminCampaignDetail.comparisonTable.dateRangeHeader'),
                cell: (item) => (
                  <SpaceBetween size="xs" direction="vertical">
                    <Box variant="small">
                      {t('adminCampaignDetail.comparisonTable.startLabel')}: {new Date(item.startDate).toLocaleDateString()}
                    </Box>
                    <Box variant="small">
                      {t('adminCampaignDetail.comparisonTable.endLabel')}: {new Date(item.endDate).toLocaleDateString()}
                    </Box>
                  </SpaceBetween>
                )
              },
              {
                id: 'owner',
                header: t('adminCampaignDetail.comparisonTable.ownerHeader'),
                cell: (item) => item.ownerName,
                sortingField: 'ownerName'
              }
            ]}
            items={comparisonData}
            loading={comparisonLoading}
            loadingText={t('adminCampaignDetail.comparisonTable.loadingComparison')}
            sortingDisabled={comparisonLoading}
            sortingColumn={{ sortingField: 'completionRate' }}
            sortingDescending={true}
            empty={
              <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                <SpaceBetween size="m">
                  <Box variant="strong" color="inherit">
                    {t('adminCampaignDetail.comparisonTable.noDataTitle')}
                  </Box>
                  <Box variant="p" color="inherit">
                    {t('adminCampaignDetail.comparisonTable.noDataDescription')}
                  </Box>
                </SpaceBetween>
              </Box>
            }
            header={
              <Header
                counter={`(${comparisonData.length})`}
                description={t('adminCampaignDetail.comparisonTable.resultsDescription')}
              >
                {t('adminCampaignDetail.comparisonTable.resultsTitle')}
              </Header>
            }
          />
        )}
      </SpaceBetween>
    </Container>
  )
}