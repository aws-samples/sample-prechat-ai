import { Container, Box, Spinner } from '@cloudscape-design/components'

interface LoadingSpinnerProps {
  message?: string
  size?: 'normal' | 'large'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'large' 
}) => {
  return (
    <Container>
      <Box textAlign="center" padding="xxl">
        <Spinner size={size} />
        {message && (
          <Box margin={{ top: 's' }} color="text-status-inactive">
            {message}
          </Box>
        )}
      </Box>
    </Container>
  )
}