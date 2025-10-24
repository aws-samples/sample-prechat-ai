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
  Textarea,
  DatePicker
} from '@cloudscape-design/components'
import { useI18n } from '../../i18n'
import { authService } from '../../services/auth'
import type { CreateCampaignRequest } from '../../types'

// Mock API function - will be replaced with actual API call
const mockCampaignApi = {
  createCampaign: async (data: CreateCampaignRequest) => {
    // Mock implementation
    console.log('Creating campaign:', data)
    return { campaignId: 'camp-' + Date.now() }
  }
}

// Mock Cognito users - will be replaced with actual Cognito API call
const mockCognitoUsers = [
  { userId: 'user-001', email: 'john.doe@company.com', name: 'John Doe' },
  { userId: 'user-002', email: 'jane.smith@company.com', name: 'Jane Smith' },
  { userId: 'user-003', email: 'bob.wilson@company.com', name: 'Bob Wilson' }
]

export default function CreateCampaign() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [, setCurrentUserEmail] = useState('')
  const [formData, setFormData] = useState({
    campaignName: '',
    campaignCode: '',
    description: '',
    startDate: '',
    endDate: '',
    ownerId: '',
    ownerEmail: '',
    ownerName: ''
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setCurrentUserEmail(user.email)
      // Auto-select current user as default owner
      const currentUser = mockCognitoUsers.find(u => u.email === user.email)
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          ownerId: currentUser.userId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name
        }))
      }
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError('Failed to load current user. Please login again.')
    } finally {
      setLoadingUser(false)
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
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await mockCampaignApi.createCampaign(formData)
      setSuccess(t('campaign_created_successfully'))
      setTimeout(() => navigate('/admin/campaigns'), 2000)
    } catch (err) {
      console.error('Failed to create campaign:', err)
      setError('Failed to create campaign. Please try again.')
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
          {t('campaign_form_title')}
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
                disabled={loadingUser}
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
                loadingText={loadingUser ? "Loading users..." : undefined}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}