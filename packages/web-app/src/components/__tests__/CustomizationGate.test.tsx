/**
 * CustomizationGate 렌더 결정 로직 단위 테스트
 *
 * node 환경에서 DOM 렌더링 대신 핵심 로직인 resolveRenderDecision을 직접 테스트합니다.
 * CustomizationGate는 resolveRenderDecision을 호출하여 렌더 결정을 내리므로,
 * 각 결정 케이스를 순수 함수 레벨에서 검증합니다.
 *
 * 테스트 시나리오:
 * 1. neutral 결정 — 고객 경로 + 로드 미완료 시 자식 미렌더
 * 2. custom/default/bypass/error-fallback 결정 — 자식 렌더
 * 3. pathKind 추론 로직 — pathname에서 admin/customer 판별
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */
import { describe, it, expect } from 'vitest';
import { resolveRenderDecision } from '../../utils/renderGating';

// CustomizationGate 내부의 pathKind 추론 로직을 재현한 헬퍼
function inferPathKind(pathname: string): 'admin' | 'customer' {
  return pathname.startsWith('/admin') ? 'admin' : 'customer';
}

describe('CustomizationGate 렌더 결정 로직', () => {
  describe('neutral 결정 — 기본 UI 노출 차단', () => {
    it('customer + loading → neutral (자식 미렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'loading',
        hasCustomization: false,
      });
      expect(decision).toBe('neutral');
      // neutral이면 CustomizationGate는 children을 렌더하지 않음
    });

    it('customer + idle → neutral (자식 미렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'idle',
        hasCustomization: false,
      });
      expect(decision).toBe('neutral');
    });

    it('customer + loading + hasCustomization=true → neutral (커스텀 여부 무관)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'loading',
        hasCustomization: true,
      });
      expect(decision).toBe('neutral');
    });

    it('customer + idle + hasCustomization=true → neutral (커스텀 여부 무관)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'idle',
        hasCustomization: true,
      });
      expect(decision).toBe('neutral');
    });
  });

  describe('자식 렌더 결정 — custom/default/bypass/error-fallback', () => {
    it('customer + loaded + hasCustomization=true → custom (자식 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'loaded',
        hasCustomization: true,
      });
      expect(decision).toBe('custom');
      // custom이면 CustomizationGate는 children을 렌더함
    });

    it('customer + loaded + hasCustomization=false → default (자식 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'loaded',
        hasCustomization: false,
      });
      expect(decision).toBe('default');
      // default이면 CustomizationGate는 children을 렌더함
    });

    it('admin + loading → bypass (자식 즉시 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'admin',
        loadStatus: 'loading',
        hasCustomization: false,
      });
      expect(decision).toBe('bypass');
      // bypass이면 CustomizationGate는 children을 즉시 렌더함
    });

    it('admin + idle → bypass (자식 즉시 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'admin',
        loadStatus: 'idle',
        hasCustomization: false,
      });
      expect(decision).toBe('bypass');
    });

    it('admin + loaded → bypass (자식 즉시 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'admin',
        loadStatus: 'loaded',
        hasCustomization: true,
      });
      expect(decision).toBe('bypass');
    });

    it('customer + error → error-fallback (자식 렌더, 안전 폴백)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'error',
        hasCustomization: false,
      });
      expect(decision).toBe('error-fallback');
      // error-fallback이면 CustomizationGate는 children을 렌더함 (안전 폴백)
    });

    it('customer + error + hasCustomization=true → error-fallback (자식 렌더)', () => {
      const decision = resolveRenderDecision({
        pathKind: 'customer',
        loadStatus: 'error',
        hasCustomization: true,
      });
      expect(decision).toBe('error-fallback');
    });
  });

  describe('렌더 여부 분류 — neutral vs 렌더', () => {
    it('neutral 결정은 자식을 렌더하지 않는다', () => {
      const neutralDecisions = [
        resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'idle',
          hasCustomization: false,
        }),
        resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'loading',
          hasCustomization: false,
        }),
      ];
      neutralDecisions.forEach((d) => expect(d).toBe('neutral'));
    });

    it('non-neutral 결정은 자식을 렌더한다', () => {
      const renderDecisions = [
        resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'loaded',
          hasCustomization: true,
        }),
        resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'loaded',
          hasCustomization: false,
        }),
        resolveRenderDecision({
          pathKind: 'admin',
          loadStatus: 'loading',
          hasCustomization: false,
        }),
        resolveRenderDecision({
          pathKind: 'customer',
          loadStatus: 'error',
          hasCustomization: false,
        }),
      ];
      renderDecisions.forEach((d) => expect(d).not.toBe('neutral'));
    });
  });
});

describe('pathKind 추론 — pathname에서 admin/customer 판별', () => {
  it('/admin → admin', () => {
    expect(inferPathKind('/admin')).toBe('admin');
  });

  it('/admin/sessions → admin', () => {
    expect(inferPathKind('/admin/sessions')).toBe('admin');
  });

  it('/admin/customizing → admin', () => {
    expect(inferPathKind('/admin/customizing')).toBe('admin');
  });

  it('/ → customer', () => {
    expect(inferPathKind('/')).toBe('customer');
  });

  it('/customer/123 → customer', () => {
    expect(inferPathKind('/customer/123')).toBe('customer');
  });

  it('/login → customer', () => {
    expect(inferPathKind('/login')).toBe('customer');
  });

  it('/campaign/abc → customer', () => {
    expect(inferPathKind('/campaign/abc')).toBe('customer');
  });

  it('빈 문자열 → customer', () => {
    expect(inferPathKind('')).toBe('customer');
  });
});
