// nosemgrep
import { useState, useEffect } from 'react'
import { Alert } from '@cloudscape-design/components'

const NOTIFICATION_KEY = 'bedrock-quota-notification-shown'

export default function BedrockQuotaNotification() {
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    // Check if notification has been shown in this browser tab
    const hasBeenShown = sessionStorage.getItem(NOTIFICATION_KEY)
    
    if (!hasBeenShown) {
      setShowNotification(true)
    }
  }, [])

  const handleDismiss = () => {
    setShowNotification(false)
    // Mark as shown in this browser tab
    sessionStorage.setItem(NOTIFICATION_KEY, 'true')
  }

  if (!showNotification) {
    return null
  }

  return (
    <Alert
      type="warning"
      dismissible
      onDismiss={handleDismiss}
      header="Bedrock 할당량 안내"
    >
      Bedrock Quota 가 한정된 환경이므로 어시스턴스 응답에 스로틀링이 발생할 수 있습니다.
    </Alert>
  )
}