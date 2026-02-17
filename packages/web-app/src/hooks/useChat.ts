import { useState } from 'react'
import { chatApi } from '../services/api'
import { Message } from '../types'
import { MESSAGES } from '../constants'

export const useChat = (sessionId: string | undefined) => {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)

  const sendMessage = async (
    onMessageAdd: (message: Message) => void,
    onComplete: (complete: boolean) => void,
    onMessageUpdate?: (messageId: string, message: Message) => void
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

    // Create initial streaming message
    const botMessageId = (parseInt(messageId) + 1).toString()
    const initialBotMessage: Message = {
      id: botMessageId,
      content: '',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation'
    }
    
    setStreamingMessage(initialBotMessage)
    onMessageAdd(initialBotMessage)

    try {
      const response = await chatApi.sendStreamMessage({
        sessionId,
        message: inputValue,
        messageId
      })

      // Simulate streaming by displaying chunks progressively
      if (response.chunks && response.chunks.length > 0) {
        let accumulatedContent = ''
        
        for (let i = 0; i < response.chunks.length; i++) {
          accumulatedContent += response.chunks[i]
          
          const updatedMessage: Message = {
            ...initialBotMessage,
            content: accumulatedContent.replace('EOF', '').trim()
          }
          
          setStreamingMessage(updatedMessage)
          
          // Update the message in the session if callback is provided
          if (onMessageUpdate) {
            onMessageUpdate(botMessageId, updatedMessage)
          }
          
          // Add delay to simulate real-time streaming
          if (i < response.chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }

      // Final message update
      const finalContent = response.response.replace('EOF', '').trim()
      const finalBotMessage: Message = {
        ...initialBotMessage,
        content: finalContent,
        contentType: response.contentType || 'text'
      }
      
      // Update the final message
      if (onMessageUpdate) {
        onMessageUpdate(botMessageId, finalBotMessage)
      }
      
      setStreamingMessage(null)
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
      setStreamingMessage(null)
      onMessageAdd(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const sendFormSubmission = async (
    formData: Record<string, string>,
    onMessageAdd: (message: Message) => void,
    onComplete: (complete: boolean) => void,
    onMessageUpdate?: (messageId: string, message: Message) => void
  ) => {
    if (loading || !sessionId) return

    const messageId = Date.now().toString()
    const userMessage: Message = {
      id: messageId,
      content: JSON.stringify(formData),
      contentType: 'form-submission',
      sender: 'customer',
      timestamp: new Date().toISOString(),
      stage: 'conversation'
    }

    onMessageAdd(userMessage)
    setLoading(true)
    setError('')

    // 봇 응답용 초기 메시지 생성
    const botMessageId = (parseInt(messageId) + 1).toString()
    const initialBotMessage: Message = {
      id: botMessageId,
      content: '',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      stage: 'conversation'
    }

    setStreamingMessage(initialBotMessage)
    onMessageAdd(initialBotMessage)

    try {
      const response = await chatApi.sendStreamMessage({
        sessionId,
        message: JSON.stringify(formData),
        messageId,
        contentType: 'form-submission'
      })

      // 스트리밍 청크 처리
      if (response.chunks && response.chunks.length > 0) {
        let accumulatedContent = ''

        for (let i = 0; i < response.chunks.length; i++) {
          accumulatedContent += response.chunks[i]

          const updatedMessage: Message = {
            ...initialBotMessage,
            content: accumulatedContent.replace('EOF', '').trim()
          }

          setStreamingMessage(updatedMessage)

          if (onMessageUpdate) {
            onMessageUpdate(botMessageId, updatedMessage)
          }

          if (i < response.chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }

      // 최종 메시지 업데이트
      const finalContent = response.response.replace('EOF', '').trim()
      const finalBotMessage: Message = {
        ...initialBotMessage,
        content: finalContent,
        contentType: response.contentType || 'text'
      }

      if (onMessageUpdate) {
        onMessageUpdate(botMessageId, finalBotMessage)
      }

      setStreamingMessage(null)
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
      console.error('Failed to send form submission:', err)
      const errorMsg = err.response?.data?.error || 'Failed to send form submission'
      setError(errorMsg)

      const errorMessage: Message = {
        id: (parseInt(messageId) + 1).toString(),
        content: MESSAGES.FAILED_TO_SEND,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        stage: 'conversation'
      }
      setStreamingMessage(null)
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
    sendFormSubmission,
    clearInput,
    streamingMessage
  }
}