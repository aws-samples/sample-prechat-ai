// nosemgrep
import React from 'react';
import { useI18n } from '../i18n';
import { useCustomizationContext } from '../contexts/CustomizationContext';

export const WelcomeScreen: React.FC = () => {
  const { t } = useI18n();
  const { customizingSet, getLocalizedValue } = useCustomizationContext();

  const subtitle = getLocalizedValue(customizingSet.welcome.subtitle) || t('welcome.header.streamlineSubtitle');
  const logoUrl = customizingSet.welcome.logoUrl;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      {logoUrl && (
        <div className="welcome-logo" style={{ flexShrink: 0 }}>
          <img
            src={logoUrl}
            alt={t('welcome.welcomeScreen.logoAlt')}
            style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
          />
        </div>
      )}
      <p className="welcome-subtitle" style={{ margin: 0 }}>
        {subtitle}
      </p>
    </div>
  );
};