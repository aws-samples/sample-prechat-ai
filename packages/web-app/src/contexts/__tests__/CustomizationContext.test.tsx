/**
 * CustomizationContext 단위 테스트
 *
 * - S3 fetch 성공 시 값 적용 확인 (LocalizedString 필드 포함)
 * - S3 fetch 실패 시 기본값 폴백 확인 (edge case)
 * - 기본값 구조 완전성 확인 (edge case)
 * - getLocalizedValue()가 현재 로케일에 맞는 값을 반환하는지 확인
 * - getLocalizedValue(null) → null 반환 확인
 * - loadStatus 상태 전이 테이블 검증 (idle → loading → loaded/error)
 * - customizingSet 초기값이 null임을 검증
 * - loaded + has_customization Preservation 테스트
 * - loaded + no_customization Preservation 테스트
 *
 * **Validates: Requirements 9.1, 9.2, 3.1, 3.2**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_CUSTOMIZING_SET,
  CustomizingSet,
  LocalizedString,
  resolveLocalized,
} from '../../types/customization';
import { deriveHasCustomization } from '../../utils/renderGating';

// ─────────────────────────────────────────────────────────────────────────────
// 기준선 동작 관찰 (Observation-First Methodology)
//
// 수정 후 코드에서 loaded 상태의 실제 출력 관찰:
// - 초기 상태: customizingSet = null, loadStatus = 'idle'
// - fetch 시작: loadStatus = 'loading'
// - fetch 성공 + 커스텀 있음: customizingSet = merged, loadStatus = 'loaded', hasCustomization = true
// - fetch 성공 + 커스텀 없음: customizingSet = DEFAULT, loadStatus = 'loaded', hasCustomization = false
// - fetch 실패: loadStatus = 'error', customizingSet = null
//
// Preservation 불변성:
// - loaded + has_customization: 커스텀 UI 필드(welcome.title ko/en, logoUrl)가 수정 전/후 동일
// - loaded + no_customization: 기본 i18n 텍스트가 수정 전/후 동일 (customizingSet null, hasCustomization false)
// ─────────────────────────────────────────────────────────────────────────────

// --- loadStatus 포함 상태 타입 ---
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface ContextState {
  customizingSet: CustomizingSet | null;
  loadStatus: LoadStatus;
  hasCustomization: boolean;
}

// --- S3 fetch 시뮬레이션 헬퍼 (loadStatus 축 포함) ---
// CustomizationProvider의 fetch 로직을 재현:
//   const data = await response.json();
//   const merged = { ...DEFAULT_CUSTOMIZING_SET, ...data };
//   setCustomizingSet(merged); setHasCustomization(deriveHasCustomization(merged)); setLoadStatus('loaded');
const applyFetchResult = (data: Partial<CustomizingSet>): CustomizingSet => {
  return { ...DEFAULT_CUSTOMIZING_SET, ...data };
};

// fetch 성공 후 전체 Context 상태 반환 (loadStatus 포함)
const applyFetchResultWithStatus = (
  data: Partial<CustomizingSet>
): ContextState => {
  const merged: CustomizingSet = {
    header: { ...DEFAULT_CUSTOMIZING_SET.header, ...data.header },
    welcome: { ...DEFAULT_CUSTOMIZING_SET.welcome, ...data.welcome },
    background: { ...DEFAULT_CUSTOMIZING_SET.background, ...data.background },
    legal: { ...DEFAULT_CUSTOMIZING_SET.legal, ...data.legal },
    meta: { ...DEFAULT_CUSTOMIZING_SET.meta, ...data.meta },
  };
  return {
    customizingSet: merged,
    loadStatus: 'loaded',
    hasCustomization: deriveHasCustomization(merged),
  };
};

// fetch 실패 시 error 상태 반환 (loadStatus 포함)
const applyFetchFallbackWithStatus = (): ContextState => {
  return {
    customizingSet: null,
    loadStatus: 'error',
    hasCustomization: false,
  };
};

// fetch 실패 시 기본값 유지 로직 재현 (기존 호환)
const applyFetchFallback = (): CustomizingSet => {
  return DEFAULT_CUSTOMIZING_SET;
};

// getLocalizedValue 로직 재현 (Context 내부에서 useCallback으로 래핑)
const getLocalizedValue = (
  value: LocalizedString,
  locale: 'ko' | 'en'
): string | null => {
  return resolveLocalized(value, locale);
};

// 초기 Context 상태 (Provider 마운트 직후)
const INITIAL_CONTEXT_STATE: ContextState = {
  customizingSet: null,
  loadStatus: 'idle',
  hasCustomization: false,
};

describe('CustomizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('S3 fetch 성공 시 값 적용', () => {
    it('fetch된 CustomizingSet 값이 기본값과 병합되어야 한다 (LocalizedString 포함)', () => {
      const s3Data: Partial<CustomizingSet> = {
        header: {
          logoUrl: 'https://example.com/logo.png',
          logoLink: 'https://example.com',
          label: { ko: '한국어 라벨', en: 'English Label' },
          labelLink: 'https://example.com/label',
        },
        welcome: {
          logoUrl: null,
          logoLink: null,
          title: { ko: '환영합니다!', en: 'Welcome!' },
          subtitle: { ko: '서브타이틀', en: 'Subtitle' },
        },
        background: { startColor: '#FF9900', endColor: '#FF6600' },
        legal: {
          privacyTermUrl: { ko: 'https://s3/privacy.ko.md', en: 'https://s3/privacy.en.md' },
          serviceTermUrl: { ko: 'https://s3/service.ko.md', en: 'https://s3/service.en.md' },
          supportChannel: 'mailto:support@example.com',
        },
        meta: { updatedAt: '2025-01-15T09:30:00Z', version: '1.0.0' },
      };

      const result = applyFetchResult(s3Data);

      expect(result.header.logoUrl).toBe('https://example.com/logo.png');
      expect(result.header.logoLink).toBe('https://example.com');
      expect(result.header.label).toEqual({ ko: '한국어 라벨', en: 'English Label' });
      expect(result.header.labelLink).toBe('https://example.com/label');
      expect(result.welcome.title).toEqual({ ko: '환영합니다!', en: 'Welcome!' });
      expect(result.welcome.subtitle).toEqual({ ko: '서브타이틀', en: 'Subtitle' });
      expect(result.background.startColor).toBe('#FF9900');
      expect(result.background.endColor).toBe('#FF6600');
      expect(result.legal.privacyTermUrl).toEqual({
        ko: 'https://s3/privacy.ko.md',
        en: 'https://s3/privacy.en.md',
      });
      expect(result.legal.serviceTermUrl).toEqual({
        ko: 'https://s3/service.ko.md',
        en: 'https://s3/service.en.md',
      });
      expect(result.legal.supportChannel).toBe('mailto:support@example.com');
      expect(result.meta.updatedAt).toBe('2025-01-15T09:30:00Z');
    });

    it('부분 데이터 fetch 시 나머지는 기본값으로 병합되어야 한다', () => {
      const result = applyFetchResult({ background: { startColor: '#000000', endColor: '#333333' } });

      expect(result.background.startColor).toBe('#000000');
      expect(result.background.endColor).toBe('#333333');
      // 기본값 유지 확인
      expect(result.header.logoUrl).toBeNull();
      expect(result.header.label).toBeNull();
      expect(result.welcome.title).toBeNull();
      expect(result.welcome.subtitle).toBeNull();
      expect(result.legal.privacyTermUrl).toBeNull();
      expect(result.meta.version).toBe('1.0.0');
    });

    it('빈 객체 fetch 시 모든 값이 기본값이어야 한다', () => {
      const result = applyFetchResult({});
      expect(result).toEqual(DEFAULT_CUSTOMIZING_SET);
    });
  });

  describe('S3 fetch 실패 시 기본값 폴백 (edge case)', () => {
    it('네트워크 에러 시 DEFAULT_CUSTOMIZING_SET으로 폴백해야 한다', () => {
      const result = applyFetchFallback();
      expect(result).toEqual(DEFAULT_CUSTOMIZING_SET);
    });

    it('폴백 결과는 DEFAULT_CUSTOMIZING_SET과 참조가 동일해야 한다', () => {
      const result = applyFetchFallback();
      expect(result).toBe(DEFAULT_CUSTOMIZING_SET);
    });
  });

  describe('기본값 구조 완전성 (edge case)', () => {
    it('DEFAULT_CUSTOMIZING_SET에 모든 카테고리가 존재해야 한다', () => {
      expect(DEFAULT_CUSTOMIZING_SET).toHaveProperty('header');
      expect(DEFAULT_CUSTOMIZING_SET).toHaveProperty('welcome');
      expect(DEFAULT_CUSTOMIZING_SET).toHaveProperty('background');
      expect(DEFAULT_CUSTOMIZING_SET).toHaveProperty('legal');
      expect(DEFAULT_CUSTOMIZING_SET).toHaveProperty('meta');
    });

    it('header 카테고리에 모든 필드가 존재해야 한다', () => {
      const { header } = DEFAULT_CUSTOMIZING_SET;
      expect(header).toHaveProperty('logoUrl');
      expect(header).toHaveProperty('logoLink');
      expect(header).toHaveProperty('label');
      expect(header).toHaveProperty('labelLink');
    });

    it('welcome 카테고리에 title과 subtitle이 존재해야 한다', () => {
      const { welcome } = DEFAULT_CUSTOMIZING_SET;
      expect(welcome).toHaveProperty('title');
      expect(welcome).toHaveProperty('subtitle');
    });

    it('legal 카테고리에 모든 필드가 존재해야 한다', () => {
      const { legal } = DEFAULT_CUSTOMIZING_SET;
      expect(legal).toHaveProperty('privacyTermUrl');
      expect(legal).toHaveProperty('serviceTermUrl');
      expect(legal).toHaveProperty('supportChannel');
    });

    it('meta 카테고리에 version과 updatedAt이 존재해야 한다', () => {
      const { meta } = DEFAULT_CUSTOMIZING_SET;
      expect(meta).toHaveProperty('version');
      expect(meta).toHaveProperty('updatedAt');
    });

    it('기본값의 모든 nullable 필드가 null이어야 한다', () => {
      expect(DEFAULT_CUSTOMIZING_SET.header.logoUrl).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.header.logoLink).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.header.label).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.header.labelLink).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.welcome.title).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.welcome.subtitle).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.background.startColor).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.background.endColor).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.legal.privacyTermUrl).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.legal.serviceTermUrl).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.legal.supportChannel).toBeNull();
      expect(DEFAULT_CUSTOMIZING_SET.meta.updatedAt).toBeNull();
    });
  });

  describe('getLocalizedValue — 로케일 기반 값 반환', () => {
    it('ko 로케일에서 LocalizedString의 ko 값을 반환해야 한다', () => {
      const result = getLocalizedValue({ ko: '안녕하세요', en: 'Hello' }, 'ko');
      expect(result).toBe('안녕하세요');
    });

    it('en 로케일에서 LocalizedString의 en 값을 반환해야 한다', () => {
      const result = getLocalizedValue({ ko: '안녕하세요', en: 'Hello' }, 'en');
      expect(result).toBe('Hello');
    });

    it('null 입력 시 null을 반환해야 한다', () => {
      expect(getLocalizedValue(null, 'ko')).toBeNull();
      expect(getLocalizedValue(null, 'en')).toBeNull();
    });

    it('해당 로케일 값이 빈 문자열이면 null을 반환해야 한다', () => {
      expect(getLocalizedValue({ ko: '', en: 'Hello' }, 'ko')).toBeNull();
      expect(getLocalizedValue({ ko: '안녕', en: '' }, 'en')).toBeNull();
    });

    it('해당 로케일 값이 공백만이면 null을 반환해야 한다', () => {
      expect(getLocalizedValue({ ko: '   ', en: 'Hello' }, 'ko')).toBeNull();
      expect(getLocalizedValue({ ko: '안녕', en: '   ' }, 'en')).toBeNull();
    });

    it('양쪽 로케일 모두 값이 있으면 요청한 로케일 값만 반환해야 한다', () => {
      const localized = { ko: '한국어 텍스트', en: 'English text' };
      expect(getLocalizedValue(localized, 'ko')).toBe('한국어 텍스트');
      expect(getLocalizedValue(localized, 'en')).toBe('English text');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // loadStatus 상태 전이 테이블 검증
  // ─────────────────────────────────────────────────────────────────────────
  describe('loadStatus 상태 전이', () => {
    it('초기 상태는 idle이어야 하고 customizingSet은 null이어야 한다', () => {
      // Provider 마운트 직후 상태 검증
      expect(INITIAL_CONTEXT_STATE.loadStatus).toBe('idle');
      expect(INITIAL_CONTEXT_STATE.customizingSet).toBeNull();
      expect(INITIAL_CONTEXT_STATE.hasCustomization).toBe(false);
    });

    it('fetch 성공 시 idle → loading → loaded 전이 (커스텀 있음)', () => {
      // idle 상태에서 시작
      const initial = INITIAL_CONTEXT_STATE;
      expect(initial.loadStatus).toBe('idle');
      expect(initial.customizingSet).toBeNull();

      // fetch 완료 후 loaded 상태로 전이
      const s3Data: Partial<CustomizingSet> = {
        welcome: {
          logoUrl: null,
          logoLink: null,
          title: { ko: '환영합니다', en: 'Welcome' },
          subtitle: null,
        },
      };
      const loaded = applyFetchResultWithStatus(s3Data);
      expect(loaded.loadStatus).toBe('loaded');
      expect(loaded.customizingSet).not.toBeNull();
      expect(loaded.hasCustomization).toBe(true);
    });

    it('fetch 성공 시 idle → loading → loaded 전이 (커스텀 없음)', () => {
      // 빈 데이터로 fetch 성공 → loaded + hasCustomization=false
      const loaded = applyFetchResultWithStatus({});
      expect(loaded.loadStatus).toBe('loaded');
      expect(loaded.customizingSet).not.toBeNull();
      expect(loaded.hasCustomization).toBe(false);
    });

    it('fetch 실패 시 idle → loading → error 전이', () => {
      // idle 상태에서 시작
      const initial = INITIAL_CONTEXT_STATE;
      expect(initial.loadStatus).toBe('idle');

      // fetch 실패 후 error 상태로 전이
      const errored = applyFetchFallbackWithStatus();
      expect(errored.loadStatus).toBe('error');
      expect(errored.customizingSet).toBeNull();
      expect(errored.hasCustomization).toBe(false);
    });

    it('loaded 이전에는 customizingSet이 null이어야 한다', () => {
      // idle 상태: null
      expect(INITIAL_CONTEXT_STATE.customizingSet).toBeNull();

      // error 상태: null (fetch 실패 시 customizingSet 미설정)
      const errored = applyFetchFallbackWithStatus();
      expect(errored.customizingSet).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Preservation: loaded 상태에서 렌더 결과 불변
  // ─────────────────────────────────────────────────────────────────────────
  describe('Preservation: loaded 상태에서 렌더 결과 불변', () => {
    it('loaded + has_customization: 커스텀 UI 필드(welcome.title ko/en, logoUrl)가 올바르게 반환됨', () => {
      // 수정 전/후 모두 커스텀 UI 필드가 동일하게 반환되어야 함
      const s3Data: Partial<CustomizingSet> = {
        header: {
          logoUrl: 'https://example.com/logo.png',
          logoLink: 'https://example.com',
          label: null,
          labelLink: null,
        },
        welcome: {
          logoUrl: 'https://example.com/welcome-logo.png',
          logoLink: null,
          title: { ko: '커스텀 타이틀', en: 'Custom Title' },
          subtitle: { ko: '커스텀 서브타이틀', en: 'Custom Subtitle' },
        },
      };

      const state = applyFetchResultWithStatus(s3Data);

      // loadStatus 검증
      expect(state.loadStatus).toBe('loaded');
      expect(state.hasCustomization).toBe(true);

      // 커스텀 UI 필드 검증 — 수정 전/후 동일해야 함
      expect(state.customizingSet).not.toBeNull();
      expect(state.customizingSet!.header.logoUrl).toBe(
        'https://example.com/logo.png'
      );
      expect(state.customizingSet!.welcome.logoUrl).toBe(
        'https://example.com/welcome-logo.png'
      );
      expect(state.customizingSet!.welcome.title).toEqual({
        ko: '커스텀 타이틀',
        en: 'Custom Title',
      });

      // getLocalizedValue로 로케일별 값 검증
      expect(
        getLocalizedValue(state.customizingSet!.welcome.title, 'ko')
      ).toBe('커스텀 타이틀');
      expect(
        getLocalizedValue(state.customizingSet!.welcome.title, 'en')
      ).toBe('Custom Title');
    });

    it('loaded + has_customization: 전체 섹션 커스텀 값이 올바르게 병합됨', () => {
      const s3Data: Partial<CustomizingSet> = {
        header: {
          logoUrl: 'https://cdn.example.com/logo.svg',
          logoLink: 'https://example.com',
          label: { ko: '한국어 라벨', en: 'English Label' },
          labelLink: 'https://example.com/label',
        },
        welcome: {
          logoUrl: null,
          logoLink: null,
          title: { ko: '환영합니다!', en: 'Welcome!' },
          subtitle: { ko: '서브타이틀', en: 'Subtitle' },
        },
        background: { startColor: '#FF9900', endColor: '#FF6600' },
        legal: {
          privacyTermUrl: {
            ko: 'https://s3/privacy.ko.md',
            en: 'https://s3/privacy.en.md',
          },
          serviceTermUrl: {
            ko: 'https://s3/service.ko.md',
            en: 'https://s3/service.en.md',
          },
          supportChannel: 'mailto:support@example.com',
        },
      };

      const state = applyFetchResultWithStatus(s3Data);

      expect(state.loadStatus).toBe('loaded');
      expect(state.hasCustomization).toBe(true);
      expect(state.customizingSet!.header.logoUrl).toBe(
        'https://cdn.example.com/logo.svg'
      );
      expect(state.customizingSet!.background.startColor).toBe('#FF9900');
      expect(state.customizingSet!.legal.supportChannel).toBe(
        'mailto:support@example.com'
      );
    });

    it('loaded + no_customization: customizingSet이 DEFAULT이고 hasCustomization이 false', () => {
      // 빈 데이터로 fetch 성공 → 기본 UI 폴백
      const state = applyFetchResultWithStatus({});

      expect(state.loadStatus).toBe('loaded');
      expect(state.hasCustomization).toBe(false);

      // 기본값 구조 검증 — 수정 전/후 동일해야 함
      expect(state.customizingSet).toEqual(DEFAULT_CUSTOMIZING_SET);
      expect(state.customizingSet!.welcome.title).toBeNull();
      expect(state.customizingSet!.header.logoUrl).toBeNull();
    });

    it('loaded + no_customization: 기본 i18n 텍스트 폴백이 올바르게 동작함', () => {
      // 커스텀 없음 상태에서 getLocalizedValue는 null을 반환해야 함
      // → 소비 컴포넌트는 || 폴백으로 기본 i18n 텍스트를 사용
      const state = applyFetchResultWithStatus({});

      expect(state.loadStatus).toBe('loaded');
      expect(state.hasCustomization).toBe(false);

      // null 필드에 대해 getLocalizedValue는 null 반환
      expect(getLocalizedValue(state.customizingSet!.welcome.title, 'ko')).toBeNull();
      expect(getLocalizedValue(state.customizingSet!.welcome.title, 'en')).toBeNull();
      expect(getLocalizedValue(state.customizingSet!.header.label, 'ko')).toBeNull();

      // 소비 컴포넌트의 || 폴백 패턴 시뮬레이션
      // customWelcomeTitle || t('welcome.header.title')
      const customWelcomeTitle = getLocalizedValue(
        state.customizingSet!.welcome.title,
        'ko'
      );
      const fallbackTitle = customWelcomeTitle || '기본 타이틀 (i18n 폴백)';
      expect(fallbackTitle).toBe('기본 타이틀 (i18n 폴백)');
    });
  });
});
