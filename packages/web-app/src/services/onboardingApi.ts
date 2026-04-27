import type { AxiosError } from 'axios';
import axios from 'axios';
import type { OnboardingStatus, QuestState } from '../types';
import { apiClient } from './api';

/**
 * 응답이 올바른 OnboardingStatus 형태인지 가볍게 검증한다.
 * - quests 배열 길이 === 6
 * - 각 quest의 questId가 unique
 * - generatedAt 이 문자열 (ISO 8601 기대, 문자열 여부만 최소 검증)
 */
function assertValidOnboardingStatus(
  data: unknown
): asserts data is OnboardingStatus {
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as OnboardingStatus).quests)
  ) {
    throw new Error('Invalid onboarding status response shape');
  }
  const status = data as OnboardingStatus;
  if (status.quests.length !== 6) {
    throw new Error(`Expected 6 quests, received ${status.quests.length}`);
  }
  const ids = status.quests.map((q: QuestState) => q.questId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Quest IDs are not unique');
  }
  if (typeof status.generatedAt !== 'string') {
    throw new Error('Missing or invalid generatedAt timestamp');
  }
}

/**
 * GET /api/admin/onboarding/status
 *
 * - 기존 axios 인스턴스(JWT 인터셉터 포함)를 재사용
 * - AbortSignal 지원 (React StrictMode / 언마운트 시 요청 취소)
 * - 401은 api.ts 공통 인터셉터가 처리하므로 여기서는 throw (호출측에서 처리 혹은 무시)
 * - 응답 형태 불량 시 throw (quests.length === 6 검증)
 */
export async function getOnboardingStatus(
  signal?: AbortSignal
): Promise<OnboardingStatus> {
  try {
    const response = await apiClient.get<OnboardingStatus>(
      '/admin/onboarding/status',
      { signal }
    );
    assertValidOnboardingStatus(response.data);
    return response.data;
  } catch (error) {
    // 언마운트 취소는 조용히 rethrow
    if (
      axios.isCancel(error) ||
      (error as AxiosError).code === 'ERR_CANCELED'
    ) {
      throw error;
    }
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message ?? error.message;
      const enhanced = new Error(
        `Failed to fetch onboarding status: ${message ?? 'unknown error'}`
      );
      (enhanced as Error & { statusCode?: number }).statusCode = statusCode;
      throw enhanced;
    }
    throw error;
  }
}
