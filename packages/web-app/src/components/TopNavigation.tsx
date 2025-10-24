// nosemgrep
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from '@cloudscape-design/components';
import { authService } from '../services/auth';
import { useI18n } from '../i18n';
import { SUPPORTED_LOCALES, SupportedLocale } from '../i18n/types';

export const AppTopNavigation: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();

  const handleLanguageClick = (event: any) => {
    console.log('Language click event:', event); // Debug log
    console.log('Event detail:', event.detail); // Debug log
    
    if (event.detail && event.detail.id) {
      const selectedLocale = event.detail.id.replace('locale-', '') as SupportedLocale;
      console.log('Setting locale to:', selectedLocale); // Debug log
      
      // Ensure it's a valid locale
      if (selectedLocale === 'ko' || selectedLocale === 'en') {
        setLocale(selectedLocale);
      } else {
        console.error('Invalid locale:', selectedLocale);
      }
    } else {
      console.error('No event detail or id found:', event);
    }
  };

  const handleUserMenuClick = (event: any) => {
    console.log('User menu click event:', event); // Debug log
    if (event.detail.id === 'logout') {
      authService.signout();
      navigate('/login');
    }
  };

  return (
    <TopNavigation
      identity={{
        href: "https://aws.amazon.com",
        title: "Amazon Web Services",
        logo: {
          src: "https://a0.awsstatic.com/libra-css/images/logos/aws_logo_smile_1200x630.png",
          alt: "Amazon Web Services"
        }
      }}
      utilities={[
        {
          type: "menu-dropdown",
          iconName: "settings",
          text: SUPPORTED_LOCALES.find(l => l.code === locale)?.nativeName || locale.toUpperCase(),
          ariaLabel: t('language_selector_aria_label'),
          onItemClick: handleLanguageClick,
          items: SUPPORTED_LOCALES.map(localeConfig => ({
            id: `locale-${localeConfig.code}`,
            text: localeConfig.nativeName,
            disabled: locale === localeConfig.code
          }))
        },
        {
          type: "menu-dropdown",
          iconName: "user-profile",
          ariaLabel: t('user_menu_aria_label'),
          onItemClick: handleUserMenuClick,
          items: [
            { id: "profile", text: t('profile_menu_item') },
            { id: "logout", text: t('logout_menu_item') }
          ]
        }
      ]}
    />
  );
};