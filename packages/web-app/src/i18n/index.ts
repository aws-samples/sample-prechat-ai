export { useI18n } from './useI18n';
export { I18nProvider } from './I18nContext';
export { 
  translationManager, 
  TranslationManager, 
  TranslationErrorType,
  type TranslationError 
} from './TranslationManager';
export { 
  TranslationErrorBoundary, 
  withTranslationErrorBoundary, 
  useTranslationErrorHandler 
} from './TranslationErrorBoundary';
export { 
  TranslationDebugger, 
  useTranslationDebug 
} from './TranslationDebugger';
export { 
  useTranslationPerformance,
  type TranslationPerformanceMetrics 
} from './useTranslationPerformance';
export type { 
  TranslationEntry, 
  LocaleConfig, 
  TranslationContext, 
  SupportedLocale,
  UseI18nReturn 
} from './types';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './types';