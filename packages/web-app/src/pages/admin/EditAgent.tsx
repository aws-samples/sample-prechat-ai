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
  Spinner
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'
import { PlaceholderTooltip } from '../../components'
import defaultPrompt from '../../assets/prechat-agent-prompt.md?raw'
import { useI18n } from '../../i18n'

export default function EditAgent() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { agentId } = useParams<{ agentId: string }>()
  const [loading, setLoading] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    agentName: '',
    foundationModel: '',
    instruction: '',
    memoryStorageDays: 30
  })
  const [agentStatus, setAgentStatus] = useState('')

  useEffect(() => {
    if (agentId) {
      loadAgent()
    }
  }, [agentId])

  const loadAgent = async () => {
    if (!agentId) return
    
    try {
      setLoadingAgent(true)
      const agent = await adminApi.getAgent(agentId)
      setFormData({
        agentName: agent.agentName,
        foundationModel: agent.foundationModel,
        instruction: agent.instruction,
        memoryStorageDays: agent.memoryStorageDays
      })
      setAgentStatus(agent.agentStatus)
    } catch (err) {
      setError(t('admin_failed_load_agent'))
    } finally {
      setLoadingAgent(false)
    }
  }

  const handleSubmit = async () => {
    if (!agentId) return
    
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await adminApi.updateAgent(agentId, {
        foundationModel: formData.foundationModel,
        instruction: formData.instruction,
        memoryStorageDays: formData.memoryStorageDays
      })
      setSuccess(t('admin_agent_updated_success', { name: formData.agentName }))
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError(t('admin_failed_update_agent'))
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

  if (loadingAgent) {
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
        
        {agentStatus === 'PREPARED' && (
          <Alert type="warning">
            {t('admin_agent_prepared_warning')}
          </Alert>
        )}

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
                disabled={!formData.foundationModel || !formData.instruction}
              >
                {t('admin_update_agent')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField 
              label={t('admin_agent_name')} 
              description={t('admin_agent_name_readonly')}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder={t('enter_agent_name')}
                disabled={true}
                readOnly={true}
              />
            </FormField>

            <FormField 
              label={t('foundation_model')} 
              description={t('admin_select_foundation_model')}
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