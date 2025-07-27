import axios from 'axios'
import { ChatMessageRequest, ChatMessageResponse, Session } from '../types'

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
  }
}

export const adminApi = {
  createSession: async (data: {
    customerName: string
    customerEmail: string
    customerCompany: string
    targetAuthority: string
    salesRepId: string
  }) => {
    const response = await api.post('/admin/sessions', data)
    return response.data
  },

  listSessions: async () => {
    const response = await api.get('/admin/sessions')
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
  }
}