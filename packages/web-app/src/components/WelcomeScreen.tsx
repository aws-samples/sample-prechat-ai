// nosemgrep
import React from 'react';
import { useI18n } from '../i18n';
import { useCustomizationContext } from '../contexts/CustomizationContext';

export const WelcomeScreen: React.FC = () => {
  const { t } = useI18n();
  const { customizingSet, getLocalizedValue } = useCustomizationContext();

  const subtitle = getLocalizedValue(customizingSet.welcome.subtitle) || t('welcome.header.streamlineSubtitle');

  return (
    <p className="welcome-subtitle" style={{ margin: 0 }}>
      {subtitle}
    </p>
  );
};