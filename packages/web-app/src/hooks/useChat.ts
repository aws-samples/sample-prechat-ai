import { useState } from 'react'
import { chatApi } from '../services/api'
import { Message } from '../types'
import { MESSAGES } from '../constants'

export const useChat = (sessionId: string | undefined) => {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendMessage = async (
    onMessageAdd: (message: Message) => void,
    onComplete: (complete: boolean) => void
  ) => {
    if (!inputValue.trim() || loading || !sessionId) return

    const messageId = Date.now().toString()
    const userMessage: Message = {
      id: messageId,
      content: inputValue,
      sender: 'customer',
      timestamp: new Date().toISOString(),
      stage: 'conversation'
    }

    onMessageAdd(userMessage)
    setInputValue('')
    setLoading(true)
    setError('')

    try {
      const response = await chatApi.sendMessage({
        sessionId,
        message: inputValue,
        messageId
      })

      // Clean up EOF token from response
      const cleanedResponse = response.response.replace('EOF', '').trim()

      const botMessage: Message = {
        id: (parseInt(messageId) + 1).toString(),
        content: cleanedResponse,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation'
      }

      onMessageAdd(botMessage)
      onComplete(response.isComplete)

      if (response.salesRepInfo) {
        const contactMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `🎯 **Consultation Complete!**\n\nYour AWS sales representative will contact you:\n\n👤 **${response.salesRepInfo.name}**\n📧 ${response.salesRepInfo.email}\n📞 ${response.salesRepInfo.phone}\n\n✅ Next steps will be shared via email within 24 hours.`,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          stage: 'conversation'
        }
        setTimeout(() => onMessageAdd(contactMessage), 500)
      }
    } catch (err: any) {
      console.error('Failed to send message:', err)
      const errorMsg = err.response?.data?.error || 'Failed to send message'
      setError(errorMsg)

      // Add error message to chat
      const errorMessage: Message = {
        id: (parseInt(messageId) + 1).toString(),
        content: MESSAGES.FAILED_TO_SEND,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation'
      }
      onMessageAdd(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const clearInput = () => {
    setInputValue('')
  }

  return {
    inputValue,
    setInputValue,
    loading,
    error,
    sendMessage,
    clearInput
  }
}