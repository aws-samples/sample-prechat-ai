import { AnalysisResults } from '../types'
import { BEDROCK_MODELS } from '../types'

interface ExportData {
  sessionId: string
  customerInfo: {
    name: string
    email: string
    company: string
  }
  salesRepInfo?: {
    name: string
  }
  salesRepEmail: string
  analysisResults: AnalysisResults
  exportedAt: string
}

interface MeetingLogExportData extends ExportData {
  meetingLog: string
}

export function generateAnalysisReportHTML(data: ExportData): string {
  const modelName = BEDROCK_MODELS.find(m => m.id === data.analysisResults.modelUsed)?.name || data.analysisResults.modelUsed
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 분석 리포트 - ${data.customerInfo.company}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #232f3e 0%, #131a22 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .header .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 40px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 30px;
        }
        
        .section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .section-title {
            font-size: 1.8rem;
            color: #232f3e;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #ff9900;
            display: inline-block;
        }
        
        .customer-info {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ff9900;
        }
        
        .info-label {
            font-weight: 600;
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 1.1rem;
            color: #333;
        }
        
        .markdown-content {
            background: #ffffff;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            line-height: 1.7;
        }
        
        .markdown-content h1 {
            color: #232f3e;
            font-size: 1.8rem;
            margin-bottom: 20px;
            border-bottom: 2px solid #ff9900;
            padding-bottom: 10px;
        }
        
        .markdown-content h2 {
            color: #232f3e;
            font-size: 1.5rem;
            margin: 25px 0 15px 0;
        }
        
        .markdown-content h3 {
            color: #232f3e;
            font-size: 1.3rem;
            margin: 20px 0 10px 0;
        }
        
        .markdown-content h4 {
            color: #232f3e;
            font-size: 1.1rem;
            margin: 15px 0 8px 0;
        }
        
        .markdown-content p {
            margin-bottom: 15px;
        }
        
        .markdown-content ul, .markdown-content ol {
            margin: 15px 0;
            padding-left: 25px;
        }
        
        .markdown-content li {
            margin: 8px 0;
        }
        
        .markdown-content blockquote {
            border-left: 4px solid #ff9900;
            padding-left: 20px;
            margin: 20px 0;
            font-style: italic;
            color: #666;
        }
        
        .markdown-content code {
            background: #f6f8fa;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .markdown-content pre {
            background: #f6f8fa;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        .bant-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .bant-item {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #ff9900;
        }
        
        .bant-label {
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }
        
        .bant-content {
            color: #555;
            line-height: 1.6;
        }
        
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
        }
        
        .service-card {
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 25px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .service-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 15px;
        }
        
        .service-section {
            margin-bottom: 15px;
        }
        
        .service-section-title {
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }
        
        .service-section-content {
            color: #555;
            line-height: 1.5;
        }
        
        .cases-list {
            display: flex;
            flex-direction: column;
            gap: 25px;
        }
        
        .case-card {
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            background: #fafbfc;
            padding: 25px;
        }
        
        .case-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 15px;
        }
        
        .case-section {
            margin-bottom: 15px;
        }
        
        .case-section:last-child {
            margin-bottom: 0;
        }
        
        .case-section-title {
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }
        
        .case-section-content {
            color: #555;
            line-height: 1.6;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
        }
        
        .footer-info {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        
        .footer-item {
            font-size: 0.9rem;
        }
        
        .no-data {
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
            
            .section {
                page-break-inside: avoid;
            }
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .bant-grid {
                grid-template-columns: 1fr;
            }
            
            .services-grid {
                grid-template-columns: 1fr;
            }
            
            .footer-info {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AI 분석 리포트</h1>
            <div class="subtitle">사전상담 대화 분석 결과</div>
        </div>
        
        <div class="content">
            <!-- Customer Information -->
            <div class="section">
                <h2 class="section-title">고객 정보</h2>
                <div class="customer-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">고객명</div>
                            <div class="info-value">${data.customerInfo.name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">이메일</div>
                            <div class="info-value">${data.customerInfo.email}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">회사명</div>
                            <div class="info-value">${data.customerInfo.company}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">담당 세일즈</div>
                            <div class="info-value">${data.salesRepInfo?.name || data.salesRepEmail}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Summary Report -->
            <div class="section">
                <h2 class="section-title">요약 보고서</h2>
                ${data.analysisResults.markdownSummary ? 
                    `<div class="markdown-content">${convertMarkdownToHTML(data.analysisResults.markdownSummary)}</div>` :
                    '<div class="no-data">요약 보고서가 생성되지 않았습니다.</div>'
                }
            </div>
            
            <!-- BANT Analysis -->
            <div class="section">
                <h2 class="section-title">BANT 분석</h2>
                ${data.analysisResults.bantAnalysis && (data.analysisResults.bantAnalysis.budget || data.analysisResults.bantAnalysis.authority || data.analysisResults.bantAnalysis.need || data.analysisResults.bantAnalysis.timeline) ?
                    `<div class="bant-grid">
                        <div class="bant-item">
                            <div class="bant-label">Budget (예산)</div>
                            <div class="bant-content">${data.analysisResults.bantAnalysis.budget || '정보 없음'}</div>
                        </div>
                        <div class="bant-item">
                            <div class="bant-label">Authority (권한)</div>
                            <div class="bant-content">${data.analysisResults.bantAnalysis.authority || '정보 없음'}</div>
                        </div>
                        <div class="bant-item">
                            <div class="bant-label">Need (필요성)</div>
                            <div class="bant-content">${data.analysisResults.bantAnalysis.need || '정보 없음'}</div>
                        </div>
                        <div class="bant-item">
                            <div class="bant-label">Timeline (일정)</div>
                            <div class="bant-content">${data.analysisResults.bantAnalysis.timeline || '정보 없음'}</div>
                        </div>
                    </div>` :
                    '<div class="no-data">BANT 분석 결과가 생성되지 않았습니다.</div>'
                }
            </div>
            
            <!-- AWS Services -->
            <div class="section">
                <h2 class="section-title">추천 AWS 서비스</h2>
                ${data.analysisResults.awsServices && data.analysisResults.awsServices.length > 0 ?
                    `<div class="services-grid">
                        ${data.analysisResults.awsServices.map(service => `
                            <div class="service-card">
                                <div class="service-title">${service.service}</div>
                                <div class="service-section">
                                    <div class="service-section-title">추천 이유</div>
                                    <div class="service-section-content">${service.reason}</div>
                                </div>
                                <div class="service-section">
                                    <div class="service-section-title">구현 방안</div>
                                    <div class="service-section-content">${service.implementation}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` :
                    '<div class="no-data">추천 AWS 서비스가 생성되지 않았습니다.</div>'
                }
            </div>
            
            <!-- Customer Cases -->
            <div class="section">
                <h2 class="section-title">관련 고객 사례</h2>
                ${data.analysisResults.customerCases && data.analysisResults.customerCases.length > 0 ?
                    `<div class="cases-list">
                        ${data.analysisResults.customerCases.map(customerCase => `
                            <div class="case-card">
                                <div class="case-title">${customerCase.title}</div>
                                <div class="case-section">
                                    <div class="case-section-title">사례 설명</div>
                                    <div class="case-section-content">${customerCase.description}</div>
                                </div>
                                <div class="case-section">
                                    <div class="case-section-title">관련성</div>
                                    <div class="case-section-content">${customerCase.relevance}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` :
                    '<div class="no-data">관련 고객 사례가 생성되지 않았습니다.</div>'
                }
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-info">
                <div class="footer-item">분석 완료: ${new Date(data.analysisResults.analyzedAt).toLocaleString('ko-KR')}</div>
                <div class="footer-item">사용 모델: ${modelName}</div>
                <div class="footer-item">리포트 생성: ${data.exportedAt}</div>
                <div class="footer-item">세션 ID: ${data.sessionId}</div>
            </div>
            <div style="margin-top: 15px; font-size: 0.8rem; color: #999;">
                이 리포트는 PreChat에서 자동 생성되었습니다.
            </div>
        </div>
    </div>
</body>
</html>`
}

function convertMarkdownToHTML(markdown: string): string {
  // Simple markdown to HTML conversion
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
  
  // Wrap in paragraphs if not already wrapped
  if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<ul') && !html.startsWith('<ol')) {
    html = '<p>' + html + '</p>'
  }
  
  // Fix list wrapping
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  
  return html
}

export function generateMeetingLogReportHTML(data: MeetingLogExportData): string {
  const modelName = BEDROCK_MODELS.find(m => m.id === data.analysisResults.modelUsed)?.name || data.analysisResults.modelUsed
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>미팅 로그 리포트 - ${data.customerInfo.company}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #232f3e 0%, #131a22 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .header .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .two-column-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 30px;
        }
        
        .left-column, .right-column {
            min-height: 500px;
        }
        
        .section {
            margin-bottom: 40px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 30px;
        }
        
        .section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .section-title {
            font-size: 1.8rem;
            color: #232f3e;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #ff9900;
            display: inline-block;
        }
        
        .customer-info {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ff9900;
        }
        
        .info-label {
            font-weight: 600;
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 1.1rem;
            color: #333;
        }
        
        .markdown-content {
            background: #ffffff;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            line-height: 1.7;
        }
        
        .meeting-log-content {
            background: #f8f9fa;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            line-height: 1.7;
            white-space: pre-wrap;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .markdown-content h1, .meeting-log-content h1 {
            color: #232f3e;
            font-size: 1.8rem;
            margin-bottom: 20px;
            border-bottom: 2px solid #ff9900;
            padding-bottom: 10px;
        }
        
        .markdown-content h2, .meeting-log-content h2 {
            color: #232f3e;
            font-size: 1.5rem;
            margin: 25px 0 15px 0;
        }
        
        .markdown-content h3, .meeting-log-content h3 {
            color: #232f3e;
            font-size: 1.3rem;
            margin: 20px 0 10px 0;
        }
        
        .markdown-content h4, .meeting-log-content h4 {
            color: #232f3e;
            font-size: 1.1rem;
            margin: 15px 0 8px 0;
        }
        
        .markdown-content p, .meeting-log-content p {
            margin-bottom: 15px;
        }
        
        .markdown-content ul, .markdown-content ol, .meeting-log-content ul, .meeting-log-content ol {
            margin: 15px 0;
            padding-left: 25px;
        }
        
        .markdown-content li, .meeting-log-content li {
            margin: 8px 0;
        }
        
        .markdown-content blockquote, .meeting-log-content blockquote {
            border-left: 4px solid #ff9900;
            padding-left: 20px;
            margin: 20px 0;
            font-style: italic;
            color: #666;
        }
        
        .markdown-content code, .meeting-log-content code {
            background: #f6f8fa;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .markdown-content pre, .meeting-log-content pre {
            background: #f6f8fa;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        .bant-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .bant-item {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #ff9900;
        }
        
        .bant-label {
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }
        
        .bant-content {
            color: #555;
            line-height: 1.6;
        }
        
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
        }
        
        .service-card {
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 25px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .service-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 15px;
        }
        
        .service-section {
            margin-bottom: 15px;
        }
        
        .service-section-title {
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }
        
        .service-section-content {
            color: #555;
            line-height: 1.5;
        }
        
        .cases-list {
            display: flex;
            flex-direction: column;
            gap: 25px;
        }
        
        .case-card {
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            background: #fafbfc;
            padding: 25px;
        }
        
        .case-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #232f3e;
            margin-bottom: 15px;
        }
        
        .case-section {
            margin-bottom: 15px;
        }
        
        .case-section:last-child {
            margin-bottom: 0;
        }
        
        .case-section-title {
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }
        
        .case-section-content {
            color: #555;
            line-height: 1.6;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
        }
        
        .footer-info {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        
        .footer-item {
            font-size: 0.9rem;
        }
        
        .no-data {
            text-align: center;
            color: #999;
            font-style: italic;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
            
            .section {
                page-break-inside: avoid;
            }
            
            .two-column-layout {
                grid-template-columns: 1fr;
            }
        }
        
        @media (max-width: 1200px) {
            .two-column-layout {
                grid-template-columns: 1fr;
                gap: 30px;
            }
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .bant-grid {
                grid-template-columns: 1fr;
            }
            
            .services-grid {
                grid-template-columns: 1fr;
            }
            
            .footer-info {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AWS PreChat 미팅 로그 리포트</h1>
            <div class="subtitle">사전상담 대화 분석 + 미팅 로그</div>
        </div>
        
        <div class="content">
            <!-- Customer Information -->
            <div class="section">
                <h2 class="section-title">고객 정보</h2>
                <div class="customer-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">고객명</div>
                            <div class="info-value">${data.customerInfo.name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">이메일</div>
                            <div class="info-value">${data.customerInfo.email}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">회사명</div>
                            <div class="info-value">${data.customerInfo.company}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">담당 세일즈</div>
                            <div class="info-value">${data.salesRepInfo?.name || data.salesRepEmail}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Two Column Layout -->
            <div class="two-column-layout">
                <!-- Left Column - AI Analysis -->
                <div class="left-column">
                    <!-- Summary Report -->
                    <div class="section">
                        <h2 class="section-title">요약 보고서</h2>
                        ${data.analysisResults.markdownSummary ? 
                            `<div class="markdown-content">${convertMarkdownToHTML(data.analysisResults.markdownSummary)}</div>` :
                            '<div class="no-data">요약 보고서가 생성되지 않았습니다.</div>'
                        }
                    </div>
                    
                    <!-- BANT Analysis -->
                    <div class="section">
                        <h2 class="section-title">BANT 분석</h2>
                        ${data.analysisResults.bantAnalysis && (data.analysisResults.bantAnalysis.budget || data.analysisResults.bantAnalysis.authority || data.analysisResults.bantAnalysis.need || data.analysisResults.bantAnalysis.timeline) ?
                            `<div class="bant-grid">
                                <div class="bant-item">
                                    <div class="bant-label">Budget (예산)</div>
                                    <div class="bant-content">${data.analysisResults.bantAnalysis.budget || '정보 없음'}</div>
                                </div>
                                <div class="bant-item">
                                    <div class="bant-label">Authority (권한)</div>
                                    <div class="bant-content">${data.analysisResults.bantAnalysis.authority || '정보 없음'}</div>
                                </div>
                                <div class="bant-item">
                                    <div class="bant-label">Need (필요성)</div>
                                    <div class="bant-content">${data.analysisResults.bantAnalysis.need || '정보 없음'}</div>
                                </div>
                                <div class="bant-item">
                                    <div class="bant-label">Timeline (일정)</div>
                                    <div class="bant-content">${data.analysisResults.bantAnalysis.timeline || '정보 없음'}</div>
                                </div>
                            </div>` :
                            '<div class="no-data">BANT 분석 결과가 생성되지 않았습니다.</div>'
                        }
                    </div>
                    
                    <!-- AWS Services -->
                    <div class="section">
                        <h2 class="section-title">추천 AWS 서비스</h2>
                        ${data.analysisResults.awsServices && data.analysisResults.awsServices.length > 0 ?
                            `<div class="services-grid">
                                ${data.analysisResults.awsServices.map(service => `
                                    <div class="service-card">
                                        <div class="service-title">${service.service}</div>
                                        <div class="service-section">
                                            <div class="service-section-title">추천 이유</div>
                                            <div class="service-section-content">${service.reason}</div>
                                        </div>
                                        <div class="service-section">
                                            <div class="service-section-title">구현 방안</div>
                                            <div class="service-section-content">${service.implementation}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>` :
                            '<div class="no-data">추천 AWS 서비스가 생성되지 않았습니다.</div>'
                        }
                    </div>
                    
                    <!-- Customer Cases -->
                    <div class="section">
                        <h2 class="section-title">관련 고객 사례</h2>
                        ${data.analysisResults.customerCases && data.analysisResults.customerCases.length > 0 ?
                            `<div class="cases-list">
                                ${data.analysisResults.customerCases.map(customerCase => `
                                    <div class="case-card">
                                        <div class="case-title">${customerCase.title}</div>
                                        <div class="case-section">
                                            <div class="case-section-title">사례 설명</div>
                                            <div class="case-section-content">${customerCase.description}</div>
                                        </div>
                                        <div class="case-section">
                                            <div class="case-section-title">관련성</div>
                                            <div class="case-section-content">${customerCase.relevance}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>` :
                            '<div class="no-data">관련 고객 사례가 생성되지 않았습니다.</div>'
                        }
                    </div>
                </div>
                
                <!-- Right Column - Meeting Log -->
                <div class="right-column">
                    <div class="section">
                        <h2 class="section-title">미팅 로그</h2>
                        ${data.meetingLog ? 
                            `<div class="meeting-log-content">${convertMarkdownToHTML(data.meetingLog)}</div>` :
                            '<div class="no-data">미팅 로그가 작성되지 않았습니다.</div>'
                        }
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-info">
                <div class="footer-item">분석 완료: ${new Date(data.analysisResults.analyzedAt).toLocaleString('ko-KR')}</div>
                <div class="footer-item">사용 모델: ${modelName}</div>
                <div class="footer-item">리포트 생성: ${data.exportedAt}</div>
                <div class="footer-item">세션 ID: ${data.sessionId}</div>
            </div>
            <div style="margin-top: 15px; font-size: 0.8rem; color: #999;">
                이 리포트는 PreChat에서 자동 생성되었습니다.
            </div>
        </div>
    </div>
</body>
</html>`
}

export function downloadHTMLFile(htmlContent: string, filename: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}