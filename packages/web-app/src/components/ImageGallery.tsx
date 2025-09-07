// nosemgrep
import { useState } from 'react'
import {
  Box,
  Modal,
  Button,
  Grid,
  Container,
  Header,
  SpaceBetween
} from '@cloudscape-design/components'
import { UploadedFile, getDisplayFileName, formatFileSize, isImageFile } from '../utils/fileUtils'
import { adminApi } from '../services/api'

interface ImageGalleryProps {
  files: UploadedFile[]
  onDelete?: (fileKey: string) => void
  sessionId?: string
}

export default function ImageGallery({ files, onDelete, sessionId }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [preparingFiles, setPreparingFiles] = useState<Set<string>>(new Set())
  const [preparedUrls, setPreparedUrls] = useState<Map<string, string>>(new Map())

  const imageFiles = files.filter(file => isImageFile(file.contentType))

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

  const openImageModal = async (file: UploadedFile) => {
    const preparedUrl = preparedUrls.get(file.fileKey)
    if (preparedUrl) {
      setSelectedImage(preparedUrl)
      setImageModalVisible(true)
    } else {
      await handlePrepareFile(file.fileKey)
      const newUrl = preparedUrls.get(file.fileKey)
      if (newUrl) {
        setSelectedImage(newUrl)
        setImageModalVisible(true)
      }
    }
  }

  const closeImageModal = () => {
    setSelectedImage(null)
    setImageModalVisible(false)
  }



  if (imageFiles.length === 0) {
    console.log('ImageGallery - No image files found, returning null')
    return (
      <Container>
        <Header variant="h3">이미지 미리보기</Header>
        <Box textAlign="center" color="text-status-inactive">
          이미지 파일이 없습니다.
        </Box>
      </Container>
    )
  }

  return (
    <>
      <Container>
        <Header variant="h3">이미지 미리보기</Header>
        <Grid gridDefinition={[
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 3, l: 2 } }
        ]}>
          {imageFiles.map((file) => {
            const isPreparing = preparingFiles.has(file.fileKey)
            const preparedUrl = preparedUrls.get(file.fileKey)
            
            return (
              <Box key={file.fileKey} padding="xs">
                <div
                  style={{
                    border: '1px solid #e1e4e8',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <div
                    style={{
                      height: '150px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#666',
                      backgroundColor: '#f0f0f0'
                    }}
                  >
                    {preparedUrl ? (
                      <img
                        src={preparedUrl}
                        alt={getDisplayFileName(file)}
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'cover',
                          display: 'block',
                          cursor: 'pointer'
                        }}
                        onClick={() => openImageModal(file)}
                      />
                    ) : (
                      <Button
                        variant="primary"
                        iconName="file"
                        loading={isPreparing}
                        onClick={() => handlePrepareFile(file.fileKey)}
                        disabled={!sessionId}
                      >
                        이미지 준비
                      </Button>
                    )}
                  </div>
                  <Box padding="xs">
                    <Box fontSize="body-s" fontWeight="bold" margin={{ bottom: "xxs" }}>
                      {getDisplayFileName(file)}
                    </Box>
                    <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                      <Box fontSize="body-s" color="text-status-inactive">
                        {formatFileSize(file.fileSize)}
                      </Box>
                      <SpaceBetween direction="horizontal" size="xxs">
                        {preparedUrl && (
                          <Button
                            variant="icon"
                            iconName="download"
                            href={preparedUrl}
                            target="_blank"
                            download={getDisplayFileName(file)}
                            ariaLabel="다운로드"
                          />
                        )}
                        {onDelete && (
                          <Button
                            variant="icon"
                            iconName="remove"
                            onClick={() => onDelete(file.fileKey)}
                            ariaLabel="삭제"
                          />
                        )}
                      </SpaceBetween>
                    </SpaceBetween>
                  </Box>
                </div>
              </Box>
            )
          })}
        </Grid>
      </Container>

      {/* Image Modal */}
      <Modal
        onDismiss={closeImageModal}
        visible={imageModalVisible}
        header="이미지 원본 보기"
        size="large"
        footer={
          <Box float="right">
            <Button variant="primary" onClick={closeImageModal}>
              닫기
            </Button>
          </Box>
        }
      >
        {selectedImage && (
          <Box textAlign="center">
            <img
              src={selectedImage}
              alt="원본 이미지"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          </Box>
        )}
      </Modal>
    </>
  )
}