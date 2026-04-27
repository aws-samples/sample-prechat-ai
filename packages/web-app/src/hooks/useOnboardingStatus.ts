import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { OnboardingStatus } from '../types';
import { getOnboardingStatus } from '../services/onboardingApi';

export interface UseOnboardingStatusResult {
  status: OnboardingStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * `/onboarding` 페이지용 데이터 수급 훅.
 *
 * - 마운트 시 1회 fetch
 * - 언마운트 시 진행 중 요청 취소 (AbortController)
 * - refetch() 호출 시 새 AbortController로 재요청
 * - 401은 axios 공통 인터셉터가 처리하므로 훅은 error 상태로 설정하지 않음
 *   (조용히 throw 전파)
 */
export function useOnboardingStatus(): UseOnboardingStatusResult {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 현재 진행 중인 요청의 AbortController 참조
  const abortRef = useRef<AbortController | null>(null);
  // 언마운트 플래그 — 컴포넌트가 언마운트된 후 setState를 피하기 위함
  const mountedRef = useRef<boolean>(true);

  const run = useCallback(async (): Promise<void> => {
    // 이전 in-flight 요청이 있으면 취소
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await getOnboardingStatus(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setStatus(data);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted) return;
      // 명시적 취소는 무시 (ERR_CANCELED 포함)
      if (axios.isCancel(err)) return;
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 401은 공통 인터셉터가 /login 리다이렉트 처리 → 훅은 조용히 무시
      if (statusCode === 401) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(async () => {
    await run();
  }, [run]);

  useEffect(() => {
    mountedRef.current = true;
    void run();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [run]);

  return { status, loading, error, refetch };
}
