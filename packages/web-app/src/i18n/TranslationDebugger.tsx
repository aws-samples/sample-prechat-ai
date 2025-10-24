import React, { useState, useEffect } from 'react';
import { translationManager, TranslationError } from './TranslationManager';
import { useI18n } from './I18nContext';
import { useTranslationPerformance } from './useTranslationPerformance';

interface TranslationDebuggerProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showInProduction?: boolean;
}

export const TranslationDebugger: React.FC<TranslationDebuggerProps> = ({
  position = 'bottom-right',
  showInProduction = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<TranslationError[]>([]);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const { locale } = useI18n();
  const { metrics, clearCaches } = useTranslationPerformance();

  // Don't show in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && !showInProduction) {
    return null;
  }

  useEffect(() => {
    const updateDebugInfo = () => {
      setErrors(translationManager.getErrorLog());
      setMissingKeys(translationManager.getMissingKeys());
    };

    // Update immediately
    updateDebugInfo();

    // Set up error handler to update when new errors occur
    const unsubscribe = translationManager.onError(() => {
      updateDebugInfo();
    });

    // Update periodically
    const interval = setInterval(updateDebugInfo, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getPositionStyles = () => {
    const base = {
      position: 'fixed' as const,
      zIndex: 9999,
      fontSize: '12px',
      fontFamily: 'monospace'
    };

    switch (position) {
      case 'top-left':
        return { ...base, top: '10px', left: '10px' };
      case 'top-right':
        return { ...base, top: '10px', right: '10px' };
      case 'bottom-left':
        return { ...base, bottom: '10px', left: '10px' };
      case 'bottom-right':
      default:
        return { ...base, bottom: '10px', right: '10px' };
    }
  };

  const coverage = translationManager.getTranslationCoverage();
  const currentCoverage = coverage[locale];

  return (
    <div style={getPositionStyles()}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: errors.length > 0 ? '#f44336' : '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          fontSize: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        title="Translation Debugger"
      >
        🌐
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '0',
            width: '400px',
            maxHeight: '500px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            fontSize: '12px'
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderBottom: '1px solid #ddd',
              fontWeight: 'bold'
            }}
          >
            Translation Debug Info
            <button
              onClick={() => setIsOpen(false)}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            {/* Current Locale Info */}
            <div style={{ marginBottom: '16px' }}>
              <strong>Current Locale:</strong> {locale}
              <br />
              <strong>Coverage:</strong> {currentCoverage.translatedKeys}/{currentCoverage.totalKeys} 
              ({currentCoverage.coverage.toFixed(1)}%)
            </div>

            {/* Performance Metrics */}
            {metrics && (
              <div style={{ marginBottom: '16px' }}>
                <strong>Performance:</strong>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  <div>Loaded: {metrics.loadingStats.loadedLocales.join(', ')}</div>
                  {metrics.coverageStats.recommendations.length > 0 && (
                    <div style={{ color: '#ff9800', marginTop: '4px' }}>
                      ⚠️ {metrics.coverageStats.recommendations.length} recommendations
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing Keys */}
            {missingKeys.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#ff9800' }}>Missing Keys ({missingKeys.length}):</strong>
                <div
                  style={{
                    maxHeight: '100px',
                    overflowY: 'auto',
                    backgroundColor: '#fff3e0',
                    padding: '8px',
                    borderRadius: '4px',
                    marginTop: '4px'
                  }}
                >
                  {missingKeys.map((key, index) => (
                    <div key={index} style={{ padding: '2px 0' }}>
                      {key}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#f44336' }}>Errors ({errors.length}):</strong>
                <div
                  style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    backgroundColor: '#ffebee',
                    padding: '8px',
                    borderRadius: '4px',
                    marginTop: '4px'
                  }}
                >
                  {errors.slice(-10).map((error, index) => (
                    <div key={index} style={{ padding: '4px 0', borderBottom: '1px solid #ffcdd2' }}>
                      <div style={{ fontWeight: 'bold', color: '#c62828' }}>
                        {error.type}
                      </div>
                      <div>{error.message}</div>
                      {error.key && <div style={{ fontSize: '10px', color: '#666' }}>Key: {error.key}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px' }}>
              <button
                onClick={() => {
                  translationManager.clearErrorLog();
                  setErrors([]);
                  setMissingKeys([]);
                }}
                style={{
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '8px',
                  fontSize: '12px'
                }}
              >
                Clear Log
              </button>
              <button
                onClick={clearCaches}
                style={{
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '8px',
                  fontSize: '12px'
                }}
              >
                Clear Cache
              </button>
              <button
                onClick={() => {
                  console.log('Translation Coverage:', coverage);
                  console.log('Missing Keys:', missingKeys);
                  console.log('Errors:', errors);
                  console.log('Performance Metrics:', metrics);
                }}
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Log to Console
              </button>
            </div>

            {/* Success State */}
            {errors.length === 0 && missingKeys.length === 0 && (
              <div
                style={{
                  backgroundColor: '#e8f5e8',
                  color: '#2e7d32',
                  padding: '12px',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}
              >
                ✅ All translations loaded successfully!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for programmatic access to debug information
export function useTranslationDebug() {
  const [debugInfo, setDebugInfo] = useState({
    errors: [] as TranslationError[],
    missingKeys: [] as string[],
    coverage: translationManager.getTranslationCoverage()
  });

  useEffect(() => {
    const updateDebugInfo = () => {
      setDebugInfo({
        errors: translationManager.getErrorLog(),
        missingKeys: translationManager.getMissingKeys(),
        coverage: translationManager.getTranslationCoverage()
      });
    };

    updateDebugInfo();
    const unsubscribe = translationManager.onError(updateDebugInfo);
    const interval = setInterval(updateDebugInfo, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return debugInfo;
}