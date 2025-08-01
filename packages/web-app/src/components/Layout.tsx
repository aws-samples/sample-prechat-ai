import React, { useState } from 'react';
import { PrivacyTermsModal } from './PrivacyTermsModal';

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
          <a href="#">Support</a>
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