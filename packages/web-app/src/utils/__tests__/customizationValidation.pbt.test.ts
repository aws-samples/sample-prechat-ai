import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateImageExtension,
  validateMarkdownExtension,
} from '../customizationValidation';

/**
 * Feature: ui-customization
 * Property 1: 파일 확장자 검증 (이미지 + 마크다운)
 *
 * 허용된 이미지 확장자(.png, .jpg, .jpeg, .svg, .webp)를 가진 파일만
 * validateImageExtension을 통과하고, .md 확장자를 가진 파일만
 * validateMarkdownExtension을 통과해야 한다.
 *
 * **Validates: Requirements 2.2, 6.4**
 */
describe('Property 1: 파일 확장자 검증 (이미지 + 마크다운)', () => {
  it('임의의 basename + 알려진 확장자 조합에서 허용된 확장자만 검증을 통과해야 한다', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(
            '.png',
            '.jpg',
            '.jpeg',
            '.svg',
            '.webp',
            '.md',
            '.txt',
            '.gif',
            '.bmp',
            '.pdf',
            '.doc'
          )
        ),
        ([basename, ext]) => {
          const filename = `${basename}${ext}`;
          const isAllowedImage = ['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(
            ext.toLowerCase()
          );
          const isAllowedMarkdown = ext.toLowerCase() === '.md';

          expect(validateImageExtension(filename)).toBe(isAllowedImage);
          expect(validateMarkdownExtension(filename)).toBe(isAllowedMarkdown);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { validateFileSize } from '../customizationValidation';

/**
 * Feature: ui-customization
 * Property 2: 파일 크기 검증 (2MB 로고 / 1MB 마크다운)
 *
 * 임의의 파일 크기(0~5MB)에 대해, 로고 이미지는 2MB 이하,
 * 마크다운 문서는 1MB 이하인 파일만 검증을 통과해야 한다.
 * 0바이트 파일은 유효하지 않으므로 검증에 실패해야 한다.
 *
 * **Validates: Requirements 2.3, 6.5**
 */
describe('Property 2: 파일 크기 검증 (2MB 로고 / 1MB 마크다운)', () => {
  const LOGO_MAX = 2 * 1024 * 1024; // 2MB
  const MD_MAX = 1 * 1024 * 1024; // 1MB

  it('임의의 파일 크기(0~5MB)에서 제한값 이하이고 0보다 큰 파일만 검증을 통과해야 한다', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 * 1024 * 1024 }), // 0 ~ 5MB
        (sizeInBytes) => {
          const logoExpected = sizeInBytes > 0 && sizeInBytes <= LOGO_MAX;
          const mdExpected = sizeInBytes > 0 && sizeInBytes <= MD_MAX;

          expect(validateFileSize(sizeInBytes, LOGO_MAX)).toBe(logoExpected);
          expect(validateFileSize(sizeInBytes, MD_MAX)).toBe(mdExpected);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { validateHttpsUrl } from '../customizationValidation';

/**
 * Feature: ui-customization
 * Property 3: URL 검증 (https:// 필수)
 *
 * 임의의 문자열에 대해, `https://`로 시작하며 길이가 8자를 초과하는
 * 문자열만 URL 검증을 통과하고, 그 외 문자열(`http://`, 빈 문자열,
 * 프로토콜 없는 문자열 등)은 검증에 실패해야 한다.
 *
 * **Validates: Requirements 2.6, 3.4**
 */
describe('Property 3: URL 검증 (https:// 필수)', () => {
  it('임의의 문자열에서 https://로 시작하고 길이 > 8인 문자열만 검증을 통과해야 한다', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (urlStr) => {
          const isValid = urlStr.startsWith('https://') && urlStr.length > 8;
          expect(validateHttpsUrl(urlStr)).toBe(isValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { validateTextLength } from '../customizationValidation';

/**
 * Feature: ui-customization
 * Property 4: 텍스트 필드 길이 검증 (100자/500자)
 *
 * 임의의 문자열과 최대 길이 제한(100 또는 500)에 대해,
 * trim 후 길이가 0보다 크고 maxLength 이하인 문자열만 검증을 통과하고,
 * 공백만으로 구성되거나 maxLength를 초과하는 문자열은 검증에 실패해야 한다.
 *
 * **Validates: Requirements 3.2, 4.2, 4.4, 6.7**
 */
describe('Property 4: 텍스트 필드 길이 검증 (100자/500자)', () => {
  it('임의의 문자열에서 trim 후 비공백이고 maxLength 이하인 문자열만 검증을 통과해야 한다', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 600 }),
        fc.constantFrom(100, 500),
        (text, maxLength) => {
          const trimmed = text.trim();
          const isValid = trimmed.length > 0 && trimmed.length <= maxLength;
          expect(validateTextLength(text, maxLength)).toBe(isValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { validateHexColor } from '../customizationValidation';

/**
 * Feature: ui-customization
 * Property 5: HEX 색상 코드 검증
 *
 * 임의의 문자열에 대해, `^#[0-9A-Fa-f]{6}$` 패턴과 일치하는
 * 문자열만 색상 검증을 통과하고, 일치하지 않는 문자열은 검증에 실패해야 한다.
 *
 * **Validates: Requirements 5.1, 5.3**
 */
describe('Property 5: HEX 색상 코드 검증', () => {
  it('임의의 문자열에서 #RRGGBB 패턴과 일치하는 문자열만 검증을 통과해야 한다', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (colorStr) => {
          const isValid = /^#[0-9A-Fa-f]{6}$/.test(colorStr);
          expect(validateHexColor(colorStr)).toBe(isValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: ui-customization
 * Property 6: Customizing Set JSON 직렬화 라운드트립 (LocalizedString 포함)
 *
 * 임의의 유효한 CustomizingSet 객체(LocalizedString 필드 포함)에 대해,
 * JSON으로 직렬화한 후 역직렬화하면 원본 객체와 동일한 값이 반환되어야 한다.
 * 또한 역직렬화된 객체는 `header`, `welcome`, `background`, `legal`, `meta`
 * 카테고리 구조를 유지해야 한다.
 *
 * **Validates: Requirements 7.5**
 */
describe('Property 6: Customizing Set JSON 직렬화 라운드트립 (LocalizedString 포함)', () => {
  // LocalizedString arbitrary: { ko: string, en: string } | null
  const localizedStringArb = fc.option(
    fc.record({
      ko: fc.string({ minLength: 1, maxLength: 100 }),
      en: fc.string({ minLength: 1, maxLength: 100 }),
    }),
    { nil: null }
  );

  it('임의의 유효한 CustomizingSet을 JSON 직렬화 후 역직렬화하면 원본과 동일해야 한다', () => {
    fc.assert(
      fc.property(
        fc.record({
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
        }),
        (customizingSet) => {
          const serialized = JSON.stringify(customizingSet);
          const deserialized = JSON.parse(serialized);

          // 라운드트립 동등성 검증
          expect(deserialized).toEqual(customizingSet);

          // 카테고리 구조 유지 검증
          expect(deserialized).toHaveProperty('header');
          expect(deserialized).toHaveProperty('welcome');
          expect(deserialized).toHaveProperty('background');
          expect(deserialized).toHaveProperty('legal');
          expect(deserialized).toHaveProperty('meta');
        }
      ),
      { numRuns: 100 }
    );
  });
});


import { resolveLocalized } from '../../types/customization';
import type { LocalizedString } from '../../types/customization';

/**
 * Feature: ui-customization
 * Property 9: LocalizedString 로케일 resolve
 *
 * 임의의 `LocalizedString` 값과 로케일(`ko` 또는 `en`)에 대해,
 * `resolveLocalized(value, locale)`는 해당 로케일의 값을 반환해야 한다.
 * - `LocalizedString`이 `null`이면 `null`을 반환
 * - 해당 로케일 키가 빈 문자열이면 `null`을 반환
 * - 그 외에는 해당 로케일의 값을 반환
 *
 * **Validates: Requirements 4.5, 4.6, 4.7, 9.1**
 */
describe('Property 9: LocalizedString 로케일 resolve', () => {
  it('임의의 LocalizedString과 로케일에 대해 올바른 resolve 결과를 반환해야 한다', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({ ko: fc.string(), en: fc.string() }),
          { nil: null }
        ),
        fc.constantFrom('ko' as const, 'en' as const),
        (localizedStr: LocalizedString, locale: 'ko' | 'en') => {
          const result = resolveLocalized(localizedStr, locale);

          if (localizedStr === null) {
            // null 입력 → null 반환
            expect(result).toBeNull();
          } else if (localizedStr[locale].trim() === '') {
            // 빈 문자열 또는 공백만 있는 경우 → null 반환
            expect(result).toBeNull();
          } else {
            // 유효한 값 → 해당 로케일 값 반환
            expect(result).toBe(localizedStr[locale]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
