// nosemgrep
import { useState, useCallback } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Input,
  Flashbar,
} from '@cloudscape-design/components';
import { adminApi } from '../services/api';
import { useI18n } from '../i18n';

// --- 테스트 가능한 순수 함수들 ---

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

/**
 * 주석 입력 유효성을 검증합니다.
 * 빈 문자열이나 공백만 있는 문자열은 유효하지 않습니다.
 */
export function validateAnnotation(annotation: string): boolean {
  return annotation.trim().length > 0;
}

/**
 * Discussion API 호출을 위한 페이로드를 구성합니다.
 */
export function buildDiscussionPayload(
  sessionId: string,
  annotation: string,
  messageContent: string
): { sessionId: string; content: string } {
  return {
    sessionId,
    content: formatCaptureContent(annotation.trim(), messageContent),
  };
}

/**
 * 캡처 핸들러를 생성합니다.
 * API 호출 성공/실패에 따라 콜백을 호출합니다.
 */
export function createCaptureHandler(options: {
  apiCall: (sessionId: string, content: string) => Promise<unknown>;
  onSuccess: () => void;
  onError: (error: Error) => void;
}): (
  sessionId: string,
  annotation: string,
  messageContent: string
) => Promise<void> {
  return async (sessionId, annotation, messageContent) => {
    const payload = buildDiscussionPayload(
      sessionId,
      annotation,
      messageContent
    );
    try {
      await options.apiCall(payload.sessionId, payload.content);
      options.onSuccess();
    } catch (error) {
      options.onError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };
}

// --- 타입 정의 ---

export interface CaptureDiscussionModalProps {
  visible: boolean;
  messageContent: string;
  sessionId: string;
  onDismiss: () => void;
  onSuccess: () => void;
}

// --- React 컴포넌트 ---

/**
 * Planning Agent 응답을 Discussion 탭에 캡처하기 위한 주석 입력 모달
 *
 * 1. Sales Rep이 AI 응답 말풍선의 캡처 버튼 클릭
 * 2. 모달 표시 → 주석 입력 필드
 * 3. 확인 클릭 → adminApi.createDiscussion 호출
 * 4. 성공 시 토스트 알림 표시 및 모달 닫기
 */
export const CaptureDiscussionModal: React.FC<
  CaptureDiscussionModalProps
> = ({ visible, messageContent, sessionId, onDismiss, onSuccess }) => {
  const { t } = useI18n();
  const [annotation, setAnnotation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flashItems, setFlashItems] = useState<
    Array<{ type: 'success' | 'error'; content: string; id: string }>
  >([]);

  const handleConfirm = useCallback(async () => {
    if (!validateAnnotation(annotation)) return;

    setIsSubmitting(true);
    const handler = createCaptureHandler({
      apiCall: adminApi.createDiscussion,
      onSuccess: () => {
        setFlashItems([
          {
            type: 'success',
            content:
              t('admin.planningChat.captureSuccess') ||
              '캡처가 완료되었습니다.',
            id: 'capture-success',
          },
        ]);
        setAnnotation('');
        setIsSubmitting(false);
        // 토스트 표시 후 모달 닫기
        setTimeout(() => {
          setFlashItems([]);
          onSuccess();
        }, 1000);
      },
      onError: () => {
        setFlashItems([
          {
            type: 'error',
            content:
              t('admin.planningChat.captureError') ||
              '캡처에 실패했습니다. 다시 시도해주세요.',
            id: 'capture-error',
          },
        ]);
        setIsSubmitting(false);
      },
    });

    await handler(sessionId, annotation, messageContent);
  }, [annotation, sessionId, messageContent, onSuccess, t]);

  const handleDismiss = useCallback(() => {
    setAnnotation('');
    setFlashItems([]);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      header={
        t('admin.planningChat.captureModalTitle') ||
        'Discussion에 캡처'
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={handleDismiss}
              disabled={isSubmitting}
            >
              {t('common.cancel') || '취소'}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={isSubmitting}
              disabled={!validateAnnotation(annotation)}
            >
              {t('common.confirm') || '확인'}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {flashItems.length > 0 && (
          <Flashbar items={flashItems} />
        )}
        <FormField
          label={
            t('admin.planningChat.annotationLabel') || '주석'
          }
          description={
            t('admin.planningChat.annotationDescription') ||
            '캡처할 내용에 대한 주석을 입력하세요.'
          }
        >
          <Input
            value={annotation}
            onChange={({ detail }) =>
              setAnnotation(detail.value)
            }
            placeholder={
              t(
                'admin.planningChat.annotationPlaceholder'
              ) || '예: 서비스 추천 관련 인사이트'
            }
            disabled={isSubmitting}
          />
        </FormField>
        <FormField
          label={
            t('admin.planningChat.captureContentLabel') ||
            '캡처 대상 내용'
          }
        >
          <Box
            variant="code"
            padding="s"
          >
            {messageContent.length > 200
              ? `${messageContent.slice(0, 200)}...`
              : messageContent}
          </Box>
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};
