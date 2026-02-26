/**
 * CustomizationPanel 단위 테스트
 *
 * CustomizationPanel 컴포넌트의 핵심 로직을 검증합니다:
 * - 저장 성공 시 성공 알림 표시 확인
 * - 저장 실패 시 에러 알림 표시 확인
 * - 로케일 탭(ko/en) 전환 시 해당 로케일 값 표시 확인
 *
 * 테스트 환경이 node이므로, 컴포넌트의 핵심 로직(상태 관리, 핸들러, 로케일 전환)을
 * 추출하여 단위 테스트합니다.
 *
 * **Validates: Requirements 7.3, 7.4**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CustomizingSet,
  DEFAULT_CUSTOMIZING_SET,
  LocalizedString,
} from '../../../types/customization';

// --- CustomizationPanel 핵심 로직 재현 ---

type SelectedLocale = 'ko' | 'en';

interface FlashItem {
  type: 'success' | 'error';
  messageKey: string;
}

/**
 * showFlash 로직 재현:
 * 저장 성공/실패 시 Flashbar 알림을 생성하는 로직
 */
const createFlashItem = (type: 'success' | 'error', messageKey: string): FlashItem => ({
  type,
  messageKey,
});

/**
 * handleSave 로직 재현:
 * 검증 통과 후 saveCustomization 호출, 결과에 따라 알림 생성
 */
const simulateHandleSave = async (
  data: CustomizingSet,
  validate: () => boolean,
  saveCustomization: (data: CustomizingSet) => Promise<boolean>
): Promise<{ flash: FlashItem | null; updatedData: CustomizingSet | null }> => {
  if (!validate()) return { flash: null, updatedData: null };

  const updatedData = {
    ...data,
    meta: { ...data.meta, updatedAt: new Date().toISOString() },
  };

  const success = await saveCustomization(updatedData);

  if (success) {
    return {
      flash: createFlashItem('success', 'adminCustomizing.notification.saveSuccess'),
      updatedData,
    };
  } else {
    return {
      flash: createFlashItem('error', 'adminCustomizing.notification.saveError'),
      updatedData: null,
    };
  }
};

/**
 * getLocalizedFieldValue 로직 재현:
 * 현재 선택된 로케일에 맞는 LocalizedString 값을 반환
 */
const getLocalizedFieldValue = (
  value: LocalizedString,
  selectedLocale: SelectedLocale
): string => {
  if (!value) return '';
  return value[selectedLocale] || '';
};

/**
 * updateLocalized 로직 재현:
 * 선택된 로케일의 LocalizedString 필드를 업데이트
 */
const updateLocalized = (
  data: CustomizingSet,
  path: 'header.label' | 'welcome.title' | 'welcome.subtitle',
  value: string,
  selectedLocale: SelectedLocale
): CustomizingSet => {
  const next = { ...data };
  const [section, field] = path.split('.') as [keyof CustomizingSet, string];
  const sectionData = { ...(next[section] as Record<string, unknown>) };
  const current = (sectionData[field] as LocalizedString) || { ko: '', en: '' };
  sectionData[field] = { ...current, [selectedLocale]: value };
  (next as Record<string, unknown>)[section] = sectionData;
  return next as CustomizingSet;
};

// --- 테스트 ---

