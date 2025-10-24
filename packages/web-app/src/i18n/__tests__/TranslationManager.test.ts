import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationManager } from '../TranslationManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
global.fetch = vi.fn();

describe('TranslationManager Error Handling', () => {
  let manager: TranslationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear global state
    vi.mocked(global.localStorage.getItem).mockReturnValue(null);
    vi.mocked(global.localStorage.setItem).mockImplementation(() => {});
    manager = new TranslationManager();
    manager.clearErrorLog(); // Clear any previous state
  });

  describe('Missing Translation Keys', () => {
    it('should return key as fallback for missing translations', () => {
      const result = manager.getTranslation('missing_key');
      // In development/test mode, missing keys are wrapped with [MISSING: ]
      expect(result).toBe('[MISSING: missing_key]');
    });

    it('should return custom fallback when provided', () => {
      const result = manager.getTranslation('missing_key', 'ko', 'Custom Fallback');
      expect(result).toBe('Custom Fallback');
    });

    it('should use safe translation method with validation', () => {
      const result = manager.getTranslationSafe('valid_key');
      // In development/test mode, missing keys are wrapped with [MISSING: ]
      expect(result).toBe('[MISSING: valid_key]');
    });

    it('should handle invalid translation keys', () => {
      const result = manager.getTranslationSafe('');
      expect(result).toBe('');
    });

    it('should handle keys with invalid characters', () => {
      const result = manager.getTranslationSafe('key<with>invalid{chars}');
      expect(result).toBe('key<with>invalid{chars}');
    });
  });

  describe('Error Logging', () => {
    beforeEach(() => {
      // Set development mode for error tracking tests
      process.env.NODE_ENV = 'development';
    });

    it('should track missing keys in development mode', () => {
      manager.getTranslation('missing_key_1');
      manager.getTranslation('missing_key_2');
      
      const missingKeys = manager.getMissingKeys();
      expect(missingKeys).toContain('missing_key_1');
      expect(missingKeys).toContain('missing_key_2');
    });

    it('should clear error log', () => {
      manager.getTranslation('missing_key');
      expect(manager.getMissingKeys().length).toBeGreaterThan(0);
      
      manager.clearErrorLog();
      expect(manager.getMissingKeys().length).toBe(0);
    });

    it('should register and call error handlers', () => {
      const errorHandler = vi.fn();
      const unsubscribe = manager.onError(errorHandler);
      
      manager.getTranslation('missing_key');
      expect(errorHandler).toHaveBeenCalled();
      
      unsubscribe();
      manager.getTranslation('another_missing_key');
      expect(errorHandler).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
    });
  });

  describe('Translation Coverage', () => {
    it('should calculate translation coverage', () => {
      const coverage = manager.getTranslationCoverage();
      expect(coverage).toHaveProperty('ko');
      expect(coverage).toHaveProperty('en');
      expect(coverage.ko).toHaveProperty('totalKeys');
      expect(coverage.ko).toHaveProperty('translatedKeys');
      expect(coverage.ko).toHaveProperty('coverage');
    });

    it('should check if translations are available', () => {
      expect(manager.hasTranslations('ko')).toBe(false);
      expect(manager.hasTranslations('en')).toBe(false);
    });
  });

  describe('Variable Interpolation', () => {
    it('should interpolate variables correctly', () => {
      const template = 'Hello {{name}}, you have {{count}} messages';
      const result = manager.interpolate(template, { name: 'John', count: 5 });
      expect(result).toBe('Hello John, you have 5 messages');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, you have {{count}} messages';
      const result = manager.interpolate(template, { name: 'John' });
      expect(result).toBe('Hello John, you have {{count}} messages');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {{name}}';
      const result = manager.interpolate(template, {});
      expect(result).toBe('Hello {{name}}');
    });
  });

  describe('Locale Management', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      vi.mocked(global.localStorage.setItem).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        manager.setLocale('en');
      }).toThrow('Failed to persist locale preference');
    });

    it('should restore locale preference', () => {
      // Create a new manager instance to test restoration
      vi.mocked(global.localStorage.getItem).mockReturnValue('en');
      const newManager = new TranslationManager();
      const locale = newManager.getCurrentLocale();
      expect(locale).toBe('en');
    });

    it('should handle invalid stored locale', () => {
      vi.mocked(global.localStorage.getItem).mockReturnValue('invalid');
      const newManager = new TranslationManager();
      const locale = newManager.getCurrentLocale();
      expect(locale).toBe('ko'); // Should default to Korean
    });


  });
});