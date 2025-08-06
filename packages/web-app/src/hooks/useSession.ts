import { useState, useEffect } from 'react'
import { chatApi } from '../services/api'
import { Message, Session } from '../types'
import { MESSAGES } from '../constants'

export const useSession = (sessionId: string | undefined, shouldLoad: boolean = true) => {
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (sessionId && shouldLoad) {
      loadSession()
    } else if (!shouldLoad) {
      setLoading(false)
    }
  }, [sessionId, shouldLoad])

  const loadSession = async () => {
    if (!sessionId) return
    
    try {
      const session = await chatApi.getSession(sessionId)
      setSessionData(session)
      setMessages(session.conversationHistory)
      setIsComplete(session.status === 'completed')
    } catch (err) {
      setError(MESSAGES.SESSION_NOT_FOUND)
    } finally {
      setLoading(false)
    }
  }

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message])
  }

  const updateMessage = (messageId: string, updatedMessage: Message) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? updatedMessage : msg
    ))
  }

  const updateSessionComplete = (complete: boolean) => {
    setIsComplete(complete)
  }

  return {
    sessionData,
    messages,
    loading,
    error,
    isComplete,
    addMessage,
    updateMessage,
    updateSessionComplete,
    setMessages
  }
}