import type { CustomizingSet } from '../types/customization';

/**
 * 렌더 게이팅 결정에 필요한 입력 타입
 * - pathKind: 현재 경로 종류 (고객 경로 vs 관리자 경로)
 * - loadStatus: 커스터마이제이션 데이터 로드 상태
 * - hasCustomization: 의미 있는 커스터마이제이션 값 존재 여부
 */
export type RenderInput = {
  pathKind: 'customer' | 'admin';
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error';
  hasCustomization: boolean;
};

/**
 * 렌더 게이팅 결정 결과 타입
 * - neutral: 로드 미완료 — 기본 UI 노출 없이 중립 상태 유지
 * - custom: 커스텀 UI 렌더 (loaded + hasCustomization=true)
 * - default: 기본 UI 렌더 (loaded + hasCustomization=false)
 * - error-fallback: 에러 발생 시 기본 UI 폴백
 * - bypass: 관리자 경로 — 게이팅 미적용, 즉시 렌더
 */
export type RenderDecision =
  | 'neutral'
  | 'custom'
  | 'default'
  | 'error-fallback'
  | 'bypass';

/**
 * 렌더 게이팅 의사결정 순수 함수
 *
 * 의사결정 표:
 * | pathKind   | loadStatus       | hasCustomization | 결과           |
 * |------------|------------------|------------------|----------------|
 * | admin      | *                | *                | bypass         |
 * | customer   | idle             | *                | neutral        |
 * | customer   | loading          | *                | neutral        |
 * | customer   | loaded           | true             | custom         |
 * | customer   | loaded           | false            | default        |
 * | customer   | error            | *                | error-fallback |
 *
 * @param input - 렌더 결정에 필요한 입력값
 * @returns 렌더 결정 결과
 */
export function resolveRenderDecision(input: RenderInput): RenderDecision {
  const { pathKind, loadStatus, hasCustomization } = input;

  // 관리자 경로: 게이팅 미적용, 즉시 렌더
  if (pathKind === 'admin') {
    return 'bypass';
  }

  // 고객 경로: loadStatus에 따라 분기
  switch (loadStatus) {
    case 'idle':
    case 'loading':
      // 로드 미완료 — 기본 UI 노출 없이 중립 상태 유지 (Bug Fix 핵심)
      return 'neutral';

    case 'loaded':
      // 로드 완료 — 커스터마이제이션 존재 여부에 따라 분기
      return hasCustomization ? 'custom' : 'default';

    case 'error':
      // 에러 발생 — 기본 UI 폴백 (터미널 상태)
      return 'error-fallback';
  }
}

/**
 * LocalizedString 값이 의미 있는지 판정하는 헬퍼
 *
 * ko/en 양쪽이 모두 빈 문자열이거나 공백만 포함하면 "의미 없음"으로 판정
 *
 * @param value - LocalizedString 또는 null
 * @returns 의미 있는 값이 있으면 true
 */
function hasLocalizedValue(
  value: { ko: string; en: string } | null
): boolean {
  if (!value) return false;
  const koTrimmed = (value.ko ?? '').trim();
  const enTrimmed = (value.en ?? '').trim();
  return koTrimmed.length > 0 || enTrimmed.length > 0;
}

/**
 * CustomizingSet에서 의미 있는 커스터마이제이션 값이 있는지 판정하는 순수 함수
 *
 * header/welcome/background/legal 섹션 중 하나라도 의미 있는 값이 있으면 true.
 * null이거나 모든 필드가 비어있으면 false.
 *
 * "의미 없음" 판정 기준:
 * - string | null 필드: null이거나 trim().length === 0
 * - LocalizedString 필드: null이거나 ko/en 양쪽 모두 trim().length === 0
 *
 * @param customizingSet - 검사할 CustomizingSet 또는 null
 * @returns 의미 있는 커스터마이제이션 값이 있으면 true
 */
export function deriveHasCustomization(
  customizingSet: CustomizingSet | null
): boolean {
  if (!customizingSet) return false;

  const { header, welcome, background, legal } = customizingSet;

  // header 섹션 검사
  const hasHeader =
    (header.logoUrl != null && header.logoUrl.trim().length > 0) ||
    (header.logoLink != null && header.logoLink.trim().length > 0) ||
    hasLocalizedValue(header.label) ||
    (header.labelLink != null && header.labelLink.trim().length > 0);

  if (hasHeader) return true;

  // welcome 섹션 검사
  const hasWelcome =
    (welcome.logoUrl != null && welcome.logoUrl.trim().length > 0) ||
    (welcome.logoLink != null && welcome.logoLink.trim().length > 0) ||
    hasLocalizedValue(welcome.title) ||
    hasLocalizedValue(welcome.subtitle);

  if (hasWelcome) return true;

  // background 섹션 검사
  const hasBackground =
    (background.startColor != null &&
      background.startColor.trim().length > 0) ||
    (background.endColor != null && background.endColor.trim().length > 0);

  if (hasBackground) return true;

  // legal 섹션 검사
  const hasLegal =
    hasLocalizedValue(legal.privacyTermUrl) ||
    hasLocalizedValue(legal.serviceTermUrl) ||
    (legal.supportChannel != null && legal.supportChannel.trim().length > 0);

  return hasLegal;
}
