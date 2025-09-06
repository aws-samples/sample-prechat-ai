// nosemgrep
import { useState, useEffect } from 'react'
import { Box } from '@cloudscape-design/components'

interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
}

export default function TypewriterText({ text, speed = 50, onComplete }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  return (
    <Box>
      {displayText}
      {currentIndex < text.length && (
        <span style={{ 
          borderRight: '2px solid #ff9900', 
          animation: 'blink 1s infinite',
          marginLeft: '2px'
        }}>|</span>
      )}
    </Box>
  )
}