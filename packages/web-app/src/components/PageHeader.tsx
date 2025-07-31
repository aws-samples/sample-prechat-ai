import { Box, Header } from '@cloudscape-design/components'

export default function PageHeader() {
  return (
    <Box
      padding="m"
      textAlign="center"
      style={{
        background: 'linear-gradient(-45deg, #232f3e, #ff9900, #146eb4, #232f3e)',
        backgroundSize: '400% 400%'
      }}
    >
      <Header variant="h1" color="white" className="typewriter fade-in-up">
        AWS PreChat
      </Header>
      <Box color="white" fontSize="body-m" padding={{ top: 's' }} textAlign="left">
        AWS PreChat is a conversational AI web system designed to streamline the pre-meeting preparation process between AWS sales teams and customers. The system replaces traditional Excel-based forms with an intuitive chatbot interface that guides customers through a structured conversation to collect business requirements, technical constraints, and project timelines. The collected information is then processed and presented to AWS sales representatives and engineers in an organized, actionable format.
      </Box>
    </Box>
  )
}