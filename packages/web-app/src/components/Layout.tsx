// nosemgrep
import React, { useState } from 'react';
<<<<<<< HEAD
import { PrivacyTermsModal } from './PrivacyTermsM
=======
import { PrivacyTermsModal } from './PrivacyTermsModal';
>>>>>>> dev

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
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
            ✨ PreChat에 오신 것을 환영합니다!
          </h1>
          <p className="header-subtitle">
            AWS 만남전에 AI 에이전트와 대화하여 논의 주제와 기대사항을 공유해 주세요.
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
          <a href="#" onClick={handlePrivacyClick}>Privacy</a>
          <a href="#" onClick={handleTermsClick}>Terms</a>
          <a href="mailto:aws-prechat@amazon.com">Support</a>
        </div>
        <div className="footer-license">
          <div className="license-info">
<<<<<<< HEAD
            <img 
              src="https://licensebuttons.net/l/by-nc/4.0/88x31.png" 
              alt="Creative Commons License" 
              className="cc-logo"
            />
            <span className="license-text">
              This work is licensed under a{' '}
              <a 
                href="https://creativecommons.org/licenses/by/4.0/" 
=======
            <span className="license-text">
              This work is licensed under the{' '}
              <a 
                href="https://opensource.org/licenses/MIT-0" 
>>>>>>> dev
                target="_blank" 
                rel="noopener noreferrer"
                className="license-link"
              >
<<<<<<< HEAD
                Creative Commons Attribution 4.0 International License
=======
                MIT-0 License
>>>>>>> dev
              </a>
            </span>
          </div>
        </div>
        <div className="footer-copyright">
          <p className="copyright-text">Copyright (c) 2025 AWS PreChat</p>
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