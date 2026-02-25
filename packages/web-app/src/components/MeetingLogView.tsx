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
import { useI18n } from '../i18n'

interface MeetingLogViewProps {
  sessionId: string
  session?: Session
}

export default function MeetingLogView({ sessionId, session }: MeetingLogViewProps) {
  const { t } = useI18n()
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
        setError(t('adminSessionDetail.meetingLog.failedLoad'))
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
      setError(t('adminSessionDetail.meetingLog.failedSave'))
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
      setError(err.response?.data?.error || t('adminSessionDetail.meetingLog.failedReanalyze'))
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
          setError(t('adminSessionDetail.meetingLog.failedAnalysis'))
          setIsAnalyzing(false)
          setTimeoutProgress(0)
        } else if (statusResponse.status === 'processing') {
          // Update progress (simulate progress over ~1 minute, polling every 15s → ~4 ticks to 95%)
          setTimeoutProgress(prev => Math.min(prev + 24, 95))
        }
      } catch (err: any) {
        console.error('Failed to check analysis status:', err)
        clearInterval(pollInterval)
        setError(t('adminSessionDetail.meetingLog.failedStatusCheck'))
        setIsAnalyzing(false)
      }
    }, 15000)

    setTimeout(() => {
      clearInterval(pollInterval)
      if (isAnalyzing) {
        setError(t('adminSessionDetail.meetingLog.timeout'))
        setIsAnalyzing(false)
        setTimeoutProgress(0)
      }
    }, 60000)
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
              <Header variant="h3">{t('adminSessionDetail.aiAnalysis.sectionTitle')}</Header>

              <ColumnLayout columns={2}>
                <Box>
                  <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
                    {t('adminSessionDetail.meetingLog.agentSelectLabel')}
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
                    placeholder={t('adminSessionDetail.meetingLog.agentSelectPlaceholder')}
                    disabled={isAnalyzing || agentConfigs.length === 0}
                    empty={t('adminSessionDetail.meetingLog.agentSelectEmpty')}
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
                      {isAnalyzing ? t('adminSessionDetail.meetingLog.reanalyzingButton') : t('adminSessionDetail.meetingLog.reanalyzeButton')}
                    </Button>
                    
                    {analysisResults && (
                      <Button
                        variant="normal"
                        iconName="download"
                        onClick={exportToHTML}
                        disabled={isAnalyzing || isLoading || !session}
                      >
                        {t('adminSessionDetail.meetingLog.exportHtmlButton')}
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
                      {t('adminSessionDetail.meetingLog.retryButton')}
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
                      {selectedConfig?.agentName || t('adminSessionDetail.aiAnalysis.sectionTitle')}{t('adminSessionDetail.meetingLog.analyzingMessage')}
                      <br />
                      <Box fontSize="body-s" color="text-status-inactive">
                        {t('adminSessionDetail.meetingLog.analyzingProgress')}{Math.round(timeoutProgress)}{t('adminSessionDetail.meetingLog.analyzingProgressSuffix')}
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
                  {t('adminSessionDetail.meetingLog.analysisComplete')} {new Date(analysisResults.analyzedAt).toLocaleString('ko-KR')} {t('adminSessionDetail.meetingLog.modelUsed')} {analysisResults.agentName || analysisResults.modelUsed}
                </Box>
              </Container>
            </SpaceBetween>
          ) : (
            <Container>
              <Box textAlign="center" padding="xl">
                <Box variant="h3" margin={{ bottom: 's' }}>
                  {t('adminSessionDetail.meetingLog.noAnalysisResults')}
                </Box>
                <Box color="text-status-inactive" margin={{ bottom: 'l' }}>
                  {t('adminSessionDetail.meetingLog.noAnalysisResultsDescription')}
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
                        {t('adminSessionDetail.meetingLog.cancelButton')}
                      </Button>
                      <Button
                        variant="primary"
                        onClick={saveMeetingLog}
                        loading={isSaving}
                        disabled={isSaving}
                      >
                        {t('adminSessionDetail.meetingLog.saveButton')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={startEditing}
                      iconName="edit"
                    >
                      {t('adminSessionDetail.meetingLog.editButton')}
                    </Button>
                  )}
                </SpaceBetween>
              }
            >
              {t('adminSessionDetail.meetingLog.sectionTitle')}
            </Header>

            {saveSuccess && (
              <Alert type="success" dismissible onDismiss={() => setSaveSuccess(false)}>
                {t('adminSessionDetail.meetingLog.saveSuccess')}
              </Alert>
            )}

            {isEditing ? (
              <Box>
                <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
                  {t('adminSessionDetail.meetingLog.writeLabel')}
                </Box>
                <Textarea
                  value={meetingLog}
                  onChange={({ detail }) => setMeetingLog(detail.value)}
                  placeholder={t('adminSessionDetail.meetingLog.writePlaceholder')}
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
                      {t('adminSessionDetail.meetingLog.noMeetingLog')}
                    </Box>
                    <Box margin={{ bottom: 'l' }}>
                      {t('adminSessionDetail.meetingLog.noMeetingLogDescription')}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <Box fontSize="body-s" color="text-status-inactive">
              {t('adminSessionDetail.meetingLog.reanalyzeHint')}
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
  const { t } = useI18n()

  if (!summary) {
    return (
      <Container>
        <Header variant="h3">{t('adminSessionDetail.summary.sectionTitle')}</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          {t('adminSessionDetail.summary.noSummary')}
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">{t('adminSessionDetail.summary.sectionTitle')}</Header>
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
  const { t } = useI18n()
  const isEmpty = !bantAnalysis || (!bantAnalysis.budget && !bantAnalysis.authority && !bantAnalysis.need && !bantAnalysis.timeline)

  if (isEmpty) {
    return (
      <Container>
        <Header variant="h3">{t('adminSessionDetail.bant.sectionTitle')}</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          {t('adminSessionDetail.bant.noResults')}
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">{t('adminSessionDetail.bant.sectionTitle')}</Header>
      <ColumnLayout columns={2}>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>{t('adminSessionDetail.bant.budgetLabel')}</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.budget || t('adminSessionDetail.aiAnalysis.noInfo')}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>{t('adminSessionDetail.bant.authorityLabel')}</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.authority || t('adminSessionDetail.aiAnalysis.noInfo')}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>{t('adminSessionDetail.bant.needLabel')}</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.need || t('adminSessionDetail.aiAnalysis.noInfo')}
          </div>
        </Box>
        <Box>
          <Box variant="awsui-key-label" margin={{ bottom: 's' }}>{t('adminSessionDetail.bant.timelineLabel')}</Box>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: '4px', minHeight: '60px', padding: '12px' }}>
            {bantAnalysis.timeline || t('adminSessionDetail.aiAnalysis.noInfo')}
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
  const { t } = useI18n()

  if (!awsServices || awsServices.length === 0) {
    return (
      <Container>
        <Header variant="h3">{t('adminSessionDetail.awsServices.sectionTitle')}</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          {t('adminSessionDetail.awsServices.noResults')}
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">{t('adminSessionDetail.awsServices.sectionTitle')}</Header>
      <ColumnLayout columns={awsServices.length > 2 ? 2 : 1}>
        {awsServices.map((service, index) => (
          <div key={index} style={{ border: '1px solid #e1e4e8', borderRadius: '8px', padding: '12px' }}>
            <SpaceBetween size="s">
              <Box variant="h4">{service.service}</Box>
              <Box>
                <Box variant="awsui-key-label">{t('adminSessionDetail.awsServices.reasonLabel')}</Box>
                <Box fontSize="body-s">{service.reason}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">{t('adminSessionDetail.awsServices.implementationLabel')}</Box>
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
  const { t } = useI18n()

  if (!customerCases || customerCases.length === 0) {
    return (
      <Container>
        <Header variant="h3">{t('adminSessionDetail.customerCases.sectionTitle')}</Header>
        <Box textAlign="center" padding="l" color="text-status-inactive">
          {t('adminSessionDetail.customerCases.noResults')}
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Header variant="h3">{t('adminSessionDetail.customerCases.sectionTitle')}</Header>
      <SpaceBetween size="m">
        {customerCases.map((customerCase, index) => (
          <div key={index} style={{ border: '1px solid #e1e4e8', borderRadius: '8px', backgroundColor: '#fafbfc', padding: '24px' }}>
            <SpaceBetween size="s">
              <Box variant="h4">{customerCase.title}</Box>
              <Box>
                <Box variant="awsui-key-label">{t('adminSessionDetail.customerCases.descriptionLabel')}</Box>
                <Box>{customerCase.description}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">{t('adminSessionDetail.customerCases.relevanceLabel')}</Box>
                <Box fontSize="body-s" color="text-status-info">{customerCase.relevance}</Box>
              </Box>
            </SpaceBetween>
          </div>
        ))}
      </SpaceBetween>
    </Container>
  )
}