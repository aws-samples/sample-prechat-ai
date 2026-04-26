// nosemgrep
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  SpaceBetween,
  Alert,
  Select,
  FormField,
  StatusIndicator,
} from '@cloudscape-design/components';
import type { SelectProps } from '@cloudscape-design/components';
import { usePlanningWebSocket } from '../hooks/usePlanningWebSocket';
import { StreamingChatMessage } from './StreamingChatMessage';
import { ChatMessage } from './ChatMessage';
import { MultilineChatInput } from './MultilineChatInput';
import { WS_URL } from '../config/api';
import { useI18n } from '../i18n';
import { CaptureDiscussionModal } from './CaptureDiscussionModal';
import { adminApi } from '../services/api';
import type {
  Session,
  Message,
  AgentConfiguration,
} from '../types';
import { extractModelName } from '../constants';

// --- 타입 정의 ---

export interface ToolEvent {
  toolName: string;
  toolUseId: string;
  status: 'running' | 'complete';
  input?: Record<string, unknown>;
  output?: string;
}

export interface PlanningMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  toolEvents?: ToolEvent[];
}

export interface PlanningChatTabProps {
  sessionId: string;
  session: Session;
}

export interface SuggestedQuestion {
  i18nKey: string;
  fallback: string;
}

// --- 테스트 가능한 순수 함수들 ---

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    i18nKey: 'admin.planningChat.suggestedQuestion1',
    fallback: '제안하기 좋은 서비스 알려줘',
  },
  {
    i18nKey: 'admin.planningChat.suggestedQuestion2',
    fallback: '유사 고객사례 찾아줘',
  },
  {
    i18nKey: 'admin.planningChat.suggestedQuestion3',
    fallback: 'Action Item 체계적으로 제안해줘',
  },
  {
    i18nKey: 'admin.planningChat.suggestedQuestion4',
    fallback: 'SHIP A2T 로그 뽑아줘',
  },
];

export function createUserMessage(content: string): PlanningMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sender: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createAssistantMessage(): PlanningMessage {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sender: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    isStreaming: true,
    toolEvents: [],
  };
}

export function addMessage(
  messages: PlanningMessage[],
  message: PlanningMessage
): PlanningMessage[] {
  return [...messages, message];
}

export function updateStreamingMessage(
  messages: PlanningMessage[],
  chunk: string
): PlanningMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.sender !== 'assistant') return messages;
  return [
    ...messages.slice(0, -1),
    { ...last, content: last.content + chunk },
  ];
}

export function completeStreamingMessage(
  messages: PlanningMessage[]
): PlanningMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.sender !== 'assistant') return messages;
  return [
    ...messages.slice(0, -1),
    { ...last, isStreaming: false },
  ];
}

export function shouldShowSuggestions(
  messages: PlanningMessage[]
): boolean {
  return messages.length === 0;
}

export function formatCaptureContent(
  annotation: string,
  messageContent: string
): string {
  return `${annotation}: ${messageContent}`;
}

// --- localStorage 헬퍼 ---

const STORAGE_KEY_PREFIX = 'planningChat_';

export function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

export function loadMessages(sessionId: string): PlanningMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((msg: PlanningMessage) => ({
      ...msg,
      isStreaming: false,
    }));
  } catch {
    return [];
  }
}

export function saveMessages(
  sessionId: string,
  messages: PlanningMessage[]
): void {
  try {
    const completed = messages.filter(
      (msg) => !msg.isStreaming && msg.content
    );
    localStorage.setItem(
      getStorageKey(sessionId),
      JSON.stringify(completed)
    );
  } catch {
    // 무시
  }
}

// --- React 컴포넌트 ---

/**
 * ✨플래닝 탭: Sales Rep가 Consultation Agent를 선택하여 세션 맥락에서 내부향 대화
 *
 * - Consultation Agent 드롭다운에서 에이전트를 고르면 WebSocket 연결 시작
 * - stateless=true + configId로 sendMessage 라우트 호출
 * - 백엔드가 메시지 저장/세션 상태 변경을 스킵하고 세션 대화 이력을 에이전트에 전달
 * - 대화 이력은 localStorage에 sessionId + configId별로 저장
 */
