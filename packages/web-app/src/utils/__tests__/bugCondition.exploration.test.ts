/**
 * Fix Property Test
 *
 * 목적: 수정 후 코드에서 버그가 수정되었음을 검증한다.
 *
 * 수정 후 기대 동작:
 * resolveRenderDecision({ pathKind: 'customer', loadStatus: 'loading', hasCustomization: true })
 * === 'neutral'  ← 수정: 로딩 중에는 중립 상태 유지 (기본 UI 조기 노출 없음)
 *
 * 이 테스트는 수정 후 코드에서 PASS (버그 수정 확인)
 *
 * 근본 원인 (수정됨):
 * - CustomizationContext가 customizingSet 초기값을 DEFAULT_CUSTOMIZING_SET으로 설정
 * - isLoading=true 상태에서도 소비 컴포넌트가 || 폴백을 즉시 발동
 * - loadStatus 개념이 없고, customizingSet 값만으로 렌더 결정
 *
 * 수정 내용:
 * - resolveRenderDecision 순수 함수 도입
 * - customer + (idle|loading) → 항상 'neutral' 반환
 * - CustomizationGate 컴포넌트로 로드 완료 전 렌더 게이팅
 *
 * **Validates: Requirements 2.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveRenderDecision } from '../renderGating';

// ─────────────────────────────────────────────────────────────────────────────
// Layout.tsx의 || 폴백 패턴을 재현하는 test double
//
// 현재 구현 (Layout.tsx):
//   const customWelcomeTitle = getLocalizedValue(customizingSet.welcome.title);
//   <h1>{customWelcomeTitle || t('welcome.header.title')}</h1>
//
// customizingSet.welcome.title이 null이면 즉시 기본 i18n 텍스트로 폴백
// ─────────────────────────────────────────────────────────────────────────────
function simulateLayoutFallback(input: {
  customWelcomeTitle: string | null;
  defaultTitle: string;
}): string {
  // 수정 전 코드의 || 폴백 패턴 재현
  return input.customWelcomeTitle || input.defaultTitle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix Property 1: loading 상태에서 resolveRenderDecision이 neutral을 반환함
// ─────────────────────────────────────────────────────────────────────────────
describe('Fix Property: loading 상태에서 neutral 반환 확인', () => {
  it('케이스 1: loading + customer + hasCustomization=true → neutral (버그 수정 확인)', () => {
    // 수정 후: 커스텀 UI가 있더라도 로딩 중에는 중립 상태 유지
    const decision = resolveRenderDecision({
      pathKind: 'customer',
      loadStatus: 'loading',
      hasCustomization: true,
    });

    // 수정 후 코드에서 PASS (버그 수정 확인)
    expect(decision).toBe('neutral');
  });

  it('케이스 2: loading + customer + hasCustomization=false → neutral (로딩 중 오판 방지)', () => {
    // 수정 후: 아직 로드 중이므로 커스텀 없음으로 오판하지 않고 중립 상태 유지
    const decision = resolveRenderDecision({
      pathKind: 'customer',
      loadStatus: 'loading',
      hasCustomization: false,
    });

    expect(decision).toBe('neutral');
  });

  it('케이스 3: idle + customer → neutral (Provider mount 직후 첫 프레임에서 중립 상태 확인)', () => {
    // 수정 후: Provider mount 직후 (idle 상태)에도 중립 상태 유지
    const decision = resolveRenderDecision({
      pathKind: 'customer',
      loadStatus: 'idle',
      hasCustomization: false,
    });

    expect(decision).toBe('neutral');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 탐색 대상 2: isLoading=true 상태에서 || 폴백이 즉시 발동하는지 확인
// (이 테스트는 Layout.tsx의 || 폴백 패턴 문서화 목적으로 유지)
// ─────────────────────────────────────────────────────────────────────────────
describe('탐색 대상 2: isLoading=true 상태에서 || 폴백이 즉시 발동함 (버그 실존 증명)', () => {
  it('customizingSet.welcome.title = null → t("welcome.header.title") 텍스트가 DOM에 노출됨', () => {
    // DEFAULT_CUSTOMIZING_SET.welcome.title = null
    // → getLocalizedValue(null) = null
    // → null || t('welcome.header.title') = 기본 i18n 텍스트
    const renderedTitle = simulateLayoutFallback({
      customWelcomeTitle: null, // DEFAULT_CUSTOMIZING_SET의 welcome.title
      defaultTitle: 'welcome.header.title', // t('welcome.header.title') 반환값
    });

    // 수정 전: 기본 i18n 텍스트가 즉시 DOM에 노출됨 (버그)
    // 수정 후: CustomizationGate가 로드 완료 전 렌더를 막으므로 이 코드 경로 자체가 실행되지 않음
    expect(renderedTitle).toBe('welcome.header.title');
  });

  it('customizingSet.welcome.subtitle = null → t("welcome.header.subtitle") 텍스트가 DOM에 노출됨', () => {
    const renderedSubtitle = simulateLayoutFallback({
      customWelcomeTitle: null,
      defaultTitle: 'welcome.header.subtitle',
    });

    expect(renderedSubtitle).toBe('welcome.header.subtitle');
  });

  it('로드 완료 후 커스텀 값이 있으면 커스텀 텍스트가 렌더됨 (정상 동작 확인)', () => {
    const renderedTitle = simulateLayoutFallback({
      customWelcomeTitle: '커스텀 타이틀',
      defaultTitle: 'welcome.header.title',
    });

    // 로드 완료 후에는 커스텀 값이 우선
    expect(renderedTitle).toBe('커스텀 타이틀');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based 검증: 모든 loading/idle 입력에서 neutral 반환 확인
// ─────────────────────────────────────────────────────────────────────────────
describe('Property: 수정 후 코드에서 customer + (idle|loading) → 항상 neutral (버그 수정 전수 확인)', () => {
  it('customer + loading 조합에서 hasCustomization 값과 무관하게 항상 neutral을 반환함', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // hasCustomization
        (hasCustomization) => {
          const decision = resolveRenderDecision({
            pathKind: 'customer',
            loadStatus: 'loading',
            hasCustomization,
          });
          // 수정 후 코드에서 PASS (버그 수정 확인)
          expect(decision).toBe('neutral');
        }
      )
    );
  });

  it('customer + idle 조합에서 hasCustomization 값과 무관하게 항상 neutral을 반환함', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (hasCustomization) => {
          const decision = resolveRenderDecision({
            pathKind: 'customer',
            loadStatus: 'idle',
            hasCustomization,
          });
          expect(decision).toBe('neutral');
        }
      )
    );
  });

  it('admin 경로는 loadStatus/hasCustomization 무관하게 항상 bypass (정상 동작 확인)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('idle', 'loading', 'loaded', 'error') as fc.Arbitrary<
          'idle' | 'loading' | 'loaded' | 'error'
        >,
        fc.boolean(),
        (loadStatus, hasCustomization) => {
          const decision = resolveRenderDecision({
            pathKind: 'admin',
            loadStatus,
            hasCustomization,
          });
          expect(decision).toBe('bypass');
        }
      )
    );
  });
});
