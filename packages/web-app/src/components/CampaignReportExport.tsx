import {
  ButtonDropdown,
  SpaceBetween
} from '@cloudscape-design/components'
import { useState } from 'react'
import type { CampaignAnalytics, Campaign, SessionSummary } from '../types'
import { useI18n } from '../i18n'
import { formatDuration } from '../utils'

interface CampaignReportExportProps {
  campaign: Campaign
  analytics: CampaignAnalytics
  sessions?: SessionSummary[]
}

export function CampaignReportExport({ campaign, analytics, sessions = [] }: CampaignReportExportProps) {
  const { t } = useI18n()
  const [exporting, setExporting] = useState(false)

  const generateCSVReport = () => {
    const headers = [
      t('adminCampaignDetail.reportExport.metricHeader'),
      t('adminCampaignDetail.reportExport.valueHeader'),
      t('adminCampaignDetail.reportExport.descriptionHeader')
    ]

    const rows = [
      [t('adminCampaignDetail.reportExport.campaignNameRow'), campaign.campaignName, ''],
      [t('adminCampaignDetail.reportExport.campaignCodeRow'), campaign.campaignCode, ''],
      [t('adminCampaignDetail.reportExport.campaignStatusRow'), campaign.status, ''],
      [t('adminCampaignDetail.reportExport.startDateRow'), new Date(campaign.startDate).toLocaleDateString(), ''],
      [t('adminCampaignDetail.reportExport.endDateRow'), new Date(campaign.endDate).toLocaleDateString(), ''],
      [t('adminCampaignDetail.reportExport.campaignOwnerRow'), campaign.ownerName, campaign.ownerEmail],
      ['', '', ''],
      [t('adminCampaignDetail.reportExport.totalSessionsRow'), analytics.totalSessions.toString(), ''],
      [t('adminCampaignDetail.reportExport.activeSessionsRow'), analytics.activeSessions.toString(), ''],
      [t('adminCampaignDetail.reportExport.completedSessionsRow'), analytics.completedSessions.toString(), ''],
      [t('adminCampaignDetail.reportExport.completionRateRow'), `${analytics.completionRate}%`, ''],
      [t('adminCampaignDetail.reportExport.averageDurationRow'), formatDuration(analytics.averageSessionDuration), t('adminCampaignDetail.reportExport.completedSessionsOnlyNote')],
      ['', '', ''],
      [t('adminCampaignDetail.reportExport.topPurposesRow'), '', ''],
      ...analytics.topConsultationPurposes.map(purpose => [
        purpose.purpose,
        purpose.count.toString(),
        `${((purpose.count / analytics.totalSessions) * 100).toFixed(1)}%`
      ]),
      ['', '', ''],
      [t('adminCampaignDetail.reportExport.customerCompaniesRow'), '', ''],
      ...analytics.customerCompanies.map(company => [
        company.company,
        company.sessionCount.toString(),
        `${((company.sessionCount / analytics.totalSessions) * 100).toFixed(1)}%`
      ])
    ]

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return csvContent
  }

  const generateSessionsCSV = () => {
    if (!sessions.length) return ''

    const headers = [
      t('adminCampaignDetail.reportExport.sessionIdHeader'),
      t('adminCampaignDetail.reportExport.statusHeader'),
      t('adminCampaignDetail.reportExport.customerNameHeader'),
      t('adminCampaignDetail.reportExport.customerEmailHeader'),
      t('adminCampaignDetail.reportExport.customerCompanyHeader'),
      t('adminCampaignDetail.reportExport.customerTitleHeader'),
      t('adminCampaignDetail.reportExport.consultationPurposesHeader'),
      t('adminCampaignDetail.reportExport.salesRepEmailHeader'),
      t('adminCampaignDetail.reportExport.createdAtHeader'),
      t('adminCampaignDetail.reportExport.completedAtHeader'),
      t('adminCampaignDetail.reportExport.durationMinutesHeader')
    ]

    const rows = sessions.map(session => {
      let duration = ''
      if (session.createdAt && session.completedAt) {
        const created = new Date(session.createdAt)
        const completed = new Date(session.completedAt)
        duration = Math.round((completed.getTime() - created.getTime()) / (1000 * 60)).toString()
      }

      return [
        session.sessionId,
        session.status,
        session.customerInfo?.name || '',
        session.customerInfo?.email || '',
        session.customerInfo?.company || '',
        '', // title not available in SessionSummary
        session.consultationPurposes || '',
        '', // salesRepEmail not available in SessionSummary
        session.createdAt ? new Date(session.createdAt).toLocaleString() : '',
        session.completedAt ? new Date(session.completedAt).toLocaleString() : '',
        duration
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')

    return csvContent
  }

  const generateHTMLReport = () => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('adminCampaignDetail.reportExport.reportTitle')}: ${campaign.campaignName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0073bb; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .generated-at { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${t('adminCampaignDetail.reportExport.reportTitle')}: ${campaign.campaignName}</h1>
        <p><strong>${t('adminCampaignDetail.reportExport.codeLabel')}:</strong> ${campaign.campaignCode}</p>
        <p><strong>${t('adminCampaignDetail.reportExport.dateRangeLabel')}:</strong> ${new Date(campaign.startDate).toLocaleDateString()} - ${new Date(campaign.endDate).toLocaleDateString()}</p>
        <p><strong>${t('adminCampaignDetail.reportExport.ownerHeader')}:</strong> ${campaign.ownerName} (${campaign.ownerEmail})</p>
    </div>

    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-label">${t('adminCampaignDetail.reportExport.totalSessionsRow')}</div>
            <div class="metric-value">${analytics.totalSessions}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">${t('adminCampaignDetail.reportExport.completionRateRow')}</div>
            <div class="metric-value">${analytics.completionRate}%</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">${t('adminCampaignDetail.reportExport.averageDurationRow')}</div>
            <div class="metric-value">${formatDuration(analytics.averageSessionDuration)}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">${t('adminCampaignDetail.reportExport.customerCompaniesRow')}</div>
            <div class="metric-value">${analytics.customerCompanies.length}</div>
        </div>
    </div>

    <div class="section">
        <h2>${t('adminCampaignDetail.reportExport.topPurposesRow')}</h2>
        <table>
            <thead>
                <tr>
                    <th>${t('adminCampaignDetail.reportExport.purposeHeader')}</th>
                    <th>${t('adminCampaignDetail.reportExport.sessionsHeader')}</th>
                    <th>${t('adminCampaignDetail.reportExport.percentageHeader')}</th>
                </tr>
            </thead>
            <tbody>
                ${analytics.topConsultationPurposes.map(purpose => `
                    <tr>
                        <td>${purpose.purpose}</td>
                        <td>${purpose.count}</td>
                        <td>${((purpose.count / analytics.totalSessions) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>${t('adminCampaignDetail.reportExport.customerCompaniesRow')}</h2>
        <table>
            <thead>
                <tr>
                    <th>${t('adminCampaignDetail.reportExport.companyHeader')}</th>
                    <th>${t('adminCampaignDetail.reportExport.sessionsHeader')}</th>
                    <th>${t('adminCampaignDetail.reportExport.percentageHeader')}</th>
                </tr>
            </thead>
            <tbody>
                ${analytics.customerCompanies.map(company => `
                    <tr>
                        <td>${company.company}</td>
                        <td>${company.sessionCount}</td>
                        <td>${((company.sessionCount / analytics.totalSessions) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="generated-at">
        ${t('adminCampaignDetail.reportExport.reportGeneratedAt')}: ${new Date().toLocaleString()}
    </div>
</body>
</html>`
    return html
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExport = async (format: string) => {
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const baseFilename = `${campaign.campaignCode}_report_${timestamp}`

      switch (format) {
        case 'csv-summary':
          const csvSummary = generateCSVReport()
          downloadFile(csvSummary, `${baseFilename}_summary.csv`, 'text/csv')
          break
        
        case 'csv-sessions':
          const csvSessions = generateSessionsCSV()
          downloadFile(csvSessions, `${baseFilename}_sessions.csv`, 'text/csv')
          break
        
        case 'html':
          const htmlReport = generateHTMLReport()
          downloadFile(htmlReport, `${baseFilename}.html`, 'text/html')
          break
      }
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <SpaceBetween size="xs" direction="horizontal">
      <ButtonDropdown
        items={[
          {
            id: 'csv-summary',
            text: t('adminCampaignDetail.reportExport.summaryCsvOption'),
            description: t('adminCampaignDetail.reportExport.summaryCsvDescription')
          },
          {
            id: 'csv-sessions',
            text: t('adminCampaignDetail.reportExport.sessionsCsvOption'),
            description: t('adminCampaignDetail.reportExport.sessionsCsvDescription'),
            disabled: sessions.length === 0
          },
          {
            id: 'html',
            text: t('adminCampaignDetail.reportExport.htmlOption'),
            description: t('adminCampaignDetail.reportExport.htmlDescription')
          }
        ]}
        onItemClick={({ detail }) => handleExport(detail.id)}
        loading={exporting}
        disabled={exporting}
      >
        {t('adminCampaignDetail.reportExport.exportButton')}
      </ButtonDropdown>
    </SpaceBetween>
  )
}