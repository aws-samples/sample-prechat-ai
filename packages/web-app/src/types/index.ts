export type ConversationStage = 'conversation' | 'completed'

// Div Return Protocol: 메시지 콘텐츠 유형
export type MessageContentType = 'text' | 'div-return' | 'form-submission';

export interface SalesRepInfo {
  name: string
  email: string
  phone: string
}

// 봇 메시지의 생성 상태
export type BotMessageStatus = 'thinking' | 'tool-use' | 'streaming' | 'complete' | 'error';

export interface Message {
  id: string;
  content: string;
  contentType?: MessageContentType;
  sender: 'customer' | 'bot';
  timestamp: string;
  stage: ConversationStage;
  // 봇 메시지 상태 (sender === 'bot' 일 때만 유효)
  status?: BotMessageStatus;
  // 도구 사용 정보 (status === 'tool-use' 일 때)
  toolInfo?: {
    toolName: string;
    status: 'running' | 'complete';
  };
}

export interface CustomerFeedback {
  rating: number;
  feedback: string;
  timestamp: string;
}

export interface Discussion {
  id: string;
  sessionId: string;
  content: string;
  authorEmail: string;
  authorName: string;
  timestamp: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Session {
  sessionId: string;
  status: 'active' | 'completed' | 'expired' | 'inactive';
  conversationHistory: Message[];
  customerInfo: {
    name: string;
    email: string;
    company: string;
    title?: string;
  };
  salesRepEmail: string;
  salesRepInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  agentId: string;
  consultationPurposes?: string;
  aiAnalysis?: AnalysisResults;
  pinNumber?: string;
  privacyConsentAgreed?: boolean;
  privacyConsentTimestamp?: string;
  meetingLog?: string;
  createdAt?: string;
  completedAt?: string;
  customerFeedback?: CustomerFeedback;
  // Campaign association fields
  campaignId?: string;
  campaignName?: string;
}

export interface Campaign {
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  description: string;
  startDate: string;
  endDate: string;
  ownerId: string; // Cognito User ID
  ownerEmail: string;
  ownerName: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  completedSessionCount: number;
}

export interface CampaignAnalytics {
  campaignId: string;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  completionRate: number;
  averageSessionDuration: number;
  topConsultationPurposes: Array<{
    purpose: string;
    count: number;
  }>;
  sessionsByDate: Array<{
    date: string;
    count: number;
  }>;
  customerCompanies: Array<{
    company: string;
    sessionCount: number;
  }>;
}

export interface ChatMessageRequest {
  sessionId: string;
  message: string;
  messageId: string;
  contentType?: MessageContentType;
}

export interface ChatMessageResponse {
  response: string;
  contentType?: MessageContentType;
  stage: ConversationStage;
  isComplete: boolean;
  nextQuestions?: string[];
  chunks?: string[];
  messageId?: string;
  salesRepInfo?: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface BedrockModel {
  id: string;
  name: string;
  provider: string;
  region: string;
}

export interface AgentCoreAgent {
  agentId: string;
  agentName: string;
  agentStatus: 'CREATING' | 'PREPARING' | 'PREPARED' | 'NOT_PREPARED' | 'DELETING' | 'FAILED' | 'VERSIONING' | 'UPDATING';
  foundationModel: string;
  instruction: string;
  createdAt: string;
  updatedAt: string;
  agentVersion?: string;
  agentArn?: string;
}

export type AgentRole = 'prechat' | 'summary' | 'planning';

export interface AgentConfiguration {
  configId: string;
  agentRole: AgentRole;
  agentRuntimeArn: string;
  modelId: string;
  systemPrompt: string;
  agentName: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}



// AI Analysis Types
export interface BANTAnalysis {
  budget: string;
  authority: string;
  need: string;
  timeline: string;
}

export interface AWSService {
  service: string;
  reason: string;
  implementation: string;
}

export interface CustomerCase {
  title: string;
  description: string;
  relevance: string;
}

export interface AnalysisResults {
  markdownSummary: string;
  bantAnalysis: BANTAnalysis;
  awsServices: AWSService[];
  customerCases: CustomerCase[];
  analyzedAt: string;
  modelUsed: string;
  agentName?: string;
}

export interface AnalysisRequest {
  sessionId: string;
  configId?: string;
}

// Campaign API Types
export interface CreateCampaignRequest {
  campaignName: string;
  campaignCode: string;
  description: string;
  startDate: string;
  endDate: string;
  ownerId: string;
}

export interface UpdateCampaignRequest {
  campaignName?: string;
  campaignCode?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  nextToken?: string;
}

export interface SessionSummary {
  sessionId: string;
  status: 'active' | 'completed' | 'expired' | 'inactive';
  customerInfo: {
    name: string;
    email: string;
    company: string;
  };
  createdAt: string;
  completedAt?: string;
  consultationPurposes?: string;
}

export interface CampaignSessionsResponse {
  sessions: SessionSummary[];
  nextToken?: string;
}

export interface AssociateCampaignRequest {
  campaignId: string;
}

export interface CognitoUser {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'ARCHIVED' | 'COMPROMISED' | 'UNKNOWN' | 'RESET_REQUIRED' | 'FORCE_CHANGE_PASSWORD';
  enabled: boolean;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface CognitoUsersResponse {
  users: CognitoUser[];
  totalUsers: number;
  nextPaginationToken?: string;
}

// Trigger Types
export type TriggerType = 'slack' | 'sns' | 'webhook';
export type TriggerEventType = 'SessionCreated' | 'SessionCompleted' | 'SessionInactivated' | 'CampaignCreated' | 'CampaignClosed';
export type TriggerStatus = 'active' | 'inactive';

export interface Trigger {
  triggerId: string;
  triggerType: TriggerType;
  eventType: TriggerEventType;
  messageTemplate: string;
  deliveryEndpoint: string;
  status: TriggerStatus;
  campaignId?: string;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateTriggerRequest {
  triggerType: TriggerType;
  eventType: TriggerEventType;
  messageTemplate?: string;
  deliveryEndpoint: string;
  campaignId?: string;
  isGlobal: boolean;
}

export interface UpdateTriggerRequest {
  messageTemplate?: string;
  deliveryEndpoint?: string;
  status?: TriggerStatus;
  eventType?: TriggerEventType;
  isGlobal?: boolean;
  campaignId?: string;
}

export interface TriggerListResponse {
  triggers: Trigger[];
  count: number;
}

export interface TriggerTemplatesResponse {
  templates: Record<string, {
    template: string;
    description: string;
    variables: string[];
  }>;
}



// WebSocket 메시지 타입 정의

// 서버 → 클라이언트 메시지 유니온 타입
export type WebSocketServerMessage =
  | { type: 'chunk'; content: string }
  | { type: 'tool'; toolName: string; toolUseId: string; status: 'running' | 'complete'; input?: Record<string, unknown>; output?: string }
  | { type: 'done'; contentType: MessageContentType; isComplete: boolean; messageId: string }
  | { type: 'error'; message: string };

// 클라이언트 → 서버 메시지
export interface WebSocketClientMessage {
  action: 'sendMessage';
  sessionId: string;
  message: string;
  messageId: string;
  contentType?: MessageContentType;
}

export const BEDROCK_MODELS: BedrockModel[] = [
  { id: 'global.amazon.nova-2-lite-v1:0', name: 'Nova 2 Lite', provider: 'Amazon', region: 'us-east-1' },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-opus-4-6-v1', name: 'Claude Opus 4.6', provider: 'Anthropic', region: 'us-east-1' },
];