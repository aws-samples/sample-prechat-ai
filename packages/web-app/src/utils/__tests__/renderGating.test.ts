/**
 * renderGating.ts 단위 테스트
 *
 * 테스트 시나리오:
 * 1. resolveRenderDecision — pathKind × loadStatus × hasCustomization 16가지 조합 테이블 드리븐 테스트
 * 2. deriveHasCustomization — 엣지 케이스 단위 테스트
 *    - null 입력 → false
 *    - DEFAULT_CUSTOMIZING_SET → false
 *    - 모든 필드 null → false
 *    - LocalizedString에 공백만 포함 → false
 *    - 정상 값 포함 → true (header, welcome, background, legal 각 섹션)
 *
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from 'vitest';
import {
  resolveRenderDecision,
  deriveHasCustomization,
  type RenderInput,
  type RenderDecision,
} from '../renderGating';
import {
  DEFAULT_CUSTOMIZING_SET,
  type CustomizingSet,
} from '../../types/customization';

// ─────────────────────────────────────────────────────────────────────────────
// resolveRenderDecision — 16가지 조합 테이블 드리븐 테스트
// pathKind(2) × loadStatus(4) × hasCustomization(2) = 16
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveRenderDecision — 16가지 조합 테이블 드리븐 테스트', () => {
  const testCases: Array<{
    input: RenderInput;
    expected: RenderDecision;
    description: string;
  }> = [
    // ── admin 경로: loadStatus/hasCustomization 무관하게 항상 bypass ──
    {
      input: { pathKind: 'admin', loadStatus: 'idle', hasCustomization: false },
      expected: 'bypass',
      description: 'admin + idle + false → bypass',
    },
    {
      input: { pathKind: 'admin', loadStatus: 'idle', hasCustomization: true },
      expected: 'bypass',
      description: 'admin + idle + true → bypass',
    },
    {
      input: {
        pathKind: 'admin',
        loadStatus: 'loading',
        hasCustomization: false,
      },
      expected: 'bypass',
      description: 'admin + loading + false → bypass',
    },
    {
      input: {
        pathKind: 'admin',
        loadStatus: 'loading',
        hasCustomization: true,
      },
      expected: 'bypass',
      description: 'admin + loading + true → bypass',
    },
    {
      input: {
        pathKind: 'admin',
        loadStatus: 'loaded',
        hasCustomization: false,
      },
      expected: 'bypass',
      description: 'admin + loaded + false → bypass',
    },
    {
      input: {
        pathKind: 'admin',
        loadStatus: 'loaded',
        hasCustomization: true,
      },
      expected: 'bypass',
      description: 'admin + loaded + true → bypass',
    },
    {
      input: {
        pathKind: 'admin',
        loadStatus: 'error',
        hasCustomization: false,
      },
      expected: 'bypass',
      description: 'admin + error + false → bypass',
    },
    {
      input: { pathKind: 'admin', loadStatus: 'error', hasCustomization: true },
      expected: 'bypass',
      description: 'admin + error + true → bypass',
    },

    // ── customer + idle/loading: hasCustomization 무관하게 항상 neutral ──
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'idle',
        hasCustomization: false,
      },
      expected: 'neutral',
      description: 'customer + idle + false → neutral',
    },
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'idle',
        hasCustomization: true,
      },
      expected: 'neutral',
      description: 'customer + idle + true → neutral',
    },
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'loading',
        hasCustomization: false,
      },
      expected: 'neutral',
      description: 'customer + loading + false → neutral',
    },
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'loading',
        hasCustomization: true,
      },
      expected: 'neutral',
      description: 'customer + loading + true → neutral',
    },

    // ── customer + loaded: hasCustomization에 따라 custom/default 분기 ──
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'loaded',
        hasCustomization: true,
      },
      expected: 'custom',
      description: 'customer + loaded + true → custom',
    },
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'loaded',
        hasCustomization: false,
      },
      expected: 'default',
      description: 'customer + loaded + false → default',
    },

    // ── customer + error: hasCustomization 무관하게 항상 error-fallback ──
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'error',
        hasCustomization: false,
      },
      expected: 'error-fallback',
      description: 'customer + error + false → error-fallback',
    },
    {
      input: {
        pathKind: 'customer',
        loadStatus: 'error',
        hasCustomization: true,
      },
      expected: 'error-fallback',
      description: 'customer + error + true → error-fallback',
    },
  ];

  testCases.forEach(({ input, expected, description }) => {
    it(description, () => {
      expect(resolveRenderDecision(input)).toBe(expected);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deriveHasCustomization — 엣지 케이스 단위 테스트
// ─────────────────────────────────────────────────────────────────────────────
describe('deriveHasCustomization', () => {
  it('null 입력 → false', () => {
    expect(deriveHasCustomization(null)).toBe(false);
  });

  it('DEFAULT_CUSTOMIZING_SET → false', () => {
    expect(deriveHasCustomization(DEFAULT_CUSTOMIZING_SET)).toBe(false);
  });

  it('모든 필드 null → false', () => {
    const allNull: CustomizingSet = {
      header: {
        logoUrl: null,
        logoLink: null,
        label: null,
        labelLink: null,
      },
      welcome: {
        logoUrl: null,
        logoLink: null,
        title: null,
        subtitle: null,
      },
      background: {
        startColor: null,
        endColor: null,
      },
      legal: {
        privacyTermUrl: null,
        serviceTermUrl: null,
        supportChannel: null,
      },
      meta: {
        updatedAt: null,
        version: '1.0.0',
      },
    };
    expect(deriveHasCustomization(allNull)).toBe(false);
  });

  it('LocalizedString에 공백만 포함 → false', () => {
    const whitespaceOnly: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      welcome: {
        ...DEFAULT_CUSTOMIZING_SET.welcome,
        title: { ko: '   ', en: '   ' },
        subtitle: { ko: '\t', en: '\n' },
      },
      header: {
        ...DEFAULT_CUSTOMIZING_SET.header,
        label: { ko: ' ', en: ' ' },
      },
      legal: {
        ...DEFAULT_CUSTOMIZING_SET.legal,
        privacyTermUrl: { ko: '  ', en: '  ' },
        serviceTermUrl: { ko: '', en: '' },
      },
    };
    expect(deriveHasCustomization(whitespaceOnly)).toBe(false);
  });

  it('header.logoUrl에 값 있음 → true', () => {
    const set: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      header: {
        ...DEFAULT_CUSTOMIZING_SET.header,
        logoUrl: 'https://example.com/logo.png',
      },
    };
    expect(deriveHasCustomization(set)).toBe(true);
  });

  it('welcome.title에 ko 값 있음 → true', () => {
    const set: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      welcome: {
        ...DEFAULT_CUSTOMIZING_SET.welcome,
        title: { ko: '환영합니다', en: '' },
      },
    };
    expect(deriveHasCustomization(set)).toBe(true);
  });

  it('background.startColor에 값 있음 → true', () => {
    const set: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      background: {
        startColor: '#FF5733',
        endColor: null,
      },
    };
    expect(deriveHasCustomization(set)).toBe(true);
  });

  it('legal.supportChannel에 값 있음 → true', () => {
    const set: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      legal: {
        ...DEFAULT_CUSTOMIZING_SET.legal,
        supportChannel: 'support@example.com',
      },
    };
    expect(deriveHasCustomization(set)).toBe(true);
  });
});
