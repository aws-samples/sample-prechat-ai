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
  FAILED_TO_SEND: 'failed_to_send_message',
  AI_THINKING: 'ai_thinking_message',
  CONSULTATION_COMPLETE: 'consultation_complete',
  CONSULTATION_COMPLETE_DESC: 'consultation_complete_desc',
  CHAT_PLACEHOLDER: 'chat_placeholder'
} as const

// Model extraction helper
export const extractModelName = (modelArn: string): string => {
  // Claude 4.6 models
  if (modelArn.includes('claude-opus-4-6')) return 'Claude Opus 4.6'
  
  // Claude 4.5 models
  if (modelArn.includes('claude-opus-4-5')) return 'Claude Opus 4.5'
  if (modelArn.includes('claude-sonnet-4-5')) return 'Claude Sonnet 4.5'
  if (modelArn.includes('claude-haiku-4-5')) return 'Claude Haiku 4.5'
  
  // Claude 4 models
  if (modelArn.includes('claude-sonnet-4-20250514')) return 'Claude Sonnet 4 (May 2025)'
  if (modelArn.includes('claude-sonnet-4')) return 'Claude Sonnet 4'
  
  // Claude 3.7 models
  if (modelArn.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet'
  
  // Claude 3.5 models
  if (modelArn.includes('claude-3-5-sonnet-20241022')) return 'Claude 3.5 Sonnet v2 (Oct 2024)'
  if (modelArn.includes('claude-3-5-sonnet-20240620')) return 'Claude 3.5 Sonnet v1 (June 2024)'
  if (modelArn.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet'
  
  // Claude 3 models
  if (modelArn.includes('claude-3-opus')) return 'Claude 3 Opus'
  if (modelArn.includes('claude-3-sonnet')) return 'Claude 3 Sonnet'
  if (modelArn.includes('claude-3-haiku')) return 'Claude 3 Haiku'
  
  // Amazon Nova 2 models
  if (modelArn.includes('nova-2-lite')) return 'Nova 2 Lite'
  
  // Amazon Nova models
  if (modelArn.includes('nova-pro')) return 'Amazon Nova Pro'
  if (modelArn.includes('nova-lite')) return 'Amazon Nova Lite'
  if (modelArn.includes('nova-micro')) return 'Amazon Nova Micro'
  
  return 'Unknown Model'
}