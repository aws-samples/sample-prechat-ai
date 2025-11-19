export type ConversationStage = 'conversation' | 'completed'

export interface SalesRepInfo {
  name: string
  email: string
  phone: string
}

export interface Message {
  id: string;
  content: string;
  sender: 'customer' | 'bot';
  timestamp: string;
  stage: ConversationStage;
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
}

export interface ChatMessageResponse {
  response: string;
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

export interface BedrockAgent {
  agentId: string;
  agentName: string;
  agentStatus: 'CREATING' | 'PREPARING' | 'PREPARED' | 'NOT_PREPARED' | 'DELETING' | 'FAILED' | 'VERSIONING' | 'UPDATING';
  foundationModel: string;
  instruction: string;
  memoryStorageDays: number;
  createdAt: string;
  updatedAt: string;
  agentVersion?: string;
  agentArn?: string;
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
}

export interface AnalysisRequest {
  sessionId: string;
  modelId: string;
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



export const BEDROCK_MODELS: BedrockModel[] = [
  { id: 'apac.anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet (June)', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet (Oct)', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.anthropic.claude-3-7-sonnet-20250219-v1:0', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'apac.amazon.nova-micro-v1:0', name: 'Nova Micro', provider: 'Amazon', region: 'ap-northeast-2' },
  { id: 'apac.amazon.nova-lite-v1:0', name: 'Nova Lite', provider: 'Amazon', region: 'ap-northeast-2' },
  { id: 'apac.amazon.nova-pro-v1:0', name: 'Nova Pro', provider: 'Amazon', region: 'ap-northeast-2' }
];