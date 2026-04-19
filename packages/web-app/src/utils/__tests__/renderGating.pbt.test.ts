/**
 * renderGating.ts Property-Based 테스트
 *
 * fast-check를 사용하여 resolveRenderDecision과 deriveHasCustomization의
 * 불변 조건(invariant)을 검증한다.
 *
 * 검증 Property 목록:
 * - Property 1 (Fix): customer + (idle|loading) → 항상 neutral
 * - Property 2 (Preservation — loaded + has): customer + loaded + true → 항상 custom
 * - Property 2 (Preservation — loaded + no): customer + loaded + false → 항상 default
 * - Property 3 (관리자 경로 bypass): admin + * → 항상 bypass
 * - Property 4 (에러 폴백 안전성): customer + error → default 또는 error-fallback
 * - Property 5 (순수성/전결정성): 동일 입력 → 동일 출력, 5가지 값 중 하나
 * - deriveHasCustomization: DEFAULT_CUSTOMIZING_SET → false
 * - deriveHasCustomization: 공백만 포함한 LocalizedString → false
 * - deriveHasCustomization: 의미 있는 값 포함 → true
 *
 * **Validates: Requirements 2.1, 2.4, 2.5, 3.1, 3.2, 3.5**
 */

// ─────────────────────────────────────────────────────────────────────────────
// 기준선 동작 관찰 (Observation-First Methodology)
//
// 수정 후 코드에서 loaded 상태의 실제 출력 관찰:
// - loaded + has_customization=true → 'custom' (커스텀 UI 렌더)
// - loaded + has_customization=false → 'default' (기본 UI 렌더)
// - admin + any loadStatus → 'bypass' (게이팅 미적용, 즉시 렌더)
//
// 이 동작은 수정 전/후 모두 동일해야 함 (Preservation 불변성)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { expect } from 'vitest';
import {
  resolveRenderDecision,
  deriveHasCustomization,
} from '../renderGating';
import { DEFAULT_CUSTOMIZING_SET } from '../../types/customization';
import type { CustomizingSet } from '../../types/customization';

