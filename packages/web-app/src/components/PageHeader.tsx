// nosemgrep
import { Box, Header } from '@cloudscape-design/components'

export default function PageHeader() {
  return (
    <div
      style={{
        background: 'linear-gradient(-45deg, #232f3e, #ff9900, #146eb4, #232f3e)',
        backgroundSize: '400% 400%',
        padding: '16px',
        textAlign: 'center'
      }}
    >
      <Header variant="h1" className="typewriter fade-in-up">
        <span style={{ color: 'white' }}>AWS PreChat</span>
      </Header>
      <Box fontSize="body-m" padding={{ top: 's' }} textAlign="left">
        <span style={{ color: 'white' }}>
          AWS PreChat is a conversational AI web system designed to streamline the pre-meeting preparation process between AWS sales teams and customers. The system replaces traditional Excel-based forms with an intuitive chatbot interface that guides customers through a structured conversation to collect business requirements, technical constraints, and project timelines. The collected information is then processed and presented to AWS sales representatives and engineers in an organized, actionable format.
        </span>
      </Box>
    </div>
  )
}