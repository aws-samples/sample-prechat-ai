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
        return <StatusIndicator type="success">{t('active')}</StatusIndicator>
      case 'completed':
        return <StatusIndicator type="info">{t('completed')}</StatusIndicator>
      case 'paused':
        return <StatusIndicator type="warning">{t('paused')}</StatusIndicator>
      case 'cancelled':
        return <StatusIndicator type="error">{t('cancelled')}</StatusIndicator>
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
          description={t('compare_campaign_performance')}
          actions={
            <Button
              variant="primary"
              onClick={handleCompare}
              disabled={selectedCampaigns.length < 2 || comparisonLoading}
              loading={comparisonLoading}
            >
              {t('compare_campaigns')}
            </Button>
          }
        >
          {t('campaign_comparison')}
        </Header>

        <FormField
          label={t('select_campaigns_to_compare')}
          description={t('select_at_least_two_campaigns')}
        >
          <Multiselect
            selectedOptions={selectedCampaigns.map(id => 
              campaignOptions.find(opt => opt.value === id)!
            ).filter(Boolean)}
            onChange={({ detail }) => 
              setSelectedCampaigns(detail.selectedOptions.map(opt => opt.value!))
            }
            options={campaignOptions}
            placeholder={t('choose_campaigns')}
            selectedAriaLabel={t('selected_campaigns')}
            deselectAriaLabel={(option) => `${t('remove')} ${option.label}`}
            filteringType="auto"
            filteringPlaceholder={t('search_campaigns')}
            filteringAriaLabel={t('search_campaigns')}
            statusType={loading ? 'loading' : 'finished'}
            loadingText={t('loading_campaigns')}
            errorText={t('error_loading_campaigns')}
            recoveryText={t('retry')}
            empty={t('no_campaigns_available')}
          />
        </FormField>
        
        {comparisonData.length > 0 && (
          <Table
            columnDefinitions={[
              {
                id: 'rank',
                header: t('rank'),
                cell: (item: CampaignComparisonData) => (comparisonData.indexOf(item) + 1),
                width: 60
              },
              {
                id: 'campaignName',
                header: t('campaign_name'),
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
                header: t('status'),
                cell: (item) => getStatusIndicator(item.status),
                sortingField: 'status'
              },
              {
                id: 'totalSessions',
                header: t('total_sessions'),
                cell: (item) => item.totalSessions,
                sortingField: 'totalSessions'
              },
              {
                id: 'completedSessions',
                header: t('completed_sessions'),
                cell: (item) => item.completedSessions,
                sortingField: 'completedSessions'
              },
              {
                id: 'completionRate',
                header: t('completion_rate'),
                cell: (item) => getCompletionRateBadge(item.completionRate),
                sortingField: 'completionRate'
              },
              {
                id: 'dateRange',
                header: t('date_range'),
                cell: (item) => (
                  <SpaceBetween size="xs" direction="vertical">
                    <Box variant="small">
                      {t('start')}: {new Date(item.startDate).toLocaleDateString()}
                    </Box>
                    <Box variant="small">
                      {t('end')}: {new Date(item.endDate).toLocaleDateString()}
                    </Box>
                  </SpaceBetween>
                )
              },
              {
                id: 'owner',
                header: t('owner'),
                cell: (item) => item.ownerName,
                sortingField: 'ownerName'
              }
            ]}
            items={comparisonData}
            loading={comparisonLoading}
            loadingText={t('loading_comparison')}
            sortingDisabled={comparisonLoading}
            sortingColumn={{ sortingField: 'completionRate' }}
            sortingDescending={true}
            empty={
              <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                <SpaceBetween size="m">
                  <Box variant="strong" color="inherit">
                    {t('no_comparison_data')}
                  </Box>
                  <Box variant="p" color="inherit">
                    {t('select_campaigns_and_click_compare')}
                  </Box>
                </SpaceBetween>
              </Box>
            }
            header={
              <Header
                counter={`(${comparisonData.length})`}
                description={t('campaigns_ranked_by_completion_rate')}
              >
                {t('comparison_results')}
              </Header>
            }
          />
        )}
      </SpaceBetween>
    </Container>
  )
}