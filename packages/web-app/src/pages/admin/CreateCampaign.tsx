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
import { campaignApi, adminApi } from '../../services/api'
import type { CreateCampaignRequest, CognitoUser } from '../../types'

export default function CreateCampaign() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [cognitoUsers, setCognitoUsers] = useState<CognitoUser[]>([])
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
    loadCognitoUsers()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setCurrentUserEmail(user.email)
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError(t('adminCampaignCreate.alert.failedLoadUser'))
    } finally {
      setLoadingUser(false)
    }
  }

  const loadCognitoUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await adminApi.listCognitoUsers()
      setCognitoUsers(response.users || [])
      
      // Auto-select current user as default owner if available
      if (currentUserEmail) {
        const currentUser = response.users.find((u: CognitoUser) => u.email === currentUserEmail)
        if (currentUser) {
          setFormData(prev => ({
            ...prev,
            ownerId: currentUser.userId,
            ownerEmail: currentUser.email,
            ownerName: currentUser.name
          }))
        }
      }
    } catch (err) {
      console.error('Failed to load Cognito users:', err)
      setError(t('adminCampaignCreate.alert.failedLoadUsers'))
    } finally {
      setLoadingUsers(false)
    }
  }

  // Update auto-selection when current user email is loaded
  useEffect(() => {
    if (currentUserEmail && cognitoUsers.length > 0 && !formData.ownerId) {
      const currentUser = cognitoUsers.find(u => u.email === currentUserEmail)
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          ownerId: currentUser.userId,
          ownerEmail: currentUser.email,
          ownerName: currentUser.name
        }))
      }
    }
  }, [currentUserEmail, cognitoUsers, formData.ownerId])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.campaignName.trim()) {
      errors.campaignName = t('adminCampaignCreate.validation.campaignNameRequired')
    }

    if (!formData.campaignCode.trim()) {
      errors.campaignCode = t('adminCampaignCreate.validation.campaignCodeRequired')
    }

    if (!formData.description.trim()) {
      errors.description = t('adminCampaignCreate.validation.descriptionRequired')
    }

    if (!formData.startDate) {
      errors.startDate = t('adminCampaignCreate.validation.startDateRequired')
    }

    if (!formData.endDate) {
      errors.endDate = t('adminCampaignCreate.validation.endDateRequired')
    }

    if (!formData.ownerId) {
      errors.owner = t('adminCampaignCreate.validation.ownerRequired')
    }

    // Validate date range
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate)
      const endDate = new Date(formData.endDate)
      if (endDate <= startDate) {
        errors.endDate = t('adminCampaignCreate.validation.invalidDateRange')
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
      const campaignData: CreateCampaignRequest = {
        campaignName: formData.campaignName.trim(),
        campaignCode: formData.campaignCode.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        ownerId: formData.ownerId
      }

      const result = await campaignApi.createCampaign(campaignData)
      setSuccess(t('adminCampaignCreate.alert.createdSuccess'))
      
      // Navigate to campaign details or campaigns list after a short delay
      setTimeout(() => {
        if (result.campaignId) {
          navigate(`/admin/campaigns/${result.campaignId}`)
        } else {
          navigate('/admin/campaigns')
        }
      }, 2000)
    } catch (err: any) {
      console.error('Failed to create campaign:', err)
      
      // Handle specific error messages
      if (err.message?.includes('Campaign code already exists')) {
        setValidationErrors(prev => ({ ...prev, campaignCode: t('adminCampaignCreate.form.campaignCodeExistsError') }))
        setError(t('adminCampaignCreate.alert.campaignCodeExists'))
      } else if (err.message?.includes('Invalid owner ID')) {
        setValidationErrors(prev => ({ ...prev, owner: t('adminCampaignCreate.form.ownerInvalidError') }))
        setError(t('adminCampaignCreate.alert.invalidOwner'))
      } else {
        setError(err.message || t('adminCampaignCreate.alert.failedCreate'))
      }
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
    const selectedUser = cognitoUsers.find(u => u.userId === selectedOption?.value)
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
              {t('adminCampaignCreate.header.cancelButton')}
            </Button>
          }
        >
          {t('adminCampaignCreate.header.title')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/campaigns')}>
                {t('adminCampaignCreate.form.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={loadingUser || loadingUsers}
              >
                {t('adminCampaignCreate.form.saveButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('adminCampaignCreate.form.campaignNameLabel')}
              description={t('adminCampaignCreate.form.campaignNameDescription')}
              errorText={validationErrors.campaignName}
              stretch
            >
              <Input
                value={formData.campaignName}
                onChange={({ detail }) => updateFormData('campaignName', detail.value)}
                placeholder={t('adminCampaignCreate.form.campaignNamePlaceholder')}
                invalid={!!validationErrors.campaignName}
              />
            </FormField>

            <FormField
              label={t('adminCampaignCreate.form.campaignCodeLabel')}
              description={t('adminCampaignCreate.form.campaignCodeDescription')}
              errorText={validationErrors.campaignCode}
              stretch
            >
              <Input
                value={formData.campaignCode}
                onChange={({ detail }) => updateFormData('campaignCode', detail.value)}
                placeholder={t('adminCampaignCreate.form.campaignCodePlaceholder')}
                invalid={!!validationErrors.campaignCode}
              />
            </FormField>

            <FormField
              label={t('adminCampaignCreate.form.descriptionLabel')}
              description={t('adminCampaignCreate.form.descriptionDescription')}
              errorText={validationErrors.description}
              stretch
            >
              <Textarea
                value={formData.description}
                onChange={({ detail }) => updateFormData('description', detail.value)}
                placeholder={t('adminCampaignCreate.form.descriptionPlaceholder')}
                rows={4}
                invalid={!!validationErrors.description}
              />
            </FormField>

            <SpaceBetween direction="horizontal" size="s">
              <FormField
                label={t('adminCampaignCreate.form.startDateLabel')}
                description={t('adminCampaignCreate.form.startDateDescription')}
                errorText={validationErrors.startDate}
                stretch
              >
                <DatePicker
                  value={formData.startDate}
                  onChange={({ detail }) => updateFormData('startDate', detail.value)}
                  placeholder={t('adminCampaignCreate.form.datePlaceholder')}
                  invalid={!!validationErrors.startDate}
                />
              </FormField>

              <FormField
                label={t('adminCampaignCreate.form.endDateLabel')}
                description={t('adminCampaignCreate.form.endDateDescription')}
                errorText={validationErrors.endDate}
                stretch
              >
                <DatePicker
                  value={formData.endDate}
                  onChange={({ detail }) => updateFormData('endDate', detail.value)}
                  placeholder={t('adminCampaignCreate.form.datePlaceholder')}
                  invalid={!!validationErrors.endDate}
                />
              </FormField>
            </SpaceBetween>

            <FormField
              label={t('adminCampaignCreate.form.ownerLabel')}
              description={t('adminCampaignCreate.form.ownerDescription')}
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
                options={cognitoUsers
                  .filter(user => user.status === 'CONFIRMED' && user.enabled)
                  .map(user => ({
                    label: `${user.name} (${user.email})`,
                    value: user.userId,
                    description: `Status: ${user.status}`
                  }))}
                placeholder={t('adminCampaignCreate.form.ownerPlaceholder')}
                invalid={!!validationErrors.owner}
                loadingText={loadingUsers ? t('adminCampaignCreate.form.ownerLoadingText') : undefined}
                disabled={loadingUsers}
                empty={cognitoUsers.length === 0 ? t('adminCampaignCreate.form.ownerEmpty') : undefined}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}