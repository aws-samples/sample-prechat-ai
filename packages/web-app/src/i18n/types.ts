export interface TranslationEntry {
  key: string;
  korean: string;
  english: string;
  context?: string;
  variables?: string[];
}

export interface LocaleConfig {
  code: 'ko' | 'en';
  name: string;
  nativeName: string;
  direction: 'ltr';
  dateFormat: string;
  numberFormat: Intl.NumberFormatOptions;
}

export interface TranslationContext {
  currentLocale: string;
  availableLocales: LocaleConfig[];
  translations: Record<string, string>;
  isLoading: boolean;
  error?: string;
}

export type SupportedLocale = 'ko' | 'en';

export interface UseI18nReturn {
  t: (key: string, variables?: Record<string, any>) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  isLoading: boolean;
  error?: string;
  hasTranslations: boolean;
  retryLoading: () => void;
  clearError: () => void;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { 
    code: 'ko', 
    name: 'Korean', 
    nativeName: '한국어', 
    direction: 'ltr', 
    dateFormat: 'ko-KR', 
    numberFormat: {} 
  },
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English', 
    direction: 'ltr', 
    dateFormat: 'en-US', 
    numberFormat: {} 
  }
];

export const DEFAULT_LOCALE: SupportedLocale = 'ko';