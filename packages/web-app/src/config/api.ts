export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://za5ttx0t8j.execute-api.ap-northeast-2.amazonaws.com/dev/api'

// WebSocket API Gateway URL (update-env-vars.sh에서 VITE_WS_URL로 자동 주입)
export const WS_URL = import.meta.env.VITE_WS_URL || ''