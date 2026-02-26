// 관리자용 Customization API 호출 훅
import { useState, useCallback } from 'react';
import { customizationApi } from '../services/api';
import { CustomizingSet } from '../types/customization';

export const useCustomization = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomization = useCallback(async (): Promise<CustomizingSet | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customizationApi.getCustomization();
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch customization';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCustomization = useCallback(async (data: CustomizingSet): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await customizationApi.saveCustomization(data);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save customization';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await customizationApi.uploadLogo(file);
      // 상대 경로를 CloudFront origin과 조합하여 절대 URL로 변환
      const url = result.url.startsWith('/') ? `${window.location.origin}${result.url}` : result.url;
      return url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload logo';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetCustomization = useCallback(async (): Promise<CustomizingSet | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await customizationApi.resetCustomization();
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset customization';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadLegalDoc = useCallback(
    async (file: File, docType: 'privacy' | 'service', locale: 'ko' | 'en'): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await customizationApi.uploadLegalDoc(file, docType, locale);
        // 상대 경로를 CloudFront origin과 조합하여 절대 URL로 변환
        const url = result.url.startsWith('/') ? `${window.location.origin}${result.url}` : result.url;
        return url;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to upload legal document';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    clearError: () => setError(null),
    fetchCustomization,
    saveCustomization,
    resetCustomization,
    uploadLogo,
    uploadLegalDoc,
  };
};
