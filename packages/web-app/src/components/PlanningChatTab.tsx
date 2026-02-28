// nosemgrep
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  SpaceBetween,
  Alert,
} from '@cloudscape-design/components';
import { usePlanningWebSocket } from '../hooks/usePlanningWebSocket';
import { StreamingChatMessage } from './StreamingChatMessage';
import { MultilineChatInput } from './MultilineChatInput';
import { WS_URL } from '../config/api';
import { useI18n } from '../i18n';
import { CaptureDiscussionModal } from './CaptureDiscussionModal';
import type { Session, Message } from '../types';

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

/**
 * 추천 질문 목록 정의
 */
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
];

/**
 * 사용자 메시지를 생성합니다.
 */
export function createUserMessage(content: string): PlanningMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sender: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 스트리밍 중인 assistant 메시지를 생성합니다.
 */
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

/**
 * 메시지 배열에 새 메시지를 추가합니다 (불변).
 */
export function addMessage(
  messages: PlanningMessage[],
  message: PlanningMessage
): PlanningMessage[] {
  return [...messages, message];
}

/**
 * 마지막 assistant 메시지에 스트리밍 chunk를 추가합니다 (불변).
 */
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

/**
 * 마지막 assistant 메시지의 스트리밍을 완료합니다 (불변).
 */
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

/**
 * Suggested Questions 표시 여부를 결정합니다.
 * 메시지가 없을 때만 표시합니다.
 */
export function shouldShowSuggestions(
  messages: PlanningMessage[]
): boolean {
  return messages.length === 0;
}

/**
 * Capture to Discussion 콘텐츠를 포맷합니다.
 * "<주석>: <응답 내용>" 형식으로 결합합니다.
 */
export function formatCaptureContent(
  annotation: string,
  messageContent: string
): string {
  return `${annotation}: ${messageContent}`;
}

// --- localStorage 헬퍼 ---

const STORAGE_KEY_PREFIX = 'planningChat_';

/**
 * sessionId별 localStorage 키를 생성합니다.
 */
export function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * localStorage에서 대화 이력을 로드합니다.
 */
export function loadMessages(sessionId: string): PlanningMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 스트리밍 중이던 메시지는 완료 상태로 복원
    return parsed.map((msg: PlanningMessage) => ({
      ...msg,
      isStreaming: false,
    }));
  } catch {
    return [];
  }
}

/**
 * localStorage에 대화 이력을 저장합니다.
 * 스트리밍 중인 메시지는 저장하지 않습니다.
 */
export function saveMessages(
  sessionId: string,
  messages: PlanningMessage[]
): void {
  try {
    // 완료된 메시지만 저장 (스트리밍 중인 빈 메시지 제외)
    const completed = messages.filter(
      (msg) => !msg.isStreaming && msg.content
    );
    localStorage.setItem(
      getStorageKey(sessionId),
      JSON.stringify(completed)
    );
  } catch {
    // localStorage 용량 초과 등 무시
  }
}

// --- React 컴포넌트 ---

/**
 * Planning Agent 채팅 탭 컴포넌트
 *
 * - 초기 진입 시 Suggested Questions 표시
 * - 추천 질문 클릭 시 자동 전송
 * - 자유 텍스트 입력 필드
 * - 스트리밍 메시지 표시 (StreamingChatMessage 재활용)
 * - 각 AI 응답에 Capture to Discussion 버튼
 * - 대화 이력은 React state로만 관리
 */
export const PlanningChatTab: React.FC<PlanningChatTabProps> = ({
  sessionId,
  // session은 향후 CaptureDiscussionModal에서 사용 예정
  session: _session,
}) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<PlanningMessage[]>(
    () => loadMessages(sessionId)
  );
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureTarget, setCaptureTarget] = useState<PlanningMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 변경 시 localStorage에 저장
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

  const handleTool = useCallback(
    (tool: ToolEvent) => {
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
    },
    []
  );

  const handleComplete = useCallback(() => {
    setMessages((prev) => completeStreamingMessage(prev));
    setIsStreaming(false);
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setIsStreaming(false);
    setMessages((prev) => completeStreamingMessage(prev));
  }, []);

  const { sendPlanningMessage, isConnected } = usePlanningWebSocket({
    sessionId,
    wsUrl: WS_URL,
    locale: 'ko',
    onChunk: handleChunk,
    onTool: handleTool,
    onComplete: handleComplete,
    onError: handleError,
  });

  // 메시지 전송 핸들러
  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);
      const userMsg = createUserMessage(text.trim());
      const assistantMsg = createAssistantMessage();

      setMessages((prev) => addMessage(addMessage(prev, userMsg), assistantMsg));
      setIsStreaming(true);
      setInputValue('');
      sendPlanningMessage(text.trim());
    },
    [isStreaming, sendPlanningMessage]
  );

  // 추천 질문 클릭 핸들러
  const handleSuggestedQuestionClick = useCallback(
    (question: string) => {
      handleSend(question);
    },
    [handleSend]
  );

  // 입력 필드 전송 핸들러
  const handleInputSend = useCallback(() => {
    handleSend(inputValue);
  }, [handleSend, inputValue]);

  // PlanningMessage → Message 변환 (StreamingChatMessage 호환)
  const toStreamingMessage = (msg: PlanningMessage): Message => ({
    id: msg.id,
    content: msg.content,
    sender: msg.sender === 'user' ? 'customer' : 'bot',
    timestamp: msg.timestamp,
    stage: 'conversation',
    status: msg.isStreaming ? 'streaming' : 'complete',
  });

  const showSuggestions = shouldShowSuggestions(messages);

  return (
    <Box padding="l">
      <SpaceBetween size="l">
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

        {/* 채팅 영역 */}
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
                <Box
                  variant="h3"
                  color="text-body-secondary"
                >
                  {t('admin.planningChat.title') ||
                    'Planning Agent'}
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Box
                      padding="s"
                      variant="awsui-gen-ai-label"
                    >
                      {msg.content}
                    </Box>
                  </div>
                ) : (
                  <div>
                    {/* Tool 사용 이벤트 말풍선 */}
                    {msg.toolEvents && msg.toolEvents.length > 0 && (
                      <SpaceBetween size="xs">
                        {msg.toolEvents.map((tool) => (
                          <Box
                            key={tool.toolUseId}
                            padding="xs"
                            color="text-body-secondary"
                            fontSize="body-s"
                          >
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              backgroundColor: tool.status === 'running'
                                ? '#f2f8fd'
                                : '#f2f8f2',
                              border: `1px solid ${tool.status === 'running' ? '#d1e3f6' : '#d1e8d1'}`,
                            }}>
                              {tool.status === 'running' ? '🔄' : '✅'}
                              {' '}
                              <strong>{tool.toolName}</strong>
                              {tool.status === 'running'
                                ? ` ${t('admin.planningChat.toolRunning') || '실행 중...'}`
                                : ` ${t('admin.planningChat.toolComplete') || '완료'}`}
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
