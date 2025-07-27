import { Box, Header } from '@cloudscape-design/components'

export default function PageHeader() {
  return (
    <Box
      backgroundColor="#1b232d"
      padding="m"
      textAlign="center"
    >
      <Header variant="h1" color="white">
        AWS PreChat
      </Header>
    </Box>
  )
}