import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Box,
  ButtonDropdown,
  Badge,
  TextFilter,
  Pagination,
  CollectionPreferences,
  Alert
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'
import { campaignApi } from '../../services/api'
import { Campaign } from '../../types'

interface CampaignTableItem extends Campaign {}

export default function CampaignDashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState<CampaignTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedItems, setSelectedItems] = useState<CampaignTableItem[]>([])
  const [filteringText, setFilteringText] = useState('')
  const [currentPageIndex, setCurrentPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortingColumn, setSortingColumn] = useState<any>({})
  const [sortingDescending, setSortingDescending] = useState(false)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await campaignApi.listCampaigns()
      setCampaigns(response.campaigns)
    } catch (err: any) {
      console.error('Failed to load campaigns:', err)
      setError(err.message || 'Failed to load campaigns. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (campaignId: string) => {
    try {
      setError('')
      await campaignApi.deleteCampaign(campaignId)
      // Remove the deleted campaign from the local state
      setCampaigns(prev => prev.filter(campaign => campaign.campaignId !== campaignId))
      // Also remove from selected items if it was selected
      setSelectedItems(prev => prev.filter(campaign => campaign.campaignId !== campaignId))
    } catch (err: any) {
      console.error('Failed to delete campaign:', err)
      setError(err.message || 'Failed to delete campaign. Please try again.')
    }
  }

  const getStatusBadge = (status: Campaign['status']) => {
    const statusConfig = {
      active: { type: 'green' as const, text: t('adminCampaigns.status.active') },
      completed: { type: 'blue' as const, text: t('adminCampaigns.status.completed') },
      paused: { type: 'grey' as const, text: t('adminCampaigns.status.paused') },
      cancelled: { type: 'red' as const, text: t('adminCampaigns.status.cancelled') }
    }
    
    const config = statusConfig[status]
    return <Badge color={config.type}>{config.text}</Badge>
  }

  // Filter campaigns based on search text
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.campaignName.toLowerCase().includes(filteringText.toLowerCase()) ||
    campaign.campaignCode.toLowerCase().includes(filteringText.toLowerCase()) ||
    campaign.ownerName.toLowerCase().includes(filteringText.toLowerCase()) ||
    campaign.description.toLowerCase().includes(filteringText.toLowerCase())
  )

  // Sort campaigns
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (!sortingColumn.sortingField) return 0
    
    let aValue: any, bValue: any
    
    switch (sortingColumn.sortingField) {
      case 'campaignName':
        aValue = a.campaignName.toLowerCase()
        bValue = b.campaignName.toLowerCase()
        break
      case 'status':
        const statusPriority = { active: 1, paused: 2, completed: 3, cancelled: 4 }
        aValue = statusPriority[a.status] || 5
        bValue = statusPriority[b.status] || 5
        break
      case 'startDate':
        aValue = new Date(a.startDate).getTime()
        bValue = new Date(b.startDate).getTime()
        break
      case 'endDate':
        aValue = new Date(a.endDate).getTime()
        bValue = new Date(b.endDate).getTime()
        break

      default:
        return 0
    }
    
    if (aValue < bValue) return sortingDescending ? 1 : -1
    if (aValue > bValue) return sortingDescending ? -1 : 1
    return 0
  })

  // Paginate campaigns
  const startIndex = (currentPageIndex - 1) * pageSize
  const paginatedCampaigns = sortedCampaigns.slice(startIndex, startIndex + pageSize)

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={t('adminCampaigns.header.description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={() => navigate('/admin/campaigns/create')}
              >
                {t('adminCampaigns.header.createButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('adminCampaigns.header.title')}
        </Header>

        {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

        <Table
          columnDefinitions={[
            {
              id: 'campaignName',
              header: t('adminCampaigns.table.campaignNameHeader'),
              sortingField: 'campaignName',
              cell: (item) => (
                <Box>
                  <Box fontWeight="bold">{item.campaignName}</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.campaignCode}
                  </Box>
                  <Box fontSize="body-s" color="text-status-info" margin={{ top: 'xxs' }}>
                    {item.description}
                  </Box>
                </Box>
              )
            },
            {
              id: 'owner',
              header: t('adminCampaigns.table.ownerHeader'),
              cell: (item) => (
                <Box>
                  <Box fontWeight="bold">{item.ownerName}</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.ownerEmail}
                  </Box>
                </Box>
              )
            },
            {
              id: 'status',
              header: t('adminCampaigns.table.statusHeader'),
              sortingField: 'status',
              cell: (item) => getStatusBadge(item.status)
            },
            {
              id: 'dates',
              header: t('adminCampaigns.table.periodHeader'),
              cell: (item) => (
                <Box>
                  <Box fontSize="body-s">
                    {t('adminCampaigns.table.startDateLabel')}: {new Date(item.startDate).toLocaleDateString()}
                  </Box>
                  <Box fontSize="body-s">
                    {t('adminCampaigns.table.endDateLabel')}: {new Date(item.endDate).toLocaleDateString()}
                  </Box>
                </Box>
              )
            },

            {
              id: 'actions',
              header: t('adminCampaigns.table.actionsHeader'),
              cell: (item) => (
                <ButtonDropdown
                  expandToViewport
                  items={[
                    {
                      text: t('adminCampaigns.actions.viewDetails'),
                      id: 'view',
                      iconName: 'external'
                    },
                    {
                      text: t('adminCampaigns.actions.edit'),
                      id: 'edit',
                      iconName: 'edit'
                    },
                    {
                      text: t('adminCampaigns.actions.viewSessions'),
                      id: 'sessions',
                      iconName: 'view-horizontal'
                    },
                    {
                      text: t('adminCampaigns.actions.delete'),
                      id: 'delete',
                      iconName: 'remove'
                    }
                  ]}
                  onItemClick={({ detail }) => {
                    switch (detail.id) {
                      case 'view':
                        navigate(`/admin/campaigns/${item.campaignId}`)
                        break
                      case 'edit':
                        navigate(`/admin/campaigns/${item.campaignId}/edit`)
                        break
                      case 'sessions':
                        navigate(`/admin/campaigns/${item.campaignId}/sessions`)
                        break
                      case 'delete':
                        handleDelete(item.campaignId)
                        break
                    }
                  }}
                >
                  {t('adminCampaigns.actions.label')}
                </ButtonDropdown>
              )
            }
          ]}
          items={paginatedCampaigns}
          loading={loading}
          loadingText={t('adminCampaigns.table.loadingText')}
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          sortingColumn={sortingColumn}
          sortingDescending={sortingDescending}
          onSortingChange={({ detail }) => {
            setSortingColumn(detail.sortingColumn)
            setSortingDescending(detail.isDescending || false)
          }}
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder={t('adminCampaigns.table.searchPlaceholder')}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={Math.ceil(filteredCampaigns.length / pageSize)}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            />
          }
          preferences={
            <CollectionPreferences
              title={t('adminCampaigns.preferences.title')}
              confirmLabel={t('adminCampaigns.preferences.confirmLabel')}
              cancelLabel={t('adminCampaigns.preferences.cancelLabel')}
              pageSizePreference={{
                title: t('adminCampaigns.preferences.pageSizeTitle'),
                options: [
                  { value: 10, label: t('adminCampaigns.preferences.pageSize10') },
                  { value: 20, label: t('adminCampaigns.preferences.pageSize20') },
                  { value: 50, label: t('adminCampaigns.preferences.pageSize50') }
                ]
              }}
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize || 10)
              }}
            />
          }
          empty={
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                {t('adminCampaigns.table.noItemsTitle')}
              </Box>
              <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                {t('adminCampaigns.table.noItemsDescription')}
              </Box>
              <Button onClick={() => navigate('/admin/campaigns/create')}>
                {t('adminCampaigns.header.createButton')}
              </Button>
            </Box>
          }
        />
      </SpaceBetween>
    </Container>
  )
}