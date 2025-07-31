import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Box, Spinner } from '@cloudscape-design/components'
import { authService } from '../services/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        setIsAuthenticated(false)
        return
      }

      try {
        await authService.verifyToken()
        setIsAuthenticated(true)
      } catch {
        authService.signout()
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  if (isAuthenticated === null) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}