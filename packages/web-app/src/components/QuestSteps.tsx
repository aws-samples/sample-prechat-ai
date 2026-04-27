import { Steps } from '@cloudscape-design/components';
import { useI18n } from '../i18n';
import type { QuestState } from '../types';
import { QuestCard } from './QuestCard';
import { mapQuestToPresentation } from '../utils';

interface QuestStepsProps {
  quests: QuestState[];
}

type StepStatus =
  | 'success'
  | 'pending'
  | 'info'
  | 'error'
  | 'warning'
  | 'stopped'
  | 'in-progress'
  | 'loading';

function resolveStepStatus(status: QuestState['status']): StepStatus {
  switch (status) {
    case 'complete':
      return 'success';
    case 'incomplete':
      return 'pending';
    case 'info-only':
    default:
      return 'info';
  }
}

/**
 * 6개 Quest를 Cloudscape Steps로 렌더링.
 *
 * - 서버에서 받은 순서 그대로 표시
 *   (users → agents → campaigns → sessions → customer-invite → session-analysis)
 * - 각 Step의 details에 QuestCard를 포함
 * - statusIconAriaLabel은 presentation 매퍼에서 제공한 i18n key를 t()로 해석
 */
export function QuestSteps({ quests }: QuestStepsProps) {
  const { t } = useI18n();

  const steps = quests.map((quest) => {
    const { statusIconAriaLabel } = mapQuestToPresentation(quest);
    return {
      status: resolveStepStatus(quest.status),
      statusIconAriaLabel: t(statusIconAriaLabel),
      header: t(`onboarding.quests.${quest.questId}.title`),
      details: <QuestCard quest={quest} />,
    };
  });

  return <Steps steps={steps} ariaLabel={t('onboarding.stepsAriaLabel')} />;
}

export default QuestSteps;
