import React from 'react';
import { TopNavigation } from '@cloudscape-design/components';

export const AppTopNavigation: React.FC = () => {
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
          items: [
            { id: "profile", text: "프로필" },
            { id: "logout", text: "로그아웃" }
          ]
        }
      ]}
    />
  );
};