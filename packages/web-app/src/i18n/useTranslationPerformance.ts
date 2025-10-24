import { useState, useEffect, useCallback } from 'react';
import { translationManager } from './TranslationManager';

export interface TranslationPerformanceMetrics {
  coverageStats: {
    totalKeys: number;
    translatedKeys: { ko: number; en: number };
    missingKeys: { ko: string[]; en: string[] };
    coverage: { ko: number; en: number };
    recommendations: string[];
  };
  loadingStats: {
    isLoading: boolean;
    loadedLocales: string[];
    failedLocales: string[];
  };
}

export const useTranslationPerformance = () => {
  const [metrics, setMetrics] = useState<TranslationPerformanceMetrics | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  const collectMetrics = useCallback(async () => {
    setIsCollecting(true);
    
    try {
      const coverageStats = translationManager.validateTranslationCoverage();
      
      const loadedLocales: string[] = [];
      const failedLocales: string[] = [];
      
      // Check which locales are loaded
      (['ko', 'en'] as const).forEach(locale => {
        if (translationManager.isTranslationLoaded(locale)) {
          loadedLocales.push(locale);
        } else {
          failedLocales.push(locale);
        }
      });
      
      setMetrics({
        coverageStats,
        loadingStats: {
          isLoading: false, // This would need to be tracked more accurately
          loadedLocales,
          failedLocales
        }
      });
    } catch (error) {
      console.error('Failed to collect translation performance metrics:', error);
    } finally {
      setIsCollecting(false);
    }
  }, []);

  // Collect metrics on mount and periodically
  useEffect(() => {
    collectMetrics();
    
    // Collect metrics every 30 seconds in development
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(collectMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [collectMetrics]);

  const clearCaches = useCallback(() => {
    // No caches to clear anymore, but keep the function for compatibility
    collectMetrics(); // Refresh metrics
  }, [collectMetrics]);

  return {
    metrics,
    isCollecting,
    collectMetrics,
    clearCaches
  };
};