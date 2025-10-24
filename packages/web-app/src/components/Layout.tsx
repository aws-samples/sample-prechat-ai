// nosemgrep
import React, { useState } from 'react';
import { PrivacyTermsModal } from './PrivacyTermsModal';

import { useI18n } from '../i18n';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useI18n();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [modalTab, setModalTab] = useState<'privacy' | 'terms'>('privacy');

  const handlePrivacyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setModalTab('privacy');
    setShowPrivacyModal(true);
  };

  const handleTermsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setModalTab('terms');
    setShowPrivacyModal(true);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1 className="welcome-title">
            {t('welcome_title')}
          </h1>
          <p className="header-subtitle">
            {t('header_subtitle')}
          </p>
        </div>
        <div className="header-controls">
          <span>🌙</span>
        </div>
      </header>
      
      <main className="main-content">
        {children}
      </main>
      
      <footer className="footer">
        <div className="footer-links">
          <a href="#" onClick={handlePrivacyClick}>{t('privacy_link')}</a>
          <a href="#" onClick={handleTermsClick}>{t('terms_link')}</a>
          <a href="mailto:aws-prechat@amazon.com">{t('support_link')}</a>
        </div>
        <div className="footer-license">
          <div className="license-info">
            <span className="license-text">
              {t('license_text')}{' '}
              <a 
                href="https://opensource.org/licenses/MIT-0" 
                target="_blank" 
                rel="noopener noreferrer"
                className="license-link"
              >
                {t('mit_license_link')}
              </a>
            </span>
          </div>
        </div>
        <div className="footer-copyright">
          <p className="copyright-text">{t('copyright_text')}</p>
        </div>
      </footer>

      <PrivacyTermsModal
        visible={showPrivacyModal}
        onDismiss={() => setShowPrivacyModal(false)}
        initialTab={modalTab}
      />
    </div>
  );
};