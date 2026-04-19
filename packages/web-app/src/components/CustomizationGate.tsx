import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useCustomizationContext } from '../contexts/CustomizationContext';
import { resolveRenderDecision } from '../utils/renderGating';

interface CustomizationGateProps {
  children: ReactNode;
}

/**
 * CustomizationGate — 커스터마이제이션 로드 완료 전까지 기본 UI 노출을 차단하는 게이트 컴포넌트
 *
 * - 고객 경로(customer): loadStatus가 idle/loading인 동안 neutral 상태 유지 (FODC 방지)
 * - 관리자 경로(admin): bypass — 게이팅 미적용, 즉시 자식 렌더
 * - 로드 완료(loaded/error): 자식 컴포넌트 그대로 렌더
 */
export const CustomizationGate: React.FC<CustomizationGateProps> = ({
  children,
}) => {
  const { pathname } = useLocation();
  const { loadStatus, hasCustomization } = useCustomizationContext();

  // /admin으로 시작하면 관리자 경로, 나머지는 고객 경로
  const pathKind = pathname.startsWith('/admin') ? 'admin' : 'customer';

  const decision = resolveRenderDecision({
    pathKind,
    loadStatus,
    hasCustomization,
  });

  // neutral 상태: 기본 UI 노출 없이 로딩 인디케이터만 표시
  if (decision === 'neutral') {
    return (
      <div className="customization-neutral">
        <StatusIndicator type="loading">Loading...</StatusIndicator>
      </div>
    );
  }

  // custom | default | error-fallback | bypass: 자식 컴포넌트 그대로 렌더
  return <>{children}</>;
};
