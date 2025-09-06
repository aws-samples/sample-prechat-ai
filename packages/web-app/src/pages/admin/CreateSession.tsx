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
  Box,
  Table
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { authService } from '../../services/auth'
import { StatusBadge } from '../../components'
import { extractModelName } from '../../constants'
import { generateSessionCSV, downloadCSV, generateCSVFilename } from '../../utils/csvExport'
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
    agentId: '',
    pinNumber: ''
  })
  const [showPin, setShowPin] = useState(false)

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

  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString()
    setFormData(prev => ({ ...prev, pinNumber: pin }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await adminApi.createSession(formData)
      const fullUrl = `${window.location.origin}/customer/${response.sessionId}`
      setSuccess(`Session created successfully! URL: ${fullUrl} | PIN: ${formData.pinNumber}`)
      
      // CSV 파일 생성 및 다운로드
      generateAndDownloadCSV(fullUrl)
      
      setTimeout(() => navigate('/admin'), 3000)
    } catch (err) {
      setError('Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  const generateAndDownloadCSV = (chatUrl: string) => {
    const csvData = {
      customerCompany: formData.customerCompany || '미입력',
      customerName: formData.customerName,
      customerTitle: formData.customerTitle || '미입력',
      chatUrl: chatUrl,
      pinNumber: formData.pinNumber,
      createdAt: new Date().toLocaleString('ko-KR')
    }
    
    const csvContent = generateSessionCSV(csvData)
    const filename = generateCSVFilename(formData.customerCompany || 'Unknown')
    
    downloadCSV(csvContent, filename)
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
          <SpaceBetween size="m">
            <Box>
              <Box fontWeight="bold" fontSize="heading-s">고객에게 전달할 정보:</Box>
            </Box>
            <SpaceBetween size="s">
              <Box>
                <Box fontWeight="bold">채팅 URL:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={success.split('URL: ')[1]?.split(' | PIN: ')[0] || ''}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="copy"
                  >
                    Copy URL
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">PIN 번호:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={formData.pinNumber}
                    readOnly
                  />
                  <Button
                    onClick={() => navigator.clipboard.writeText(formData.pinNumber)}
                    iconName="copy"
                  >
                    Copy PIN
                  </Button>
                </SpaceBetween>
              </Box>
              <Box>
                <Box fontWeight="bold">CSV 파일 다운로드:</Box>
                <SpaceBetween size="xs" direction="horizontal">
                  <Box fontSize="body-s" color="text-status-inactive">
                    CSV 파일이 자동으로 다운로드되었습니다.
                  </Box>
                  <Button
                    onClick={() => generateAndDownloadCSV(success.split('URL: ')[1]?.split(' | PIN: ')[0] || '')}
                    iconName="download"
                    variant="normal"
                  >
                    다시 다운로드
                  </Button>
                </SpaceBetween>
              </Box>
            </SpaceBetween>
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
                disabled={!formData.customerName || !formData.customerEmail || !formData.salesRepEmail || !formData.agentId || !formData.pinNumber}
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
                empty="No prepared agents available"
              />
            </FormField>

            <FormField
              label="6자리 PIN 번호"
              description="고객이 채팅에 접속할 때 사용할 PIN 번호입니다."
              stretch
            >
              <SpaceBetween direction="horizontal" size="xs">
                <Input
                  value={formData.pinNumber}
                  onChange={({ detail }) => updateFormData('pinNumber', detail.value)}
                  placeholder="6자리 숫자 입력"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
    
                />
                <Button
                  variant="normal"
                  onClick={() => setShowPin(!showPin)}
                  iconName={showPin ? "lock-private" : "security"}
                >
                  {showPin ? "숨기기" : "보기"}
                </Button>
                <Button
                  variant="normal"
                  onClick={generateRandomPin}
                  iconName="refresh"
                >
                  랜덤 생성
                </Button>
              </SpaceBetween>
            </FormField>


          </SpaceBetween>
        </Form>

        <Header variant="h2">사용 가능한 에이전트 🤖</Header>
        <div style={{ minHeight: '30vh' }}>
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
                cell: (item) => extractModelName(item.foundationModel)
              },
              {
                id: 'status',
                header: '상태',
                cell: (item) => <StatusBadge status={item.agentStatus} type="agent" />
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
        </div>
      </SpaceBetween>
    </Container>
  )
}