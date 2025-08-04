import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigation } from '@cloudscape-design/components';
import { authService } from '../services/auth';

export const AppTopNavigation: React.FC = () => {
  const navigate = useNavigate();

  const handleUtilityClick = (event: any) => {
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
          type: "button",
          iconName: "search",
          ariaLabel: "검색"
        },
        {
          type: "menu-dropdown",
          iconName: "user-profile",
          ariaLabel: "사용자 메뉴",
          onItemClick: handleUtilityClick,
          items: [
            { id: "profile", text: "프로필" },
            { id: "logout", text: "로그아웃" }
          ]
        }
      ]}
    />
  );
};