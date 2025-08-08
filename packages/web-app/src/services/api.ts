import axios from 'axios'
import type { ChatMessageRequest, ChatMessageResponse, Session, AnalysisResults } from '../types'
import { API_BASE_URL } from '../config/api'

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

export const chatApi = {
  sendMessage: async (request: ChatMessageRequest): Promise<ChatMessageResponse> => {
    const response = await api.post('/chat/message', request)
    return response.data
  },

  sendStreamMessage: async (request: ChatMessageRequest): Promise<ChatMessageResponse & { chunks: string[] }> => {
    const response = await api.post('/chat/stream', request)
    return response.data
  },

  getSession: async (sessionId: string): Promise<Session> => {
    const response = await api.get(`/chat/session/${sessionId}`)
    return response.data
  },

  verifySessionPin: async (sessionId: string, pinNumber: string, privacyAgreed: boolean = false) => {
    const response = await api.post(`/chat/session/${sessionId}/verify-pin`, { 
      pinNumber, 
      privacyAgreed 
    })
    return response.data
  },

  generateUploadUrl: async (sessionId: string, fileInfo: {
    fileName: string
    fileType: string
    fileSize: number
  }) => {
    const response = await api.post(`/chat/session/${sessionId}/upload-url`, fileInfo)
    return response.data
  },

  listSessionFiles: async (sessionId: string) => {
    const response = await api.get(`/chat/session/${sessionId}/files`)
    return response.data
  },

  deleteSessionFile: async (sessionId: string, fileKey: string) => {
    // Encode the fileKey to handle special characters in the path
    const encodedFileKey = encodeURIComponent(fileKey)
    const response = await api.delete(`/chat/session/${sessionId}/files/${encodedFileKey}`)
    return response.data
  }
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
  }) => {
    const response = await api.post('/admin/sessions', data)
    return response.data
  },

  listSessions: async () => {
    const response = await api.get('/admin/sessions')
    return response.data
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
    const response = await api.put(`/admin/sessions/${sessionId}/inactivate`)
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    const response = await api.delete(`/admin/sessions/${sessionId}`)
    return response.data
  },

  // Bedrock Agents API
  listAgents: async () => {
    const response = await api.get('/admin/agents')
    return response.data
  },

  createAgent: async (data: {
    agentName: string
    foundationModel: string
    instruction: string
  }) => {
    const response = await api.post('/admin/agents', data)
    return response.data
  },

  deleteAgent: async (agentId: string) => {
    const response = await api.delete(`/admin/agents/${agentId}`)
    return response.data
  },

  prepareAgent: async (agentId: string) => {
    const response = await api.post(`/admin/agents/${agentId}/prepare`)
    return response.data
  },

  getAgent: async (agentId: string) => {
    const response = await api.get(`/admin/agents/${agentId}`)
    return response.data
  },

  updateAgent: async (agentId: string, data: {
    foundationModel: string
    instruction: string
  }) => {
    const response = await api.put(`/admin/agents/${agentId}`, data)
    return response.data
  },



  // Producer-Consumer Analysis API
  requestAnalysis: async (sessionId: string, modelId: string) => {
    const response = await api.post(`/admin/sessions/${sessionId}/analyze`, { modelId })
    return response.data
  },

  getAnalysisStatus: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/analysis-status`)
    return response.data
  }
}