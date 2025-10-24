// nosemgrep
import React from 'react';
import { useI18n } from '../i18n';

export const WelcomeScreen: React.FC = () => {
  const { t } = useI18n();

  return (
    <p className="welcome-subtitle">
      {t('korean_d15515d2')}
    </p>
  );
};