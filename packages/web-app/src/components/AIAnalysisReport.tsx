// nosemgrep
import { useState, useEffect } from 'react'
import {
  SpaceBetween,
  Box,
  Header,
  Button,
  Select,
  Alert,
  Container,
  ColumnLayout,
  Spinner
} from '@cloudscape-design/components'
import LoadingBar from '@cloudscape-design/chat-components/loading-bar'
import ReactMarkdown from 'react-markdown'
import { adminApi } from '../services/api'
import { BEDROCK_MODELS, AnalysisResults, BedrockModel, Session } from '../types'
import { generateAnalysisReportHTML, downloadHTMLFile } from '../utils/htmlExport'

interface AIAnalysisReportProps {
  sessionId: string
  session?: Session
}

export default function AIAnalysisReport({ sessionId, session }: AIAnalysisReportProps) {
  const [selectedModel, setSelectedModel] = useState<BedrockModel>(BEDROCK_MODELS[0])
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [timeoutProgress, setTimeoutProgress] = useState(0)

  useEffect(() => {
    loadExistingAnalysis()
  }, [sessionId])

  const loadExistingAnalysis = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await adminApi.getSessionReport(sessionId)
      if (response && (response as any).analysis) {
        setAnalysisResults((response as any).analysis)
      } else if (response && (response as any).status === 'processing') {
        // Analysis is in progress, start polling
        setIsAnalyzing(true)
        pollAnalysisStatus()
      }
    } catch (err: any) {
      console.error('Failed to load existing analysis:', err)
      // Don't show error for missing analysis - it's expected
      if (err.response?.status !== 404 && err.response?.status !== 202) {
        setError('기존 분석 결과를 불러오는데 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const startAnalysis = async () => {
    setIsAnalyzing(true)
    setError('')
    setTimeoutProgress(0)

    try {
      // Start analysis (Producer)
      await adminApi.requestAnalysis(sessionId, selectedModel.id)
      
      // Start polling for status
      pollAnalysisStatus()
    } catch (err: any) {
      console.error('Failed to start analysis:', err)
      setError(err.response?.data?.error || '분석 요청에 실패했습니다. 다시 시도해주세요.')
      setIsAnalyzing(false)
    }
  }

  const pollAnalysisStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await adminApi.getAnalysisStatus(sessionId)
        
        if (statusResponse.status === 'completed') {
          clearInterval(pollInterval)
          // Get the analysis results
          const reportResponse = await adminApi.getSessionReport(sessionId)
          if (reportResponse && (reportResponse as any).analysis) {
            setAnalysisResults((reportResponse as any).analysis)
          }
          setIsAnalyzing(false)
          setTimeoutProgress(100)
        } else if (statusResponse.status === 'failed') {
          clearInterval(pollInterval)
          setError('AI 분석에 실패했습니다. 다시 시도해주세요.')
          setIsAnalyzing(false)
          setTimeoutProgress(0)
        } else if (statusResponse.status === 'processing') {
          // Update progress (simulate progress over 15 minutes)
          setTimeoutProgress(prev => Math.min(prev + 2, 95))
        }
      } catch (err: any) {
        console.error('Failed to check analysis status:', err)
        clearInterval(pollInterval)
        setError('분석 상태 확인에 실패했습니다.')
        setIsAnalyzing(false)
      }
    }, 15000) // Poll every 15 seconds

    // Safety timeout after 20 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      if (isAnalyzing) {
        setError('분석 시간이 초과되었습니다. 다시 시도해주세요.')
        setIsAnalyzing(false)
        setTimeoutProgress(0)
      }
    }, 1200000) // 20 minutes
  }

  const refreshAnalysis = async () => {
    await loadExistingAnalysis()
  }

  const exportToHTML = () => {
    if (!analysisResults || !session) {
      return
    }

    const exportData = {
      sessionId,
      customerInfo: session.customerInfo,
      salesRepInfo: session.salesRepInfo,
      salesRepEmail: session.salesRepEmail,
      analysisResults,
      exportedAt: new Date().toLocaleString('ko-KR')
    }

    const htmlContent = generateAnalysisReportHTML(exportData)
    const filename = `AI분석리포트_${session.customerInfo.company}_${session.customerInfo.name}_${new Date().toISOString().split('T')[0]}.html`
    
    downloadHTMLFile(htmlContent, filename)
  }

  const renderAnalysisInterface = () => (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3">
          AI 분석
        </Header>

        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
              분석 모델 선택
            </Box>
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
              disabled={isAnalyzing}
            />
          </Box>

          <Box>
            <SpaceBetween size="s" direction="horizontal">
              <Button
                variant="primary"
                onClick={startAnalysis}
                loading={isAnalyzing}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'AI 분석 중...' : 'AI 분석 시작'}
              </Button>
              
              {analysisResults && (
                <>
                  <Button
                    variant="normal"
                    iconName="refresh"
                    onClick={refreshAnalysis}
                    loading={isLoading}
                    disabled={isAnalyzing || isLoading}
                  >
                    새로고침
                  </Button>
                  <Button
                    variant="normal"
                    iconName="download"
                    onClick={exportToHTML}
                    disabled={isAnalyzing || isLoading || !session}
                  >
                    HTML 저장
                  </Button>
                </>
              )}
            </SpaceBetween>
          </Box>
        </ColumnLayout>

        {error && (
          <Alert 
            type="error"
            action={
              <Button
                variant="primary"
                onClick={startAnalysis}
                disabled={isAnalyzing}
              >
                다시 시도
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {isAnalyzing && (
          <Alert type="info">
            <SpaceBetween size="s">
              <LoadingBar variant="gen-ai" />
              <Box>
                선택된 모델({selectedModel.name})이 대화 내용을 분석하고 있습니다...
                <br />
                <Box fontSize="body-s" color="text-status-inactive">
                  최대 5분까지 소요될 수 있습니다. ({Math.round(timeoutProgress)}% 완료)
                </Box>
              </Box>
            </SpaceBetween>
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  )

  const renderAnalysisResults = () => {
    if (isLoading) {
      return (
        <Container>
          <Box textAlign="center" padding="xl">
            <Spinner size="large" />
            <Box margin={{ top: 's' }}>분석 결과를 불러오는 중...</Box>
          </Box>
        </Container>
      )
    }

    if (!analysisResults) {
      return (
        <Container>
          <Box textAlign="center" padding="xl">
            <Box variant="h3" margin={{ bottom: 's' }}>
              분석 결과가 없습니다
            </Box>
            <Box color="text-status-inactive" margin={{ bottom: 'l' }}>
              위의 "AI 분석 시작" 버튼을 클릭하여 대화 내용을 분석해보세요.
            </Box>
          </Box>
        </Container>
      )
    }

    return (
      <SpaceBetween size="l">
        <MarkdownSummaryContainer summary={analysisResults.markdownSummary} />
        <BANTAnalysisContainer bantAnalysis={analysisResults.bantAnalysis} />
        <AWSServicesContainer awsServices={analysisResults.awsServices} />
        <CustomerCasesContainer customerCases={analysisResults.customerCases} />
        
        <Container>
          <Box fontSize="body-s" color="text-status-inactive" textAlign="center">
            분석 완료: {new Date(analysisResults.analyzedAt).toLocaleString('ko-KR')} | 
            사용 모델: {BEDROCK_MODELS.find(m => m.id === analysisResults.modelUsed)?.name || analysisResults.modelUsed}
          </Box>
        </Container>
      </SpaceBetween>
    )
  }

  return (
    <SpaceBetween size="l">
      {renderAnalysisInterface()}
      {renderAnalysisResults()}
    </SpaceBetween>
  )
}

// Markdown Summary Container
interface MarkdownSummaryContainerProps {
  summary: string
}

function MarkdownSummaryContainer({ summary }: MarkdownSummaryContainerProps) {
  if (!summary) {
    return (
      <Container>
        <Header variant="h3">요약 보고서</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          요약 보고서가 생성되지 않았습니다.
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">요약 보고서</Header>
      <Box padding="l">
        <div 
          style={{ 
            backgroundColor: '#ffffff', 
            border: '1px solid #e1e4e8', 
            borderRadius: '8px',
            padding: '24px',
            maxHeight: '600px',
            overflowY: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            lineHeight: '1.6'
          }}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ lineHeight: '1.6', margin: '0 0 16px 0' }}>{children}</p>,
              h1: ({ children }) => <h1 style={{ lineHeight: '1.4', margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ lineHeight: '1.4', margin: '20px 0 16px 0', fontSize: '20px', fontWeight: 'bold' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ lineHeight: '1.4', margin: '16px 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>{children}</h3>,
              h4: ({ children }) => <h4 style={{ lineHeight: '1.4', margin: '12px 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>{children}</h4>,
              ul: ({ children }) => <ul style={{ lineHeight: '1.6', margin: '0 0 16px 0', paddingLeft: '20px' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ lineHeight: '1.6', margin: '0 0 16px 0', paddingLeft: '20px' }}>{children}</ol>,
              li: ({ children }) => <li style={{ lineHeight: '1.6', margin: '4px 0' }}>{children}</li>,
              blockquote: ({ children }) => <blockquote style={{ lineHeight: '1.6', margin: '16px 0', paddingLeft: '16px', borderLeft: '4px solid #e1e4e8', fontStyle: 'italic' }}>{children}</blockquote>,
              code: ({ children }) => <code style={{ backgroundColor: '#f6f8fa', padding: '2px 4px', borderRadius: '3px', fontSize: '14px' }}>{children}</code>,
              pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: '16px', borderRadius: '6px', overflow: 'auto', margin: '16px 0' }}>{children}</pre>
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      </Box>
    </Container>
  )
}

// BANT Analysis Container
interface BANTAnalysisContainerProps {
  bantAnalysis: {
    budget: string
    authority: string
    need: string
    timeline: string
  }
}

function BANTAnalysisContainer({ bantAnalysis }: BANTAnalysisContainerProps) {
  const isEmpty = !bantAnalysis || (!bantAnalysis.budget && !bantAnalysis.authority && !bantAnalysis.need && !bantAnalysis.timeline)

  if (isEmpty) {
    return (
      <Container>
        <Header variant="h3">BANT 분석</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          BANT 분석 결과가 생성되지 않았습니다.
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">BANT 분석</Header>
      <ColumnLayout columns={2}>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>Budget (예산)</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.budget || '정보 없음'}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>Authority (권한)</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.authority || '정보 없음'}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>Need (필요성)</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.need || '정보 없음'}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>Timeline (일정)</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.timeline || '정보 없음'}
          </div>
        </Box>
      </ColumnLayout>
    </Container>
  )
}

// AWS Services Container
interface AWSServicesContainerProps {
  awsServices: Array<{
    service: string
    reason: string
    implementation: string
  }>
}

function AWSServicesContainer({ awsServices }: AWSServicesContainerProps) {
  if (!awsServices || awsServices.length === 0) {
    return (
      <Container>
        <Header variant="h3">추천 AWS 서비스</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          추천 AWS 서비스가 생성되지 않았습니다.
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">추천 AWS 서비스</Header>
      <ColumnLayout columns={awsServices.length > 2 ? 2 : 1}>
        {awsServices.map((service, index) => (
          <div key={index} style={{ border: '1px solid #e1e4e8', borderRadius: '8px', padding: '12px' }}>
            <SpaceBetween size="s">
              <Box variant="h4">{service.service}</Box>
              <Box>
                <Box variant="awsui-key-label">추천 이유</Box>
                <Box fontSize="body-s">{service.reason}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">구현 방안</Box>
                <Box fontSize="body-s">{service.implementation}</Box>
              </Box>
            </SpaceBetween>
          </div>
        ))}
      </ColumnLayout>
    </Container>
  )
}

// Customer Cases Container
interface CustomerCasesContainerProps {
  customerCases: Array<{
    title: string
    description: string
    relevance: string
  }>
}

function CustomerCasesContainer({ customerCases }: CustomerCasesContainerProps) {
  if (!customerCases || customerCases.length === 0) {
    return (
      <Container>
        <Header variant="h3">관련 고객 사례</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          관련 고객 사례가 생성되지 않았습니다.
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">관련 고객 사례</Header>
      <SpaceBetween size="m">
        {customerCases.map((customerCase, index) => (
          <div key={index} style={{ border: '1px solid #e1e4e8', borderRadius: '8px', backgroundColor: '#fafbfc', padding: '24px' }}>
            <SpaceBetween size="s">
              <Box variant="h4">{customerCase.title}</Box>
              <Box>
                <Box variant="awsui-key-label">사례 설명</Box>
                <Box>{customerCase.description}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">관련성</Box>
                <Box fontSize="body-s" color="text-status-info">{customerCase.relevance}</Box>
              </Box>
            </SpaceBetween>
          </div>
        ))}
      </SpaceBetween>
    </Container>
  )
}