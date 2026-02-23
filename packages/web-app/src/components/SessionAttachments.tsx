// nosemgrep
import { useState, useEffect } from 'react'
import {
  Box,
  SpaceBetween,
  Alert,
  Spinner,
  Container,
  Header
} from '@cloudscape-design/components'
import { adminApi } from '../services/api'
import FileList from './FileList'
import ImageGallery from './ImageGallery'
import { UploadedFile } from '../utils/fileUtils'
import { useI18n } from '../i18n'

interface SessionAttachmentsProps {
  sessionId: string
}

export default function SessionAttachments({ sessionId }: SessionAttachmentsProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadFiles()
  }, [sessionId])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await adminApi.listSessionFiles(sessionId)
      console.log('SessionAttachments - API response:', response)
      console.log('SessionAttachments - Files:', response.files)
      setFiles(response.files || [])
    } catch (err) {
      console.error('SessionAttachments - Error loading files:', err)
      setError(t('adminSessionDetail.attachments.failedLoad'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFile = async (fileKey: string) => {
    if (!confirm(t('adminSessionDetail.attachments.deleteConfirm'))) {
      return
    }

    try {
      setDeleting(fileKey)
      await adminApi.deleteSessionFile(sessionId, fileKey)
      setFiles(prev => prev.filter(file => file.fileKey !== fileKey))
    } catch (err) {
      console.error('Error deleting file:', err)
      setError(t('adminSessionDetail.attachments.failedDelete'))
    } finally {
      setDeleting(null)
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
      <Alert type="error" header={t('adminSessionDetail.alert.errorOccurred')}>
        {error}
      </Alert>
    )
  }

  return (
    <SpaceBetween size="l">
      {/* File List Table */}
      <Container>
        <Header variant="h3">{t('adminSessionDetail.attachments.uploadedFilesTitle')}</Header>
        <FileList 
          files={files} 
          loading={loading || deleting !== null}
          onDelete={handleDeleteFile}
          sessionId={sessionId}
        />
      </Container>

      {/* Image Gallery */}
      <ImageGallery 
        files={files} 
        onDelete={handleDeleteFile}
        sessionId={sessionId}
      />
    </SpaceBetween>
  )
}