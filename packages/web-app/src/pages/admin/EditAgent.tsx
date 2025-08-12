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

export default function EditAgent() {
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const [loading, setLoading] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    agentName: '',
    foundationModel: '',
    instruction: ''
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
        instruction: agent.instruction
      })
      setAgentStatus(agent.agentStatus)
    } catch (err) {
      setError('Failed to load agent details')
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
        instruction: formData.instruction
      })
      setSuccess(`Agent "${formData.agentName}" updated successfully!`)
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError('Failed to update agent')
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

  if (loadingAgent) {
    return (
      <Container>
        <SpaceBetween size="l">
          <Header variant="h1">PreChat 에이전트를 수정합니다 🤖</Header>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="large" />
            <div style={{ marginTop: '1rem' }}>Loading agent details...</div>
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
              대시보드로
            </Button>
          }
        >
          PreChat 에이전트를 수정합니다 🤖
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}
        
        {agentStatus === 'PREPARED' && (
          <Alert type="warning">
            This agent is currently prepared and deployed. Updating it will require re-preparing the agent after changes are saved.
          </Alert>
        )}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin/agents')}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.foundationModel || !formData.instruction}
              >
                에이전트 수정
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField 
              label="에이전트 이름" 
              description="에이전트 이름은 수정할 수 없습니다"
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder="Enter agent name"
                disabled={true}
                readOnly={true}
              />
            </FormField>

            <FormField 
              label="Foundation Model" 
              description="Foundation model 을 선택합니다"
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
                placeholder="Select a foundation model"
              />
            </FormField>

            <FormField 
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Agent Instructions</span>
                  <PlaceholderTooltip />
                </div>
              }
              description="에이전트 행동에 대한 지침을 상세하게 작성합니다. 플레이스홀더를 사용하여 동적 정보를 포함할 수 있습니다."
              stretch
              secondaryControl={
                <Button
                  variant="normal"
                  iconName="refresh"
                  onClick={() => updateFormData('instruction', defaultPrompt)}
                >
                  기본 에이전트 지침
                </Button>
              }
            >
              <Textarea
                value={formData.instruction}
                onChange={({ detail }) => updateFormData('instruction', detail.value)}
                placeholder="Enter agent instructions..."
                rows={15}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}