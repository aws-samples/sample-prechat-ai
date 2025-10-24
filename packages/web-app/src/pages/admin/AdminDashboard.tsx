// nosemgrep
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
  const { t } = useI18n()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showMySessionsOnly, setShowMySessionsOnly] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
  const [sortingColumn, setSortingColumn] = useState<any>({})
  const [sortingDescending, setSortingDescending] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<{ label: string; value: string } | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadSessions()
    loadCampaigns()
  }, [])

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
      customerCompany: session.customerCompany || t('admin_no_input'),
      customerName: session.customerName,
      customerTitle: session.customerTitle || t('admin_no_input'),
      chatUrl: `${window.location.origin}/customer/${session.sessionId}`,
      pinNumber: t('admin_pin_contact_sales', { email: session.salesRepEmail }),
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
          description={t('admin_dashboard_description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="normal"
                onClick={() => navigate('/admin/agents')}
              >
                {t('admin_prechat_agents')}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/admin/sessions/create')}
              >
                {t('admin_add_session')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('admin_prechat_sessions')}
        </Header>

        <SpaceBetween direction="horizontal" size="l">          
          <Box>
            <FormField
              label={t('campaign_association')}
            >
              <Select
                selectedOption={selectedCampaign}
                onChange={({ detail }) => setSelectedCampaign(detail.selectedOption as { label: string; value: string } | null)}
                options={[
                  { label: t('all_campaigns'), value: 'all' },
                  { label: t('no_campaign'), value: 'none' },
                  ...campaigns.map(campaign => ({
                    label: campaign.campaignName,
                    value: campaign.campaignId
                  }))
                ]}
                loadingText={t('loading_campaigns')}
                statusType={campaignsLoading ? 'loading' : 'finished'}
              />
            </FormField>
          </Box>
          <Box>
            <FormField
              label=""
              description={t('admin_show_my_sessions_only')}
            >
              <Toggle
                checked={showMySessionsOnly}
                onChange={({ detail }) => setShowMySessionsOnly(detail.checked)}
              />
            </FormField>
          </Box>
        </SpaceBetween>

        <div style={{ minHeight: '50vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'customer',
                header: t('admin_customer_company_contact'),
                sortingField: 'customer',
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.customerCompany}/{item.customerName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      {item.customerTitle && `${item.customerTitle} • `}{item.customerEmail}
                    </Box>
                    {item.consultationPurposes && (
                      <Box fontSize="body-s" color="text-status-info" margin={{ top: 'xxs' }}>
                        {t('admin_consultation_purpose')}: {formatPurposesForDisplay(item.consultationPurposes)}
                      </Box>
                    )}
                    {item.campaignName && (
                      <Box fontSize="body-s" color="text-status-success" margin={{ top: 'xxs' }}>
                        {t('campaign_association')}: {item.campaignName}
                      </Box>
                    )}
                  </Box>
                )
              },
              {
                id: 'campaign',
                header: t('campaign_association'),
                sortingField: 'campaign',
                cell: (item) => (
                  <Box fontSize="body-s">
                    {item.campaignName ? (
                      <Box color="text-status-success">{item.campaignName}</Box>
                    ) : (
                      <Box color="text-status-inactive">{t('no_campaign')}</Box>
                    )}
                  </Box>
                )
              },
              {
                id: 'agent',
                header: t('admin_conversation_agent'),
                sortingField: 'agent',
                cell: (item) => (
                  <Box fontSize="body-s" color="text-status-inactive">
                    {item.agentId ? `Agent: ${item.agentId}` : t('admin_no_agent_assigned')}
                  </Box>
                )
              },
              {
                id: 'status',
                header: t('admin_session_status'),
                sortingField: 'status',
                cell: (item) => <StatusBadge status={item.status} type="session" />
              },
              {
                id: 'created',
                header: t('admin_created_date'),
                sortingField: 'created',
                cell: (item) => new Date(item.createdAt).toLocaleDateString()
              },
              {
                id: 'completed',
                header: t('admin_completed_date'),
                sortingField: 'completed',
                cell: (item) => item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'
              },
              {
                id: 'actions',
                header: t('admin_actions'),
                cell: (item) => (
                  <ButtonDropdown
                    expandToViewport
                    items={[
                      {
                        text: t('admin_conversation_analysis'),
                        id: 'view',
                        iconName: 'external'
                      },
                      {
                        text: t('admin_entry_info_csv'),
                        id: 'download-csv',
                        iconName: 'download'
                      },
                      ...(item.status === 'active' ? [{
                        text: t('admin_inactivate'),
                        id: 'inactivate', 
                      }] : []),
                      ...(item.status === 'inactive' ? [{
                        text: t('admin_delete'),
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
                    {t('admin_actions')}
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
                  {t('admin_no_sessions')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('admin_no_sessions_found')}
                </Box>
                <Button onClick={() => navigate('/admin/sessions/create')}>
                  {t('admin_add_session')}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}