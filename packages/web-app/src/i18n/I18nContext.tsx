import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translationManager, TranslationError, TranslationErrorType } from './TranslationManager';
import { SupportedLocale } from './types';
import { TranslationErrorBoundary } from './TranslationErrorBoundary';

export interface I18nContextValue {
  t: (key: string, variables?: Record<string, any>) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  isLoading: boolean;
  error?: string;
  hasTranslations: boolean;
  retryLoading: () => void;
  clearError: () => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    // Restore locale preference on initialization
    return translationManager.restoreLocalePreference();
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hasTranslations, setHasTranslations] = useState<boolean>(false);

  // Listen for locale changes from other components during active sessions
  useEffect(() => {
    const handleLocaleChange = (event: CustomEvent<{ 
      locale: SupportedLocale; 
      previousLocale?: SupportedLocale;
      timestamp?: number;
      translationsLoaded?: boolean;
    }>) => {
      const { locale: newLocale, translationsLoaded } = event.detail;
      
      // Update state immediately if translations are already loaded
      if (translationsLoaded) {
        setLocaleState(newLocale);
        setIsLoading(false);
        setError(undefined);
      } else {
        // Set loading state if translations need to be loaded
        setIsLoading(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('localeChanged', handleLocaleChange as EventListener);
      return () => {
        window.removeEventListener('localeChanged', handleLocaleChange as EventListener);
      };
    }
  }, []);

  // Set up error handler for translation manager
  useEffect(() => {
    const unsubscribe = translationManager.onError((translationError: TranslationError) => {
      // Only set error state for critical errors, not missing keys in development
      if (translationError.type !== TranslationErrorType.MISSING_KEY || process.env.NODE_ENV !== 'development') {
        setError(translationError.message);
      }
    });

    return unsubscribe;
  }, []);

  // Preload all translations on app initialization
  useEffect(() => {
    const preloadTranslations = async () => {
      setIsLoading(true);
      setError(undefined);

      try {
        // Load current locale first
        if (!translationManager.isTranslationLoaded(locale)) {
          await translationManager.loadTranslations(locale);
        }
        
        // Check if we have translations
        setHasTranslations(translationManager.hasTranslations(locale));
        
        // Preload the other locale in the background
        const otherLocale: SupportedLocale = locale === 'ko' ? 'en' : 'ko';
        if (!translationManager.isTranslationLoaded(otherLocale)) {
          // Don't await this one to avoid blocking the UI
          translationManager.loadTranslations(otherLocale).catch(err => {
            console.warn('Failed to preload translations for', otherLocale, err);
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load translations';
        setError(errorMessage);
        console.error('Translation loading error:', err);
        setHasTranslations(false);
      } finally {
        setIsLoading(false);
      }
    };

    preloadTranslations();
  }, []); // Only run once on mount

  // Load translations when locale changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (translationManager.isTranslationLoaded(locale)) {
        setHasTranslations(translationManager.hasTranslations(locale));
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        await translationManager.loadTranslations(locale);
        setHasTranslations(translationManager.hasTranslations(locale));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load translations';
        setError(errorMessage);
        setHasTranslations(false);
        console.error('Translation loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [locale]);

  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;

    setIsLoading(true);
    setError(undefined);
    
    try {
      // Use the enhanced locale switching method that handles active sessions
      await translationManager.switchLocale(newLocale);
      
      // Update local state to trigger re-renders
      setLocaleState(newLocale);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch locale';
      setError(errorMessage);
      console.error('Locale switching error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  const t = useCallback((key: string, variables?: Record<string, any>): string => {
    try {
      const translation = translationManager.getTranslationSafe(key, locale);
      
      if (variables && Object.keys(variables).length > 0) {
        return translationManager.interpolate(translation, variables);
      }
      
      return translation;
    } catch (err) {
      console.error('Error in translation function:', err);
      // Return key as fallback if translation function fails
      return key;
    }
  }, [locale]);

  const retryLoading = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Clear any cached failed attempts
      translationManager.clearErrorLog();
      await translationManager.loadTranslations(locale);
      setHasTranslations(translationManager.hasTranslations(locale));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load translations';
      setError(errorMessage);
      setHasTranslations(false);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  const contextValue: I18nContextValue = {
    t,
    locale,
    setLocale,
    isLoading,
    error,
    hasTranslations,
    retryLoading,
    clearError
  };

  return (
    <I18nContext.Provider value={contextValue}>
      <TranslationErrorBoundary>
        {children}
      </TranslationErrorBoundary>
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};