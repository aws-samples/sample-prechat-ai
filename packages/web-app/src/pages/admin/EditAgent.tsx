// nosemgrep
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
  Spinner,
  Badge,
  Checkbox
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'
import { PlaceholderTooltip } from '../../components'
import consultationPrompt from '../../assets/prechat-agent-prompt.md?raw'
import analysisPrompt from '../../assets/summary-agent-prompt.md?raw'
import planningPrompt from '../../assets/planning-agent-prompt.md?raw'
import { useI18n } from '../../i18n'

const ROLE_LABELS: Record<string, string> = {
  prechat: 'Consultation Agent',
  summary: 'Summary Agent',
  planning: 'Planning Agent'
}

const DEFAULT_PROMPTS: Record<string, string> = {
  prechat: consultationPrompt,
  summary: analysisPrompt,
  planning: planningPrompt,
}

const READONLY_ROLES = ['summary', 'planning']

export default function EditAgent() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { agentId: configId } = useParams<{ agentId: string }>()
  const [loading, setLoading] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [overridePrompt, setOverridePrompt] = useState(false)
  const [agentRole, setAgentRole] = useState('')
  const isReadOnlyRole = READONLY_ROLES.includes(agentRole)
  const [formData, setFormData] = useState({
    agentName: '',
    modelId: '',
    systemPrompt: ''
  })

  useEffect(() => {
    if (configId) {
      loadConfig()
    }
  }, [configId])

  const loadConfig = async () => {
    if (!configId) return

    try {
      setLoadingConfig(true)
      const config = await adminApi.getAgentConfig(configId)
      setFormData({
        agentName: config.agentName,
        modelId: config.modelId,
        systemPrompt: config.systemPrompt
      })
      setAgentRole(config.agentRole)
    } catch (err) {
      setError(t('adminAgentEdit.alert.failedLoadAgent'))
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleSubmit = async () => {
    if (!configId) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await adminApi.updateAgentConfig(configId, {
        modelId: formData.modelId,
        systemPrompt: overridePrompt ? formData.systemPrompt : '',
        agentName: formData.agentName
      })
      setSuccess(t('adminAgentEdit.alert.updatedSuccess', { name: formData.agentName }))
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError(t('adminAgentEdit.alert.failedUpdateAgent'))
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const modelOptions = BEDROCK_MODELS.map(model => ({
    label: `${model.name} (${model.provider})`,
    value: model.id
  }))

  if (loadingConfig) {
    return (
      <Container>
        <SpaceBetween size="l">
          <Header variant="h1">{t('adminAgentEdit.loading.pageTitle')}</Header>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="large" />
            <div style={{ marginTop: '1rem' }}>{t('adminAgentEdit.loading.agentDetails')}</div>
          </div>
        </SpaceBetween>
      </Container>
    )
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin/agents')}>
              {t('adminAgentEdit.header.toDashboardButton')}
            </Button>
          }
        >
          {t('adminAgentEdit.header.title')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/agents')}>
                {t('adminAgentEdit.form.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.modelId}
              >
                {t('adminAgentEdit.form.updateAgentButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('adminAgentEdit.form.agentRoleLabel')}
              description={t('adminAgentEdit.form.agentRoleReadonlyDescription')}
              stretch
            >
              <Badge color={
                agentRole === 'prechat' ? 'blue' :
                agentRole === 'summary' ? 'green' : 'grey'
              }>
                {ROLE_LABELS[agentRole] || agentRole}
              </Badge>
            </FormField>

            <FormField
              label={t('adminAgentEdit.form.agentNameLabel')}
              description={t('adminAgentEdit.form.agentNameDescription')}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder={t('adminAgentEdit.form.agentNamePlaceholder')}
                disabled={isReadOnlyRole}
              />
            </FormField>

            {isReadOnlyRole && (
              <Alert type="info">
                {t('adminAgentEdit.form.readOnlyRoleInfo')}
              </Alert>
            )}

            <FormField
              label={t('adminAgentEdit.form.foundationModelLabel')}
              description={t('adminAgentEdit.form.foundationModelDescription')}
              stretch
            >
              <Select
                selectedOption={
                  formData.modelId
                    ? modelOptions.find(opt => opt.value === formData.modelId) || null
                    : null
                }
                onChange={({ detail }) =>
                  updateFormData('modelId', detail.selectedOption?.value || '')
                }
                options={modelOptions}
                placeholder={t('adminAgentEdit.form.foundationModelPlaceholder')}
              />
            </FormField>

            {!isReadOnlyRole && (
              <>
                <FormField
                  label={t('adminAgentEdit.form.promptOverrideLabel')}
                  description={t('adminAgentEdit.form.promptOverrideDescription')}
                  stretch
                >
                  <Checkbox
                    checked={overridePrompt}
                    onChange={({ detail }) => setOverridePrompt(detail.checked)}
                  >
                    {t('adminAgentEdit.form.promptOverrideCheckbox')}
                  </Checkbox>
                </FormField>

                {overridePrompt && (
                  <FormField
                    label={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{t('adminAgentEdit.form.agentInstructionsLabel')}</span>
                        <PlaceholderTooltip />
                      </div>
                    }
                    description={t('adminAgentEdit.form.agentInstructionsDescription')}
                    stretch
                    secondaryControl={
                      <Button
                        variant="normal"
                        iconName="refresh"
                        onClick={() => updateFormData('systemPrompt', DEFAULT_PROMPTS[agentRole] || consultationPrompt)}
                      >
                        {t('adminAgentEdit.form.defaultInstructionsButton')}
                      </Button>
                    }
                  >
                    <Textarea
                      value={formData.systemPrompt}
                      onChange={({ detail }) => updateFormData('systemPrompt', detail.value)}
                      placeholder={t('adminAgentEdit.form.agentInstructionsPlaceholder')}
                      rows={15}
                    />
                  </FormField>
                )}
              </>
            )}
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}
