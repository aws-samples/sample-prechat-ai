export type ConversationStage = 'conversation' | 'completed'

export interface Message {
  id: string;
  content: string;
  sender: 'customer' | 'bot';
  timestamp: string;
  stage: ConversationStage;
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
  createdAt: string;
  updatedAt: string;
  agentVersion?: string;
  agentArn?: string;
}

export const BEDROCK_MODELS: BedrockModel[] = [
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet (June)', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet (Oct)', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-3-7-sonnet-20250219-v1:0', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', provider: 'Anthropic', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.amazon.nova-micro-v1:0', name: 'Nova Micro', provider: 'Amazon', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.amazon.nova-lite-v1:0', name: 'Nova Lite', provider: 'Amazon', region: 'ap-northeast-2' },
  { id: 'arn:aws:bedrock:ap-northeast-2:890742565845:inference-profile/apac.amazon.nova-pro-v1:0', name: 'Nova Pro', provider: 'Amazon', region: 'ap-northeast-2' }
];