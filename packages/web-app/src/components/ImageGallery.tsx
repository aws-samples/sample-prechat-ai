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

interface ImageGalleryProps {
  files: UploadedFile[]
  onDelete?: (fileKey: string) => void
}

export default function ImageGallery({ files, onDelete }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  console.log('ImageGallery - All files:', files)
  const imageFiles = files.filter(file => isImageFile(file.contentType))
  console.log('ImageGallery - Image files:', imageFiles)
  console.log('ImageGallery - Image files count:', imageFiles.length)

  const openImageModal = (file: UploadedFile) => {
    setSelectedImage(file.fileUrl)
    setImageModalVisible(true)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
    setImageModalVisible(false)
  }

  const handleImageError = (fileKey: string) => {
    setImageErrors(prev => new Set(prev).add(fileKey))
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
          {imageFiles.map((file) => (
            <Box key={file.fileKey} padding="xs">
              <div
                style={{
                  border: '1px solid #e1e4e8',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  backgroundColor: '#f8f9fa'
                }}
                onClick={() => openImageModal(file)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {imageErrors.has(file.fileKey) ? (
                  <div
                    style={{
                      height: '150px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      color: '#666'
                    }}
                  >
                    이미지를 불러올 수 없습니다
                  </div>
                ) : (
                  <img
                    src={file.fileUrl}
                    alt={getDisplayFileName(file)}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                    onError={() => handleImageError(file.fileKey)}
                  />
                )}
                <Box padding="xs">
                  <Box fontSize="body-s" fontWeight="bold" margin={{ bottom: "xxs" }}>
                    {getDisplayFileName(file)}
                  </Box>
                  <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                    <Box fontSize="body-s" color="text-status-inactive">
                      {formatFileSize(file.fileSize)}
                    </Box>
                    <SpaceBetween direction="horizontal" size="xxs">
                      <Button
                        variant="icon"
                        iconName="download"
                        href={file.fileUrl}
                        target="_blank"
                        download={getDisplayFileName(file)}
                        ariaLabel="다운로드"
                      />
                      {onDelete && (
                        <Button
                          variant="icon"
                          iconName="remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(file.fileKey)
                          }}
                          ariaLabel="삭제"
                        />
                      )}
                    </SpaceBetween>
                  </SpaceBetween>
                </Box>
              </div>
            </Box>
          ))}
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