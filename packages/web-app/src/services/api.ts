import axios from 'axios'
import type { 
  ChatMessageRequest, 
  ChatMessageResponse, 
  Session, 
  AnalysisResults,
  Campaign,
  CampaignAnalytics,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignListResponse,
  CampaignSessionsResponse,
  Trigger,
  CreateTriggerRequest,
  UpdateTriggerRequest,
  TriggerListResponse
} from '../types'
import { API_BASE_URL } from '../config/api'
import type { CustomizingSet } from '../types/customization'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Add Authorization header for authenticated requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('idToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
}

// Exponential backoff retry utility
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  retries: number = RETRY_CONFIG.maxRetries
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    if (retries > 0 && axios.isAxiosError(error)) {
      const statusCode = error.response?.status
      if (statusCode && RETRY_CONFIG.retryableStatusCodes.includes(statusCode)) {
        const delay = RETRY_CONFIG.retryDelay * Math.pow(2, RETRY_CONFIG.maxRetries - retries)
        await new Promise(resolve => setTimeout(resolve, delay))
        return retryWithBackoff(operation, retries - 1)
      }
    }
    throw error
  }
}

// Enhanced error handling utility
const handleApiError = (error: unknown, context: string): never => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message || error.message
    const statusCode = error.response?.status
    
    console.error(`API Error in ${context}:`, {
      message,
      statusCode,
      url: error.config?.url,
      method: error.config?.method
    })
    
    // Throw enhanced error with context
    const enhancedError = new Error(`${context}: ${message}`)
    ;(enhancedError as any).statusCode = statusCode
    ;(enhancedError as any).originalError = error
    throw enhancedError
  }
  
  console.error(`Unexpected error in ${context}:`, error)
  throw new Error(`${context}: An unexpected error occurred`)
}

export const chatApi = {
  sendMessage: async (request: ChatMessageRequest): Promise<ChatMessageResponse> => {
    const { sessionId, ...rest } = request as ChatMessageRequest & { sessionId: string }
    const response = await api.post(`/sessions/${sessionId}/messages`, rest)
    return response.data
  },

  sendStreamMessage: async (request: ChatMessageRequest): Promise<ChatMessageResponse & { chunks: string[] }> => {
    const { sessionId, ...rest } = request as ChatMessageRequest & { sessionId: string }
    const response = await api.post(`/sessions/${sessionId}/messages/stream`, rest)
    return response.data
  },

  getSession: async (sessionId: string): Promise<Session> => {
    const response = await api.get(`/sessions/${sessionId}`)
    // Store CSRF token if provided
    if (response.data.csrfToken) {
      localStorage.setItem(`csrf_${sessionId}`, response.data.csrfToken)
    }
    return response.data
  },

  verifySessionPin: async (sessionId: string, pinNumber: string, privacyAgreed: boolean = false) => {
    const response = await api.post(`/sessions/${sessionId}/verify-pin`, { 
      pinNumber, 
      privacyAgreed 
    })
    // Store CSRF token for subsequent requests
    if (response.data.csrfToken) {
      localStorage.setItem(`csrf_${sessionId}`, response.data.csrfToken)
    }
    return response.data
  },

  generateUploadUrl: async (sessionId: string, fileInfo: {
    fileName: string
    fileType: string
    fileSize: number
  }) => {
    const csrfToken = localStorage.getItem(`csrf_${sessionId}`)
    const response = await api.post(`/sessions/${sessionId}/files/upload-url`, fileInfo, {
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    })
    return response.data
  },

  listSessionFiles: async (sessionId: string) => {
    const csrfToken = localStorage.getItem(`csrf_${sessionId}`)
    const response = await api.get(`/sessions/${sessionId}/files`, {
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    })
    return response.data
  },

  deleteSessionFile: async (sessionId: string, fileKey: string) => {
    const csrfToken = localStorage.getItem(`csrf_${sessionId}`)
    const encodedFileKey = encodeURIComponent(fileKey)
    const response = await api.delete(`/sessions/${sessionId}/files/${encodedFileKey}`, {
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    })
    return response.data
  },

  submitFeedback: async (sessionId: string, rating: number, feedback: string) => {
    const csrfToken = localStorage.getItem(`csrf_${sessionId}`)
    const response = await api.post(`/sessions/${sessionId}/feedback`, {
      rating,
      feedback
    }, {
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    })
    return response.data
  },

  updateConsultationPurposes: async (sessionId: string, consultationPurposes: string) => {
    const csrfToken = localStorage.getItem(`csrf_${sessionId}`)
    const response = await api.put(`/sessions/${sessionId}/consultation-purposes`, {
      consultationPurposes
    }, {
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    })
    return response.data
  },


}

