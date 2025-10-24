// nosemgrep
import React from 'react';
import { Container, Header, Box, SpaceBetween, Button, Alert } from '@cloudscape-design/components';
import { useI18n, TranslationDebugger, useTranslationDebug } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export const TranslationTest: React.FC = () => {
  const { t, locale, error, isLoading, hasTranslations, retryLoading, clearError } = useI18n();
  const debugInfo = useTranslationDebug();

  return (
    <Container>
      <SpaceBetween size="m">
        <Header variant="h1">Translation Test</Header>
        
        <Box>
          <strong>Current Locale:</strong> {locale}
          <br />
          <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
          <br />
          <strong>Has Translations:</strong> {hasTranslations ? 'Yes' : 'No'}
          <br />
          <strong>Coverage:</strong> {debugInfo.coverage[locale]?.coverage.toFixed(1)}%
        </Box>
        
        {error && (
          <Alert
            type="error"
            header="Translation Error"
            action={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={clearError}>Dismiss</Button>
                <Button onClick={retryLoading}>Retry</Button>
              </SpaceBetween>
            }
          >
            {error}
          </Alert>
        )}
        
        <LanguageSwitcher variant="aws-console" />
        
        <Box>
          <Header variant="h3">Sample Translations:</Header>
          <SpaceBetween size="s">
            <Box>
              <strong>welcome_title:</strong> {t('welcome_title')}
            </Box>
            <Box>
              <strong>header_subtitle:</strong> {t('header_subtitle')}
            </Box>
            <Box>
              <strong>file_name_header:</strong> {t('file_name_header')}
            </Box>
            <Box>
              <strong>file_size_header:</strong> {t('file_size_header')}
            </Box>
            <Box>
              <strong>upload_time_header:</strong> {t('upload_time_header')}
            </Box>
            <Box>
              <strong>actions:</strong> {t('actions')}
            </Box>
            <Box>
              <strong>delete:</strong> {t('delete')}
            </Box>
            <Box>
              <strong>modal_confirm_button:</strong> {t('modal_confirm_button')}
            </Box>
            <Box>
              <strong>loading_ec6095c4:</strong> {t('loading_ec6095c4')}
            </Box>
            <Box>
              <strong>loading_3d28a7fc:</strong> {t('loading_3d28a7fc')}
            </Box>
          </SpaceBetween>
        </Box>

        {/* Error Handling Demo */}
        <Box>
          <Header variant="h3">Error Handling Demo:</Header>
          <SpaceBetween size="s">
            <Box>
              <strong>Missing Key (should show fallback):</strong> {t('this_key_does_not_exist')}
            </Box>
            <Box>
              <strong>Invalid Key (should show fallback):</strong> {t('')}
            </Box>
            <Box>
              <strong>Variable Interpolation:</strong> {t('welcome_message', { name: 'User' })}
            </Box>
          </SpaceBetween>
        </Box>

        {/* Debug Information */}
        {process.env.NODE_ENV === 'development' && (
          <Box>
            <Header variant="h3">Debug Information:</Header>
            <SpaceBetween size="s">
              <Box>
                <strong>Missing Keys:</strong> {debugInfo.missingKeys.length}
                {debugInfo.missingKeys.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {debugInfo.missingKeys.slice(0, 5).join(', ')}
                    {debugInfo.missingKeys.length > 5 && '...'}
                  </div>
                )}
              </Box>
              <Box>
                <strong>Errors:</strong> {debugInfo.errors.length}
                {debugInfo.errors.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Latest: {debugInfo.errors[debugInfo.errors.length - 1]?.message}
                  </div>
                )}
              </Box>
            </SpaceBetween>
          </Box>
        )}
      </SpaceBetween>
      
      {/* Translation Debugger (only in development) */}
      {process.env.NODE_ENV === 'development' && <TranslationDebugger />}
    </Container>
  );
};