export interface SessionCSVData {
  customerCompany: string
  customerName: string
  customerTitle: string
  chatUrl: string
  pinNumber: string
  createdAt: string
}

export const generateSessionCSV = (data: SessionCSVData): string => {
  const headers = [
    '고객사명',
    '고객님명', 
    '고객직무명',
    '채팅URL',
    '핀번호',
    '생성일시'
  ]
  
  const row = [
    data.customerCompany,
    data.customerName,
    data.customerTitle,
    data.chatUrl,
    data.pinNumber,
    data.createdAt
  ]
  
  // CSV 형식으로 변환 (쉼표가 포함된 데이터는 따옴표로 감싸기)
  const csvHeaders = headers.join(',')
  const csvRow = row.map(field => {
    // 쉼표나 따옴표가 포함된 경우 따옴표로 감싸고 내부 따옴표는 이스케이프
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }).join(',')
  
  return `${csvHeaders}\n${csvRow}`
}

export const downloadCSV = (csvContent: string, filename: string): void => {
  // BOM 추가로 한글 깨짐 방지
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // 메모리 정리
  URL.revokeObjectURL(url)
}

export const generateCSVFilename = (customerCompany: string): string => {
  const now = new Date()
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '')
  
  // 파일명에 사용할 수 없는 문자 제거
  const sanitizedCompany = customerCompany
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20) // 길이 제한
  
  return `AWSPreChat_${sanitizedCompany}_${yymmdd}_session_url.csv`
}