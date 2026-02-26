// nosemgrep
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from '@cloudscape-design/components';
import { authService } from '../services/auth';
import { useI18n } from '../i18n';
import { SUPPORTED_LOCALES, SupportedLocale } from '../i18n/types';
import { useCustomizationContext } from '../contexts/CustomizationContext';

export const AppTopNavigation: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const { customizingSet, getLocalizedValue } = useCustomizationContext();

  // 헤더 커스터마이제이션 값
  const logoUrl = customizingSet.header.logoUrl;
  const logoLink = customizingSet.header.logoLink;
  const label = getLocalizedValue(customizingSet.header.label);
  const labelLink = customizingSet.header.labelLink;

  const handleLanguageClick = (event: any) => {
    if (event.detail && event.detail.id) {
      const selectedLocale = event.detail.id.replace('locale-', '') as SupportedLocale;
      if (selectedLocale === 'ko' || selectedLocale === 'en') {
        setLocale(selectedLocale);
      }
    }
  };

  const handleUserMenuClick = (event: any) => {
    if (event.detail.id === 'logout') {
      authService.signout();
      navigate('/login');
    }
  };

  // identity 구성: 커스터마이제이션 값 우선, 없으면 기본값
  const identity: {
    href: string;
    title: string;
    logo?: { src: string; alt: string };
  } = {
    href: labelLink || '#',
    title: label || 'PreChat',
    ...(logoUrl
      ? {
          logo: {
            src: logoUrl,
            alt: label || 'Logo',
          },
        }
      : {}),
  };

  // 로고 클릭 시 logoLink로 이동 (identity.href와 별도로 로고 자체 링크)
  if (logoUrl && logoLink) {
    identity.href = logoLink;
  }

  return (
    <TopNavigation
      identity={identity}
      utilities={[
        {
          type: "menu-dropdown",
          iconName: "settings",
          text: SUPPORTED_LOCALES.find(l => l.code === locale)?.nativeName || locale.toUpperCase(),
          ariaLabel: t('welcome.topNavigation.languageSelectorAriaLabel'),
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
          ariaLabel: t('welcome.topNavigation.userMenuAriaLabel'),
          onItemClick: handleUserMenuClick,
          items: [
            { id: "profile", text: t('welcome.topNavigation.profileMenuItem') },
            { id: "logout", text: t('welcome.topNavigation.logoutMenuItem') }
          ]
        }
      ]}
    />
  );
};