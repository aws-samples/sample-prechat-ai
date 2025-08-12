import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Textarea,
  SpaceBetween
} from '@cloudscape-design/components'

interface MultilineChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  onClear?: () => void
}

export const MultilineChatInput: React.FC<MultilineChatInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "메시지를 입력하세요...",
  disabled = false,
  onClear
}) => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 모바일 환경 감지
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
      const isSmallScreen = window.innerWidth <= 768
      setIsMobile(isMobileDevice || isSmallScreen)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend()
    }
  }

  const handleClear = () => {
    if (onClear) {
      onClear()
    }
  }

  // 텍스트 영역의 행 수를 동적으로 계산
  const calculateRows = () => {
    const lineCount = value.split('\n').length
    return Math.min(Math.max(lineCount, 2), 6) // 최소 2줄, 최대 6줄
  }

  return (
    <Box>
      <SpaceBetween size="xs">
        {/* 모바일에서 도움말 표시 */}
        {isMobile && (
          <Box fontSize="body-s" color="text-status-inactive">
            💡 여러 줄 입력이 가능합니다. 전송하려면 아래 전송 버튼을 눌러주세요.
          </Box>
        )}
        
        {/* 데스크톱에서 도움말 표시 */}
        {!isMobile && (
          <Box fontSize="body-s" color="text-status-inactive">
            💡 Enter로 줄바꿈, 전송 버튼으로 메시지 전송
          </Box>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'flex-end',
          border: '1px solid var(--awsui-color-border-input-default)',
          borderRadius: '8px',
          padding: '8px',
          backgroundColor: 'var(--awsui-color-background-input-default)'
        }}>
          <div style={{ flex: 1 }}>
            <Textarea
              value={value}
              onChange={({ detail }) => onChange(detail.value)}
              placeholder={placeholder}
              disabled={disabled}
              rows={calculateRows()}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Button
              variant="primary"
              iconName="send"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              ariaLabel="메시지 전송"
            />
            
            {onClear && (
              <Button
                variant="normal"
                iconName="close"
                onClick={handleClear}
                disabled={!value || disabled}
                ariaLabel="입력 내용 지우기"
              />
            )}
          </div>
        </div>
      </SpaceBetween>
    </Box>
  )
}