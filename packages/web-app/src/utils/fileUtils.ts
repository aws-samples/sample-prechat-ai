export interface UploadedFile {
  fileKey: string
  fileName: string
  encodedFileName?: string
  fileSize: number
  uploadedAt: string
  contentType: string
  fileUrl: string
}

export const getDisplayFileName = (file: UploadedFile): string => {
  if (file.encodedFileName) {
    try {
      // Properly decode UTF-8 from base64
      const binaryString = atob(file.encodedFileName)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return new TextDecoder('utf-8').decode(bytes)
    } catch (error) {
      console.error('Failed to decode filename:', error)
      return file.fileName
    }
  }
  return file.fileName
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const isImageFile = (contentType: string): boolean => {
  return contentType.startsWith('image/')
}

