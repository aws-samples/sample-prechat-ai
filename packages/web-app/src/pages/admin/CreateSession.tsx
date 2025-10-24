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
import { adminApi } from '../../services/api'
import { authService } from '../../services/auth'
import { StatusBadge } from '../../components'
import { extractModelName } from '../../constants'
import { generateSessionCSV, downloadCSV, generateCSVFilename } from '../../utils/csvExport'
import type { BedrockAgent } from '../../types'
import { useI18n } from '../../i18n'

export default function CreateSession() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingUser, setLoadingUser] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [agents, setAgents] = useState<BedrockAgent[]>([])
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    customerTitle: '',
    salesRepEmail: '',
    agentId: '',
    pinNumber: ''
  })
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    loadAgents()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setFormData(prev => ({ ...prev, salesRepEmail: user.email }))
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError(t('admin_failed_load_user'))
    } finally {
      setLoadingUser(false)
    }
  }

  const loadAgents = async () => {
    try {
      const response = await adminApi.listAgents()
      setAgents(response.agents || [])
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoadingAgents(false)
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
      const fullUrl = `${window.location.origin}/customer/${response.sessionId}`
      setSuccess(t('admin_session_created_success', { url: fullUrl, pin: formData.pinNumber }))
      
      // CSV 파일 생성 및 다운로드
      generateAndDownloadCSV(fullUrl)
      
      setTimeout(() => navigate('/admin'), 3000)
    } catch (err) {
      setError(t('admin_failed_create_session'))
    } finally {
      setLoading(false)
    }
  }

  const generateAndDownloadCSV = (chatUrl: string) => {
    const csvData = {
      customerCompany: formData.customerCompany || t('admin_no_input'),
      customerName: formData.customerName,
      customerTitle: formData.customerTitle || t('admin_no_input'),
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
              {t('admin_to_dashboard')}
            </Button>
          }
        >
          {t('admin_create_new_session')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {success && (
          <SpaceBetween size="m">
            <Box>
              <Box fontWeight="bold" fontSize="heading-s">{t('admin_customer_info_to_share')}:</Box>
            </Box>
            <SpaceBetween size="s">
              <Box>
                <Box fontWeight="bold">{t('admin_chat_url')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={success.split('URL: ')[1]?.split(' | PIN: ')[0] || ''}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="copy"
                  >
                    {t('admin_copy_url')}
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">{t('admin_pin_number')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={formData.pinNumber}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(formData.pinNumber)}
                    iconName="copy"
                  >
                    {t('admin_copy_pin')}
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">{t('admin_csv_download')}:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Box fontSize="body-s" color="text-status-inactive">
                    {t('admin_csv_auto_downloaded')}
                  </Box>
                  <Button
                    onClick={() => generateAndDownloadCSV(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="download"
                    variant="normal"
                  >
                    {t('admin_download_again')}
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
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.customerName || !formData.customerEmail || !formData.salesRepEmail || !formData.agentId || !formData.pinNumber}
              >
                {t('admin_add_session')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('customer_name')}
              description={t('admin_customer_contact_name')}
              stretch>
              <Input
                value={formData.customerName}
                onChange={({ detail }) => updateFormData('customerName', detail.value)}
                placeholder={t('enter_customer_name')}
              />
            </FormField>

            <FormField
              label={t('customer_email')}
              description={t('admin_customer_contact_email')}
              stretch>
              <Input
                value={formData.customerEmail}
                onChange={({ detail }) => updateFormData('customerEmail', detail.value)}
                placeholder={t('enter_customer_email')}
                type="email"
              />
            </FormField>

            <FormField
              label={t('customer_company')}
              description={t('admin_customer_company_name')}
              stretch>
              <Input
                value={formData.customerCompany}
                onChange={({ detail }) => updateFormData('customerCompany', detail.value)}
                placeholder={t('enter_customer_company')}
              />
            </FormField>

            <FormField
              label={t('customer_title')}
              description={t('admin_customer_position')}
              stretch>
              <Input
                value={formData.customerTitle}
                onChange={({ detail }) => updateFormData('customerTitle', detail.value)}
                placeholder={t('enter_customer_title')}
              />
            </FormField>

            <FormField
              label={t('sales_representative_email')}
              description={t('admin_sales_rep_auto_filled')}
              stretch
            >
              <Input
                value={formData.salesRepEmail}
                onChange={({ detail }) => updateFormData('salesRepEmail', detail.value)}
                placeholder={loadingUser ? t('loading_current_user') : t('current_user_email')}
                type="email"
                readOnly={true}
                disabled={true}
              />
            </FormField>

            <FormField
              label={t('select_agent')}
              description={t('admin_select_prechat_agent')}
              stretch
            >
              <Select
                selectedOption={
                  formData.agentId ?
                    { label: agents.find(a => a.agentId === formData.agentId)?.agentName || '', value: formData.agentId } : null
                }
                onChange={({ detail }) =>
                  updateFormData('agentId', detail.selectedOption?.value || '')
                }
                options={agents
                  .filter(agent => agent.agentStatus === 'PREPARED')
                  .map(agent => ({
                    label: agent.agentName,
                    value: agent.agentId
                  }))
                }
                placeholder={t('select_an_agent')}
                empty={t('admin_no_prepared_agents')}
              />
            </FormField>

            <FormField
              label={t('admin_six_digit_pin')}
              description={t('admin_pin_description')}
              stretch
            >
              <SpaceBetween direction="horizontal" size="xs">
                <Input
                  value={formData.pinNumber}
                  onChange={({ detail }) => updateFormData('pinNumber', detail.value)}
                  placeholder={t('admin_enter_six_digits')}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
    
                />
                <Button
                  variant="normal"
                  onClick={() => setShowPin(!showPin)}
                  iconName={showPin ? "lock-private" : "security"}
                >
                  {showPin ? t('admin_hide') : t('admin_show')}
                </Button>
                <Button
                  variant="normal"
                  onClick={generateRandomPin}
                  iconName="refresh"
                >
                  {t('admin_random_generate')}
                </Button>
              </SpaceBetween>
            </FormField>


          </SpaceBetween>
        </Form>

        <Header variant="h2">{t('admin_available_agents')}</Header>
        <div style={{ minHeight: '30vh' }}>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: t('admin_agent_name'),
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.agentName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.agentId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'model',
                header: t('foundation_model'),
                cell: (item) => extractModelName(item.foundationModel)
              },
              {
                id: 'status',
                header: t('status'),
                cell: (item) => <StatusBadge status={item.agentStatus} type="agent" />
              }
            ]}
            items={agents}
            loading={loadingAgents}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('no_agents')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('no_bedrock_agents_found')}
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  {t('admin_create_agent')}
                </Button>
              </Box>
            }
          />
        </div>
      </SpaceBetween>
    </Container>
  )
}