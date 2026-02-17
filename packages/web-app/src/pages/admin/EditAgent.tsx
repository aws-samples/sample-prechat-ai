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
  Badge
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'
import { PlaceholderTooltip } from '../../components'
import consultationPrompt from '../../assets/prechat-agent-prompt.md?raw'
import analysisPrompt from '../../assets/analysis-agent-prompt.md?raw'
import planningPrompt from '../../assets/planning-agent-prompt.md?raw'
import { useI18n } from '../../i18n'

const ROLE_LABELS: Record<string, string> = {
  prechat: 'Consultation Agent',
  summary: 'Analysis Agent',
  planning: 'Planning Agent'
}

const DEFAULT_PROMPTS: Record<string, string> = {
  prechat: consultationPrompt,
  summary: analysisPrompt,
  planning: planningPrompt,
}

export default function EditAgent() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { agentId: configId } = useParams<{ agentId: string }>()
  const [loading, setLoading] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [agentRole, setAgentRole] = useState('')
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
      setError(t('admin_failed_load_agent'))
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
        systemPrompt: formData.systemPrompt,
        agentName: formData.agentName
      })
      setSuccess(t('admin_agent_updated_success', { name: formData.agentName }))
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError(t('admin_failed_update_agent'))
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
          <Header variant="h1">{t('admin_edit_prechat_agent')}</Header>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="large" />
            <div style={{ marginTop: '1rem' }}>{t('loading_agent_details')}</div>
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
              {t('admin_to_dashboard')}
            </Button>
          }
        >
          {t('admin_edit_prechat_agent')}
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/agents')}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.modelId || !formData.systemPrompt}
              >
                {t('admin_update_agent')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label={t('agent_role')}
              description={t('agent_role_readonly_description')}
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
              label={t('admin_agent_name')}
              description={t('agents_agent_name_description')}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder={t('enter_agent_name')}
              />
            </FormField>

            <FormField
              label={t('foundation_model')}
              description={t('admin_select_foundation_model')}
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
                placeholder={t('select_a_foundation_model')}
              />
            </FormField>

            <FormField
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('agent_instructions')}</span>
                  <PlaceholderTooltip />
                </div>
              }
              description={t('admin_agent_instructions_description')}
              stretch
              secondaryControl={
                <Button
                  variant="normal"
                  iconName="refresh"
                  onClick={() => updateFormData('systemPrompt', DEFAULT_PROMPTS[agentRole] || consultationPrompt)}
                >
                  {t('admin_default_agent_instructions')}
                </Button>
              }
            >
              <Textarea
                value={formData.systemPrompt}
                onChange={({ detail }) => updateFormData('systemPrompt', detail.value)}
                placeholder={t('enter_agent_instructions')}
                rows={15}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}
