import { Button, ButtonProps } from '@cloudscape-design/components'
import { ReactNode } from 'react'

interface AnimatedButtonProps extends ButtonProps {
  children: ReactNode
  animation?: 'pulse' | 'float' | 'none'
}

export default function AnimatedButton({ children, animation = 'pulse', ...props }: AnimatedButtonProps) {
  const animationClass = animation === 'pulse' ? 'pulse-hover' : animation === 'float' ? 'float' : ''
  const existingClassName = props.className || ''
  
  return (
    <Button 
      {...props} 
      className={`${existingClassName} ${animationClass}`.trim()}
    >
      {children}
    </Button>
  )
}