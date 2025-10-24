// nosemgrep
import {
  Table,
  Button,
  Box,
  SpaceBetween
} from '@cloudscape-design/components'
import { useState } from 'react'
import { UploadedFile, getDisplayFileName, formatFileSize } from '../utils/fileUtils'
import { adminApi } from '../services/api'
import { useI18n } from '../i18n'

interface FileListProps {
  files: UploadedFile[]
  loading?: boolean
  showActions?: boolean
  onDelete?: (fileKey: string) => void
  sessionId?: string
}

export default function FileList({ files, loading = false, showActions = true, onDelete, sessionId }: FileListProps) {
  const { t } = useI18n();
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
      header: t('file_name_header'),
      cell: (item: UploadedFile) => getDisplayFileName(item)
    },
    {
      id: 'fileSize',
      header: t('file_size_header'),
      cell: (item: UploadedFile) => formatFileSize(item.fileSize)
    },
    {
      id: 'contentType',
      header: t('file_type_header'),
      cell: (item: UploadedFile) => item.contentType
    },
    {
      id: 'uploadedAt',
      header: t('upload_time_header'),
      cell: (item: UploadedFile) => new Date(item.uploadedAt).toLocaleString('ko-KR')
    }
  ]

  if (showActions) {
    columnDefinitions.push({
      id: 'actions',
      header: t('actions'),
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
                {t('loading_612ca27b')}
              </Button>
            ) : (
              <Button
                variant="normal"
                iconName="file"
                loading={isPreparing}
                onClick={() => handlePrepareFile(item.fileKey)}
                disabled={!sessionId}
              >
                {t('file_0b7ade37')}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="normal"
                iconName="remove"
                onClick={() => onDelete(item.fileKey)}
              >
                {t('delete')}
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
            {t('loading_ec6095c4')}
          </Box>
          <Box variant="p" padding={{ bottom: 's' }} color="inherit">
            {t('loading_3d28a7fc')}
          </Box>
        </Box>
      }
    />
  )
}