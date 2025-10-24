import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Textarea,
  DatePicker,
  Spinner
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'
import type { Campaign, UpdateCampaignRequest } from '../../types'

// Mock API functions - will be replaced with actual API calls
const mockCampaignApi = {
  getCampaign: async (_campaignId: string): Promise<Campaign> => {
    // Mock implementation
    return {
      campaignId: 'camp-001',
      campaignName: 'Q1 2025 Enterprise Migration',
      campaignCode: 'Q1-ENT-MIG',
      description: 'Enterprise customer migration campaign for Q1 2025',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      ownerId: 'user-001',
      ownerEmail: 'john.doe@company.com',
      ownerName: 'John Doe',
      status: 'active',
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
      sessionCount: 15,
      completedSessionCount: 8
    }
  },
  
  updateCampaign: async (campaignId: string, data: UpdateCampaignRequest) => {
    // Mock implementation
    console.log('Updating campaign:', campaignId, data)
    return { campaignId }
  }
}

// Mock Cognito users - will be replaced with actual Cognito API call
const mockCognitoUsers = [
  { userId: 'user-001', email: 'john.doe@company.com', name: 'John Doe' },
  { userId: 'user-002', email: 'jane.smith@company.com', name: 'Jane Smith' },
  { userId: 'user-003', email: 'bob.wilson@company.com', name: 'Bob Wilson' }
]

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' }
]

