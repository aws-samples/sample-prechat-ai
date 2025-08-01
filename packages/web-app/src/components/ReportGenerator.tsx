import { useState, useEffect } from 'react'
import {
  SpaceBetween,
  Box,
  Header,
  Button,
  Checkbox,
  FormField,
  Select,
  Textarea,
  Alert,
  Container,
  ColumnLayout,
  Badge
} from '@cloudscape-design/components'
import Steps from '@cloudscape-design/components/steps'

import LoadingBar from '@cloudscape-design/chat-components/loading-bar'
import ReactMarkdown from 'react-markdown'
import { adminApi, chatApi } from '../services/api'
import { BEDROCK_MODELS, BedrockAgent, ReportAnalysisOptions, Session } from '../types'

interface ReportGeneratorProps {
  sessionId: string
}

type ReportStep = 1 | 2 | 3 | 4

export default function ReportGenerator({ sessionId }: ReportGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<ReportStep>(1)
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [analysisOptions, setAnalysisOptions] = useState<ReportAnalysisOptions>({
    coreRequirements: true, // 필수
    priorities: true, // 필수
    bant: false,
    awsServices: false,
    approachStrategy: false
  })

  // Step 2 - Model Selection & Prompt Generation
  const [selectedModel, setSelectedModel] = useState(BEDROCK_MODELS[0])
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [promptLoading, setPromptLoading] = useState(false)

  // Step 3 - Agent Selection & Custom Prompt
  const [agents, setAgents] = useState<BedrockAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<BedrockAgent | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [useAgent, setUseAgent] = useState(false)

  // Step 4 - Results
  const [reportContent, setReportContent] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    loadAgents()
    loadSessionData()
  }, [])

  const loadSessionData = async () => {
    try {
      const session = await chatApi.getSession(sessionId)
      setSessionData(session)
    } catch (err) {
      console.error('Failed to load session data:', err)
    }
  }

  const loadAgents = async () => {
    setAgentsLoading(true)
    try {
      const response = await adminApi.listAgents()
      setAgents(response.agents || [])
    } catch (err) {
      console.error('Failed to load agents:', err)
      setAgents([]) // 오류 시 빈 배열로 설정
    } finally {
      setAgentsLoading(false)
    }
  }

  const handleAnalysisOptionChange = (option: keyof ReportAnalysisOptions, checked: boolean) => {
    setAnalysisOptions(prev => ({
      ...prev,
      [option]: checked
    }))
  }

  const generateOptimizedPrompt = async () => {
    setPromptLoading(true)
    setReportError('')
    try {
      const response = await adminApi.generateOptimizedPrompt(sessionId, analysisOptions, selectedModel.id)
      setOptimizedPrompt(response.prompt)
      setCustomPrompt(response.prompt) // Pre-fill custom prompt
      setCurrentStep(3)
    } catch (err: any) {
      console.error('Failed to generate prompt:', err)
      setReportError(err.response?.data?.error || '프롬프트 생성에 실패했습니다.')
    } finally {
      setPromptLoading(false)
    }
  }

  const generateReport = async () => {
    setReportLoading(true)
    setReportError('')

    if (!sessionData) {
      setReportError('세션 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      setReportLoading(false)
      return
    }

    try {
      let response
      if (useAgent && selectedAgent) {
        response = await adminApi.generateReportWithAgent(
          sessionId, 
          selectedAgent.agentId, 
          customPrompt,
          sessionData.conversationHistory,
          sessionData.customerInfo
        )
      } else {
        response = await adminApi.generateReportWithModel(
          sessionId, 
          selectedModel.id, 
          customPrompt,
          sessionData.conversationHistory,
          sessionData.customerInfo
        )
      }

      setReportContent(response.content)
      setCurrentStep(4)
    } catch (err: any) {
      console.error('Failed to generate report:', err)
      setReportError(err.response?.data?.error || '리포트 생성에 실패했습니다.')
    } finally {
      setReportLoading(false)
    }
  }

  const regenerateReport = async () => {
    setReportContent('')
    await generateReport()
  }

  const renderStep1 = () => (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3">
          분석 항목 선택
        </Header>

        <Box>
          <FormField
            label="포함할 분석 항목을 선택하세요"
            description="핵심 요구사항과 우선순위는 필수 항목입니다."
          >
            <SpaceBetween size="s">
              <Checkbox
                checked={analysisOptions.coreRequirements}
                disabled={true}
                onChange={() => { }} // 필수 항목이므로 변경 불가
              >
                <Box>
                  <Box fontWeight="bold">핵심 요구사항</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    고객이 언급한 주요 비즈니스 요구사항과 기술적 니즈 (필수)
                  </Box>
                </Box>
              </Checkbox>

              <Checkbox
                checked={analysisOptions.priorities}
                disabled={true}
                onChange={() => { }} // 필수 항목이므로 변경 불가
              >
                <Box>
                  <Box fontWeight="bold">우선순위</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    고객이 중요하게 생각하는 항목들의 우선순위 분석 (필수)
                  </Box>
                </Box>
              </Checkbox>

              <Checkbox
                checked={analysisOptions.bant}
                onChange={({ detail }) => handleAnalysisOptionChange('bant', detail.checked)}
              >
                <Box>
                  <Box fontWeight="bold">BANT 분석</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    Budget, Authority, Need, Timeline 분석
                  </Box>
                </Box>
              </Checkbox>

              <Checkbox
                checked={analysisOptions.awsServices}
                onChange={({ detail }) => handleAnalysisOptionChange('awsServices', detail.checked)}
              >
                <Box>
                  <Box fontWeight="bold">추천 AWS 서비스</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    고객 요구사항에 적합한 AWS 서비스 추천
                  </Box>
                </Box>
              </Checkbox>

              <Checkbox
                checked={analysisOptions.approachStrategy}
                onChange={({ detail }) => handleAnalysisOptionChange('approachStrategy', detail.checked)}
              >
                <Box>
                  <Box fontWeight="bold">유사고객 접근 전략</Box>
                  <Box fontSize="body-s" color="text-status-inactive">
                    비슷한 고객 사례를 바탕으로 한 접근 전략 제안
                  </Box>
                </Box>
              </Checkbox>
            </SpaceBetween>
          </FormField>
        </Box>

        <Box float="right">
          <Button
            variant="primary"
            onClick={() => setCurrentStep(2)}
          >
            다음 단계
          </Button>
        </Box>
      </SpaceBetween>
    </Container>
  )

  const renderStep2 = () => (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3">
          모델 선택 및 프롬프트 최적화
        </Header>

        <ColumnLayout columns={2}>
          <FormField label="Bedrock 모델 선택">
            <Select
              selectedOption={{
                label: `${selectedModel.name} (${selectedModel.provider})`,
                value: selectedModel.id
              }}
              onChange={({ detail }) => {
                const model = BEDROCK_MODELS.find(m => m.id === detail.selectedOption.value)
                if (model) setSelectedModel(model)
              }}
              options={BEDROCK_MODELS.map(model => ({
                label: `${model.name} (${model.provider})`,
                value: model.id
              }))}
            />
          </FormField>

          <Box>
            <Box variant="awsui-key-label">선택된 분석 항목</Box>
            <SpaceBetween size="xs" direction="horizontal">
              {analysisOptions.coreRequirements && <Badge color="blue">핵심 요구사항</Badge>}
              {analysisOptions.priorities && <Badge color="blue">우선순위</Badge>}
              {analysisOptions.bant && <Badge color="green">BANT</Badge>}
              {analysisOptions.awsServices && <Badge color="green">AWS 서비스</Badge>}
              {analysisOptions.approachStrategy && <Badge color="green">접근 전략</Badge>}
            </SpaceBetween>
          </Box>
        </ColumnLayout>

        {reportError && (
          <Alert type="error">
            {reportError}
          </Alert>
        )}

        {promptLoading && (
          <Alert type="info">
            <LoadingBar variant="gen-ai" />
            선택된 모델({selectedModel.name})이 최적화된 프롬프트를 생성하고 있습니다...
          </Alert>
        )}

        {optimizedPrompt && (
          <FormField
            label="AI가 생성한 최적화된 프롬프트"
            description="선택된 분석 항목과 대화 내용을 바탕으로 AI가 생성한 프롬프트입니다."
          >
            <Box padding="s" style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <Box fontSize="body-s">
                <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {optimizedPrompt}
                </pre>
              </Box>
            </Box>
          </FormField>
        )}

        <SpaceBetween size="s" direction="horizontal">
          <Button
            variant="normal"
            onClick={() => setCurrentStep(1)}
          >
            이전 단계
          </Button>

          <Button
            variant="primary"
            onClick={generateOptimizedPrompt}
            loading={promptLoading}
            disabled={promptLoading}
          >
            {promptLoading ? 'AI가 프롬프트 생성 중...' : 'AI로 최적화된 프롬프트 생성'}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  )

  const renderStep3 = () => (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3">
          에이전트 선택 및 프롬프트 편집
        </Header>

        <FormField>
          <Checkbox
            checked={useAgent}
            onChange={({ detail }) => setUseAgent(detail.checked)}
          >
            PreChat 에이전트 사용하기
          </Checkbox>
        </FormField>

        {useAgent && (
          <FormField label="PreChat 에이전트 선택">
            {agentsLoading ? (
              <Box>에이전트 목록을 불러오는 중...</Box>
            ) : (
              <Select
                selectedOption={selectedAgent ? {
                  label: selectedAgent.agentName,
                  value: selectedAgent.agentId
                } : null}
                onChange={({ detail }) => {
                  const agent = agents.find(a => a.agentId === detail.selectedOption.value)
                  setSelectedAgent(agent || null)
                }}
                options={agents
                  .filter(agent => agent.agentStatus === 'PREPARED')
                  .map(agent => ({
                    label: `${agent.agentName} (${agent.foundationModel})`,
                    value: agent.agentId
                  }))}
                placeholder={agents.length === 0 ? "사용 가능한 에이전트가 없습니다" : "에이전트를 선택하세요"}
                disabled={agents.length === 0}
              />
            )}
          </FormField>
        )}

        <FormField
          label="프롬프트"
          description={optimizedPrompt ?
            "2단계에서 AI가 생성한 최적화된 프롬프트를 편집하거나 직접 작성하세요." :
            "리포트 생성을 위한 프롬프트를 직접 작성하세요. (2단계에서 AI 생성 프롬프트를 먼저 생성하는 것을 권장합니다)"
          }
        >
          <Textarea
            value={customPrompt}
            onChange={({ detail }) => setCustomPrompt(detail.value)}
            rows={12}
            placeholder={optimizedPrompt ?
              "AI가 생성한 프롬프트를 편집하거나 새로 작성하세요..." :
              "리포트 생성을 위한 프롬프트를 입력하세요..."
            }
          />
        </FormField>

        {!optimizedPrompt && (
          <Alert type="warning">
            2단계에서 AI가 생성한 최적화된 프롬프트를 사용하는 것을 권장합니다.
            이전 단계로 돌아가서 프롬프트를 생성해보세요.
          </Alert>
        )}

        <SpaceBetween size="s" direction="horizontal">
          <Button
            variant="normal"
            onClick={() => setCurrentStep(2)}
          >
            이전 단계
          </Button>

          <Button
            variant="primary"
            onClick={generateReport}
            loading={reportLoading}
            disabled={!customPrompt || (useAgent && !selectedAgent)}
          >
            리포트 생성
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  )

  const renderStep4 = () => (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h3"
          actions={
            <Button
              variant="normal"
              iconName="refresh"
              onClick={regenerateReport}
              loading={reportLoading}
            >
              재생성
            </Button>
          }
        >
          생성된 리포트
        </Header>

        {reportError && (
          <Alert type="error">
            {reportError}
          </Alert>
        )}

        {reportLoading ? (
          <LoadingBar variant="gen-ai" />
        ) : reportContent ? (
          <Box padding="l">
            <Box 
              style={{ 
                backgroundColor: '#ffffff', 
                border: '1px solid #e1e4e8', 
                borderRadius: '8px',
                padding: '24px',
                maxHeight: '600px',
                overflowY: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                lineHeight: '1.3'
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ lineHeight: '1.3', margin: '0 0 16px 0' }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ lineHeight: '1.3', margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ lineHeight: '1.3', margin: '20px 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ lineHeight: '1.3', margin: '16px 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>{children}</h3>,
                  h4: ({ children }) => <h4 style={{ lineHeight: '1.3', margin: '12px 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>{children}</h4>,
                  ul: ({ children }) => <ul style={{ lineHeight: '1.3', margin: '0 0 16px 0', paddingLeft: '20px' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ lineHeight: '1.3', margin: '0 0 16px 0', paddingLeft: '20px' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ lineHeight: '1.3', margin: '4px 0' }}>{children}</li>,
                  blockquote: ({ children }) => <blockquote style={{ lineHeight: '1.3', margin: '16px 0', paddingLeft: '16px', borderLeft: '4px solid #e1e4e8', fontStyle: 'italic' }}>{children}</blockquote>,
                  code: ({ children }) => <code style={{ backgroundColor: '#f6f8fa', padding: '2px 4px', borderRadius: '3px', fontSize: '14px' }}>{children}</code>,
                  pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: '16px', borderRadius: '6px', overflow: 'auto', margin: '16px 0' }}>{children}</pre>
                }}
              >
                {reportContent}
              </ReactMarkdown>
            </Box>
          </Box>
        ) : (
          <Alert type="info">
            리포트를 생성하려면 이전 단계에서 "리포트 생성" 버튼을 클릭하세요.
          </Alert>
        )}

        <Box float="left">
          <Button
            variant="normal"
            onClick={() => setCurrentStep(3)}
          >
            이전 단계
          </Button>
        </Box>
      </SpaceBetween>
    </Container>
  )

  return (
    <SpaceBetween size="l">
      <Steps
        onStepClick={({ detail }) => {
          const stepIndex = detail.stepIndex + 1
          // Allow navigation to previous steps or current step
          if (stepIndex <= currentStep) {
            setCurrentStep(stepIndex as ReportStep)
          }
        }}
        steps={[
          {
            status: currentStep > 1 ? 'success' : currentStep === 1 ? 'in-progress' : 'pending',
            header: '분석 항목 선택',
            statusIconAriaLabel: currentStep > 1 ? 'Complete' : currentStep === 1 ? 'In progress' : 'Pending',
            isOptional: false
          },
          {
            status: currentStep > 2 ? 'success' : 
                   currentStep === 2 ? (promptLoading ? 'in-progress' : reportError ? 'error' : 'in-progress') : 
                   'pending',
            header: 'AI 프롬프트 생성',
            statusIconAriaLabel: currentStep > 2 ? 'Complete' : 
                               currentStep === 2 ? (promptLoading ? 'In progress' : reportError ? 'Error' : 'In progress') : 
                               'Pending',
            isOptional: false
          },
          {
            status: currentStep > 3 ? 'success' : currentStep === 3 ? 'in-progress' : 'pending',
            header: '에이전트 및 프롬프트 편집',
            statusIconAriaLabel: currentStep > 3 ? 'Complete' : currentStep === 3 ? 'In progress' : 'Pending',
            isOptional: false
          },
          {
            status: currentStep === 4 ? 
                   (reportContent ? 'success' : reportLoading ? 'in-progress' : reportError ? 'error' : 'in-progress') : 
                   'pending',
            header: '리포트 결과',
            statusIconAriaLabel: currentStep === 4 ? 
                                (reportContent ? 'Complete' : reportLoading ? 'In progress' : reportError ? 'Error' : 'In progress') : 
                                'Pending',
            isOptional: false
          }
        ]}
      />

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </SpaceBetween>
  )
}