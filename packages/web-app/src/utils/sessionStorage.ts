/**
 * 세션 저장소에서 PIN 번호 관리를 위한 유틸리티 함수들
 */

const PIN_STORAGE_PREFIX = 'UserInputPin_'

/**
 * 세션 ID에 대한 PIN 번호를 세션 저장소에 저장
 */
export const storePinForSession = (sessionId: string, pin: string): void => {
  try {
    const key = `${PIN_STORAGE_PREFIX}${sessionId}`
    sessionStorage.setItem(key, pin)
  } catch (error) {
    console.warn('Failed to store PIN in session storage:', error)
  }
}

/**
 * 세션 ID에 대한 저장된 PIN 번호를 가져옴
 */
export const getStoredPinForSession = (sessionId: string): string | null => {
  try {
    const key = `${PIN_STORAGE_PREFIX}${sessionId}`
    return sessionStorage.getItem(key)
  } catch (error) {
    console.warn('Failed to get PIN from session storage:', error)
    return null
  }
}

/**
 * 세션 ID에 대한 저장된 PIN 번호를 삭제
 */
export const removePinForSession = (sessionId: string): void => {
  try {
    const key = `${PIN_STORAGE_PREFIX}${sessionId}`
    sessionStorage.removeItem(key)
    // Also remove CSRF token from localStorage
    localStorage.removeItem(`csrf_${sessionId}`)
  } catch (error) {
    console.warn('Failed to remove PIN from session storage:', error)
  }
}

/**
 * 모든 저장된 PIN 번호를 삭제 (선택적 정리 기능)
 */
export const clearAllStoredPins = (): void => {
  try {
    const keysToRemove: string[] = []
    const csrfKeysToRemove: string[] = []
    
    // sessionStorage의 모든 키를 확인
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(PIN_STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    
    // localStorage의 CSRF 토큰 키들도 확인
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('csrf_')) {
        csrfKeysToRemove.push(key)
      }
    }
    
    // PIN 관련 키들을 삭제
    keysToRemove.forEach(key => sessionStorage.removeItem(key))
    csrfKeysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear stored PINs:', error)
  }
}

/**
 * PIN 검증 성공 시 개인정보 동의 상태도 함께 저장
 */
export const storePrivacyConsentForSession = (sessionId: string): void => {
  try {
    const key = `PrivacyConsent_${sessionId}`
    sessionStorage.setItem(key, 'true')
  } catch (error) {
    console.warn('Failed to store privacy consent in session storage:', error)
  }
}

/**
 * 세션 ID에 대한 개인정보 동의 상태를 가져옴
 */
export const getStoredPrivacyConsentForSession = (sessionId: string): boolean => {
  try {
    const key = `PrivacyConsent_${sessionId}`
    return sessionStorage.getItem(key) === 'true'
  } catch (error) {
    console.warn('Failed to get privacy consent from session storage:', error)
    return false
  }
}

/**
 * 세션 ID에 대한 상담 목적들을 세션 저장소에 저장 ("|"로 구분된 문자열)
 */
export const storeConsultationPurposesForSession = (sessionId: string, purposes: string): void => {
  try {
    const key = `ConsultationPurposes_${sessionId}`
    sessionStorage.setItem(key, purposes)
  } catch (error) {
    console.warn('Failed to store consultation purposes in session storage:', error)
  }
}

/**
 * 세션 ID에 대한 저장된 상담 목적들을 가져옴 ("|"로 구분된 문자열)
 */
export const getStoredConsultationPurposesForSession = (sessionId: string): string | null => {
  try {
    const key = `ConsultationPurposes_${sessionId}`
    return sessionStorage.getItem(key)
  } catch (error) {
    console.warn('Failed to get consultation purposes from session storage:', error)
    return null
  }
}

// 하위 호환성을 위한 기존 함수들 (deprecated)
export const storeConsultationPurposeForSession = (sessionId: string, purpose: string): void => {
  storeConsultationPurposesForSession(sessionId, purpose)
}

export const getStoredConsultationPurposeForSession = (sessionId: string): string | null => {
  return getStoredConsultationPurposesForSession(sessionId)
}


/**
 * 피드백 제출 완료 상태를 localStorage에 저장 (탭/브라우저 종료 후에도 유지)
 */
export const storeFeedbackSubmittedForSession = (sessionId: string): void => {
  try {
    localStorage.setItem(`FeedbackSubmitted_${sessionId}`, 'true')
  } catch (error) {
    console.warn('Failed to store feedback status:', error)
  }
}

/**
 * 세션에 대한 피드백 제출 여부를 확인
 */
export const isFeedbackSubmittedForSession = (sessionId: string): boolean => {
  try {
    return localStorage.getItem(`FeedbackSubmitted_${sessionId}`) === 'true'
  } catch (error) {
    console.warn('Failed to get feedback status:', error)
    return false
  }
}