export default function EditCampaign() {
  const navigate = useNavigate()
  const { campaignId } = useParams<{ campaignId: string }>()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [loadingCampaign, setLoadingCampaign] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [formData, setFormData] = useState({
    campaignName: '',
    campaignCode: '',
    description: '',
    startDate: '',
    endDate: '',
    ownerId: '',
    ownerEmail: '',
    ownerName: '',
    status: 'active' as Campaign['status']
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (campaignId) {
      loadCampaign()
    }
  }, [campaignId])

  const loadCampaign = async () => {
    if (!campaignId) return

    try {
      setLoadingCampaign(true)
      const campaignData = await mockCampaignApi.getCampaign(campaignId)
      setCampaign(campaignData)
      setFormData({
        campaignName: campaignData.campaignName,
        campaignCode: campaignData.campaignCode,
        description: campaignData.description,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        ownerId: campaignData.ownerId,
        ownerEmail: campaignData.ownerEmail,
        ownerName: campaignData.ownerName,
        status: campaignData.status
      })
    } catch (err) {
      console.error('Failed to load campaign:', err)
      setError('Failed to load campaign details. Please try again.')
    } finally {
      setLoadingCampaign(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.campaignName.trim()) {
      errors.campaignName = t('campaign_name_required')
    }

    if (!formData.campaignCode.trim()) {
      errors.campaignCode = t('campaign_code_required')
    }

    if (!formData.description.trim()) {
      errors.description = t('campaign_description_required')
    }

    if (!formData.startDate) {
      errors.startDate = t('start_date_required')
    }

    if (!formData.endDate) {
      errors.endDate = t('end_date_required')
    }

    if (!formData.ownerId) {
      errors.owner = t('owner_required')
    }

    // Validate date range
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      if (endDate <= startDate) {
        errors.endDate = t('invalid_date_range')
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm() || !campaignId) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const updateData: UpdateCampaignRequest = {
        campaignName: formData.campaignName,
        campaignCode: formData.campaignCode,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        ownerId: formData.ownerId,
        ownerEmail: formData.ownerEmail,
        ownerName: formData.ownerName,
        status: formData.status
      }

      await mockCampaignApi.updateCampaign(campaignId, updateData)
      setSuccess(t('campaign_updated_successfully'))
      setTimeout(() => navigate('/admin/campaigns'), 2000)
    } catch (err) {
      console.error('Failed to update campaign:', err)
      setError('Failed to update campaign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleOwnerChange = (selectedOption: any) => {
    const selectedUser = mockCognitoUsers.find(u => u.userId === selectedOption?.value)
    if (selectedUser) {
      setFormData(prev => ({
        ...prev,
        ownerId: selectedUser.userId,
        ownerEmail: selectedUser.email,
        ownerName: selectedUser.name
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        ownerId: '',
        ownerEmail: '',
        ownerName: ''
      }))
    }
    // Clear validation error
    if (validationErrors.owner) {
      setValidationErrors(prev => ({ ...prev, owner: '' }))
    }
  }

  const handleStatusChange = (selectedOption: any) => {
    if (selectedOption?.value) {
      updateFormData('status', selectedOption.value)
    }
  }

  if (loadingCampaign) {
    return (
      <Container>
        <SpaceBetween size="l" alignItems="center">
          <Spinner size="large" />
          <div>Loading campaign details...</div>
        </SpaceBetween>
      </Container>
    )
  }

  if (!campaign) {
    return (
      <Container>
        <Alert type="error">Campaign not found</Alert>
      </Container>
    )
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin/campaigns')}>
              {t('cancel')}
            </Button>
          }
        >
          {t('edit_campaign_title')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/campaigns')}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
              >
                {t('save_campaign')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('campaign_name_label')}
              description="Enter a descriptive name for the campaign"
              errorText={validationErrors.campaignName}
              stretch
            >
              <Input
                value={formData.campaignName}
                onChange={({ detail }) => updateFormData('campaignName', detail.value)}
                placeholder="e.g., Q1 2025 Enterprise Migration"
                invalid={!!validationErrors.campaignName}
              />
            </FormField>

            <FormField
              label={t('campaign_code_label')}
              description="Enter a unique code for the campaign"
              errorText={validationErrors.campaignCode}
              stretch
            >
              <Input
                value={formData.campaignCode}
                onChange={({ detail }) => updateFormData('campaignCode', detail.value)}
                placeholder="e.g., Q1-ENT-MIG"
                invalid={!!validationErrors.campaignCode}
              />
            </FormField>

            <FormField
              label={t('campaign_description_label')}
              description="Provide a detailed description of the campaign"
              errorText={validationErrors.description}
              stretch
            >
              <Textarea
                value={formData.description}
                onChange={({ detail }) => updateFormData('description', detail.value)}
                placeholder="Describe the campaign objectives, target audience, and key goals..."
                rows={4}
                invalid={!!validationErrors.description}
              />
            </FormField>

            <SpaceBetween direction="horizontal" size="s">
              <FormField
                label={t('start_date_label')}
                description="Campaign start date"
                errorText={validationErrors.startDate}
                stretch
              >
                <DatePicker
                  value={formData.startDate}
                  onChange={({ detail }) => updateFormData('startDate', detail.value)}
                  placeholder="YYYY-MM-DD"
                  invalid={!!validationErrors.startDate}
                />
              </FormField>

              <FormField
                label={t('end_date_label')}
                description="Campaign end date"
                errorText={validationErrors.endDate}
                stretch
              >
                <DatePicker
                  value={formData.endDate}
                  onChange={({ detail }) => updateFormData('endDate', detail.value)}
                  placeholder="YYYY-MM-DD"
                  invalid={!!validationErrors.endDate}
                />
              </FormField>
            </SpaceBetween>

            <FormField
              label={t('campaign_owner_label')}
              description="Select the campaign owner from Cognito users"
              errorText={validationErrors.owner}
              stretch
            >
              <Select
                selectedOption={
                  formData.ownerId
                    ? {
                        label: `${formData.ownerName} (${formData.ownerEmail})`,
                        value: formData.ownerId
                      }
                    : null
                }
                onChange={({ detail }) => handleOwnerChange(detail.selectedOption)}
                options={mockCognitoUsers.map(user => ({
                  label: `${user.name} (${user.email})`,
                  value: user.userId
                }))}
                placeholder="Select campaign owner..."
                invalid={!!validationErrors.owner}
              />
            </FormField>

            <FormField
              label={t('campaign_status_label')}
              description="Select the current status of the campaign"
              stretch
            >
              <Select
                selectedOption={
                  statusOptions.find(option => option.value === formData.status) || null
                }
                onChange={({ detail }) => handleStatusChange(detail.selectedOption)}
                options={statusOptions}
                placeholder="Select status..."
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}