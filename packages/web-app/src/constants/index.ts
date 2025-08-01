// Status mappings
export const SESSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  INACTIVE: 'inactive'
} as const

export const AGENT_STATUS = {
  CREATING: 'CREATING',
  PREPARING: 'PREPARING',
  PREPARED: 'PREPARED',
  NOT_PREPARED: 'NOT_PREPARED',
  DELETING: 'DELETING',
  FAILED: 'FAILED',
  VERSIONING: 'VERSIONING',
  UPDATING: 'UPDATING'
} as const

// UI Messages
export const MESSAGES = {
  LOADING: 'Loading...',
  SESSION_NOT_FOUND: 'Session not found or expired',
  FAILED_TO_SEND: '죄송합니다. 메시지 전송 중 오류가 발생했습니다. 다시 시도해 주세요.',
  AI_THINKING: 'AI is thinking...',
  CONSULTATION_COMPLETE: '✅ 상담이 완료되었습니다',
  CONSULTATION_COMPLETE_DESC: '감사합니다. 귀하의 응답이 기록되었습니다. 담당자가 연락드릴 예정입니다.',
  CHAT_PLACEHOLDER: '💬 Tell me about your business goals, technical challenges, or AWS requirements... I\'m here to help!'
} as const

// Model extraction helper
export const extractModelName = (modelArn: string): string => {
  if (modelArn.includes('claude-3-haiku')) return 'Claude 3 Haiku'
  if (modelArn.includes('claude-3-sonnet')) return 'Claude 3 Sonnet'
  if (modelArn.includes('claude-3-5-sonnet-20240620')) return 'Claude 3.5 Sonnet (June)'
  if (modelArn.includes('claude-3-5-sonnet-20241022')) return 'Claude 3.5 Sonnet (Oct)'
  if (modelArn.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet'
  if (modelArn.includes('claude-sonnet-4')) return 'Claude Sonnet 4'
  if (modelArn.includes('nova-micro')) return 'Nova Micro'
  if (modelArn.includes('nova-lite')) return 'Nova Lite'
  if (modelArn.includes('nova-pro')) return 'Nova Pro'
  return 'Unknown Model'
}