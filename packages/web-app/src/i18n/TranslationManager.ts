import { SupportedLocale, DEFAULT_LOCALE } from './types';

// Key for tracking if this is a new user
const NEW_USER_KEY = 'prechat_new_user';

// Development mode detection (include test environment for testing)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Error types for better error handling
export enum TranslationErrorType {
  MISSING_KEY = 'MISSING_KEY',
  LOADING_FAILED = 'LOADING_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR'
}

export interface TranslationError {
  type: TranslationErrorType;
  message: string;
  key?: string;
  locale?: SupportedLocale;
  originalError?: Error;
}

// Global sets to track missing keys and errors across all instances
const globalMissingKeys = new Set<string>();
const globalErrorLog: TranslationError[] = [];

export class TranslationManager {
  private translations: Map<SupportedLocale, Record<string, any>> = new Map();
  private currentLocale: SupportedLocale = DEFAULT_LOCALE;
  private loadingPromises: Map<SupportedLocale, Promise<Record<string, any>>> = new Map();
  private storageKey = 'prechat_locale';
  private errorHandlers: ((error: TranslationError) => void)[] = [];
  private retryAttempts: Map<SupportedLocale, number> = new Map();
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second base delay

  constructor() {
    this.initializeLocale();
  }

  private initializeLocale(): void {
    try {
      const savedLocale = localStorage.getItem(this.storageKey) as SupportedLocale;
      const isNewUser = !localStorage.getItem(NEW_USER_KEY);
      
      if (savedLocale && (savedLocale === 'ko' || savedLocale === 'en')) {
        this.currentLocale = savedLocale;
      } else {
        // Set Korean as default for new users and save to localStorage
        this.currentLocale = DEFAULT_LOCALE;
        localStorage.setItem(this.storageKey, DEFAULT_LOCALE);
      }
      
      // Mark user as no longer new
      if (isNewUser) {
        localStorage.setItem(NEW_USER_KEY, 'false');
        console.log('New user detected, setting default locale to Korean');
      }
    } catch (error) {
      console.warn('Failed to load locale from localStorage:', error);
      // Fallback to default locale if localStorage is not available
      this.currentLocale = DEFAULT_LOCALE;
    }
  }

  async loadTranslations(locale: SupportedLocale): Promise<Record<string, any>> {
    // Return cached translations if already loaded
    if (this.translations.has(locale)) {
      return this.translations.get(locale)!;
    }

    // Return existing loading promise if already in progress
    if (this.loadingPromises.has(locale)) {
      return this.loadingPromises.get(locale)!;
    }

    // Create new loading promise with standard fetch
    const loadingPromise = this.fetchTranslations(locale);
    this.loadingPromises.set(locale, loadingPromise);

    try {
      const translations = await loadingPromise;
      this.translations.set(locale, translations);
      this.loadingPromises.delete(locale);
      return translations;
    } catch (error) {
      this.loadingPromises.delete(locale);
      throw error;
    }
  }

  private async fetchTranslations(locale: SupportedLocale): Promise<Record<string, any>> {
    const attempts = this.retryAttempts.get(locale) || 0;
    
    try {
      const response = await fetch(`/i18n/locales/locale.${locale}.json`);
      
      if (!response.ok) {
        const error: TranslationError = {
          type: TranslationErrorType.NETWORK_ERROR,
          message: `HTTP ${response.status}: ${response.statusText}`,
          locale
        };
        
        if (response.status >= 500 && attempts < this.maxRetries) {
          // Retry on server errors
          return this.retryFetchTranslations(locale, error);
        }
        
        throw new Error(error.message);
      }
      
      const translations = await response.json();
      
      // Reset retry count on success
      this.retryAttempts.delete(locale);
      
      // Validate translations structure
      if (typeof translations !== 'object' || translations === null) {
        throw new Error('Invalid translations format: expected object');
      }
      
      return translations;
    } catch (error) {
      const translationError: TranslationError = {
        type: error instanceof SyntaxError ? TranslationErrorType.PARSE_ERROR : TranslationErrorType.LOADING_FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
        locale,
        originalError: error instanceof Error ? error : undefined
      };
      
      this.handleError(translationError);
      
      // Retry on network errors if we haven't exceeded max attempts
      if (translationError.type === TranslationErrorType.LOADING_FAILED && attempts < this.maxRetries) {
        return this.retryFetchTranslations(locale, translationError);
      }
      
      // Return empty translations object as fallback
      console.error(`Failed to load translations for ${locale} after ${attempts + 1} attempts:`, error);
      return {};
    }
  }

