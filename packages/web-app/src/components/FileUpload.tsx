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
      setError('파일 크기가 50MB를 초과합니다.')
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
      setError('지원하지 않는 파일 형식입니다. 이미지, PDF, Office 문서만 업로드 가능합니다.')
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
          setSuccess('파일이 성공적으로 업로드되었습니다.')
          setUploadProgress(100)
          loadUploadedFiles() // Refresh file list
        } else {
          setError('파일 업로드에 실패했습니다.')
        }
        setUploading(false)
      })

      xhr.addEventListener('error', (event) => {
        console.error('Upload error:', event)
        console.error('XHR status:', xhr.status)
        console.error('XHR response:', xhr.responseText)
        setError(`파일 업로드 중 오류가 발생했습니다. (Status: ${xhr.status})`)
        setUploading(false)
      })

      xhr.open('PUT', urlResponse.uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)

    } catch (err: any) {
      setError(err.response?.data?.error || '파일 업로드에 실패했습니다.')
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
    try {
      await chatApi.deleteSessionFile(sessionId, fileKey)
      setSuccess('파일이 삭제되었습니다.')
      loadUploadedFiles() // Refresh file list
    } catch (err: any) {
      setError(err.response?.data?.error || '파일 삭제에 실패했습니다.')
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
      header="첨부파일 제공"
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              닫기
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Container>
        <SpaceBetween size="s">
          <Box>
            <Header variant="h3">파일 업로드가 필요한 이유</Header>
            <SpaceBetween size="s">
              <Box variant="p">
                <strong>더 정확한 상담을 위해 추가 자료를 제공해 주시면 도움이 됩니다.</strong>
              </Box>
              <Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>현재 아키텍처 다이어그램</strong>: 기존 시스템 구성 정보 제공
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>요구사항 문서</strong>: 비즈니스 요구사항 제공
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>기술 명세서</strong>: 기술적 제약사항과 선호사항을 확인
                </Box>
                <Box variant="p" margin={{ left: 'm' }}>
                  • <strong>성능/용량 계획서</strong>: 예상 트래픽과 데이터량 등
                </Box>
              </Box>
              <Box variant="small" color="text-status-success">
                💡 업로드된 파일은 AWS 담당자가 사전 검토하여 더욱 효과적인 미팅을 준비할 수 있습니다.
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
                  {isDragOver ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
                </Box>
                <Box variant="p" color="text-status-inactive">
                  최대 50MB • 이미지, PDF, Office 문서, 텍스트 파일 지원
                </Box>
              </Box>
              <Button
                variant="primary"
                disabled={uploading}
                iconName="upload"
              >
                파일 선택
              </Button>
            </SpaceBetween>
          </div>

          {uploading && (
            <Box>
              <Box margin={{ bottom: 'xs' }}>업로드 중... {uploadProgress}%</Box>
              <ProgressBar value={uploadProgress} />
            </Box>
          )}

          <Header variant="h3">업로드된 파일</Header>

          <Table
            columnDefinitions={[
              {
                id: 'fileName',
                header: '파일명',
                cell: (item) => getDisplayFileName(item)
              },
              {
                id: 'fileSize',
                header: '크기',
                cell: (item) => formatFileSize(item.fileSize)
              },
              {
                id: 'uploadedAt',
                header: '업로드 시간',
                cell: (item) => new Date(item.uploadedAt).toLocaleString('ko-KR')
              },
              {
                id: 'actions',
                header: '작업',
                cell: (item) => (
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => handleDeleteFile(item.fileKey)}
                  >
                    삭제
                  </Button>
                )
              }
            ]}
            items={uploadedFiles}
            loading={loadingFiles}
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="strong" textAlign="center" color="inherit">
                  업로드된 파일이 없습니다
                </Box>
                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                  파일을 업로드하여 상담에 필요한 자료를 제공해 주세요.
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