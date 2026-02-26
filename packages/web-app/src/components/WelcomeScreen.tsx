// nosemgrep
import React from 'react';
import { useI18n } from '../i18n';
import { useCustomizationContext } from '../contexts/CustomizationContext';

export const WelcomeScreen: React.FC = () => {
  const { t } = useI18n();
  const { customizingSet, getLocalizedValue } = useCustomizationContext();

  const subtitle = getLocalizedValue(customizingSet.welcome.subtitle) || t('welcome.header.streamlineSubtitle');
  const logoUrl = customizingSet.header.logoUrl;
  const logoLink = customizingSet.header.logoLink;

  return (
    <>
      {logoUrl && (
        <div className="welcome-logo" style={{ marginBottom: '1.5rem' }}>
          {logoLink ? (
            <a href={logoLink} target="_blank" rel="noopener noreferrer">
              <img
                src={logoUrl}
                alt={t('welcome.welcomeScreen.logoAlt')}
                style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
              />
            </a>
          ) : (
            <img
              src={logoUrl}
              alt={t('welcome.welcomeScreen.logoAlt')}
              style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
            />
          )}
        </div>
      )}
      <p className="welcome-subtitle">
        {subtitle}
      </p>
    </>
  );
};