import type { CampaignAnalytics, Session, Campaign } from '../types'

/**
 * Calculate campaign analytics from session data
 */
export function calculateCampaignMetrics(sessions: Session[]): Omit<CampaignAnalytics, 'campaignId'> {
  const totalSessions = sessions.length
  const activeSessions = sessions.filter(s => s.status === 'active').length
  const completedSessions = sessions.filter(s => s.status === 'completed').length
  
  // Calculate completion rate
  const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
  
  // Calculate average session duration for completed sessions
  const completedSessionsWithDuration = sessions.filter(s => 
    s.status === 'completed' && s.createdAt && s.completedAt
  )
  
  let totalDuration = 0
  completedSessionsWithDuration.forEach(session => {
    if (session.createdAt && session.completedAt) {
      const created = new Date(session.createdAt)
      const completed = new Date(session.completedAt)
      const duration = (completed.getTime() - created.getTime()) / (1000 * 60) // Convert to minutes
      totalDuration += duration
    }
  })
  
  const averageSessionDuration = completedSessionsWithDuration.length > 0 
    ? totalDuration / completedSessionsWithDuration.length 
    : 0
  
  // Analyze consultation purposes
  const purposesMap = new Map<string, number>()
  sessions.forEach(session => {
    if (session.consultationPurposes) {
      // Split by common delimiters and clean up
      const purposes = session.consultationPurposes
        .split(/[,;]/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      purposes.forEach(purpose => {
        purposesMap.set(purpose, (purposesMap.get(purpose) || 0) + 1)
      })
    }
  })
  
  const topConsultationPurposes = Array.from(purposesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([purpose, count]) => ({ purpose, count }))
  
  // Analyze sessions by date
  const sessionsByDateMap = new Map<string, number>()
  sessions.forEach(session => {
    if (session.createdAt) {
      const date = new Date(session.createdAt).toISOString().split('T')[0]
      sessionsByDateMap.set(date, (sessionsByDateMap.get(date) || 0) + 1)
    }
  })
  
  const sessionsByDate = Array.from(sessionsByDateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
  
  // Analyze customer companies
  const companiesMap = new Map<string, number>()
  sessions.forEach(session => {
    if (session.customerInfo?.company) {
      const company = session.customerInfo.company
      companiesMap.set(company, (companiesMap.get(company) || 0) + 1)
    }
  })
  
  const customerCompanies = Array.from(companiesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([company, sessionCount]) => ({ company, sessionCount }))
  
  return {
    totalSessions,
    activeSessions,
    completedSessions,
    completionRate: Math.round(completionRate * 100) / 100,
    averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
    topConsultationPurposes,
    sessionsByDate,
    customerCompanies
  }
}

/**
 * Calculate time-series data for campaign trends
 */
export function calculateCampaignTrends(sessions: Session[], dateRange: { start: Date; end: Date }) {
  const trends = new Map<string, { date: string; sessions: number; completed: number }>()
  
  // Initialize all dates in range with zero values
  const currentDate = new Date(dateRange.start)
  while (currentDate <= dateRange.end) {
    const dateStr = currentDate.toISOString().split('T')[0]
    trends.set(dateStr, { date: dateStr, sessions: 0, completed: 0 })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Populate with actual session data
  sessions.forEach(session => {
    if (session.createdAt) {
      const sessionDate = new Date(session.createdAt).toISOString().split('T')[0]
      const existing = trends.get(sessionDate)
      if (existing) {
        existing.sessions += 1
        if (session.status === 'completed') {
          existing.completed += 1
        }
      }
    }
  })
  
  return Array.from(trends.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calculate performance metrics for campaign comparison
 */
export function calculateCampaignComparison(campaigns: Array<Campaign & { sessions?: Session[] }>) {
  return campaigns.map(campaign => {
    const sessions = campaign.sessions || []
    const metrics = calculateCampaignMetrics(sessions)
    
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      campaignCode: campaign.campaignCode,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      ownerName: campaign.ownerName,
      ...metrics
    }
  }).sort((a, b) => b.completionRate - a.completionRate)
}

/**
 * Generate summary statistics across multiple campaigns
 */
export function calculateCampaignsSummary(campaigns: Campaign[]) {
  const totalCampaigns = campaigns.length
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const totalSessions = campaigns.reduce((sum, c) => sum + (c.sessionCount || 0), 0)
  const totalCompletedSessions = campaigns.reduce((sum, c) => sum + (c.completedSessionCount || 0), 0)
  
  const overallCompletionRate = totalSessions > 0 
    ? (totalCompletedSessions / totalSessions) * 100 
    : 0
  
  // Find top performing campaigns by completion rate
  const campaignsWithSessions = campaigns.filter(c => (c.sessionCount || 0) > 0)
  const topPerformingCampaigns = campaignsWithSessions
    .map(c => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      sessionCount: c.sessionCount || 0,
      completedSessionCount: c.completedSessionCount || 0,
      completionRate: ((c.completedSessionCount || 0) / (c.sessionCount || 1)) * 100
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5)
  
  // Status distribution
  const statusDistribution = campaigns.reduce((acc, campaign) => {
    acc[campaign.status] = (acc[campaign.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return {
    totalCampaigns,
    activeCampaigns,
    totalSessions,
    totalCompletedSessions,
    overallCompletionRate: Math.round(overallCompletionRate * 100) / 100,
    topPerformingCampaigns,
    statusDistribution
  }
}

/**
 * Format duration in minutes to human readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  
  return ((current - previous) / previous) * 100
}

/**
 * Generate date range for analytics based on campaign dates
 */
export function generateAnalyticsDateRange(campaign: Campaign): { start: Date; end: Date } {
  const start = new Date(campaign.startDate)
  const end = new Date(campaign.endDate)
  
  // Extend range slightly to capture edge cases
  start.setDate(start.getDate() - 1)
  end.setDate(end.getDate() + 1)
  
  return { start, end }
}