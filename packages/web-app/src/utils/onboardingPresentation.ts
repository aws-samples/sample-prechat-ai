import type { QuestState, QuestStatus } from '../types';

/**
 * 단일 Quest를 UI presentation 속성으로 변환한 결과.
 *
 * - `showCta`: CTA 버튼을 렌더링해야 하는지 여부
 * - `safeCtaPath`: 네비게이션에 사용할 안전한 CTA 경로 (검증 통과 시에만 값, 아니면 null)
 * - `statusIconAriaLabel`: Cloudscape StatusIndicator 등에 사용할 aria-label용 i18n key
 */
export interface QuestPresentation {
  /** CTA 버튼을 렌더링해야 하는지 여부 */
  showCta: boolean;
  /** 네비게이션에 사용할 안전한 CTA 경로 (검증 통과 시에만 값, 아니면 null) */
  safeCtaPath: string | null;
  /** Cloudscape StatusIndicator 등에 사용할 aria-label용 i18n key */
  statusIconAriaLabel: string;
}

/**
 * Quest의 ctaPath가 안전한 내부 어드민 경로인지 검증한다.
 *
 * - null, undefined, 빈 문자열, 비문자열 → unsafe
 * - 정확히 '/admin' 또는 '/admin/'로 시작하는 경우만 safe
 *
 * '/administrator' 같은 유사 경로를 허용하지 않도록 `startsWith('/admin/')`와
 * 정확 일치(`=== '/admin'`)만 허용한다.
 */
export function isSafeCtaPath(ctaPath: string | null | undefined): boolean {
  if (typeof ctaPath !== 'string' || ctaPath.length === 0) return false;
  return ctaPath === '/admin' || ctaPath.startsWith('/admin/');
}

/**
 * Quest 상태에 대응하는 i18n key를 반환한다.
 *
 * 실제 텍스트 해석은 페이지 측에서 t() 함수로 수행하며,
 * 이 함수는 key 문자열만 반환한다 (부작용 없음).
 *
 * - `complete`   → 'onboarding.status.complete'
 * - `incomplete` → 'onboarding.status.incomplete'
 * - `info-only`  → 'onboarding.status.info'
 * - 그 외        → 'onboarding.status.info' (안전한 fallback)
 */
export function getStatusAriaLabelKey(status: QuestStatus): string {
  switch (status) {
    case 'complete':
      return 'onboarding.status.complete';
    case 'incomplete':
      return 'onboarding.status.incomplete';
    case 'info-only':
      return 'onboarding.status.info';
    default:
      return 'onboarding.status.info';
  }
}

/**
 * QuestState를 presentation 속성으로 매핑한다.
 *
 * 순수 함수이며 부작용이 없고, 동일 입력에 대해 항상 동일 출력을 반환한다
 * (deterministic, fast-check 기반 PBT로 검증 가능).
 *
 * @param quest 서버에서 수급한 단일 Quest 상태
 * @returns UI 렌더링에 필요한 presentation 속성
 */
export function mapQuestToPresentation(quest: QuestState): QuestPresentation {
  const safe = isSafeCtaPath(quest.ctaPath);
  return {
    showCta: safe,
    safeCtaPath: safe ? (quest.ctaPath as string) : null,
    statusIconAriaLabel: getStatusAriaLabelKey(quest.status),
  };
}
