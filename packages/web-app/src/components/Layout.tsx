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
import { useCustomizationContext } from '../contexts/CustomizationContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { customizingSet, getLocalizedValue } = useCustomizationContext();
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
      text: t('adminSessions.sideNav.sectionTitle'),
      items: [
        {
          type: 'link',
          text: t('adminSessions.sideNav.allSessions'),
          href: '/admin',
        },
        {
          type: 'link',
          text: t('adminSessions.sideNav.addSession'),
          href: '/admin/sessions/create'
        }
      ]
    },
    {
      type: 'section',
      text: t('adminSessions.sideNav.campaignsSectionTitle'),
      items: [
        {
          type: 'link',
          text: t('adminSessions.sideNav.allCampaigns'),
          href: '/admin/campaigns',
        },
        {
          type: 'link',
          text: t('adminSessions.sideNav.createCampaign'),
          href: '/admin/campaigns/create'
        },

      ]
    },
    {
      type: 'section',
      text: t('adminSessions.sideNav.agentsSectionTitle'),
      items: [
        {
          type: 'link',
          text: t('adminSessions.sideNav.allAgents'),
          href: '/admin/agents',
        },
        {
          type: 'link',
          text: t('adminSessions.sideNav.createAgent'),
          href: '/admin/agents/create'
        }
      ]
    },
    {
      type: 'section',
      text: t('adminTriggers.sideNav.sectionTitle'),
      items: [
        {
          type: 'link',
          text: t('adminTriggers.sideNav.manageTriggers'),
          href: '/admin/triggers',
        }
      ]
    },
    {
      type: 'section',
      text: t('adminCustomizing.sideNav.sectionTitle'),
      items: [
        {
          type: 'link',
          text: t('adminCustomizing.sideNav.manageCustomizing'),
          href: '/admin/customizing',
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

    // Trigger routes
    if (path.startsWith('/admin/triggers')) return '/admin/triggers';

    // Customizing routes
    if (path.startsWith('/admin/customizing')) return '/admin/customizing';

    return '/admin';
  };

  const customWelcomeTitle = getLocalizedValue(customizingSet.welcome.title);
  const customWelcomeSubtitle = getLocalizedValue(customizingSet.welcome.subtitle);
  const welcomeLogoUrl = customizingSet.welcome.logoUrl;

  const contentWithHeader = (
    <div className="app-container">
      <header className="header">
        <div className="header-content" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {welcomeLogoUrl && (
            <div style={{ flexShrink: 0 }}>
              <img
                src={welcomeLogoUrl}
                alt={t('welcome.welcomeScreen.logoAlt')}
                style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
              />
            </div>
          )}
          <div>
            <h1 className="welcome-title">
              {customWelcomeTitle || t('welcome.header.title')}
            </h1>
            <p className="header-subtitle">
              {customWelcomeSubtitle || t('welcome.header.subtitle')}
            </p>
          </div>
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <div className="footer-links">
          <a href="#" onClick={handlePrivacyClick}>{t('welcome.footer.privacyLink')}</a>
          <a href="#" onClick={handleTermsClick}>{t('welcome.footer.termsLink')}</a>
          <a href="mailto:aws-prechat@amazon.com">{t('welcome.footer.supportLink')}</a>
        </div>
        <div className="footer-license">
          <div className="license-info">
            <span className="license-text">
              {t('welcome.footer.licenseText')}{' '}
              <a
                href="https://opensource.org/licenses/MIT-0"
                target="_blank"
                rel="noopener noreferrer"
                className="license-link"
              >
                {t('welcome.footer.mitLicenseLink')}
              </a>
            </span>
          </div>
        </div>
        <div className="footer-copyright">
          <p className="copyright-text">{t('welcome.footer.copyrightText')}</p>
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
                text: t('adminSessions.sideNav.portalTitle')
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