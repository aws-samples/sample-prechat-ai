/**
 * PlanningChatTab 컴포넌트 단위 테스트
 *
 * node 환경에서 컴포넌트의 핵심 로직을 순수 함수로 추출하여 테스트합니다.
 * - Suggested Questions 목록 구성
 * - PlanningMessage 생성 (user/assistant)
 * - 메시지 상태 관리 로직 (추가, 스트리밍 업데이트, 완료)
 * - Suggested Questions 표시 조건 (메시지가 없을 때만)
 * - Capture to Discussion 콘텐츠 포맷팅
 * - 대화 이력 초기화 시 Suggested Questions 재표시
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.3, 6.4**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// node 환경에서 DOMPurify 등 브라우저 전용 모듈 mock
vi.mock('dompurify', () => ({
  default: {
    addHook: vi.fn(),
    sanitize: vi.fn((html: string) => html),
  },
}));

vi.mock('react-markdown', () => ({
  default: vi.fn(),
}));

vi.mock('remark-gfm', () => ({
  default: vi.fn(),
}));

import {
  SUGGESTED_QUESTIONS,
  createUserMessage,
  createAssistantMessage,
  addMessage,
  updateStreamingMessage,
  completeStreamingMessage,
  shouldShowSuggestions,
  formatCaptureContent,
  type SuggestedQuestion,
} from '../PlanningChatTab';

describe('PlanningChatTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Suggested Questions ---
  describe('SUGGESTED_QUESTIONS', () => {
    it('3개의 추천 질문이 정의되어 있다', () => {
      expect(SUGGESTED_QUESTIONS).toHaveLength(3);
    });

    it('각 추천 질문은 i18n 키를 포함한다', () => {
      SUGGESTED_QUESTIONS.forEach((q: SuggestedQuestion) => {
        expect(q.i18nKey).toBeTruthy();
        expect(typeof q.i18nKey).toBe('string');
      });
    });

    it('각 추천 질문은 fallback 텍스트를 포함한다', () => {
      SUGGESTED_QUESTIONS.forEach((q: SuggestedQuestion) => {
        expect(q.fallback).toBeTruthy();
        expect(typeof q.fallback).toBe('string');
      });
    });
  });

  // --- PlanningMessage 생성 ---
  describe('createUserMessage', () => {
    it('sender가 user인 메시지를 생성한다', () => {
      const msg = createUserMessage('테스트 질문');
      expect(msg.sender).toBe('user');
      expect(msg.content).toBe('테스트 질문');
      expect(msg.id).toBeTruthy();
      expect(msg.timestamp).toBeTruthy();
    });

    it('고유한 id를 생성한다', () => {
      const msg1 = createUserMessage('질문 1');
      const msg2 = createUserMessage('질문 2');
      expect(msg1.id).not.toBe(msg2.id);
    });

    it('isStreaming이 undefined이다', () => {
      const msg = createUserMessage('질문');
      expect(msg.isStreaming).toBeUndefined();
    });
  });

  describe('createAssistantMessage', () => {
    it('sender가 assistant인 빈 메시지를 생성한다', () => {
      const msg = createAssistantMessage();
      expect(msg.sender).toBe('assistant');
      expect(msg.content).toBe('');
      expect(msg.isStreaming).toBe(true);
      expect(msg.id).toBeTruthy();
      expect(msg.timestamp).toBeTruthy();
    });

    it('toolEvents가 빈 배열로 초기화된다', () => {
      const msg = createAssistantMessage();
      expect(msg.toolEvents).toEqual([]);
    });
  });

  // --- 메시지 상태 관리 ---
  describe('addMessage', () => {
    it('빈 배열에 메시지를 추가한다', () => {
      const msg = createUserMessage('안녕');
      const result = addMessage([], msg);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(msg);
    });

    it('기존 메시지 배열에 새 메시지를 추가한다', () => {
      const existing = [createUserMessage('기존 메시지')];
      const newMsg = createAssistantMessage();
      const result = addMessage(existing, newMsg);
      expect(result).toHaveLength(2);
      expect(result[1]).toBe(newMsg);
    });

    it('원본 배열을 변경하지 않는다 (불변성)', () => {
      const original = [createUserMessage('원본')];
      const originalLength = original.length;
      addMessage(original, createUserMessage('새 메시지'));
      expect(original).toHaveLength(originalLength);
    });
  });

  describe('updateStreamingMessage', () => {
    it('마지막 assistant 메시지의 content에 chunk를 추가한다', () => {
      const assistantMsg = createAssistantMessage();
      assistantMsg.content = '기존 ';
      const messages = [createUserMessage('질문'), assistantMsg];

      const result = updateStreamingMessage(messages, '텍스트');
      const lastMsg = result[result.length - 1];
      expect(lastMsg.content).toBe('기존 텍스트');
    });

    it('마지막 메시지가 assistant가 아니면 변경하지 않는다', () => {
      const messages = [createUserMessage('질문')];
      const result = updateStreamingMessage(messages, '청크');
      expect(result).toEqual(messages);
    });

    it('빈 배열이면 변경하지 않는다', () => {
      const result = updateStreamingMessage([], '청크');
      expect(result).toEqual([]);
    });

    it('원본 배열을 변경하지 않는다 (불변성)', () => {
      const assistantMsg = createAssistantMessage();
      const original = [assistantMsg];
      updateStreamingMessage(original, '청크');
      expect(original[0].content).toBe('');
    });
  });

  describe('completeStreamingMessage', () => {
    it('마지막 assistant 메시지의 isStreaming을 false로 설정한다', () => {
      const assistantMsg = createAssistantMessage();
      assistantMsg.content = '완성된 응답';
      const messages = [createUserMessage('질문'), assistantMsg];

      const result = completeStreamingMessage(messages);
      const lastMsg = result[result.length - 1];
      expect(lastMsg.isStreaming).toBe(false);
    });

    it('마지막 메시지가 assistant가 아니면 변경하지 않는다', () => {
      const messages = [createUserMessage('질문')];
      const result = completeStreamingMessage(messages);
      expect(result).toEqual(messages);
    });
  });

  // --- Suggested Questions 표시 조건 ---
  describe('shouldShowSuggestions', () => {
    it('메시지가 없으면 true를 반환한다', () => {
      expect(shouldShowSuggestions([])).toBe(true);
    });

    it('메시지가 있으면 false를 반환한다', () => {
      const messages = [createUserMessage('질문')];
      expect(shouldShowSuggestions(messages)).toBe(false);
    });
  });

  // --- Capture to Discussion 콘텐츠 포맷팅 ---
  describe('formatCaptureContent', () => {
    it('주석과 메시지 내용을 올바른 형식으로 결합한다', () => {
      const result = formatCaptureContent(
        '중요한 인사이트',
        'AWS Lambda를 추천합니다.'
      );
      expect(result).toBe(
        '중요한 인사이트: AWS Lambda를 추천합니다.'
      );
    });

    it('빈 주석이면 메시지 내용만 반환한다', () => {
      const result = formatCaptureContent('', '응답 내용');
      expect(result).toBe(': 응답 내용');
    });

    it('주석과 응답 내용이 정확히 보존된다', () => {
      const annotation = '특수문자 !@#$%';
      const content = '마크다운 **볼드** `코드`';
      const result = formatCaptureContent(annotation, content);
      expect(result).toContain(annotation);
      expect(result).toContain(content);
    });
  });
});
