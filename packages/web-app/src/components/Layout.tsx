// nosemgrep
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppLayout,
  SideNavigation,
  SideNavigationProps
} from '@cloudscape-design/components';
import { PrivacyTermsModal } from './PrivacyTermsModal';
import { useI18n } from '../i18n';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Check if we're on an admin page
  const isAdminPage = location.pathname.startsWith('/admin');

  // Admin navigation items
  const navigationItems: SideNavigationProps.Item[] = [
    {
      type: 'section',
      text: t('admin_dashboard'),
      items: [
        {
          type: 'link',
          text: t('admin_prechat_sessions'),
          href: '/admin',
        },
        {
          type: 'link',
          text: t('admin_add_session'),
          href: '/admin/sessions/create'
        }
      ]
    },
    {
      type: 'section',
      text: t('campaigns'),
      items: [
        {
          type: 'link',
          text: t('campaign_list_title'),
          href: '/admin/campaigns',
        },
        {
          type: 'link',
          text: t('create_campaign'),
          href: '/admin/campaigns/create'
        },

      ]
    },
    {
      type: 'section',
      text: t('admin_prechat_agents'),
      items: [
        {
          type: 'link',
          text: t('admin_agents_list'),
          href: '/admin/agents',
        },
        {
          type: 'link',
          text: t('admin_create_agent'),
          href: '/admin/agents/create'
        }
      ]
    }
  ];

  const handleNavigate: SideNavigationProps['onFollow'] = (event) => {
    if (!event.detail.external) {
      event.preventDefault();
      navigate(event.detail.href);
    }
  };

  // Determine active href based on current location
  const getActiveHref = () => {
    const path = location.pathname;

    // Campaign routes
    if (path.startsWith('/admin/campaigns/create')) return '/admin/campaigns/create';
    if (path.startsWith('/admin/campaigns')) return '/admin/campaigns';

    // Session routes
    if (path.startsWith('/admin/sessions/create')) return '/admin/sessions/create';
    if (path === '/admin' || path.startsWith('/admin/sessions')) return '/admin';

    // Agent routes
    if (path.startsWith('/admin/agents/create')) return '/admin/agents/create';
    if (path.startsWith('/admin/agents')) return '/admin/agents';

    return '/admin';
  };

  const contentWithHeader = (
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

  // If it's an admin page, wrap with AppLayout and SideNavigation
  if (isAdminPage) {
    return (
      <div style={{ 
        background: 'var(--gradient-bg)', 
        minHeight: '100vh'
      }}>
        <AppLayout
          navigation={
            <SideNavigation
              header={{
                href: '/admin',
                text: t('admin_portal')
              }}
              items={navigationItems}
              activeHref={getActiveHref()}
              onFollow={handleNavigate}
            />
          }
          content={contentWithHeader}
          toolsHide
          navigationWidth={280}
        />
      </div>
    );
  }

  // For non-admin pages, return the regular layout
  return contentWithHeader;
};