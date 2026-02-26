// UI Customization 타입 정의

/** 로케일별 문자열 타입 (ko/en) */
export type LocalizedString = { ko: string; en: string } | null;

/** 로케일에 맞는 값을 resolve하는 헬퍼 */
export const resolveLocalized = (
  value: LocalizedString,
  locale: 'ko' | 'en'
): string | null => {
  if (!value) return null;
  const resolved = value[locale];
  return resolved && resolved.trim().length > 0 ? resolved : null;
};

/** Customizing Set JSON 구조 */
export interface CustomizingSet {
  header: {
    logoUrl: string | null;
    logoLink: string | null;
    label: LocalizedString;
    labelLink: string | null;
  };
  welcome: {
    logoUrl: string | null;
    logoLink: string | null;
    title: LocalizedString;
    subtitle: LocalizedString;
  };
  background: {
    color: string | null;
  };
  legal: {
    privacyTermUrl: LocalizedString;
    serviceTermUrl: LocalizedString;
    supportChannel: string | null;
  };
  meta: {
    updatedAt: string | null;
    version: string;
  };
}

/** 기본 Customizing Set */
export const DEFAULT_CUSTOMIZING_SET: CustomizingSet = {
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
    color: null,
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