// ─────────────────────────────────────────────────────────────────────────────
// resolveRenderDecision Property-Based 테스트
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveRenderDecision — Property-Based 테스트', () => {
  // Property 1 (Fix): customer + (idle|loading) → 항상 neutral
  // 버그 수정 핵심: 로드 미완료 시점에 기본 UI 조기 렌더링 금지
  it('property 1 (Fix): customer + (idle|loading) → 항상 neutral', () => {
    fc.assert(
      fc.property(
        fc.record({
          pathKind: fc.constant('customer' as const),
          loadStatus: fc.constantFrom('idle' as const, 'loading' as const),
          hasCustomization: fc.boolean(),
        }),
        (input) => {
          expect(resolveRenderDecision(input)).toBe('neutral');
        }
      )
    );
  });

  // Property 2 (Preservation — loaded + has): customer + loaded + true → 항상 custom
  // 로드 완료 + 커스터마이제이션 있음 → 커스텀 UI 렌더 (수정 전/후 동일)
  it('property 2 (Preservation — loaded + has): customer + loaded + true → 항상 custom', () => {
    fc.assert(
      fc.property(fc.constant('customer' as const), (pathKind) => {
        expect(
          resolveRenderDecision({
            pathKind,
            loadStatus: 'loaded',
            hasCustomization: true,
          })
        ).toBe('custom');
      })
    );
  });

  // Property 2 (Preservation — loaded + no): customer + loaded + false → 항상 default
  // 로드 완료 + 커스터마이제이션 없음 → 기본 UI 렌더 (수정 전/후 동일)
  it('property 2 (Preservation — loaded + no): customer + loaded + false → 항상 default', () => {
    fc.assert(
      fc.property(fc.constant('customer' as const), (pathKind) => {
        expect(
          resolveRenderDecision({
            pathKind,
            loadStatus: 'loaded',
            hasCustomization: false,
          })
        ).toBe('default');
      })
    );
  });

  // Property 3 (관리자 경로 bypass): admin + * → 항상 bypass
  // loadStatus/hasCustomization 무관하게 관리자 경로는 즉시 렌더 (회귀 방지)
  it('property 3 (관리자 경로 bypass): admin + * → 항상 bypass', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'idle' as const,
          'loading' as const,
          'loaded' as const,
          'error' as const
        ),
        fc.boolean(),
        (loadStatus, hasCustomization) =>
          resolveRenderDecision({
            pathKind: 'admin',
            loadStatus,
            hasCustomization,
          }) === 'bypass'
      )
    );
  });

  // Property 4 (에러 폴백 안전성): customer + error → default 또는 error-fallback
  // 에러 상태는 터미널이므로 custom/neutral을 반환하면 안 됨
  it('property 4 (에러 폴백 안전성): customer + error → default 또는 error-fallback', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasCustomization) => {
        const d = resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'error',
          hasCustomization,
        });
        expect(['default', 'error-fallback']).toContain(d);
      })
    );
  });

  // Property 5 (순수성/전결정성): 동일 입력 → 동일 출력, 정의된 5가지 값 중 하나
  // 모든 16가지 조합에서 전결정성(totality)과 순수성(purity) 검증
  it('property 5 (순수성/전결정성): 동일 입력 → 동일 출력, 5가지 값 중 하나', () => {
    const inputArb = fc.record({
      pathKind: fc.constantFrom('customer' as const, 'admin' as const),
      loadStatus: fc.constantFrom(
        'idle' as const,
        'loading' as const,
        'loaded' as const,
        'error' as const
      ),
      hasCustomization: fc.boolean(),
    });
    fc.assert(
      fc.property(inputArb, (input) => {
        const a = resolveRenderDecision(input);
        const b = resolveRenderDecision(input);
        expect(a).toBe(b);
        expect([
          'neutral',
          'custom',
          'default',
          'error-fallback',
          'bypass',
        ]).toContain(a);
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deriveHasCustomization Property-Based 테스트
// ─────────────────────────────────────────────────────────────────────────────
describe('deriveHasCustomization — Property-Based 테스트', () => {
  // DEFAULT_CUSTOMIZING_SET은 모든 nullable 필드가 null이므로 항상 false
  it('property: DEFAULT_CUSTOMIZING_SET → false', () => {
    fc.assert(
      fc.property(fc.constant(DEFAULT_CUSTOMIZING_SET), (set) => {
        expect(deriveHasCustomization(set)).toBe(false);
      })
    );
  });

  // 공백만 포함한 LocalizedString은 "의미 없음"으로 판정 → false
  it('property: 공백만 포함한 LocalizedString → false', () => {
    const whitespaceStringArb = fc.stringMatching(/^\s+$/);
    const whitespaceLocalizedArb = fc.record({
      ko: whitespaceStringArb,
      en: whitespaceStringArb,
    });

    fc.assert(
      fc.property(whitespaceLocalizedArb, (localizedTitle) => {
        const set: CustomizingSet = {
          ...DEFAULT_CUSTOMIZING_SET,
          welcome: {
            ...DEFAULT_CUSTOMIZING_SET.welcome,
            title: localizedTitle,
          },
        };
        expect(deriveHasCustomization(set)).toBe(false);
      })
    );
  });

  // 의미 있는 값(trim 후 길이 > 0)이 포함되면 true
  it('property: 의미 있는 값 포함 → true', () => {
    const nonEmptyStringArb = fc
      .string({ minLength: 1 })
      .filter((s) => s.trim().length > 0);
    const nonEmptyLocalizedArb = fc.record({
      ko: nonEmptyStringArb,
      en: nonEmptyStringArb,
    });

    fc.assert(
      fc.property(nonEmptyLocalizedArb, (title) => {
        const set: CustomizingSet = {
          ...DEFAULT_CUSTOMIZING_SET,
          welcome: {
            ...DEFAULT_CUSTOMIZING_SET.welcome,
            title,
          },
        };
        expect(deriveHasCustomization(set)).toBe(true);
      })
    );
  });
});
