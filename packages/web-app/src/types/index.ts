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
  // boundary로 확정된 메시지에 타이핑 애니메이션 적용
  animate?: boolean;
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

// SHIP Assessment 상태 타입
export type AssessmentStatus =
  | 'pending'
  | 'legal_agreed'
  | 'role_submitted'
  | 'scanning'
  | 'completed'
  | 'failed';

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
  campaignType?: 'outbound' | 'inbound';
  // SHIP Assessment fields
  assessmentStatus?: AssessmentStatus;
  assessmentRequestedAt?: string;
  assessmentCompletedAt?: string;
  reportS3Key?: string;
  legalConsentTimestamp?: string;
  legalConsentAgreed?: boolean;
}

// SHIP Assessment API 요청/응답 타입
export interface LegalConsentRequest {
  agreed: boolean;
}

export interface RoleArnSubmitRequest {
  roleArn: string;
}

export interface AssessmentStatusResponse {
  assessmentStatus: AssessmentStatus;
  assessmentRequestedAt?: string;
  assessmentCompletedAt?: string;
  hasReport: boolean;
  hasHtmlReport?: boolean;
  hasCsvReport?: boolean;
  codeBuildRoleArn?: string;
}

export type ReportType = 'html' | 'csv' | 'dashboard';

export interface ReportDownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  reportType: ReportType;
}

export interface Campaign {
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  campaignType: 'outbound' | 'inbound';
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

// 인바운드 캠페인 공개 정보 (PIN 미포함)
export interface InboundCampaignInfo {
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  description: string;
  startDate: string;
  endDate: string;
}

// 인바운드 세션 생성 요청
export interface CreateInboundSessionRequest {
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  customerPhone: string;
}

// 인바운드 세션 생성 응답
export interface CreateInboundSessionResponse {
  sessionId: string;
  sessionUrl: string;
  csrfToken: string;
  isExisting: boolean;
  campaignId: string;
  campaignName: string;
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

export type AgentRole = 'consultation' | 'summary';

export interface ToolConfig {
  tool_name: string;
  tool_attributes?: Record<string, string>;
}

export interface AgentConfiguration {
  configId: string;
  agentRole: AgentRole;
  agentName: string;
  systemPrompt: string;
  tools: ToolConfig[];
  modelId: string;
  i18n: string;
}

export interface KnowledgeBase {
  knowledgeBaseId: string;
  name: string;
  status: string;
}

export interface CampaignAgentConfigurations {
  consultation: string; // configId
  summary: string; // configId
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

export interface AnalysisResults {
  markdownSummary: string;
  bantAnalysis: BANTAnalysis;
  awsServices: AWSService[];
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
  campaignType?: 'outbound' | 'inbound';
  campaignPin?: string;
  agentConfigurations?: CampaignAgentConfigurations;
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
  campaignPin?: string;
  agentConfigurations?: CampaignAgentConfigurations;
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
  // 백엔드 flat 필드 (campaign sessions API)
  customerName?: string;
  customerEmail?: string;
  customerCompany?: string;
  customerTitle?: string;
  salesRepEmail?: string;
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
export type TriggerEventType = 'SessionCreated' | 'SessionCompleted' | 'SessionInactivated' | 'CampaignCreated' | 'CampaignCompleted' | 'AssessmentStarted' | 'AssessmentCompleted' | 'AssessmentFailed';
export type TriggerStatus = 'active' | 'inactive';

export interface Trigger {
  triggerId: string;
  triggerType: TriggerType;
  eventType: TriggerEventType;
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
  deliveryEndpoint: string;
  campaignId?: string;
  isGlobal: boolean;
}

export interface UpdateTriggerRequest {
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



// WebSocket 메시지 타입 정의

// 서버 → 클라이언트 메시지 유니온 타입
export type WebSocketServerMessage =
  | { type: 'chunk'; content: string }
  | { type: 'boundary' }
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
  locale?: string;
  agentRole?: string;
  // Sales Rep 플래닝 채팅 모드: 메시지 저장/세션 상태 변경 스킵
  stateless?: boolean;
  // stateless 모드에서 사용할 임의의 Consultation Agent configId
  configId?: string;
}

export const BEDROCK_MODELS: BedrockModel[] = [
  { id: 'global.amazon.nova-2-lite-v1:0', name: 'Nova 2 Lite', provider: 'Amazon', region: 'us-east-1' },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5', provider: 'Anthropic', region: 'us-east-1' },
  { id: 'global.anthropic.claude-opus-4-6-v1', name: 'Claude Opus 4.6', provider: 'Anthropic', region: 'us-east-1' },
];