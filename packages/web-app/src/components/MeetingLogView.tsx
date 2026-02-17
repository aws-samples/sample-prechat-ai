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
  Spinner,
  Textarea,
  Grid
} from '@cloudscape-design/components'
import LoadingBar from '@cloudscape-design/chat-components/loading-bar'
import ReactMarkdown from 'react-markdown'
import { adminApi } from '../services/api'
import { AnalysisResults, AgentConfiguration, Session } from '../types'
import { generateMeetingLogReportHTML, downloadHTMLFile } from '../utils/htmlExport'

interface MeetingLogViewProps {
  sessionId: string
  session?: Session
}

export default function MeetingLogView({ sessionId, session }: MeetingLogViewProps) {
  const [agentConfigs, setAgentConfigs] = useState<AgentConfiguration[]>([])
  const [selectedConfig, setSelectedConfig] = useState<AgentConfiguration | null>(null)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [meetingLog, setMeetingLog] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [timeoutProgress, setTimeoutProgress] = useState(0)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadExistingData()
    loadAgentConfigs()
  }, [sessionId])

  const loadExistingData = async () => {
    setIsLoading(true)
    setError('')
    try {
      // Load session details including meeting log
      const sessionDetails = await adminApi.getSessionDetails(sessionId)
      if (sessionDetails.meetingLog) {
        setMeetingLog(sessionDetails.meetingLog)
        setIsEditing(false) // Show in display mode if meeting log exists
      } else {
        setIsEditing(true) // Show in edit mode if no meeting log exists
      }

      // Load existing analysis
      const response = await adminApi.getSessionReport(sessionId)
      if (response && (response as any).analysis) {
        setAnalysisResults((response as any).analysis)
      } else if (response && (response as any).status === 'processing') {
        setIsAnalyzing(true)
        pollAnalysisStatus()
      }
    } catch (err: any) {
      console.error('Failed to load existing data:', err)
      if (err.response?.status !== 404 && err.response?.status !== 202) {
        setError('기존 데이터를 불러오는데 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadAgentConfigs = async () => {
    try {
      const campaignId = (session as any)?.campaignId || ''
      const response = await adminApi.listAgentConfigs(campaignId || undefined)
      const summaryConfigs = (response.configs || []).filter(
        (c: AgentConfiguration) => c.agentRole === 'summary' && c.status === 'active'
      )
      setAgentConfigs(summaryConfigs)
      if (summaryConfigs.length > 0 && !selectedConfig) {
        setSelectedConfig(summaryConfigs[0])
      }
    } catch (err) {
      console.error('Failed to load agent configs:', err)
    }
  }

  const saveMeetingLog = async () => {
    setIsSaving(true)
    setError('')
    setSaveSuccess(false)
    
    try {
      await adminApi.saveMeetingLog(sessionId, meetingLog)
      setSaveSuccess(true)
      setIsEditing(false) // Switch to display mode after saving
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to save meeting log:', err)
      setError('미팅 로그 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = () => {
    setIsEditing(true)
  }

  const cancelEditing = () => {
    // Reload the original meeting log
    loadExistingData()
    setIsEditing(false)
  }

  const startReanalysis = async () => {
    setIsAnalyzing(true)
    setError('')
    setTimeoutProgress(0)

    try {
      await adminApi.reanalyzeWithMeetingLog(sessionId, selectedConfig?.configId)
      pollAnalysisStatus()
    } catch (err: any) {
      console.error('Failed to start re-analysis:', err)
      setError(err.response?.data?.error || '재분석 요청에 실패했습니다. 다시 시도해주세요.')
      setIsAnalyzing(false)
    }
  }

  const pollAnalysisStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await adminApi.getAnalysisStatus(sessionId)
        
        if (statusResponse.status === 'completed') {
          clearInterval(pollInterval)
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
          setTimeoutProgress(prev => Math.min(prev + 2, 95))
        }
      } catch (err: any) {
        console.error('Failed to check analysis status:', err)
        clearInterval(pollInterval)
        setError('분석 상태 확인에 실패했습니다.')
        setIsAnalyzing(false)
      }
    }, 15000)

    setTimeout(() => {
      clearInterval(pollInterval)
      if (isAnalyzing) {
        setError('분석 시간이 초과되었습니다. 다시 시도해주세요.')
        setIsAnalyzing(false)
        setTimeoutProgress(0)
      }
    }, 1200000)
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
      meetingLog,
      exportedAt: new Date().toLocaleString('ko-KR')
    }

    const htmlContent = generateMeetingLogReportHTML(exportData)
    const filename = `미팅로그리포트_${session.customerInfo.company}_${session.customerInfo.name}_${new Date().toISOString().split('T')[0]}.html`
    
    downloadHTMLFile(htmlContent, filename)
  }

  if (isLoading) {
    return (
      <Container>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </Container>
    )
  }

  return (
    <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
      {/* Left side - AI Analysis */}
      <div>
        <SpaceBetween size="l">
          {/* Analysis Interface */}
          <Container>
            <SpaceBetween size="l">
              <Header variant="h3">AI 분석</Header>

              <ColumnLayout columns={2}>
                <Box>
                  <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
                    분석 에이전트 선택
                  </Box>
                  <Select
                    selectedOption={selectedConfig ? {
                      label: `${selectedConfig.agentName || selectedConfig.configId} (${selectedConfig.modelId.split('.').pop()})`,
                      value: selectedConfig.configId
                    } : null}
                    onChange={({ detail }) => {
                      const config = agentConfigs.find(c => c.configId === detail.selectedOption.value)
                      if (config) setSelectedConfig(config)
                    }}
                    options={agentConfigs.map(config => ({
                      label: `${config.agentName || config.configId} (${config.modelId.split('.').pop()})`,
                      value: config.configId
                    }))}
                    placeholder="요약 에이전트를 선택하세요"
                    disabled={isAnalyzing || agentConfigs.length === 0}
                    empty="캠페인에 연결된 요약 에이전트가 없습니다"
                  />
                </Box>

                <Box>
                  <SpaceBetween size="s" direction="horizontal">
                    <Button
                      variant="primary"
                      onClick={startReanalysis}
                      loading={isAnalyzing}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? '재분석 중...' : '재분석'}
                    </Button>
                    
                    {analysisResults && (
                      <Button
                        variant="normal"
                        iconName="download"
                        onClick={exportToHTML}
                        disabled={isAnalyzing || isLoading || !session}
                      >
                        HTML 저장
                      </Button>
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
                      onClick={startReanalysis}
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
                      {selectedConfig?.agentName || '분석 에이전트'}가 대화 내용과 미팅 로그를 함께 분석하고 있습니다...
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

          {/* Analysis Results */}
          {analysisResults ? (
            <SpaceBetween size="l">
              <MarkdownSummaryContainer summary={analysisResults.markdownSummary} />
              <BANTAnalysisContainer bantAnalysis={analysisResults.bantAnalysis} />
              <AWSServicesContainer awsServices={analysisResults.awsServices} />
              <CustomerCasesContainer customerCases={analysisResults.customerCases} />
              
              <Container>
                <Box fontSize="body-s" color="text-status-inactive" textAlign="center">
                  분석 완료: {new Date(analysisResults.analyzedAt).toLocaleString('ko-KR')} | 
                  에이전트: {analysisResults.agentName || analysisResults.modelUsed}
                </Box>
              </Container>
            </SpaceBetween>
          ) : (
            <Container>
              <Box textAlign="center" padding="xl">
                <Box variant="h3" margin={{ bottom: 's' }}>
                  분석 결과가 없습니다
                </Box>
                <Box color="text-status-inactive" margin={{ bottom: 'l' }}>
                  "재분석" 버튼을 클릭하여 대화 내용과 미팅 로그를 함께 분석해보세요.
                </Box>
              </Box>
            </Container>
          )}
        </SpaceBetween>
      </div>

      {/* Right side - Meeting Log */}
      <div>
        <Container>
          <SpaceBetween size="l">
            <Header 
              variant="h3"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  {isEditing ? (
                    <>
                      <Button
                        variant="normal"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        취소
                      </Button>
                      <Button
                        variant="primary"
                        onClick={saveMeetingLog}
                        loading={isSaving}
                        disabled={isSaving}
                      >
                        저장
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={startEditing}
                      iconName="edit"
                    >
                      수정
                    </Button>
                  )}
                </SpaceBetween>
              }
            >
              미팅 로그
            </Header>

            {saveSuccess && (
              <Alert type="success" dismissible onDismiss={() => setSaveSuccess(false)}>
                미팅 로그가 성공적으로 저장되었습니다.
              </Alert>
            )}

            {isEditing ? (
              <Box>
                <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
                  초도미팅록 작성 (마크다운 형식 지원)
                </Box>
                <Textarea
                  value={meetingLog}
                  onChange={({ detail }) => setMeetingLog(detail.value)}
                  placeholder="미팅 내용을 자유롭게 작성해주세요. 마크다운 형식을 사용할 수 있습니다.

예시:
## 미팅 개요
- 일시: 2024-01-15 14:00
- 참석자: 홍길동 (고객), 김영희 (AWS)

## 주요 논의사항
1. 클라우드 마이그레이션 계획
2. 예상 비용 및 일정
3. 기술적 요구사항

## 액션 아이템
- [ ] POC 제안서 작성
- [ ] 기술 검토 미팅 일정 조율"
                  rows={20}
                  disabled={isSaving}
                />
              </Box>
            ) : (
              <Box>
                {meetingLog ? (
                  <div 
                    style={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e1e4e8', 
                      borderRadius: '8px',
                      padding: '24px',
                      minHeight: '400px',
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
                      {meetingLog}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <Box textAlign="center" padding="xl" color="text-status-inactive">
                    <Box variant="h4" margin={{ bottom: 's' }}>
                      미팅 로그가 없습니다
                    </Box>
                    <Box margin={{ bottom: 'l' }}>
                      "수정" 버튼을 클릭하여 초도미팅록을 작성해보세요.
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <Box fontSize="body-s" color="text-status-inactive">
              미팅 로그를 저장한 후 "재분석" 버튼을 클릭하면, 사전상담 대화 내용과 미팅 로그를 모두 고려하여 AI가 좌측의 분석 결과를 업데이트합니다.
            </Box>
          </SpaceBetween>
        </Container>
      </div>
    </Grid>
  )
}

// Reuse existing components from AIAnalysisReport
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