export const PlanningChatTab: React.FC<PlanningChatTabProps> = ({
  sessionId,
  session: _session,
}) => {
  const { t } = useI18n();

  // Consultation Agent 목록 및 선택
  const [configs, setConfigs] = useState<AgentConfiguration[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(
    null
  );

  // 채팅 상태
  const [messages, setMessages] = useState<PlanningMessage[]>(() =>
    loadMessages(sessionId)
  );
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureTarget, setCaptureTarget] =
    useState<PlanningMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Consultation Agent 목록 로드
  useEffect(() => {
    setLoadingConfigs(true);
    setConfigError(null);
    adminApi
      .listAgentConfigs({ agentRole: 'consultation' })
      .then((res) => {
        setConfigs(res.configs || []);
      })
      .catch(() => {
        setConfigError(
          t('admin.planningChat.loadAgentsError') ||
            '에이전트 목록을 불러오지 못했습니다.'
        );
      })
      .finally(() => {
        setLoadingConfigs(false);
      });
  }, [t]);

  // 메시지 변경 시 localStorage 저장
  useEffect(() => {
    if (!isStreaming) {
      saveMessages(sessionId, messages);
    }
  }, [messages, isStreaming, sessionId]);

  // 스크롤을 최하단으로 이동
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket 콜백
  const handleChunk = useCallback((chunk: string) => {
    setMessages((prev) => updateStreamingMessage(prev, chunk));
  }, []);

  // 에이전트가 paragraph 경계(\n\n)를 boundary 이벤트로 보낸다.
  // 단일 말풍선 내 paragraph 분리를 위해 \n\n을 복원한다.
  const handleBoundary = useCallback(() => {
    setMessages((prev) => updateStreamingMessage(prev, '\n\n'));
  }, []);

  const handleTool = useCallback((tool: ToolEvent) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.sender !== 'assistant') return prev;
      const updatedTools = [...(last.toolEvents || [])];
      const existingIdx = updatedTools.findIndex(
        (t) => t.toolUseId === tool.toolUseId
      );
      if (existingIdx >= 0) {
        updatedTools[existingIdx] = tool;
      } else {
        updatedTools.push(tool);
      }
      return [
        ...prev.slice(0, -1),
        { ...last, toolEvents: updatedTools },
      ];
    });
  }, []);

  const handleComplete = useCallback(() => {
    setMessages((prev) => completeStreamingMessage(prev));
    setIsStreaming(false);
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setIsStreaming(false);
    setMessages((prev) => completeStreamingMessage(prev));
  }, []);

  const { sendPlanningMessage, isConnected, connectionState } =
    usePlanningWebSocket({
      sessionId,
      wsUrl: WS_URL,
      locale: 'ko',
      configId: selectedConfigId || undefined,
      onChunk: handleChunk,
      onBoundary: handleBoundary,
      onTool: handleTool,
      onComplete: handleComplete,
      onError: handleError,
    });

  // 메시지 전송 핸들러
  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      if (!selectedConfigId) {
        setError(
          t('admin.planningChat.selectAgentPrompt') ||
            '먼저 에이전트를 선택해 주세요.'
        );
        return;
      }

      setError(null);
      const userMsg = createUserMessage(text.trim());
      const assistantMsg = createAssistantMessage();

      setMessages((prev) =>
        addMessage(addMessage(prev, userMsg), assistantMsg)
      );
      setIsStreaming(true);
      setInputValue('');
      sendPlanningMessage(text.trim());
    },
    [isStreaming, selectedConfigId, sendPlanningMessage, t]
  );

  const handleSuggestedQuestionClick = useCallback(
    (question: string) => {
      handleSend(question);
    },
    [handleSend]
  );

  const handleInputSend = useCallback(() => {
    handleSend(inputValue);
  }, [handleSend, inputValue]);

  // PlanningMessage → Message 변환
  const toStreamingMessage = (msg: PlanningMessage): Message => ({
    id: msg.id,
    content: msg.content,
    sender: msg.sender === 'user' ? 'customer' : 'bot',
    timestamp: msg.timestamp,
    stage: 'conversation',
    status: msg.isStreaming ? 'streaming' : 'complete',
  });

  // 대화 이력 클리어
  const handleClearMessages = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(getStorageKey(sessionId));
    } catch {
      // 무시
    }
  }, [sessionId]);

  const showSuggestions = shouldShowSuggestions(messages);

  // 에이전트 선택 옵션
  const agentOptions: SelectProps.Option[] = configs.map((c) => ({
    label: c.agentName || `Agent ${c.configId.slice(0, 8)}`,
    value: c.configId,
    description: extractModelName(c.modelId),
  }));

  const selectedOption = selectedConfigId
    ? agentOptions.find((o) => o.value === selectedConfigId) || null
    : null;

  const isChatEnabled = Boolean(selectedConfigId);

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        {/* 에이전트 선택 */}
        <FormField
          label={
            t('admin.planningChat.agentSelectLabel') || '상담 에이전트 선택'
          }
          description={
            t('admin.planningChat.agentSelectDescription') ||
            '영업 전략 수립에 사용할 상담 에이전트(Consultation Agent)를 선택하세요.'
          }
        >
          <SpaceBetween direction="horizontal" size="xs">
            <Select
              selectedOption={selectedOption}
              onChange={({ detail }) =>
                setSelectedConfigId(
                  detail.selectedOption?.value || null
                )
              }
              options={agentOptions}
              loadingText={
                t('admin.planningChat.loadingAgents') ||
                '에이전트 목록 로딩 중...'
              }
              statusType={loadingConfigs ? 'loading' : 'finished'}
              placeholder={
                t('admin.planningChat.agentSelectPlaceholder') ||
                '에이전트를 선택하세요'
              }
              empty={
                t('admin.planningChat.agentEmpty') ||
                '사용 가능한 상담 에이전트가 없습니다.'
              }
              expandToViewport
              disabled={loadingConfigs || configs.length === 0}
            />
            {isChatEnabled && (
              <StatusIndicator
                type={
                  connectionState === 'connected'
                    ? 'success'
                    : connectionState === 'connecting'
                    ? 'loading'
                    : connectionState === 'error'
                    ? 'error'
                    : 'pending'
                }
              >
                {connectionState === 'connected'
                  ? t('admin.planningChat.connected') || '연결됨'
                  : connectionState === 'connecting'
                  ? t('admin.planningChat.connecting') || '연결 중...'
                  : connectionState === 'error'
                  ? t('admin.planningChat.connectionError') ||
                    '연결 오류'
                  : t('admin.planningChat.disconnected') || '대기 중'}
              </StatusIndicator>
            )}
          </SpaceBetween>
        </FormField>

        {/* 에이전트 목록 로드 에러 */}
        {configError && <Alert type="error">{configError}</Alert>}

        {/* 에러 알림 */}
        {error && (
          <Alert
            type="error"
            dismissible
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {!isChatEnabled && !configError && !loadingConfigs && (
          <Alert type="info">
            {t('admin.planningChat.selectAgentPrompt') ||
              '대화를 시작하려면 상단에서 에이전트를 선택하세요.'}
          </Alert>
        )}

        {/* 채팅 영역 */}
        {isChatEnabled && (
          <>
            <div
              style={{
                minHeight: '400px',
                maxHeight: '600px',
                overflowY: 'auto',
                padding: '16px',
              }}
            >
              {/* Suggested Questions */}
              {showSuggestions && (
                <Box textAlign="center" padding="xl">
                  <SpaceBetween size="m">
                    <Box variant="h3" color="text-body-secondary">
                      {t('admin.planningChat.title') || 'Planning Agent'}
                    </Box>
                    <Box color="text-body-secondary">
                      {t('admin.planningChat.description') ||
                        '어카운트 분석, 서비스 추천, 유사 고객사례 검색을 도와드립니다.'}
                    </Box>
                    <SpaceBetween size="s" direction="horizontal">
                      {SUGGESTED_QUESTIONS.map((q, idx) => (
                        <Button
                          key={idx}
                          variant="normal"
                          onClick={() =>
                            handleSuggestedQuestionClick(
                              t(q.i18nKey) || q.fallback
                            )
                          }
                          disabled={isStreaming || !isConnected}
                        >
                          {t(q.i18nKey) || q.fallback}
                        </Button>
                      ))}
                    </SpaceBetween>
                  </SpaceBetween>
                </Box>
              )}

              {/* 메시지 목록 */}
              <SpaceBetween size="m">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.sender === 'user' ? (
                      <ChatMessage
                        message={toStreamingMessage(msg)}
                        isCustomer={true}
                      />
                    ) : (
                      <div>
                        {msg.toolEvents && msg.toolEvents.length > 0 && (
                          <SpaceBetween size="xs">
                            {msg.toolEvents.map((tool) => (
                              <Box
                                key={tool.toolUseId}
                                padding="xs"
                                color="text-body-secondary"
                                fontSize="body-s"
                              >
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    backgroundColor:
                                      tool.status === 'running'
                                        ? '#f2f8fd'
                                        : '#f2f8f2',
                                    border: `1px solid ${
                                      tool.status === 'running'
                                        ? '#d1e3f6'
                                        : '#d1e8d1'
                                    }`,
                                  }}
                                >
                                  {tool.status === 'running' ? '🔄' : '✅'}{' '}
                                  <strong>{tool.toolName}</strong>
                                  {tool.status === 'running'
                                    ? ` ${
                                        t(
                                          'admin.planningChat.toolRunning'
                                        ) || '실행 중...'
                                      }`
                                    : ` ${
                                        t(
                                          'admin.planningChat.toolComplete'
                                        ) || '완료'
                                      }`}
                                </span>
                              </Box>
                            ))}
                          </SpaceBetween>
                        )}
                        <StreamingChatMessage
                          message={toStreamingMessage(msg)}
                          isStreaming={msg.isStreaming}
                          onCapture={
                            !msg.isStreaming && msg.content
                              ? () => setCaptureTarget(msg)
                              : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </SpaceBetween>

              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <SpaceBetween size="xs">
              {messages.length > 0 && (
                <Box float="right">
                  <Button
                    variant="normal"
                    iconName="refresh"
                    onClick={handleClearMessages}
                    disabled={isStreaming}
                  >
                    {t('admin.planningChat.clearHistory') ||
                      '대화 이력 초기화'}
                  </Button>
                </Box>
              )}
              <MultilineChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleInputSend}
                placeholder={
                  t('admin.planningChat.inputPlaceholder') ||
                  'Planning Agent에게 질문하세요...'
                }
                disabled={isStreaming || !isConnected}
              />
            </SpaceBetween>
          </>
        )}

        {/* Capture to Discussion 모달 */}
        <CaptureDiscussionModal
          visible={captureTarget !== null}
          messageContent={captureTarget?.content || ''}
          sessionId={sessionId}
          onDismiss={() => setCaptureTarget(null)}
          onSuccess={() => setCaptureTarget(null)}
        />
      </SpaceBetween>
    </Box>
  );
};
