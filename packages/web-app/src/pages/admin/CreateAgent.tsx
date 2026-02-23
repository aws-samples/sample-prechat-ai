// nosemgrep
import { useState } from 'react'
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
  Checkbox
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'
import { PlaceholderTooltip } from '../../components'
import consultationPrompt from '../../assets/prechat-agent-prompt.md?raw'
import analysisPrompt from '../../assets/analysis-agent-prompt.md?raw'
import planningPrompt from '../../assets/planning-agent-prompt.md?raw'
import { useI18n } from '../../i18n'

const AGENT_ROLES = [
  { value: 'prechat', label: 'Consultation Agent' },
  { value: 'summary', label: 'Analysis Agent' },
  { value: 'planning', label: 'Planning Agent' }
]

const DEFAULT_PROMPTS: Record<string, string> = {
  prechat: consultationPrompt,
  summary: analysisPrompt,
  planning: planningPrompt,
}

export default function CreateAgent() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [overridePrompt, setOverridePrompt] = useState(false)
  const [formData, setFormData] = useState({
    agentName: '',
    agentRole: '',
    modelId: 'global.amazon.nova-2-lite-v1:0',
    systemPrompt: consultationPrompt
  })

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await adminApi.createAgentConfig({
        agentRole: formData.agentRole,
        modelId: formData.modelId,
        systemPrompt: formData.systemPrompt,
        agentName: formData.agentName
      })
      setSuccess(t('adminAgentCreate.alert.createdSuccess', { name: formData.agentName }))
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError(t('adminAgentCreate.alert.failedCreate'))
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      // 역할 변경 시 해당 역할의 기본 프롬프트로 자동 전환
      if (field === 'agentRole' && DEFAULT_PROMPTS[value]) {
        updated.systemPrompt = DEFAULT_PROMPTS[value]
      }
      return updated
    })
  }

  const modelOptions = BEDROCK_MODELS.map(model => ({
    label: `${model.name} (${model.provider})`,
    value: model.id
  }))

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin/agents')}>
              {t('adminAgentCreate.header.toDashboardButton')}
            </Button>
          }
        >
          {t('adminAgentCreate.header.title')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/agents')}>
                {t('adminAgentCreate.form.cancelButton')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.agentName || !formData.agentRole || !formData.modelId}
              >
                {t('adminAgentCreate.form.createAgentButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('adminAgentCreate.form.agentNameLabel')}
              description={t('adminAgentCreate.form.agentNameDescription')}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder={t('adminAgentCreate.form.agentNamePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminAgentCreate.form.agentRoleLabel')}
              description={t('adminAgentCreate.form.agentRoleDescription')}
              stretch
            >
              <Select
                selectedOption={
                  formData.agentRole
                    ? AGENT_ROLES.find(r => r.value === formData.agentRole) || null
                    : null
                }
                onChange={({ detail }) =>
                  updateFormData('agentRole', detail.selectedOption?.value || '')
                }
                options={AGENT_ROLES}
                placeholder={t('adminAgentCreate.form.agentRolePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminAgentCreate.form.foundationModelLabel')}
              description={t('adminAgentCreate.form.foundationModelDescription')}
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
                placeholder={t('adminAgentCreate.form.foundationModelPlaceholder')}
              />
            </FormField>

            <FormField
              label={t('adminAgentCreate.form.promptOverrideLabel')}
              description={t('adminAgentCreate.form.promptOverrideDescription')}
              stretch
            >
              <Checkbox
                checked={overridePrompt}
                onChange={({ detail }) => setOverridePrompt(detail.checked)}
              >
                {t('adminAgentCreate.form.promptOverrideCheckbox')}
              </Checkbox>
            </FormField>

            {overridePrompt && (
              <FormField
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{t('adminAgentCreate.form.agentInstructionsLabel')}</span>
                    <PlaceholderTooltip />
                  </div>
                }
                description={t('adminAgentCreate.form.agentInstructionsDescription')}
                stretch
                secondaryControl={
                  <Button
                    variant="normal"
                    iconName="refresh"
                    onClick={() => updateFormData('systemPrompt', DEFAULT_PROMPTS[formData.agentRole] || consultationPrompt)}
                  >
                    {t('adminAgentCreate.form.defaultInstructionsButton')}
                  </Button>
                }
              >
                <Textarea
                  value={formData.systemPrompt}
                  onChange={({ detail }) => updateFormData('systemPrompt', detail.value)}
                  placeholder={t('adminAgentCreate.form.agentInstructionsPlaceholder')}
                  rows={15}
                />
              </FormField>
            )}
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}
