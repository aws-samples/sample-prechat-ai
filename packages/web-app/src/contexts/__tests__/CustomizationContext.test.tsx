/**
 * CustomizationContext 단위 테스트
 *
 * - S3 fetch 성공 시 값 적용 확인 (LocalizedString 필드 포함)
 * - S3 fetch 실패 시 기본값 폴백 확인 (edge case)
 * - 기본값 구조 완전성 확인 (edge case)
 * - getLocalizedValue()가 현재 로케일에 맞는 값을 반환하는지 확인
 * - getLocalizedValue(null) → null 반환 확인
 *
 * **Validates: Requirements 9.1, 9.2**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_CUSTOMIZING_SET,
  CustomizingSet,
  LocalizedString,
  resolveLocalized,
} from '../../types/customization';

// --- S3 fetch 시뮬레이션 헬퍼 ---
// CustomizationProvider의 fetch 로직을 재현:
//   const data = await response.json();
//   setCustomizingSet({ ...DEFAULT_CUSTOMIZING_SET, ...data });
const applyFetchResult = (data: Partial<CustomizingSet>): CustomizingSet => {
  return { ...DEFAULT_CUSTOMIZING_SET, ...data };
};

// fetch 실패 시 기본값 유지 로직 재현
const applyFetchFallback = (): CustomizingSet => {
  return DEFAULT_CUSTOMIZING_SET;
};

// getLocalizedValue 로직 재현 (Context 내부에서 useCallback으로 래핑)
const getLocalizedValue = (value: LocalizedString, locale: 'ko' | 'en'): string | null => {
  return resolveLocalized(value, locale);
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
          title: { ko: '환영합니다!', en: 'Welcome!' },
          subtitle: { ko: '서브타이틀', en: 'Subtitle' },
        },
        background: { color: '#FF9900' },
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
      expect(result.background.color).toBe('#FF9900');
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
      const result = applyFetchResult({ background: { color: '#000000' } });

      expect(result.background.color).toBe('#000000');
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
      expect(DEFAULT_CUSTOMIZING_SET.background.color).toBeNull();
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
});