  private async retryFetchTranslations(locale: SupportedLocale, _lastError: TranslationError): Promise<Record<string, any>> {
    const attempts = this.retryAttempts.get(locale) || 0;
    const newAttempts = attempts + 1;
    this.retryAttempts.set(locale, newAttempts);
    
    // Exponential backoff with jitter
    const delay = this.retryDelay * Math.pow(2, attempts) + Math.random() * 1000;
    
    if (isDevelopment) {
      console.warn(`Retrying translation load for ${locale} (attempt ${newAttempts}/${this.maxRetries}) in ${Math.round(delay)}ms`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.fetchTranslations(locale);
  }

  // dot notation으로 중첩 JSON 객체를 탐색하여 문자열 값을 반환
  private resolveNestedKey(obj: any, key: string): string | undefined {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
  }

  getTranslation(key: string, locale?: SupportedLocale, fallback?: string): string {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);
    
    if (translations) {
      // 먼저 플랫 키로 시도 (하위 호환성)
      if (translations[key]) {
        return translations[key];
      }
      // dot notation으로 중첩 키 탐색
      const nested = this.resolveNestedKey(translations, key);
      if (nested) {
        return nested;
      }
    }

    // Fallback to the other locale if available
    const otherLocale: SupportedLocale = targetLocale === 'ko' ? 'en' : 'ko';
    const otherTranslations = this.translations.get(otherLocale);
    if (otherTranslations) {
      // 폴백 로케일에서도 플랫 키 → 중첩 키 순서로 조회
      if (otherTranslations[key]) {
        if (isDevelopment) {
          console.warn(`Translation key "${key}" not found in ${targetLocale}, using ${otherLocale} fallback`);
        }
        return otherTranslations[key];
      }
      const nestedFallback = this.resolveNestedKey(otherTranslations, key);
      if (nestedFallback) {
        if (isDevelopment) {
          console.warn(`Translation key "${key}" not found in ${targetLocale}, using ${otherLocale} fallback`);
        }
        return nestedFallback;
      }
    }

    // Log missing key in development mode
    if (isDevelopment && !globalMissingKeys.has(key)) {
      globalMissingKeys.add(key);
      const error: TranslationError = {
        type: TranslationErrorType.MISSING_KEY,
        message: `Missing translation key: ${key}`,
        key,
        locale: targetLocale
      };
      this.handleError(error);
      console.warn(`Missing translation key: "${key}" for locale: ${targetLocale}`);
    }

    // Return provided fallback or the key itself as final fallback
    const finalFallback = fallback || key;
    
    // In development, make missing keys more visible
    if (isDevelopment && !fallback) {
      return `[MISSING: ${key}]`;
    }
    
    return finalFallback;
  }

  setLocale(locale: SupportedLocale): void {
    if (locale !== this.currentLocale) {
      const previousLocale = this.currentLocale;
      this.currentLocale = locale;
      
      try {
        localStorage.setItem(this.storageKey, locale);
      } catch (error) {
        const translationError: TranslationError = {
          type: TranslationErrorType.STORAGE_FAILED,
          message: 'Failed to persist locale preference',
          locale,
          originalError: error instanceof Error ? error : undefined
        };
        
        this.handleError(translationError);
        
        // Revert to previous locale if storage fails
        this.currentLocale = previousLocale;
        throw new Error(translationError.message);
      }
      
      // Emit a custom event to notify about locale change during active sessions
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('localeChanged', { 
          detail: { 
            locale, 
            previousLocale,
            timestamp: Date.now()
          } 
        }));
      }
    }
  }

  getCurrentLocale(): SupportedLocale {
    return this.currentLocale;
  }

  isTranslationLoaded(locale: SupportedLocale): boolean {
    return this.translations.has(locale);
  }

  // Method to interpolate variables in translations
  interpolate(template: string, variables: Record<string, any> = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  // Method to restore locale preference on application load
  restoreLocalePreference(): SupportedLocale {
    try {
      const savedLocale = localStorage.getItem(this.storageKey) as SupportedLocale;
      if (savedLocale && (savedLocale === 'ko' || savedLocale === 'en')) {
        this.currentLocale = savedLocale;
        return savedLocale;
      }
    } catch (error) {
      console.warn('Failed to restore locale preference:', error);
    }
    
    // Return default locale for new users
    this.currentLocale = DEFAULT_LOCALE;
    this.persistLocale(DEFAULT_LOCALE);
    return DEFAULT_LOCALE;
  }

  // Method to persist locale preference with error handling
  private persistLocale(locale: SupportedLocale): boolean {
    try {
      localStorage.setItem(this.storageKey, locale);
      return true;
    } catch (error) {
      console.warn('Failed to persist locale preference:', error);
      return false;
    }
  }

  // Method to handle locale switching during active sessions
  switchLocale(locale: SupportedLocale): Promise<void> {
    return new Promise((resolve, reject) => {
      if (locale === this.currentLocale) {
        resolve();
        return;
      }

      const previousLocale = this.currentLocale;
      
      // Update locale
      this.currentLocale = locale;
      
      // Persist the change
      if (!this.persistLocale(locale)) {
        // Revert on persistence failure
        this.currentLocale = previousLocale;
        reject(new Error('Failed to persist locale preference'));
        return;
      }

      // Load translations for the new locale if not already loaded
      if (!this.isTranslationLoaded(locale)) {
        this.loadTranslations(locale)
          .then(() => {
            // Emit locale change event after translations are loaded
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('localeChanged', { 
                detail: { 
                  locale, 
                  previousLocale,
                  timestamp: Date.now(),
                  translationsLoaded: true
                } 
              }));
            }
            resolve();
          })
          .catch((error) => {
            // Revert on translation loading failure
            this.currentLocale = previousLocale;
            this.persistLocale(previousLocale);
            reject(error);
          });
      } else {
        // Emit locale change event immediately if translations are already loaded
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('localeChanged', { 
            detail: { 
              locale, 
              previousLocale,
              timestamp: Date.now(),
              translationsLoaded: true
            } 
          }));
        }
        resolve();
      }
    });
  }

  // Method to check if this is a new user (for analytics or onboarding)
  isNewUser(): boolean {
    try {
      return !localStorage.getItem(NEW_USER_KEY);
    } catch (error) {
      console.warn('Failed to check new user status:', error);
      return true; // Assume new user if we can't check
    }
  }

  // Method to get locale preference status
  getLocalePreferenceStatus(): {
    hasStoredPreference: boolean;
    currentLocale: SupportedLocale;
    isDefault: boolean;
  } {
    try {
      const savedLocale = localStorage.getItem(this.storageKey) as SupportedLocale;
      return {
        hasStoredPreference: !!savedLocale,
        currentLocale: this.currentLocale,
        isDefault: this.currentLocale === DEFAULT_LOCALE
      };
    } catch (error) {
      console.warn('Failed to get locale preference status:', error);
      return {
        hasStoredPreference: false,
        currentLocale: this.currentLocale,
        isDefault: this.currentLocale === DEFAULT_LOCALE
      };
    }
  }

  // Error handling methods
  private handleError(error: TranslationError): void {
    globalErrorLog.push(error);
    
    // Keep error log size manageable
    if (globalErrorLog.length > 100) {
      globalErrorLog.splice(0, 50); // Remove oldest 50 errors
    }
    
    // Notify error handlers
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in translation error handler:', handlerError);
      }
    });
  }

  // Public method to register error handlers
  onError(handler: (error: TranslationError) => void): () => void {
    this.errorHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  // Get error log for debugging
  getErrorLog(): TranslationError[] {
    return [...globalErrorLog];
  }

  // Get missing keys for debugging
  getMissingKeys(): string[] {
    return Array.from(globalMissingKeys);
  }

  // Clear error log and missing keys
  clearErrorLog(): void {
    globalErrorLog.length = 0;
    globalMissingKeys.clear();
  }

  // Check if translations are available for a locale
  hasTranslations(locale: SupportedLocale): boolean {
    const translations = this.translations.get(locale);
    return translations !== undefined && Object.keys(translations).length > 0;
  }

  // Get translation coverage statistics
  getTranslationCoverage(): {
    [locale in SupportedLocale]: {
      totalKeys: number;
      translatedKeys: number;
      coverage: number;
    }
  } {
    const allKeys = new Set<string>();
    
    // Collect all keys from all locales
    this.translations.forEach(translations => {
      Object.keys(translations).forEach(key => allKeys.add(key));
    });
    
    const result = {} as any;
    
    (['ko', 'en'] as SupportedLocale[]).forEach(locale => {
      const translations = this.translations.get(locale) || {};
      const translatedKeys = Object.keys(translations).filter(key => 
        translations[key] && translations[key].trim() !== ''
      ).length;
      
      result[locale] = {
        totalKeys: allKeys.size,
        translatedKeys,
        coverage: allKeys.size > 0 ? (translatedKeys / allKeys.size) * 100 : 0
      };
    });
    
    return result;
  }

  // Validate translation key format
  private isValidTranslationKey(key: string): boolean {
    // Basic validation: non-empty string, no special characters that could cause issues
    return typeof key === 'string' && 
           key.length > 0 && 
           key.length < 200 && 
           !/[<>{}]/.test(key);
  }

  // Enhanced translation method with validation
  getTranslationSafe(key: string, locale?: SupportedLocale, fallback?: string): string {
    if (!this.isValidTranslationKey(key)) {
      const error: TranslationError = {
        type: TranslationErrorType.MISSING_KEY,
        message: `Invalid translation key format: ${key}`,
        key,
        locale: locale || this.currentLocale
      };
      this.handleError(error);
      return fallback || key;
    }
    
    return this.getTranslation(key, locale, fallback);
  }



  // Performance optimization: Validate translation coverage
  validateTranslationCoverage(): {
    totalKeys: number;
    translatedKeys: { [locale in SupportedLocale]: number };
    missingKeys: { [locale in SupportedLocale]: string[] };
    coverage: { [locale in SupportedLocale]: number };
    recommendations: string[];
  } {
    const allKeys = new Set<string>();
    const missingKeys: { [locale in SupportedLocale]: string[] } = { ko: [], en: [] };
    const translatedKeys: { [locale in SupportedLocale]: number } = { ko: 0, en: 0 };
    
    // Collect all keys from all locales
    this.translations.forEach(translations => {
      Object.keys(translations).forEach(key => allKeys.add(key));
    });
    
    // Check coverage for each locale
    (['ko', 'en'] as SupportedLocale[]).forEach(locale => {
      const translations = this.translations.get(locale) || {};
      
      allKeys.forEach(key => {
        if (translations[key] && translations[key].trim() !== '') {
          translatedKeys[locale]++;
        } else {
          missingKeys[locale].push(key);
        }
      });
    });
    
    const coverage: { [locale in SupportedLocale]: number } = {
      ko: allKeys.size > 0 ? (translatedKeys.ko / allKeys.size) * 100 : 0,
      en: allKeys.size > 0 ? (translatedKeys.en / allKeys.size) * 100 : 0
    };
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (coverage.ko < 95) {
      recommendations.push(`Korean translation coverage is ${coverage.ko.toFixed(1)}%. Consider translating missing keys.`);
    }
    
    if (coverage.en < 95) {
      recommendations.push(`English translation coverage is ${coverage.en.toFixed(1)}%. Consider translating missing keys.`);
    }
    

    
    if (globalMissingKeys.size > 0) {
      recommendations.push(`${globalMissingKeys.size} missing translation keys detected. Check console for details.`);
    }
    
    return {
      totalKeys: allKeys.size,
      translatedKeys,
      missingKeys,
      coverage,
      recommendations
    };
  }
}

// Singleton instance
export const translationManager = new TranslationManager();