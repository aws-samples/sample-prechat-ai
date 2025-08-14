import {
  Table,
  Button,
  Box,
  SpaceBetween
} from '@cloudscape-design/components'
import { useState } from 'react'
import { UploadedFile, getDisplayFileName, formatFileSize } from '../utils/fileUtils'
import { adminApi } from '../services/api'

interface FileListProps {
  files: UploadedFile[]
  loading?: boolean
  showActions?: boolean
  onDelete?: (fileKey: string) => void
  sessionId?: string
}

export default function FileList({ files, loading = false, showActions = true, onDelete, sessionId }: FileListProps) {
  const [preparingFiles, setPreparingFiles] = useState<Set<string>>(new Set())
  const [preparedUrls, setPreparedUrls] = useState<Map<string, string>>(new Map())

  const handlePrepareFile = async (fileKey: string) => {
    if (!sessionId) return
    
    setPreparingFiles(prev => new Set(prev).add(fileKey))
    try {
      const response = await adminApi.generateFilePresignedUrl(sessionId, fileKey)
      setPreparedUrls(prev => new Map(prev).set(fileKey, response.presignedUrl))
    } catch (error) {
      console.error('Failed to prepare file:', error)
    } finally {
      setPreparingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileKey)
        return newSet
      })
    }
  }
  const columnDefinitions: any[] = [
    {
      id: 'fileName',
      header: '파일명',
      cell: (item: UploadedFile) => getDisplayFileName(item)
    },
    {
      id: 'fileSize',
      header: '크기',
      cell: (item: UploadedFile) => formatFileSize(item.fileSize)
    },
    {
      id: 'contentType',
      header: '타입',
      cell: (item: UploadedFile) => item.contentType
    },
    {
      id: 'uploadedAt',
      header: '업로드 시간',
      cell: (item: UploadedFile) => new Date(item.uploadedAt).toLocaleString('ko-KR')
    }
  ]

  if (showActions) {
    columnDefinitions.push({
      id: 'actions',
      header: '작업',
      cell: (item: UploadedFile) => {
        const isPreparing = preparingFiles.has(item.fileKey)
        const preparedUrl = preparedUrls.get(item.fileKey)
        
        return (
          <SpaceBetween direction="horizontal" size="xs">
            {preparedUrl ? (
              <Button
                variant="primary"
                iconName="download"
                href={preparedUrl}
                target="_blank"
                download={getDisplayFileName(item)}
              >
                다운로드
              </Button>
            ) : (
              <Button
                variant="normal"
                iconName="file"
                loading={isPreparing}
                onClick={() => handlePrepareFile(item.fileKey)}
                disabled={!sessionId}
              >
                파일 준비
              </Button>
            )}
            {onDelete && (
              <Button
                variant="normal"
                iconName="remove"
                onClick={() => onDelete(item.fileKey)}
              >
                삭제
              </Button>
            )}
          </SpaceBetween>
        )
      }
    })
  }

  return (
    <Table
      columnDefinitions={columnDefinitions}
      items={files}
      loading={loading}
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
  )
}