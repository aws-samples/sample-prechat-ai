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
  Box,
  Table,
  Badge
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { authService } from '../../services/auth'
import type { BedrockAgent } from '../../types'

export default function CreateSession() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingUser, setLoadingUser] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [agents, setAgents] = useState<BedrockAgent[]>([])
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    customerTitle: '',
    salesRepEmail: '',
    agentId: ''
  })

  useEffect(() => {
    loadAgents()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await authService.verifyToken()
      setFormData(prev => ({ ...prev, salesRepEmail: user.email }))
    } catch (err) {
      console.error('Failed to load current user:', err)
      setError('Failed to load current user. Please login again.')
    } finally {
      setLoadingUser(false)
    }
  }

  const loadAgents = async () => {
    try {
      const response = await adminApi.listAgents()
      setAgents(response.agents || [])
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoadingAgents(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await adminApi.createSession(formData)
      const fullUrl = `${window.location.origin}/customer/${response.sessionId}`
      setSuccess(`Session created successfully! URL: ${fullUrl}`)
      setTimeout(() => navigate('/admin'), 3000)
    } catch (err) {
      setError('Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin')}>
              대시보드로
            </Button>
          }
        >
          새 상담 세션을 만듭니다 💬
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {success && (
          <SpaceBetween size="s" direction="horizontal">
            <Input
              value={success.split('URL: ')[1] || ''}
              readOnly
            />
            <Button
              onClick={() => navigator.clipboard.writeText(success.split('URL: ')[1] || '')}
            >
              Copy URL
            </Button>
          </SpaceBetween>
        )}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin')}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.customerName || !formData.customerEmail || !formData.salesRepEmail || !formData.agentId}
              >
                세션 추가
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label="Customer Name"
              description="고객 담당자 이름"
              stretch>
              <Input
                value={formData.customerName}
                onChange={({ detail }) => updateFormData('customerName', detail.value)}
                placeholder="Enter customer name"
              />
            </FormField>

            <FormField 
              label="Customer Email"
              description="고객 담당자 이메일"
              stretch>
              <Input
                value={formData.customerEmail}
                onChange={({ detail }) => updateFormData('customerEmail', detail.value)}
                placeholder="Enter customer email"
                type="email"
              />
            </FormField>

            <FormField 
              label="Customer Company" 
              description="고객사 이름"
              stretch>
              <Input
                value={formData.customerCompany}
                onChange={({ detail }) => updateFormData('customerCompany', detail.value)}
                placeholder="Enter customer company"
              />
            </FormField>

            <FormField 
              label="Customer Title"
              description="고객 직책"
              stretch>
              <Input
                value={formData.customerTitle}
                onChange={({ detail }) => updateFormData('customerTitle', detail.value)}
                placeholder="Enter customer title/position"
              />
            </FormField>

            <FormField 
              label="Sales Representative Email" 
              description="영업 담당자(자동 입력)"
              stretch
            >
              <Input
                value={formData.salesRepEmail}
                onChange={({ detail }) => updateFormData('salesRepEmail', detail.value)}
                placeholder={loadingUser ? "Loading current user..." : "Current user email"}
                type="email"
                readOnly={true}
                disabled={true}
              />
            </FormField>

            <FormField
              label="Select Agent"
              description="고객과 대화를 담당할 PreChat Agent 를 선택합니다."
              stretch
            >
              <Select
                selectedOption={
                  formData.agentId ?
                    { label: agents.find(a => a.agentId === formData.agentId)?.agentName || '', value: formData.agentId } : null
                }
                onChange={({ detail }) =>
                  updateFormData('agentId', detail.selectedOption?.value || '')
                }
                options={agents
                  .filter(agent => agent.agentStatus === 'PREPARED')
                  .map(agent => ({
                    label: agent.agentName,
                    value: agent.agentId
                  }))
                }
                placeholder="Select an agent"
                loading={loadingAgents}
                empty="No prepared agents available"
              />
            </FormField>


          </SpaceBetween>
        </Form>

        <Header variant="h2">사용 가능한 에이전트 🤖</Header>
        <Box minHeight="30vh">
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: '에이전트 이름',
                cell: (item) => (
                  <Box>
                    <Box fontWeight="bold">{item.agentName}</Box>
                    <Box fontSize="body-s" color="text-status-inactive">
                      ID: {item.agentId}
                    </Box>
                  </Box>
                )
              },
              {
                id: 'model',
                header: 'Foundation Model',
                cell: (item) => {
                  // Extract model name from ARN
                  const modelArn = item.foundationModel
                  if (modelArn.includes('claude-3-haiku')) return 'Claude 3 Haiku'
                  if (modelArn.includes('claude-3-sonnet')) return 'Claude 3 Sonnet'
                  if (modelArn.includes('claude-3-5-sonnet-20240620')) return 'Claude 3.5 Sonnet (June)'
                  if (modelArn.includes('claude-3-5-sonnet-20241022')) return 'Claude 3.5 Sonnet (Oct)'
                  if (modelArn.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet'
                  if (modelArn.includes('claude-sonnet-4')) return 'Claude Sonnet 4'
                  if (modelArn.includes('nova-micro')) return 'Nova Micro'
                  if (modelArn.includes('nova-lite')) return 'Nova Lite'
                  if (modelArn.includes('nova-pro')) return 'Nova Pro'
                  return 'Unknown Model'
                }
              },
              {
                id: 'status',
                header: '상태',
                cell: (item) => {
                  switch (item.agentStatus) {
                    case 'PREPARED':
                      return <Badge color="green">Prepared</Badge>
                    case 'PREPARING':
                      return <Badge color="blue">Preparing</Badge>
                    case 'NOT_PREPARED':
                      return <Badge color="grey">Not Prepared</Badge>
                    case 'CREATING':
                      return <Badge color="blue">Creating</Badge>
                    case 'UPDATING':
                      return <Badge color="blue">Updating</Badge>
                    case 'DELETING':
                      return <Badge color="red">Deleting</Badge>
                    case 'FAILED':
                      return <Badge color="red">Failed</Badge>
                    default:
                      return <Badge>{item.agentStatus}</Badge>
                  }
                }
              }
            ]}
            items={agents}
            loading={loadingAgents}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  No agents
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  No Bedrock agents found.
                </Box>
                <Button onClick={() => navigate('/admin/agents/create')}>
                  에이전트 생성
                </Button>
              </Box>
            }
          />
        </Box>
      </SpaceBetween>
    </Container>
  )
}