// nosemgrep
import { useState, useRef, useEffect } from 'react'
import {
  Modal,
  Box,
  Button,
  SpaceBetween,
  Alert,
  ProgressBar,
  Table,
  Header,
  Container,
  Icon
} from '@cloudscape-design/components'
import { chatApi } from '../services/api'
import { useI18n } from '../i18n'

interface UploadedFile {
  fileKey: string
  fileName: string
  encodedFileName?: string
  fileSize: number
  uploadedAt: string
  contentType: string
}

interface FileUploadProps {
  sessionId: string
  visible: boolean
  onDismiss: () => void
}

export default function FileUpload({ sessionId, visible, onDismiss }: FileUploadProps) {
  const { t, locale } = useI18n();
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Load uploaded files when modal opens
  const loadUploadedFiles = async () => {
    if (!visible) return

    setLoadingFiles(true)
    try {
      const response = await chatApi.listSessionFiles(sessionId)
      setUploadedFiles(response.files || [])
    } catch (err) {
      console.error('Failed to load files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  // Load files when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadUploadedFiles()
    }
  }, [visible])



  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const validateAndUploadFile = async (file: File) => {
    // Reset states
    setError('')
    setSuccess('')
    setUploadProgress(0)

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      setError(t('file_size_exceeded_error'))
      return
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'
    ]

    if (!allowedTypes.includes(file.type)) {
      setError(t('unsupported_file_type_error'))
      return
    }

    setUploading(true)

    try {
      // Get presigned URL
      const urlResponse = await chatApi.generateUploadUrl(sessionId, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      })

      // Upload file to S3
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setSuccess(t('file_upload_success'))
          setUploadProgress(100)
          loadUploadedFiles() // Refresh file list
        } else {
          setError(t('file_upload_failed'))
        }
        setUploading(false)
      })

      xhr.addEventListener('error', (event) => {
        console.error('Upload error:', event)
        console.error('XHR status:', xhr.status)
        console.error('XHR response:', xhr.responseText)
        setError(t('status_mixed_719b2f') + xhr.status + ')')
        setUploading(false)
      })

      xhr.open('PUT', urlResponse.uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)

    } catch (err: any) {
      setError(err.response?.data?.error || t('file_upload_failed'))
      setUploading(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await validateAndUploadFile(file)

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      await validateAndUploadFile(files[0]) // Only handle the first file
    }
  }

  const handleDeleteFile = async (fileKey: string) => {
    if (!confirm(t('delete_c689deef'))) {
      return
    }

    try {
      await chatApi.deleteSessionFile(sessionId, fileKey)
      setSuccess(t('file_delete_success'))
      loadUploadedFiles() // Refresh file list
    } catch (err: any) {
      setError(err.response?.data?.error || t('file_delete_failed'))
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getDisplayFileName = (file: UploadedFile): string => {

    if (file.encodedFileName) {
      try {
        // Properly decode UTF-8 from base64
        const binaryString = atob(file.encodedFileName)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const decoded = new TextDecoder('utf-8').decode(bytes)
        return decoded
      } catch (error) {
        console.error('Failed to decode filename:', error)
        return file.fileName
      }
    }
    return file.fileName
  }

  return (
    <Modal
      onDismiss={onDismiss}
      visible={visible}
      header={t('btn_file_attach')}
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              {t('modal_confirm_button')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Container>
        <SpaceBetween size="s">
          <Box>
            <Header variant="h3">{t('loading_154127e6')}</Header>
            <SpaceBetween size="s">
              <Box variant="p">
                <strong>{t('consultation_dafee129')}</strong>
              </Box>
              <Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>{t('korean_06584212')}</strong>{t('korean_8bb6b000')}
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>{t('korean_988eb876')}</strong>{t('korean_60c989b4')}
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>{t('korean_49462616')}</strong>{t('confirm_f32a7b34')}
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>{t('korean_6d4a44dd')}</strong>{t('korean_25f3797a')}
                </Box>
              </Box>
              <Box variant="small" color="text-status-success">
                {t('aws_mixed_5d79d8')}
              </Box>
            </SpaceBetween>
          </Box>

          {error && (
            <Alert type="error" dismissible onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert type="success" dismissible onDismiss={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {/* Drag & Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--awsui-color-border-status-info)' : 'var(--awsui-color-border-divider-default)'}`,
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              backgroundColor: isDragOver ? 'var(--awsui-color-background-status-info)' : 'var(--awsui-color-background-input-default)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={handleFileSelect}
          >
            <SpaceBetween size="m" alignItems="center">
              <Icon
                name="upload"
                size="big"
                variant={isDragOver ? 'success' : 'normal'}
              />
              <Box>
                <Box variant="h3" color={isDragOver ? 'text-status-success' : 'inherit'}>
                  {isDragOver ? t('drop_files_here') : t('drag_or_click_to_upload')}
                </Box>
                <Box variant="p" color="text-status-inactive">
                  {t('text_50mb_pdf_office_mixed_8cbfa2')}
                </Box>
              </Box>
              <Button
                variant="primary"
                disabled={uploading}
                iconName="upload"
              >
                {t('file_11f4a302')}
              </Button>
            </SpaceBetween>
          </div>

          {uploading && (
            <Box>
              <Box margin={{ bottom: 'xs' }}>{t('loading_0a4de75d')} {uploadProgress}%</Box>
              <ProgressBar value={uploadProgress} />
            </Box>
          )}

          <Header variant="h3">{t('loading_5d37a8ec')}</Header>

          <Table
            columnDefinitions={[
              {
                id: 'fileName',
                header: t('file_name_header'),
                cell: (item) => getDisplayFileName(item)
              },
              {
                id: 'fileSize',
                header: t('file_size_header'),
                cell: (item) => formatFileSize(item.fileSize)
              },
              {
                id: 'uploadedAt',
                header: t('upload_time_header'),
                cell: (item) => new Date(item.uploadedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
              },
              {
                id: 'actions',
                header: t('actions'),
                cell: (item) => (
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => handleDeleteFile(item.fileKey)}
                  >
                    {t('delete')}
                  </Button>
                )
              }
            ]}
            items={uploadedFiles}
            loading={loadingFiles}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  {t('loading_ec6095c4')}
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  {t('loading_3d28a7fc')}
                </Box>
              </Box>
            }
          />

          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          />
        </SpaceBetween>
      </Container>
    </Modal>
  )
}