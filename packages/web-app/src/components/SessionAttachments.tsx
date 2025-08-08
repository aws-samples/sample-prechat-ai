import { useState, useEffect } from 'react'
import {
  Box,
  SpaceBetween,
  Alert,
  Spinner,
  Container,
  Header
} from '@cloudscape-design/components'
import { chatApi } from '../services/api'
import FileList from './FileList'
import ImageGallery from './ImageGallery'
import { UploadedFile } from '../utils/fileUtils'

interface SessionAttachmentsProps {
  sessionId: string
}

export default function SessionAttachments({ sessionId }: SessionAttachmentsProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFiles()
  }, [sessionId])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await chatApi.listSessionFiles(sessionId)
      console.log('SessionAttachments - API response:', response)
      console.log('SessionAttachments - Files:', response.files)
      setFiles(response.files || [])
    } catch (err) {
      console.error('SessionAttachments - Error loading files:', err)
      setError('파일 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" padding="l">
        <Spinner size="large" />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert type="error" header="오류">
        {error}
      </Alert>
    )
  }

  return (
    <SpaceBetween size="l">
      {/* File List Table */}
      <Container>
        <Header variant="h3">업로드된 파일</Header>
        <FileList files={files} />
      </Container>

      {/* Image Gallery */}
      <ImageGallery files={files} />
    </SpaceBetween>
  )
}