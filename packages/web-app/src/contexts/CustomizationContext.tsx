// UI Customization Context — S3에서 Customizing Set을 로드하고 앱 전체에 제공
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useI18n } from '../i18n';
import {
  CustomizingSet,
  DEFAULT_CUSTOMIZING_SET,
  LocalizedString,
  resolveLocalized,
} from '../types/customization';

interface CustomizationContextValue {
  customizingSet: CustomizingSet;
  isLoading: boolean;
  getLocalizedValue: (value: LocalizedString) => string | null;
}

const CustomizationContext = createContext<CustomizationContextValue | undefined>(undefined);

// S3에서 customizing-set.json을 직접 fetch하는 URL
const getCustomizingSetUrl = () => {
  const origin = window.location.origin;
  return `${origin}/customization/customizing-set.json`;
};

export const CustomizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { locale } = useI18n();
  const [customizingSet, setCustomizingSet] = useState<CustomizingSet>(DEFAULT_CUSTOMIZING_SET);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const fetchCustomizingSet = async () => {
      try {
        const url = getCustomizingSetUrl();
        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          setCustomizingSet({ ...DEFAULT_CUSTOMIZING_SET, ...data });
        }
      } catch {
        // fetch 실패 시 기본값 유지 (콘솔 경고)
        console.warn('Customizing Set fetch failed, using defaults');
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    fetchCustomizingSet();
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  // 배경 그라디언트 CSS 변수 적용
  useEffect(() => {
    const { startColor, endColor } = customizingSet.background;
    if (startColor || endColor) {
      const start = startColor || '#ffeef8';
      const end = endColor || '#e8f4fd';
      document.documentElement.style.setProperty(
        '--gradient-bg',
        `linear-gradient(135deg, ${start} 0%, ${end} 100%)`
      );
    }
    return () => {
      document.documentElement.style.setProperty(
        '--gradient-bg',
        'linear-gradient(135deg, #ffeef8 0%, #e8f4fd 100%)'
      );
    };
  }, [customizingSet.background.startColor, customizingSet.background.endColor]);

  const getLocalizedValue = useCallback(
    (value: LocalizedString): string | null => resolveLocalized(value, locale),
    [locale]
  );

  return (
    <CustomizationContext.Provider value={{ customizingSet, isLoading, getLocalizedValue }}>
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomizationContext = () => {
  const ctx = useContext(CustomizationContext);
  if (!ctx) {
    throw new Error('useCustomizationContext must be used within CustomizationProvider');
  }
  return ctx;
};
