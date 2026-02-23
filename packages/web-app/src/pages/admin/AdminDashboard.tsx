// nosemgrep
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Box,
  ButtonDropdown,
  Toggle,
  FormField,
  Select
} from '@cloudscape-design/components'
import { adminApi, campaignApi } from '../../services/api'
import { StatusBadge, BedrockQuotaNotification } from '../../components'
import { generateSessionCSV, downloadCSV, generateCSVFilename } from '../../utils/csvExport'
import { authService } from '../../services/auth'
import { formatPurposesForDisplay } from '../../components/ConsultationPurposeSelector'
import { useI18n } from '../../i18n'
import type { Campaign } from '../../types'

interface SessionSummary {
  sessionId: string
  customerName: string
  customerEmail: string
  customerCompany: string
  customerTitle?: string
  consultationPurposes?: string
  status: 'active' | 'completed' | 'expired' | 'inactive'
  createdAt: string
  completedAt?: string
  salesRepEmail: string
  agentId: string
  campaignId?: string
  campaignName?: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showMySessionsOnly, setShowMySessionsOnly] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
  const [sortingColumn, setSortingColumn] = useState<any>({})
  const [sortingDescending, setSortingDescending] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<{ label: string; value: string } | null>({ label: t('adminSessions.filter.allCampaigns'), value: 'all' })
  const [campaignsLoading, setCampaignsLoading] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadSessions()
    loadCampaigns()
    
    // Handle URL query parameters
    const mySessionParam = searchParams.get('mySession')
    
    // Set mySession filter based on query parameter
    if (mySessionParam === 'y') {
      setShowMySessionsOnly(true)
    } else if (mySessionParam === 'n') {
      setShowMySessionsOnly(false)
    }
    
    // Campaign code will be handled after campaigns are loaded
  }, [])

  // Handle campaignCode parameter after campaigns are loaded
  useEffect(() => {
    const campaignCodeParam = searchParams.get('campaignCode')
    if (campaignCodeParam && campaigns.length > 0) {
      const matchingCampaign = campaigns.find(campaign => campaign.campaignCode === campaignCodeParam)
      if (matchingCampaign) {
        setSelectedCampaign({
          label: matchingCampaign.campaignName,
          value: matchingCampaign.campaignId
        })
      } else {
        // Campaign code not found, reset to all campaigns
        setSelectedCampaign({ label: t('adminSessions.filter.allCampaigns'), value: 'all' })
      }
    } else if (!campaignCodeParam && campaigns.length > 0) {
      // No campaign code parameter, ensure "all campaigns" is selected
      setSelectedCampaign({ label: t('adminSessions.filter.allCampaigns'), value: 'all' })
    }
  }, [campaigns, searchParams, t])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setCurrentUserEmail(user.email)
    } catch (err) {
      console.error('Failed to get current user:', err)
    }
  }

  const loadSessions = async () => {
    try {
      const response = await adminApi.listSessions()
      setSessions(response.sessions || [])
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCampaigns = async () => {
    setCampaignsLoading(true)
    try {
      const response = await campaignApi.listCampaigns()
      setCampaigns(response.campaigns || [])
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    } finally {
      setCampaignsLoading(false)
    }
  }

  const handleInactivate = async (sessionId: string) => {
    try {
      await adminApi.inactivateSession(sessionId)
      loadSessions()
    } catch (err) {
      console.error('Failed to inactivate session:', err)
    }
  }

  const handleDelete = async (sessionId: string) => {
    try {
      await adminApi.deleteSession(sessionId)
      loadSessions()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleDownloadCSV = (session: SessionSummary) => {
    const csvData = {
      customerCompany: session.customerCompany || t('adminSessions.csv.noInput'),
      customerName: session.customerName,
      customerTitle: session.customerTitle || t('adminSessions.csv.noInput'),
      chatUrl: `${window.location.origin}/customer/${session.sessionId}`,
      pinNumber: t('adminSessions.csv.pinContactSales', { email: session.salesRepEmail }),
      createdAt: new Date(session.createdAt).toLocaleString('ko-KR')
    }

    const csvContent = generateSessionCSV(csvData)
    const filename = generateCSVFilename(session.customerCompany || 'Unknown')

    downloadCSV(csvContent, filename)
  }

  // Filter and sort sessions
  let filteredSessions = showMySessionsOnly 
    ? sessions.filter(session => session.salesRepEmail === currentUserEmail)
    : sessions

  // Apply campaign filter
  if (selectedCampaign && selectedCampaign.value !== 'all') {
    if (selectedCampaign.value === 'none') {
      filteredSessions = filteredSessions.filter(session => !session.campaignId)
    } else {
      filteredSessions = filteredSessions.filter(session => session.campaignId === selectedCampaign.value)
    }
  }



  // Sort sessions based on current sorting state
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (!sortingColumn.sortingField) return 0
    
    let aValue: any, bValue: any
    
    switch (sortingColumn.sortingField) {
      case 'customer':
        aValue = `${a.customerCompany}/${a.customerName}`.toLowerCase()
        bValue = `${b.customerCompany}/${b.customerName}`.toLowerCase()
        break
      case 'status':
        // Define status priority for sorting
        const statusPriority = { active: 1, completed: 2, expired: 3, inactive: 4 }
        aValue = statusPriority[a.status] || 5
        bValue = statusPriority[b.status] || 5
        break
      case 'created':
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
      case 'completed':
        aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0
        bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0
        break
      case 'agent':
        aValue = (a.agentId || '').toLowerCase()
        bValue = (b.agentId || '').toLowerCase()
        break
      case 'campaign':
        aValue = (a.campaignName || '').toLowerCase()
        bValue = (b.campaignName || '').toLowerCase()
        break
      default:
        return 0
    }
    
    if (aValue < bValue) return sortingDescending ? 1 : -1
    if (aValue > bValue) return sortingDescending ? -1 : 1
    return 0
  })

  return (
    <Container>
      <SpaceBetween size="l">
        <BedrockQuotaNotification />
        <Header
          variant="h1"
          description={t('adminSessions.header.description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin/agents')}
              >
                {t('adminSessions.header.agentsButton')}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/sessions/create')}
              >
                {t('adminSessions.header.addSessionButton')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('adminSessions.header.title')}
        </Header>

        <SpaceBetween direction="horizontal" size="l">          
          <Box>
            <FormField
              label={t('adminSessions.filter.campaignAssociationLabel')}
            >
              <Select
                selectedOption={selectedCampaign}
                onChange={({ detail }) => {
                  const selectedOption = detail.selectedOption as { label: string; value: string } | null
                  setSelectedCampaign(selectedOption)
                  
                  // Update URL query parameter
                  const newSearchParams = new URLSearchParams(searchParams)
                  if (selectedOption && selectedOption.value !== 'all') {
                    if (selectedOption.value === 'none') {
                      newSearchParams.delete('campaignCode')
                    } else {
                      const selectedCampaign = campaigns.find(c => c.campaignId === selectedOption.value)
                      if (selectedCampaign) {
                        newSearchParams.set('campaignCode', selectedCampaign.campaignCode)
                      }
                    }
                  } else {
                    newSearchParams.delete('campaignCode')
                  }
                  setSearchParams(newSearchParams)
                }}
                options={[
                  { label: t('adminSessions.filter.allCampaigns'), value: 'all' },
                  { label: t('adminSessions.filter.noCampaign'), value: 'none' },
                  ...campaigns.map(campaign => ({
                    label: campaign.campaignName,
                    value: campaign.campaignId
                  }))
                ]}
                loadingText={t('adminSessions.filter.loadingCampaigns')}
                statusType={campaignsLoading ? 'loading' : 'finished'}
              />
            </FormField>
          </Box>
          <Box>
            <FormField
              label=""
              description={t('adminSessions.filter.mySessionsOnlyDescription')}
            >
              <Toggle
                checked={showMySessionsOnly}
                onChange={({ detail }) => {
                  setShowMySessionsOnly(detail.checked)
                  // Update URL query parameter
                  const newSearchParams = new URLSearchParams(searchParams)
                  newSearchParams.set('mySession', detail.checked ? 'y' : 'n')
                  setSearchParams(newSearchParams)
                }}
              />
            </FormField>
          </Box>
        </SpaceBetween>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'customer',
                header: t('adminSessions.table.customerCompanyContact'),
                sortingField: 'customer',
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.customerCompany}/{item.customerName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      {item.customerTitle && `${item.customerTitle} • `}{item.customerEmail}
                    </Box>
                    {item.consultationPurposes && (
                      <Box fontSize="body-s" color="text-status-info" margin={{ top: 'xxs' }}>
                        {t('adminSessions.table.consultationPurpose')}: {formatPurposesForDisplay(item.consultationPurposes)}
                      </Box>
                    )}
                    {item.campaignName && (
                      <Box fontSize="body-s" color="text-status-success" margin={{ top: 'xxs' }}>
                        {t('adminSessions.table.campaignAssociation')}: {item.campaignName}
                      </Box>
                    )}
                  </Box>
                )
              },
              {
                id: 'campaign',
                header: t('adminSessions.table.campaignAssociation'),
                sortingField: 'campaign',
                cell: (item) => (
                  <Box fontSize="body-s">
                    {item.campaignName ? (
                      <Box color="text-status-success">{item.campaignName}</Box>
                    ) : (
                      <Box color="text-status-inactive">{t('adminSessions.table.noCampaign')}</Box>
                    )}
                  </Box>
                )
              },
              {
                id: 'agent',
                header: t('adminSessions.table.conversationAgent'),
                sortingField: 'agent',
                cell: (item) => (
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.agentId ? `Agent: ${item.agentId}` : t('adminSessions.table.noAgentAssigned')}
                  </Box>
                )
              },
              {
                id: 'status',
                header: t('adminSessions.table.sessionStatus'),
                sortingField: 'status',
                cell: (item) => <StatusBadge status={item.status} type="session" />
              },
              {
                id: 'created',
                header: t('adminSessions.table.createdDate'),
                sortingField: 'created',
                cell: (item) => new Date(item.createdAt).toLocaleDateString()
              },
              {
                id: 'completed',
                header: t('adminSessions.table.completedDate'),
                sortingField: 'completed',
                cell: (item) => item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'
              },
              {
                id: 'actions',
                header: t('adminSessions.actions.actionsLabel'),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: t('adminSessions.actions.conversationAnalysis'),
                        id: 'view',
                        iconName: 'external'
                      },
                      {
                        text: t('adminSessions.actions.entryInfoCsv'),
                        id: 'download-csv',
                        iconName: 'download'
                      },
                      ...(item.status === 'active' ? [{
                        text: t('adminSessions.actions.inactivate'),
                        id: 'inactivate', 
                      }] : []),
                      ...(item.status === 'inactive' ? [{
                        text: t('adminSessions.actions.delete'),
                        id: 'delete'
                      }] : [])
                    ]}
                    onItemClick={({ detail }) => {
                      switch (detail.id) {
                        case 'view':
                          navigate(`/admin/sessions/${item.sessionId}`)
                          break
                        case 'inactivate':
                          handleInactivate(item.sessionId)
                          break
                        case 'delete':
                          handleDelete(item.sessionId)
                          break
                        case 'download-csv':
                          handleDownloadCSV(item)
                          break
                      }
                    }}
                  >
                    {t('adminSessions.actions.actionsLabel')}
                  </ButtonDropdown>
                )
              }
            ]}
            items={sortedSessions}
            loading={loading}
            sortingColumn={sortingColumn}
            sortingDescending={sortingDescending}
            onSortingChange={({ detail }) => {
              setSortingColumn(detail.sortingColumn)
              setSortingDescending(detail.isDescending || false)
            }}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('adminSessions.table.noSessions')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('adminSessions.table.noSessionsFound')}
                </Box>
                <Button onClick={() => navigate('/admin/sessions/create')}>
                  {t('adminSessions.header.addSessionButton')}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}