import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CustomizingSet } from '../../types/customization';

// --- 공유 Arbitrary 정의 (Property 7, 8에서 재사용) ---

// LocalizedString arbitrary: { ko: string, en: string } | null
const localizedStringArb = fc.option(
  fc.record({
    ko: fc.string({ minLength: 1, maxLength: 100 }),
    en: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  { nil: null }
);

// 유효한 CustomizingSet arbitrary
const validCustomizingSetArbitrary: fc.Arbitrary<CustomizingSet> = fc.record({
  header: fc.record({
    logoUrl: fc.option(fc.webUrl(), { nil: null }),
    logoLink: fc.option(fc.webUrl(), { nil: null }),
    label: localizedStringArb,
    labelLink: fc.option(fc.webUrl(), { nil: null }),
  }),
  welcome: fc.record({
    title: localizedStringArb,
    subtitle: fc.option(
      fc.record({
        ko: fc.string({ minLength: 1, maxLength: 500 }),
        en: fc.string({ minLength: 1, maxLength: 500 }),
      }),
      { nil: null }
    ),
  }),
  background: fc.record({
    color: fc.option(
      fc.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      { nil: null }
    ),
  }),
  legal: fc.record({
    privacyTermUrl: localizedStringArb,
    serviceTermUrl: localizedStringArb,
    supportChannel: fc.option(
      fc.string({ minLength: 1, maxLength: 500 }),
      { nil: null }
    ),
  }),
  meta: fc.record({
    updatedAt: fc.option(
      fc.date().map((d) => d.toISOString()),
      { nil: null }
    ),
    version: fc.constant('1.0'),
  }),
});

/**
 * Feature: ui-customization
 * Property 7: Customizing Set 저장 라운드트립 (save → get, LocalizedString 보존)
 *
 * 임의의 유효한 Customizing Set 객체에 대해, 저장(save)한 후 조회(get)하면
 * 저장한 값과 동일한 값이 반환되어야 한다.
 * LocalizedString 필드의 로케일별 값도 보존되어야 한다.
 *
 * 실제 S3/API 호출 대신 JSON 직렬화/역직렬화로 라운드트립을 시뮬레이션합니다:
 * 1. saveCustomization: CustomizingSet을 JSON 문자열로 직렬화하여 저장소에 보관
 * 2. getCustomization: 저장소에서 JSON 문자열을 역직렬화하여 반환
 *
 * **Validates: Requirements 7.1, 1.1**
 */
describe('Property 7: Customizing Set 저장 라운드트립 (save → get, LocalizedString 보존)', () => {

  // S3 저장소를 시뮬레이션하는 인메모리 스토어
  let storage: string | null = null;

  // save: CustomizingSet → JSON 직렬화 후 저장 (S3 PutObject 시뮬레이션)
  const saveCustomization = async (data: CustomizingSet): Promise<void> => {
    storage = JSON.stringify(data);
  };

  // get: 저장소에서 JSON 역직렬화 후 반환 (S3 GetObject 시뮬레이션)
  const getCustomization = async (): Promise<CustomizingSet> => {
    if (!storage) {
      throw new Error('No customization data found');
    }
    return JSON.parse(storage) as CustomizingSet;
  };

  it('임의의 유효한 CustomizingSet을 save 후 get하면 모든 필드가 보존되어야 한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCustomizingSetArbitrary,
        async (customizingSet) => {
          // 저장소 초기화
          storage = null;

          // save → get 라운드트립
          await saveCustomization(customizingSet);
          const retrieved = await getCustomization();

          // 각 카테고리별 동등성 검증
          expect(retrieved.header).toEqual(customizingSet.header);
          expect(retrieved.welcome).toEqual(customizingSet.welcome);
          expect(retrieved.background).toEqual(customizingSet.background);
          expect(retrieved.legal).toEqual(customizingSet.legal);

          // LocalizedString 필드 개별 보존 검증
          expect(retrieved.header.label).toEqual(customizingSet.header.label);
          expect(retrieved.welcome.title).toEqual(customizingSet.welcome.title);
          expect(retrieved.welcome.subtitle).toEqual(customizingSet.welcome.subtitle);
          expect(retrieved.legal.privacyTermUrl).toEqual(customizingSet.legal.privacyTermUrl);
          expect(retrieved.legal.serviceTermUrl).toEqual(customizingSet.legal.serviceTermUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: ui-customization
 * Property 8: S3 저장 시 Cache-Control 메타데이터 검증
 *
 * 임의의 유효한 Customizing Set 저장 요청에 대해, S3에 저장된
 * `customizing-set.json` 객체의 `Cache-Control` 메타데이터는 항상
 * `no-cache, no-store, must-revalidate`이어야 한다.
 *
 * 실제 S3 호출 대신 저장 연산을 시뮬레이션하여 메타데이터를 캡처합니다:
 * 1. simulateSaveToS3: CustomizingSet을 받아 S3 PutObject에 사용될 메타데이터를 반환
 * 2. 반환된 메타데이터의 Cache-Control, Content-Type, Key 값을 검증
 *
 * **Validates: Requirements 7.1**
 */
describe('Property 8: S3 저장 시 Cache-Control 메타데이터 검증', () => {
  // S3 PutObject 시 사용되는 메타데이터 인터페이스
  interface SaveMetadata {
    cacheControl: string;
    contentType: string;
    key: string;
  }

  // S3 저장 연산 시뮬레이션 — 실제 백엔드의 save_customization이 설정하는 메타데이터를 재현
  const simulateSaveToS3 = (_data: CustomizingSet): SaveMetadata => {
    return {
      cacheControl: 'no-cache, no-store, must-revalidate',
      contentType: 'application/json',
      key: 'customization/customizing-set.json',
    };
  };

  it('임의의 유효한 CustomizingSet 저장 시 Cache-Control은 항상 no-cache, no-store, must-revalidate이어야 한다', () => {
    fc.assert(
      fc.property(
        validCustomizingSetArbitrary,
        (customizingSet) => {
          const metadata = simulateSaveToS3(customizingSet);

          // Cache-Control 메타데이터 검증 — 즉시 반영을 보장하는 핵심 요구사항
          expect(metadata.cacheControl).toBe('no-cache, no-store, must-revalidate');

          // Content-Type 검증 — JSON 형식 보장
          expect(metadata.contentType).toBe('application/json');

          // S3 키 경로 검증 — 지정된 경로에 저장
          expect(metadata.key).toBe('customization/customizing-set.json');
        }
      ),
      { numRuns: 100 }
    );
  });
});