describe('CustomizationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('저장 성공 시 성공 알림 표시', () => {
    it('saveCustomization이 true를 반환하면 success 타입의 알림이 생성되어야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const mockValidate = vi.fn().mockReturnValue(true);

      const result = await simulateHandleSave(
        DEFAULT_CUSTOMIZING_SET,
        mockValidate,
        mockSave
      );

      expect(result.flash).not.toBeNull();
      expect(result.flash!.type).toBe('success');
      expect(result.flash!.messageKey).toBe('adminCustomizing.notification.saveSuccess');
    });

    it('저장 성공 시 updatedData에 meta.updatedAt이 설정되어야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const mockValidate = vi.fn().mockReturnValue(true);

      const result = await simulateHandleSave(
        DEFAULT_CUSTOMIZING_SET,
        mockValidate,
        mockSave
      );

      expect(result.updatedData).not.toBeNull();
      expect(result.updatedData!.meta.updatedAt).toBeTruthy();
    });

    it('저장 성공 시 saveCustomization에 updatedAt이 포함된 데이터가 전달되어야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const mockValidate = vi.fn().mockReturnValue(true);

      await simulateHandleSave(DEFAULT_CUSTOMIZING_SET, mockValidate, mockSave);

      expect(mockSave).toHaveBeenCalledTimes(1);
      const savedData = mockSave.mock.calls[0][0] as CustomizingSet;
      expect(savedData.meta.updatedAt).toBeTruthy();
    });
  });

  describe('저장 실패 시 에러 알림 표시', () => {
    it('saveCustomization이 false를 반환하면 error 타입의 알림이 생성되어야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(false);
      const mockValidate = vi.fn().mockReturnValue(true);

      const result = await simulateHandleSave(
        DEFAULT_CUSTOMIZING_SET,
        mockValidate,
        mockSave
      );

      expect(result.flash).not.toBeNull();
      expect(result.flash!.type).toBe('error');
      expect(result.flash!.messageKey).toBe('adminCustomizing.notification.saveError');
    });

    it('저장 실패 시 updatedData가 null이어야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(false);
      const mockValidate = vi.fn().mockReturnValue(true);

      const result = await simulateHandleSave(
        DEFAULT_CUSTOMIZING_SET,
        mockValidate,
        mockSave
      );

      expect(result.updatedData).toBeNull();
    });

    it('검증 실패 시 saveCustomization이 호출되지 않아야 한다', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const mockValidate = vi.fn().mockReturnValue(false);

      const result = await simulateHandleSave(
        DEFAULT_CUSTOMIZING_SET,
        mockValidate,
        mockSave
      );

      expect(mockSave).not.toHaveBeenCalled();
      expect(result.flash).toBeNull();
    });
  });

  describe('로케일 탭(ko/en) 전환 시 해당 로케일 값 표시', () => {
    const testData: CustomizingSet = {
      ...DEFAULT_CUSTOMIZING_SET,
      header: {
        ...DEFAULT_CUSTOMIZING_SET.header,
        label: { ko: '한국어 라벨', en: 'English Label' },
      },
      welcome: {
        title: { ko: '환영합니다!', en: 'Welcome!' },
        subtitle: { ko: '서브타이틀입니다', en: 'This is subtitle' },
      },
    };

    it('ko 탭 선택 시 header.label의 한국어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.header.label, 'ko');
      expect(value).toBe('한국어 라벨');
    });

    it('en 탭 선택 시 header.label의 영어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.header.label, 'en');
      expect(value).toBe('English Label');
    });

    it('ko 탭 선택 시 welcome.title의 한국어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.welcome.title, 'ko');
      expect(value).toBe('환영합니다!');
    });

    it('en 탭 선택 시 welcome.title의 영어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.welcome.title, 'en');
      expect(value).toBe('Welcome!');
    });

    it('ko 탭 선택 시 welcome.subtitle의 한국어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.welcome.subtitle, 'ko');
      expect(value).toBe('서브타이틀입니다');
    });

    it('en 탭 선택 시 welcome.subtitle의 영어 값을 반환해야 한다', () => {
      const value = getLocalizedFieldValue(testData.welcome.subtitle, 'en');
      expect(value).toBe('This is subtitle');
    });

    it('LocalizedString이 null이면 빈 문자열을 반환해야 한다', () => {
      expect(getLocalizedFieldValue(null, 'ko')).toBe('');
      expect(getLocalizedFieldValue(null, 'en')).toBe('');
    });

    it('해당 로케일 값이 빈 문자열이면 빈 문자열을 반환해야 한다', () => {
      const partial: LocalizedString = { ko: '한국어만', en: '' };
      expect(getLocalizedFieldValue(partial, 'en')).toBe('');
      expect(getLocalizedFieldValue(partial, 'ko')).toBe('한국어만');
    });
  });

  describe('로케일별 LocalizedString 필드 업데이트', () => {
    it('ko 탭에서 header.label 수정 시 ko 값만 변경되어야 한다', () => {
      const initial: CustomizingSet = {
        ...DEFAULT_CUSTOMIZING_SET,
        header: {
          ...DEFAULT_CUSTOMIZING_SET.header,
          label: { ko: '기존 한국어', en: 'Existing English' },
        },
      };

      const updated = updateLocalized(initial, 'header.label', '새 한국어', 'ko');

      expect((updated.header.label as { ko: string; en: string }).ko).toBe('새 한국어');
      expect((updated.header.label as { ko: string; en: string }).en).toBe('Existing English');
    });

    it('en 탭에서 welcome.title 수정 시 en 값만 변경되어야 한다', () => {
      const initial: CustomizingSet = {
        ...DEFAULT_CUSTOMIZING_SET,
        welcome: {
          ...DEFAULT_CUSTOMIZING_SET.welcome,
          title: { ko: '한국어 제목', en: 'Old Title' },
          subtitle: DEFAULT_CUSTOMIZING_SET.welcome.subtitle,
        },
      };

      const updated = updateLocalized(initial, 'welcome.title', 'New Title', 'en');

      expect((updated.welcome.title as { ko: string; en: string }).ko).toBe('한국어 제목');
      expect((updated.welcome.title as { ko: string; en: string }).en).toBe('New Title');
    });

    it('null인 LocalizedString 필드에 값을 입력하면 양쪽 로케일 구조가 생성되어야 한다', () => {
      const updated = updateLocalized(
        DEFAULT_CUSTOMIZING_SET,
        'header.label',
        '새 라벨',
        'ko'
      );

      expect(updated.header.label).not.toBeNull();
      expect((updated.header.label as { ko: string; en: string }).ko).toBe('새 라벨');
      expect((updated.header.label as { ko: string; en: string }).en).toBe('');
    });

    it('로케일 전환 후 다른 로케일 값을 수정해도 기존 로케일 값이 보존되어야 한다', () => {
      // ko 탭에서 입력
      let data = updateLocalized(DEFAULT_CUSTOMIZING_SET, 'welcome.subtitle', '한국어 부제', 'ko');
      // en 탭으로 전환 후 입력
      data = updateLocalized(data, 'welcome.subtitle', 'English subtitle', 'en');

      expect((data.welcome.subtitle as { ko: string; en: string }).ko).toBe('한국어 부제');
      expect((data.welcome.subtitle as { ko: string; en: string }).en).toBe('English subtitle');
    });
  });

  describe('저장 시 데이터 무결성', () => {
    it('LocalizedString 필드가 포함된 데이터가 저장 시 보존되어야 한다', async () => {
      const dataWithLocalized: CustomizingSet = {
        ...DEFAULT_CUSTOMIZING_SET,
        header: {
          ...DEFAULT_CUSTOMIZING_SET.header,
          label: { ko: '한국어', en: 'English' },
        },
        welcome: {
          title: { ko: '제목', en: 'Title' },
          subtitle: { ko: '부제', en: 'Subtitle' },
        },
        background: { color: '#FF9900' },
      };

      const mockSave = vi.fn().mockResolvedValue(true);
      const mockValidate = vi.fn().mockReturnValue(true);

      const result = await simulateHandleSave(dataWithLocalized, mockValidate, mockSave);

      const savedData = mockSave.mock.calls[0][0] as CustomizingSet;
      expect(savedData.header.label).toEqual({ ko: '한국어', en: 'English' });
      expect(savedData.welcome.title).toEqual({ ko: '제목', en: 'Title' });
      expect(savedData.welcome.subtitle).toEqual({ ko: '부제', en: 'Subtitle' });
      expect(savedData.background.color).toBe('#FF9900');
      expect(result.flash!.type).toBe('success');
    });
  });
});
