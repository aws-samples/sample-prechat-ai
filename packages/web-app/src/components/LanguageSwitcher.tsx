// nosemgrep
import React from 'react';
import { ButtonDropdown } from '@cloudscape-design/components';
import { useI18n } from '../i18n/useI18n';
import { SUPPORTED_LOCALES, SupportedLocale } from '../i18n/types';

export interface LanguageSwitcherProps {
  variant?: 'aws-console' | 'dropdown' | 'toggle';
  position?: 'header' | 'footer';
  showLabels?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'aws-console',
  showLabels = true
}) => {
  const { locale, setLocale } = useI18n();

  const currentLocaleConfig = SUPPORTED_LOCALES.find(l => l.code === locale);
  const currentLabel = showLabels 
    ? currentLocaleConfig?.nativeName || locale.toUpperCase()
    : locale.toUpperCase();

  const handleLanguageChange = (event: { detail: { id: string } }) => {
    const selectedLocale = event.detail.id as SupportedLocale;
    if (selectedLocale !== locale) {
      setLocale(selectedLocale);
    }
  };

  if (variant === 'aws-console') {
    // AWS Console style with pipe separator
    return (
      <div className="language-switcher-console" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {SUPPORTED_LOCALES.map((localeConfig, index) => (
          <React.Fragment key={localeConfig.code}>
            <button
              className={`language-option ${locale === localeConfig.code ? 'active' : ''}`}
              onClick={() => setLocale(localeConfig.code)}
              style={{
                background: 'none',
                border: 'none',
                color: locale === localeConfig.code ? '#0972d3' : '#5f6b7a',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: locale === localeConfig.code ? '600' : '400',
                padding: '4px 8px',
                textDecoration: 'none',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (locale !== localeConfig.code) {
                  e.currentTarget.style.color = '#0972d3';
                }
              }}
              onMouseLeave={(e) => {
                if (locale !== localeConfig.code) {
                  e.currentTarget.style.color = '#5f6b7a';
                }
              }}
            >
              {showLabels ? localeConfig.nativeName : localeConfig.code.toUpperCase()}
            </button>
            {index < SUPPORTED_LOCALES.length - 1 && (
              <span style={{ color: '#5f6b7a', fontSize: '14px' }}>|</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Dropdown variant using CloudScape ButtonDropdown
  return (
    <ButtonDropdown
      items={SUPPORTED_LOCALES.map(localeConfig => ({
        id: localeConfig.code,
        text: localeConfig.nativeName,
        disabled: locale === localeConfig.code
      }))}
      onItemClick={handleLanguageChange}
      variant="icon"
      ariaLabel="Change language"
    >
      {currentLabel}
    </ButtonDropdown>
  );
};