import {
  Box,
  Button,
  Container,
  Header,
  SpaceBetween,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { QuestState } from '../types';
import { mapQuestToPresentation } from '../utils';

interface QuestCardProps {
  quest: QuestState;
}

/**
 * 단일 Quest의 세부 정보를 Cloudscape Container로 렌더링.
 *
 * - 제목, 설명, 가이드 텍스트(옵션), 상태 뱃지, CTA 버튼을 포함
 * - ctaPath가 안전한 내부 어드민 경로인 경우에만 CTA 버튼 노출
 * - CTA 클릭 시 react-router-dom의 navigate로 내부 라우팅만 수행
 * - 모든 user-visible 텍스트는 i18n t() 호출 경유
 */
export function QuestCard({ quest }: QuestCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { showCta, safeCtaPath, statusIconAriaLabel } =
    mapQuestToPresentation(quest);

  const titleKey = `onboarding.quests.${quest.questId}.title`;
  const descriptionKey = `onboarding.quests.${quest.questId}.description`;
  const ctaLabelKey = `onboarding.quests.${quest.questId}.ctaLabel`;
  // users, customer-invite 같이 info-only 텍스트 가이드가 있는 Quest 용
  const guidanceKey = `onboarding.quests.${quest.questId}.guidance`;

  const statusType: 'success' | 'pending' | 'info' =
    quest.status === 'complete'
      ? 'success'
      : quest.status === 'incomplete'
        ? 'pending'
        : 'info';

  const handleCtaClick = () => {
    if (safeCtaPath) navigate(safeCtaPath);
  };

  return (
    <Container
      header={
        <Header variant="h3" description={t(descriptionKey)}>
          {t(titleKey)}
        </Header>
      }
    >
      <SpaceBetween size="s">
        <StatusIndicator type={statusType}>
          {t(statusIconAriaLabel)}
        </StatusIndicator>
        {/* users, customer-invite 등 guidance 텍스트가 있는 경우 노출 */}
        {(quest.questId === 'users' ||
          quest.questId === 'customer-invite') && (
          <Box variant="p">{t(guidanceKey)}</Box>
        )}
        {quest.subCounts && (
          <Box variant="small" color="text-body-secondary">
            {Object.entries(quest.subCounts)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </Box>
        )}
        {showCta && (
          <Button variant="primary" onClick={handleCtaClick}>
            {t(ctaLabelKey)}
          </Button>
        )}
      </SpaceBetween>
    </Container>
  );
}

export default QuestCard;
