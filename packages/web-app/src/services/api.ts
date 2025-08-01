import axios from 'axios'
import type { ChatMessageRequest, ChatMessageResponse, Session, BedrockAgent } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

export const chatApi = {
  sendMessage: async (request: ChatMessageRequest): Promise<ChatMessageResponse> => {
    const response = await api.post('/chat/message', request)
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

  getSessionReport: async (sessionId: string) => {
    const response = await api.get(`/admin/sessions/${sessionId}/report`)
    return response.data
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
  }
}