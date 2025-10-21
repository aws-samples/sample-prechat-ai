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

export default function CreateAgent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    agentName: '',
    foundationModel: '',
<<<<<<< HEAD
    instruction: defaultPrompt
=======
    instruction: defaultPrompt,
    memoryStorageDays: 30
>>>>>>> dev
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
      setSuccess(`Agent "${formData.agentName}" created successfully!`)
      setTimeout(() => navigate('/admin/agents'), 3000)
    } catch (err) {
      setError('Failed to 에이전트 생성')
    } finally {
      setLoading(false)
    }
  }

<<<<<<< HEAD
  const updateFormData = (field: string, value: string) => {
=======
  const updateFormData = (field: string, value: string | number) => {
>>>>>>> dev
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
              대시보드로
            </Button>
          }
        >
          새로운 PreChat Agent 를 등록합니다 🤖
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

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
                disabled={!formData.agentName || !formData.foundationModel || !formData.instruction}
              >
                에이전트 생성
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField 
              label="에이전트 이름" 
              description="에이전트 이름"
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) => updateFormData('agentName', detail.value)}
                placeholder="Enter 에이전트 이름"
              />
            </FormField>

            <FormField 
              label="Foundation Model" 
              description="에이전트의 기반 Foundation Model"
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
<<<<<<< HEAD
=======
              label="Memory Storage Days" 
              description="에이전트가 대화 맥락을 기억할 기간 (일 단위, 1-365일)"
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
>>>>>>> dev
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