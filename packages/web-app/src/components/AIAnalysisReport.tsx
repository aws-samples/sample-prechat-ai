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
import remarkGfm from 'remark-gfm'
import { adminApi } from '../services/api'
import { AnalysisResults, AgentConfiguration, Session } from '../types'
import { generateAnalysisReportHTML, downloadHTMLFile } from '../utils/htmlExport'
import { useI18n } from '../i18n'

interface AIAnalysisReportProps {
  sessionId: string
  session?: Session
}

export default function AIAnalysisReport({ sessionId, session }: AIAnalysisReportProps) {
  const { t } = useI18n()
  const [agentConfigs, setAgentConfigs] = useState<AgentConfiguration[]>([])
  const [selectedConfig, setSelectedConfig] = useState<AgentConfiguration | null>(null)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [timeoutProgress, setTimeoutProgress] = useState(0)

  useEffect(() => {
    loadExistingAnalysis()
    loadAgentConfigs()
  }, [sessionId])

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
        setError(t('adminSessionDetail.aiAnalysis.failedLoad'))
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
      await adminApi.requestAnalysis(sessionId, selectedConfig?.configId)
      pollAnalysisStatus()
    } catch (err: any) {
      console.error('Failed to start analysis:', err)
      setError(err.response?.data?.error || t('adminSessionDetail.aiAnalysis.failedRequest'))
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
          setError(t('adminSessionDetail.aiAnalysis.failed'))
          setIsAnalyzing(false)
          setTimeoutProgress(0)
        } else if (statusResponse.status === 'processing') {
          // Update progress (simulate progress over ~1 minute, polling every 15s → ~4 ticks to 95%)
          setTimeoutProgress(prev => Math.min(prev + 24, 95))
        }
      } catch (err: any) {
        console.error('Failed to check analysis status:', err)
        clearInterval(pollInterval)
        setError(t('adminSessionDetail.aiAnalysis.failedStatusCheck'))
        setIsAnalyzing(false)
      }
    }, 15000) // Poll every 15 seconds

    // Safety timeout after 20 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
      if (isAnalyzing) {
        setError(t('adminSessionDetail.aiAnalysis.timeout'))
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
    const filename = `${t('adminSessionDetail.aiAnalysis.exportFilenamePrefix')}${session.customerInfo.company}_${session.customerInfo.name}_${new Date().toISOString().split('T')[0]}.html`
    
    downloadHTMLFile(htmlContent, filename)
  }

  const renderAnalysisInterface = () => (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3">
          {t('adminSessionDetail.aiAnalysis.sectionTitle')}
        </Header>

        <ColumnLayout columns={2}>
          <Box>
            <Box variant="awsui-key-label" margin={{ bottom: 's' }}>
              {t('adminSessionDetail.aiAnalysis.agentSelectLabel')}
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
              placeholder={t('adminSessionDetail.aiAnalysis.agentSelectPlaceholder')}
              disabled={isAnalyzing || agentConfigs.length === 0}
              empty={t('adminSessionDetail.aiAnalysis.agentSelectEmpty')}
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
                {isAnalyzing ? t('adminSessionDetail.aiAnalysis.inProgressButton') : t('adminSessionDetail.aiAnalysis.startButton')}
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
                    {t('adminSessionDetail.aiAnalysis.refreshButton')}
                  </Button>
                  <Button
                    variant="normal"
                    iconName="download"
                    onClick={exportToHTML}
                    disabled={isAnalyzing || isLoading || !session}
                  >
                    {t('adminSessionDetail.aiAnalysis.exportHtmlButton')}
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
                {t('adminSessionDetail.aiAnalysis.retryButton')}
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
                {t('adminSessionDetail.aiAnalysis.analyzingMessage', { model: selectedConfig?.agentName || t('adminSessionDetail.aiAnalysis.sectionTitle') })}
                <br />
                <Box fontSize="body-s" color="text-status-inactive">
                  {t('adminSessionDetail.aiAnalysis.analyzingProgress')}{Math.round(timeoutProgress)}{t('adminSessionDetail.aiAnalysis.analyzingProgressSuffix')}
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
            <Box margin={{ top: 's' }}>{t('adminSessionDetail.aiAnalysis.loadingResults')}</Box>
          </Box>
        </Container>
      )
    }

    if (!analysisResults) {
      return (
        <Container>
          <Box textAlign="center" padding="xl">
            <Box variant="h3" margin={{ bottom: 's' }}>
              {t('adminSessionDetail.aiAnalysis.noResults')}
            </Box>
            <Box color="text-status-inactive" margin={{ bottom: 'l' }}>
              {t('adminSessionDetail.aiAnalysis.noResultsDescription')}
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
            {t('adminSessionDetail.aiAnalysis.analysisComplete')} {new Date(analysisResults.analyzedAt).toLocaleString()} {t('adminSessionDetail.aiAnalysis.modelUsed')} {analysisResults.agentName || analysisResults.modelUsed}
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
            remarkPlugins={[remarkGfm]}
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

// AWS Services Container
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

// Customer Cases Container
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