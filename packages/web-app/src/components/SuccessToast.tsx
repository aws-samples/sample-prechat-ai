// nosemgrep
import { useEffect } from 'react'
import { StatusIndicator } from '@cloudscape-design/components'

interface SuccessToastProps {
  message: string
  show: boolean
  onHide: () => void
  duration?: number
}

export default function SuccessToast({ message, show, onHide, duration = 3000 }: SuccessToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, duration)
      return () => clearTimeout(timer)
    }
  }, [show, onHide, duration])

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        padding: '8px',
        backgroundColor: 'var(--awsui-color-background-status-success)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
      className="success-animation"
    >
      <StatusIndicator type="success">
        {message}
      </StatusIndicator>
    </div>
  )
}