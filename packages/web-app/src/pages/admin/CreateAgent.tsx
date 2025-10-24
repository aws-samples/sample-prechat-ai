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
  Textarea
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'
import { PlaceholderTooltip } from '../../components'
import defaultPrompt from '../../assets/prechat-agent-prompt.md?raw'
import { useI18n } from '../../i18n'

export default function CreateAgent() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    agentName: '',
    foundationModel: '',
    instruction: defaultPrompt,
    memoryStorageDays: 30
  })

  useEffect(() => {
    // Set default instruction from the imported markdown file
    setFormData(prev => ({ ...prev, instruction: defaultPrompt }))
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await adminApi.createAgent(formData)
      setSuccess(t('agents_created_success', { name: formData.agentName }))
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError(t('agents_failed_create'))
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
              {t('admin_to_dashboard')}
            </Button>
          }
        >
          {t('agents_create_new_agent')}
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
                disabled={!formData.agentName || !formData.foundationModel || !formData.instruction}
              >
                {t('admin_create_agent')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField 
              label={t('admin_agent_name')} 
              description={t('agents_agent_name_description')}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder={t('agents_enter_agent_name')}
              />
            </FormField>

            <FormField 
              label={t('foundation_model')} 
              description={t('agents_foundation_model_description')}
              stretch
            >
              <Select
                selectedOption={
                  formData.foundationModel ? 
                  modelOptions.find(opt => opt.value === formData.foundationModel) || null : null
                }
                onChange={({ detail }) => 
                  updateFormData('foundationModel', detail.selectedOption?.value || '')
                }
                options={modelOptions}
                placeholder={t('select_a_foundation_model')}
              />
            </FormField>

            <FormField 
              label={t('memory_storage_days')} 
              description={t('admin_memory_storage_description')}
              stretch
            >
              <Input
                type="number"
                value={formData.memoryStorageDays.toString()}
                onChange={({ detail }) => {
                  const days = parseInt(detail.value) || 30
                  if (days >= 1 && days <= 365) {
                    updateFormData('memoryStorageDays', days)
                  }
                }}
                placeholder="30"
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
                  onClick={() => updateFormData('instruction', defaultPrompt)}
                >
                  {t('admin_default_agent_instructions')}
                </Button>
              }
            >
              <Textarea
                value={formData.instruction}
                onChange={({ detail }) => updateFormData('instruction', detail.value)}
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