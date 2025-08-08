import {
  Table,
  Button,
  Box
} from '@cloudscape-design/components'
import { UploadedFile, getDisplayFileName, formatFileSize } from '../utils/fileUtils'

interface FileListProps {
  files: UploadedFile[]
  loading?: boolean
  showActions?: boolean
  onDelete?: (fileKey: string) => void
}

export default function FileList({ files, loading = false, showActions = false, onDelete }: FileListProps) {
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

  if (showActions && onDelete) {
    columnDefinitions.push({
      id: 'actions',
      header: '작업',
      cell: (item: UploadedFile) => (
        <Button
          variant="normal"
          iconName="remove"
          onClick={() => onDelete(item.fileKey)}
        >
          삭제
        </Button>
      )
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