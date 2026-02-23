import type { SalesRepInfo } from '../types'

/**
 * 메시지 내용에서 영업 담당자 정보 플레이스홀더를 실제 값으로 치환합니다.
 * 단일 중괄호({sales_rep.name}), 이중 중괄호({{sales_rep.name}}),
 * 삼중 이상 중괄호도 모두 탐지합니다.
 * 
 * @param content - 치환할 메시지 내용
 * @param salesRepInfo - 영업 담당자 정보
 * @returns 플레이스홀더가 치환된 메시지 내용
 */
export function replaceSalesRepPlaceholders(
  content: string, 
  salesRepInfo?: SalesRepInfo
): string {
  if (!salesRepInfo) {
    return content
  }

  let replacedContent = content

  // {+sales_rep.name}+ 치환 (중괄호 1개 이상 모두 매칭)
  replacedContent = replacedContent.replace(
    /\{+\s*sales_rep\.name\s*\}+/g, 
    salesRepInfo.name || '영업 담당자'
  )

  // {+sales_rep.phone}+ 치환
  replacedContent = replacedContent.replace(
    /\{+\s*sales_rep\.phone\s*\}+/g, 
    salesRepInfo.phone || '연락처 정보 없음'
  )

  // {+sales_rep.email}+ 치환
  replacedContent = replacedContent.replace(
    /\{+\s*sales_rep\.email\s*\}+/g, 
    salesRepInfo.email || '이메일 정보 없음'
  )

  return replacedContent
}