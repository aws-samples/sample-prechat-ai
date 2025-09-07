import { useState } from 'react'

export const useFormSubmission = <T>(
  submitFn: (data: T) => Promise<any>,
  onSuccess?: (result: any) => void,
  onError?: (error: any) => void
) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (data: T) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await submitFn(data)
      if (onSuccess) {
        onSuccess(result)
      }
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred'
      setError(errorMessage)
      if (onError) {
        onError(err)
      }
      throw err
    } finally {
      setLoading(false)
    }
  }

  const setSuccessMessage = (message: string) => {
    setSuccess(message)
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  return {
    loading,
    error,
    success,
    submit,
    setSuccessMessage,
    clearMessages
  }
}