export const adminApi = {
  createSession: async (data: {
    customerName: string
    customerEmail: string
    customerCompany: string
    customerTitle: string
    salesRepEmail: string
    agentId: string
    pinNumber: string
    campaignId?: string
    campaignCode?: string
  }): Promise<any> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.post('/admin/sessions', data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Create Session')
    }
  },

  listSessions: async (campaignId?: string): Promise<any> => {
    try {
      return await retryWithBackoff(async () => {
        const params = campaignId ? { campaignId } : {}
        const response = await api.get('/admin/sessions', { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'List Sessions')
    }
  },

  getSessionDetails: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/details`)
    return response.data
  },

  getSessionReport: async (sessionId: string): Promise<AnalysisResults | null> => {
    try {
      const response = await api.get(`/admin/sessions/${sessionId}/report`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No analysis data exists yet
        return null
      }
      throw error
    }
  },

  inactivateSession: async (sessionId: string) => {
    const response = await api.patch(`/admin/sessions/${sessionId}`, { status: 'inactive' })
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    const response = await api.delete(`/admin/sessions/${sessionId}`)
    return response.data
  },

  // Agent Configuration API
  listAgentConfigs: async (campaignId?: string) => {
    const params = campaignId ? { campaignId } : {}
    const response = await api.get('/admin/agent-configs', { params })
    return response.data
  },

  createAgentConfig: async (data: {
    agentRole: string
    agentRuntimeArn?: string
    modelId: string
    systemPrompt: string
    agentName: string
  }) => {
    const response = await api.post('/admin/agent-configs', data)
    return response.data
  },

  getAgentConfig: async (configId: string) => {
    const response = await api.get(`/admin/agent-configs/${configId}`)
    return response.data
  },

  updateAgentConfig: async (configId: string, data: {
    modelId?: string
    systemPrompt?: string
    agentName?: string
    status?: string
  }) => {
    const response = await api.put(`/admin/agent-configs/${configId}`, data)
    return response.data
  },

  deleteAgentConfig: async (configId: string) => {
    const response = await api.delete(`/admin/agent-configs/${configId}`)
    return response.data
  },



  // Unified Analysis API (AgentCore 기반)
  requestAnalysis: async (sessionId: string, configId?: string) => {
    const response = await api.post(`/admin/sessions/${sessionId}/analysis`, {
      configId: configId || ''
    })
    return response.data
  },

  getAnalysisStatus: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/analysis-status`)
    return response.data
  },

  // Admin file operations (no CSRF required)
  listSessionFiles: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/files`)
    return response.data
  },

  deleteSessionFile: async (sessionId: string, fileKey: string) => {
    const encodedFileKey = encodeURIComponent(fileKey)
    const response = await api.delete(`/admin/sessions/${sessionId}/files/${encodedFileKey}`)
    return response.data
  },

  generateFilePresignedUrl: async (sessionId: string, fileKey: string) => {
    const encodedFileKey = encodeURIComponent(fileKey)
    const response = await api.post(`/admin/sessions/${sessionId}/files/presigned-url/${encodedFileKey}`)
    return response.data
  },

  // Meeting log operations
  saveMeetingLog: async (sessionId: string, meetingLog: string) => {
    const response = await api.put(`/admin/sessions/${sessionId}/meeting-log`, { meetingLog })
    return response.data
  },

  reanalyzeWithMeetingLog: async (sessionId: string, configId?: string) => {
    const response = await api.post(`/admin/sessions/${sessionId}/analysis`, {
      configId: configId || '',
      includeMeetingLog: true
    })
    return response.data
  },

  getSessionFeedback: async (sessionId: string) => {
    try {
      const response = await api.get(`/admin/sessions/${sessionId}/feedback`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No feedback exists yet
        return null
      }
      throw error
    }
  },

  // Discussion operations
  listDiscussions: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/discussions`)
    return response.data
  },

  createDiscussion: async (sessionId: string, content: string) => {
    const response = await api.post(`/admin/sessions/${sessionId}/discussions`, { content })
    return response.data
  },

  updateDiscussion: async (sessionId: string, discussionId: string, content: string) => {
    const response = await api.put(`/admin/sessions/${sessionId}/discussions/${discussionId}`, { content })
    return response.data
  },

  deleteDiscussion: async (sessionId: string, discussionId: string) => {
    const response = await api.delete(`/admin/sessions/${sessionId}/discussions/${discussionId}`)
    return response.data
  },

  // User Management
  listCognitoUsers: async (paginationToken?: string, limit: number = 60) => {
    try {
      return await retryWithBackoff(async () => {
        const params: any = { limit }
        if (paginationToken) {
          params.paginationToken = paginationToken
        }
        const response = await api.get('/admin/users', { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'List Users')
    }
  },

  getCognitoUser: async (userId: string) => {
    try {
      if (!userId?.trim()) {
        throw new Error('User ID is required')
      }

      return await retryWithBackoff(async () => {
        const response = await api.get(`/admin/users/${userId}`)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get User')
    }
  }
}

export const campaignApi = {
  /**
   * List all campaigns with optional pagination
   */
  listCampaigns: async (nextToken?: string): Promise<CampaignListResponse> => {
    try {
      return await retryWithBackoff(async () => {
        const params = nextToken ? { nextToken } : {}
        const response = await api.get('/admin/campaigns', { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'List Campaigns')
    }
  },

  /**
   * Create a new campaign
   */
  createCampaign: async (data: CreateCampaignRequest): Promise<Campaign> => {
    try {
      // Validate required fields
      if (!data.campaignName?.trim()) {
        throw new Error('Campaign name is required')
      }
      if (!data.campaignCode?.trim()) {
        throw new Error('Campaign code is required')
      }
      if (!data.startDate || !data.endDate) {
        throw new Error('Start date and end date are required')
      }
      if (new Date(data.endDate) <= new Date(data.startDate)) {
        throw new Error('End date must be after start date')
      }

      return await retryWithBackoff(async () => {
        const response = await api.post('/admin/campaigns', data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Create Campaign')
    }
  },

  /**
   * Get campaign details by ID
   */
  getCampaign: async (campaignId: string): Promise<Campaign> => {
    try {
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      return await retryWithBackoff(async () => {
        const response = await api.get(`/admin/campaigns/${campaignId}`)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Campaign')
    }
  },

  /**
   * Update campaign details
   */
  updateCampaign: async (campaignId: string, data: UpdateCampaignRequest): Promise<Campaign> => {
    try {
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      // Validate date range if both dates are provided
      if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
        throw new Error('End date must be after start date')
      }

      return await retryWithBackoff(async () => {
        const response = await api.put(`/admin/campaigns/${campaignId}`, data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Update Campaign')
    }
  },

  /**
   * Delete a campaign
   */
  deleteCampaign: async (campaignId: string): Promise<void> => {
    try {
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      await retryWithBackoff(async () => {
        const response = await api.delete(`/admin/campaigns/${campaignId}`)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Delete Campaign')
    }
  },

  /**
   * Get sessions associated with a campaign
   */
  getCampaignSessions: async (campaignId: string, nextToken?: string): Promise<CampaignSessionsResponse> => {
    try {
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      return await retryWithBackoff(async () => {
        const params = nextToken ? { nextToken } : {}
        const response = await api.get(`/admin/campaigns/${campaignId}/sessions`, { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Campaign Sessions')
    }
  },

  /**
   * Get campaign analytics and metrics
   */
  getCampaignAnalytics: async (campaignId: string): Promise<CampaignAnalytics> => {
    try {
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      return await retryWithBackoff(async () => {
        const response = await api.get(`/admin/campaigns/${campaignId}/analytics`)
        
        // Transform and validate analytics data
        const analytics = response.data
        return {
          campaignId: analytics.campaignId,
          totalSessions: analytics.totalSessions || 0,
          activeSessions: analytics.activeSessions || 0,
          completedSessions: analytics.completedSessions || 0,
          completionRate: analytics.completionRate || 0,
          averageSessionDuration: analytics.averageSessionDuration || 0,
          topConsultationPurposes: analytics.topConsultationPurposes || [],
          sessionsByDate: analytics.sessionsByDate || [],
          customerCompanies: analytics.customerCompanies || []
        }
      })
    } catch (error) {
      return handleApiError(error, 'Get Campaign Analytics')
    }
  },

  /**
   * Associate a session with a campaign (via PATCH)
   */
  associateSessionWithCampaign: async (sessionId: string, campaignId: string): Promise<void> => {
    try {
      if (!sessionId?.trim()) {
        throw new Error('Session ID is required')
      }
      if (!campaignId?.trim()) {
        throw new Error('Campaign ID is required')
      }

      await retryWithBackoff(async () => {
        const response = await api.patch(`/admin/sessions/${sessionId}`, { campaignId })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Associate Session with Campaign')
    }
  },

  /**
   * Remove campaign association from a session (via PATCH)
   */
  dissociateSessionFromCampaign: async (sessionId: string): Promise<void> => {
    try {
      if (!sessionId?.trim()) {
        throw new Error('Session ID is required')
      }

      await retryWithBackoff(async () => {
        const response = await api.patch(`/admin/sessions/${sessionId}`, { campaignId: '' })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Dissociate Session from Campaign')
    }
  },

  /**
   * Get summary analytics across all campaigns
   */
  getCampaignsSummaryAnalytics: async (ownerId?: string): Promise<any> => {
    try {
      return await retryWithBackoff(async () => {
        const params = ownerId ? { ownerId } : {}
        const response = await api.get('/admin/analytics/summary', { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Campaigns Summary Analytics')
    }
  },

  /**
   * Get comparative analytics between multiple campaigns
   */
  getCampaignComparisonAnalytics: async (campaignIds: string[]): Promise<any> => {
    try {
      if (!campaignIds?.length) {
        throw new Error('Campaign IDs are required')
      }

      if (campaignIds.length > 10) {
        throw new Error('Maximum 10 campaigns can be compared at once')
      }

      return await retryWithBackoff(async () => {
        const response = await api.get('/admin/analytics/comparison', {
          params: { campaignIds: campaignIds.join(',') }
        })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Campaign Comparison Analytics')
    }
  }
}


export const triggerApi = {
  listTriggers: async (params?: { campaignId?: string; eventType?: string }): Promise<TriggerListResponse> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.get('/admin/triggers', { params })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'List Triggers')
    }
  },

  createTrigger: async (data: CreateTriggerRequest): Promise<Trigger> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.post('/admin/triggers', data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Create Trigger')
    }
  },

  getTrigger: async (triggerId: string): Promise<Trigger> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.get(`/admin/triggers/${triggerId}`)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Trigger')
    }
  },

  updateTrigger: async (triggerId: string, data: UpdateTriggerRequest): Promise<Trigger> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.put(`/admin/triggers/${triggerId}`, data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Update Trigger')
    }
  },

  deleteTrigger: async (triggerId: string): Promise<void> => {
    try {
      await retryWithBackoff(async () => {
        const response = await api.delete(`/admin/triggers/${triggerId}`)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Delete Trigger')
    }
  },

  listSnsTopics: async (): Promise<{ topics: Array<{ topicArn: string; topicName: string }>; count: number }> => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.get('/admin/triggers/sns-topics')
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'List SNS Topics')
    }
  },

}

export const customizationApi = {
  getCustomization: async () => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.get('/admin/customization')
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Get Customization')
    }
  },

  saveCustomization: async (data: CustomizingSet) => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.post('/admin/customization', data)
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Save Customization')
    }
  },

  uploadLogo: async (file: File): Promise<{ url: string }> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      return await retryWithBackoff(async () => {
        const response = await api.post('/admin/customization/upload/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Upload Logo')
    }
  },

  resetCustomization: async () => {
    try {
      return await retryWithBackoff(async () => {
        const response = await api.delete('/admin/customization')
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Reset Customization')
    }
  },

  uploadLegalDoc: async (
    file: File,
    docType: 'privacy' | 'service',
    locale: 'ko' | 'en'
  ): Promise<{ url: string }> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      return await retryWithBackoff(async () => {
        const response = await api.post(
          `/admin/customization/upload/legal/${docType}?locale=${locale}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return response.data
      })
    } catch (error) {
      return handleApiError(error, 'Upload Legal Document')
    }
  },
}
