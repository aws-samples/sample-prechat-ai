// nosemgrep
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  Form,
  FormField,
  Input,
  Button,
  SpaceBetween,
  Alert,
  Select,
  Box,
  Table
} from '@cloudscape-design/components'
import { adminApi, campaignApi } from '../../services/api'
import { authService } from '../../services/auth'
import { StatusBadge } from '../../components'
import { extractModelName } from '../../constants'
import { generateSessionCSV, downloadCSV, generateCSVFilename } from '../../utils/csvExport'
import type { Campaign, AgentConfiguration } from '../../types'
import { useI18n } from '../../i18n'

export default function CreateSession() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [agentConfigs, setAgentConfigs] = useState<AgentConfiguration[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    customerTitle: '',
    salesRepEmail: '',
    agentId: '',
    pinNumber: '',
    campaignId: ''
  })
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    loadCurrentUser()
    loadCampaigns()
    loadAgentConfigs()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setFormData(prev => ({ ...prev, salesRepEmail: user.email }))
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError(t('adminSessionCreate.alert.failedLoadUser'))
    } finally {
      setLoadingUser(false)
    }
  }

  const loadAgentConfigs = async (campaignId?: string) => {
    try {
      setLoadingAgents(true)
      // campaignId 없이 호출하면 전체 에이전트 목록 반환
      const response = await adminApi.listAgentConfigs(campaignId)
      const configs = (response.configs || []).filter(
        (c: AgentConfiguration) => c.agentRole === 'prechat' && c.status === 'active'
      )
      setAgentConfigs(configs)
      // 단일 에이전트만 있을 경우 자동 선택
      if (configs.length === 1) {
        setFormData(prev => ({ ...prev, agentId: configs[0].configId }))
      }
    } catch (err) {
      console.error('Failed to load agent configs:', err)
    } finally {
      setLoadingAgents(false)
    }
  }

  const loadCampaigns = async () => {
    try {
      const response = await campaignApi.listCampaigns()
      setCampaigns(response.campaigns || [])
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    } finally {
      setLoadingCampaigns(false)
    }
  }

  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString()
    setFormData(prev => ({ ...prev, pinNumber: pin }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await adminApi.createSession(formData)
      
      // Associate session with campaign if selected
      if (formData.campaignId) {
        try {
          await campaignApi.associateSessionWithCampaign(response.sessionId, formData.campaignId)
        } catch (campaignErr) {
          console.error('Failed to associate session with campaign:', campaignErr)
          // Continue with session creation even if campaign association fails
        }
      }
      
      const fullUrl = `${window.location.origin}/customer/${response.sessionId}`
      setSuccess(t('adminSessionCreate.alert.sessionCreatedSuccess', { url: fullUrl, pin: formData.pinNumber }))
      
      // CSV 파일 생성 및 다운로드
      generateAndDownloadCSV(fullUrl)
      
      setTimeout(() => navigate('/admin'), 3000)
    } catch (err) {
      setError(t('adminSessionCreate.alert.failedCreateSession'))
    } finally {
      setLoading(false)
    }
  }

  const generateAndDownloadCSV = (chatUrl: string) => {
    const csvData = {
      customerCompany: formData.customerCompany || t('adminSessionCreate.csv.noInput'),
      customerName: formData.customerName,
      customerTitle: formData.customerTitle || t('adminSessionCreate.csv.noInput'),
      chatUrl: chatUrl,
      pinNumber: formData.pinNumber,
      createdAt: new Date().toLocaleString('ko-KR')
    }
    
    const csvContent = generateSessionCSV(csvData)
    const filename = generateCSVFilename(formData.customerCompany || 'Unknown')
    
    downloadCSV(csvContent, filename)
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin')}>
              {t('adminSessionCreate.header.backButton')}
            </Button>
          }
        >
          {t('adminSessionCreate.header.title')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {success && (
          <SpaceBetween size="m">
            <Box>
              <Box fontWeight="bold" fontSize="heading-s">{t('adminSessionCreate.successInfo.sectionTitle')}:</Box>
            </Box>
            <SpaceBetween size="s">
              <Box>
                <Box fontWeight="bold">{t('adminSessionCreate.successInfo.chatUrlLabel')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={success.split('URL: ')[1]?.split(' | PIN: ')[0] || ''}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="copy"
                  >
                    {t('adminSessionCreate.successInfo.copyUrlButton')}
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">{t('adminSessionCreate.successInfo.pinNumberLabel')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={formData.pinNumber}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(formData.pinNumber)}
                    iconName="copy"
                  >
                    {t('adminSessionCreate.successInfo.copyPinButton')}
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">{t('adminSessionCreate.successInfo.csvDownloadLabel')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Box fontSize="body-s" color="text-status-inactive">
                    {t('adminSessionCreate.successInfo.csvAutoDownloaded')}
                  </Box>
                  <Button
                    onClick={() => generateAndDownloadCSV(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="download"
                    variant="normal"
                  >
                    {t('adminSessionCreate.successInfo.downloadAgainButton')}
                  </Button>
                </SpaceBetween>
              </Box>
            </SpaceBetween>
          </SpaceBetween>
        )}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin')}>
                {t('adminSessionCreate.form.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.customerName || !formData.customerEmail || !formData.salesRepEmail || !formData.agentId || !formData.pinNumber}
              >
                {t('adminSessionCreate.form.submitButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('adminSessionCreate.form.customerNameLabel')}
              description={t('adminSessionCreate.form.customerNameDescription')}
              stretch>
              <Input
                value={formData.customerName}
                onChange={({ detail }) => updateFormData('customerName', detail.value)}
                placeholder={t('adminSessionCreate.form.customerNamePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.customerEmailLabel')}
              description={t('adminSessionCreate.form.customerEmailDescription')}
              stretch>
              <Input
                value={formData.customerEmail}
                onChange={({ detail }) => updateFormData('customerEmail', detail.value)}
                placeholder={t('adminSessionCreate.form.customerEmailPlaceholder')}
                type="email"
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.customerCompanyLabel')}
              description={t('adminSessionCreate.form.customerCompanyDescription')}
              stretch>
              <Input
                value={formData.customerCompany}
                onChange={({ detail }) => updateFormData('customerCompany', detail.value)}
                placeholder={t('adminSessionCreate.form.customerCompanyPlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.customerTitleLabel')}
              description={t('adminSessionCreate.form.customerTitleDescription')}
              stretch>
              <Input
                value={formData.customerTitle}
                onChange={({ detail }) => updateFormData('customerTitle', detail.value)}
                placeholder={t('adminSessionCreate.form.customerTitlePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.salesRepEmailLabel')}
              description={t('adminSessionCreate.form.salesRepEmailDescription')}
              stretch
            >
              <Input
                value={formData.salesRepEmail}
                onChange={({ detail }) => updateFormData('salesRepEmail', detail.value)}
                placeholder={loadingUser ? t('adminSessionCreate.form.salesRepEmailLoadingPlaceholder') : t('adminSessionCreate.form.salesRepEmailPlaceholder')}
                type="email"
                readOnly={true}
                disabled={true}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.agentLabel')}
              description={t('adminSessionCreate.form.agentDescription')}
              stretch
            >
              <Select
                selectedOption={
                  formData.agentId ?
                    { label: agentConfigs.find(c => c.configId === formData.agentId)?.agentName || '', value: formData.agentId } : null
                }
                onChange={({ detail }) =>
                  updateFormData('agentId', detail.selectedOption?.value || '')
                }
                options={agentConfigs.map(config => ({
                  label: config.agentName || `Consultation Agent (${config.configId.slice(0, 8)})`,
                  value: config.configId,
                  description: extractModelName(config.modelId)
                }))}
                placeholder={t('adminSessionCreate.form.agentPlaceholder')}
                empty={t('adminSessionCreate.form.agentEmpty')}
                statusType={loadingAgents ? 'loading' : 'finished'}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.campaignLabel')}
              description={t('adminSessionCreate.form.campaignDescription')}
              stretch
            >
              <Select
                selectedOption={
                  formData.campaignId ?
                    { label: campaigns.find(c => c.campaignId === formData.campaignId)?.campaignName || '', value: formData.campaignId } : null
                }
                onChange={({ detail }) => {
                  const campaignId = detail.selectedOption?.value || ''
                  updateFormData('campaignId', campaignId)
                  updateFormData('agentId', '')
                  // campaignId가 있으면 해당 캠페인 에이전트로 필터링, 없으면 전체 로드
                  loadAgentConfigs(campaignId || undefined)
                }}
                options={[
                  { label: t('adminSessionCreate.form.campaignNoCampaign'), value: '' },
                  ...campaigns
                    .filter(campaign => campaign.status === 'active')
                    .map(campaign => ({
                      label: campaign.campaignName,
                      value: campaign.campaignId
                    }))
                ]}
                placeholder={t('adminSessionCreate.form.campaignPlaceholder')}
                empty={t('adminSessionCreate.form.campaignEmpty')}
                loadingText={t('adminSessionCreate.form.campaignLoading')}
                statusType={loadingCampaigns ? 'loading' : 'finished'}
              />
            </FormField>

            <FormField
              label={t('adminSessionCreate.form.pinLabel')}
              description={t('adminSessionCreate.form.pinDescription')}
              stretch
            >
              <SpaceBetween direction="horizontal" size="xs">
                <Input
                  value={formData.pinNumber}
                  onChange={({ detail }) => updateFormData('pinNumber', detail.value)}
                  placeholder={t('adminSessionCreate.form.pinPlaceholder')}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
    
                />
                <Button
                  variant="normal"
                  onClick={() => setShowPin(!showPin)}
                  iconName={showPin ? "lock-private" : "security"}
                >
                  {showPin ? t('adminSessionCreate.form.pinHideButton') : t('adminSessionCreate.form.pinShowButton')}
                </Button>
                <Button
                  variant="normal"
                  onClick={generateRandomPin}
                  iconName="refresh"
                >
                  {t('adminSessionCreate.form.pinRandomButton')}
                </Button>
              </SpaceBetween>
            </FormField>


          </SpaceBetween>
        </Form>

        <Header variant="h2">{t('adminSessionCreate.agentTable.sectionTitle')}</Header>
        <div style={{ minHeight: '30vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: t('adminSessionCreate.agentTable.nameHeader'),
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.agentName || `Consultation Agent`}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.configId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'model',
                header: t('adminSessionCreate.agentTable.modelHeader'),
                cell: (item) => extractModelName(item.modelId)
              },
              {
                id: 'status',
                header: t('adminSessionCreate.agentTable.statusHeader'),
                cell: (item) => <StatusBadge status={item.status} type="session" />
              }
            ]}
            items={agentConfigs}
            loading={loadingAgents}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('adminSessionCreate.agentTable.noAgents')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {formData.campaignId ? t('adminSessionCreate.agentTable.noAgentsFoundWithCampaign') : t('adminSessionCreate.agentTable.noAgentsFound')}
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  {t('adminSessionCreate.agentTable.createAgentButton')}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}