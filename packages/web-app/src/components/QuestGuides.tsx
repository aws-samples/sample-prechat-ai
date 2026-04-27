import { Alert, Box, Button, SpaceBetween } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { QuestState } from '../types';
import { mapQuestToPresentation } from '../utils';

interface QuestGuidesProps {
  quests: QuestState[];
}

/**
 * info-only Quest들을 Cloudscape Alert(type="info")로 렌더링하는 안내 섹션.
 *
 * - 체크 가능한 단계(Steps)와 분리하여 "안내성" 성격을 시각적으로 구분
 * - 각 Alert는 제목 + 설명(+guidance)으로 구성되며,
 *   안전한 ctaPath(`/admin`로 시작)가 있는 경우에만 action 버튼 노출
 * - currentCount가 있는 경우(session-analysis) 카운트를 함께 표시
 * - 모든 user-visible 텍스트는 i18n t() 호출 경유
 */
export function QuestGuides({ quests }: QuestGuidesProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <SpaceBetween size="s">
      {quests.map((quest) => {
        const { showCta, safeCtaPath } = mapQuestToPresentation(quest);
        const titleKey = `onboarding.quests.${quest.questId}.title`;
        const descriptionKey = `onboarding.quests.${quest.questId}.description`;
        const guidanceKey = `onboarding.quests.${quest.questId}.guidance`;
        const ctaLabelKey = `onboarding.quests.${quest.questId}.ctaLabel`;
        const countLabelKey = `onboarding.quests.${quest.questId}.countLabel`;

        const hasGuidance =
          quest.questId === 'customer-invite' || quest.questId === 'users';
        const hasCount = typeof quest.currentCount === 'number';

        return (
          <Alert
            key={quest.questId}
            type="info"
            header={t(titleKey)}
            action={
              showCta && safeCtaPath ? (
                <Button onClick={() => navigate(safeCtaPath)}>
                  {t(ctaLabelKey)}
                </Button>
              ) : undefined
            }
          >
            <SpaceBetween size="xxs">
              <Box variant="p">{t(descriptionKey)}</Box>
              {hasGuidance && (
                <Box variant="small" color="text-body-secondary">
                  {t(guidanceKey)}
                </Box>
              )}
              {hasCount && (
                <Box variant="small" color="text-body-secondary">
                  {t(countLabelKey)}: {quest.currentCount}
                </Box>
              )}
            </SpaceBetween>
          </Alert>
        );
      })}
    </SpaceBetween>
  );
}

export default QuestGuides;
