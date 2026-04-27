import {
  Alert,
  Box,
  Button,
  Container,
  Header,
  SpaceBetween,
  Spinner,
} from '@cloudscape-design/components'
import { QuestGuides, QuestSteps } from '../../components'
import { useI18n } from '../../i18n'
import { useOnboardingStatus } from '../../hooks'

/**
 * `/onboarding` 어드민 랜딩 페이지.
 *
 * - useOnboardingStatus 훅으로 6개 Quest 상태 수급
 * - 체크 가능한 Quest(complete/incomplete)는 QuestSteps로, 안내성(info-only)
 *   Quest는 QuestGuides(Alert 리스트)로 분리 렌더링하여 역할을 시각적으로
 *   구분한다. 이는 info 아이콘만으로는 "안내" 의미 전달이 모호하다는
 *   사용자 피드백에 따른 구조 변경이다.
 * - 로딩 → Spinner, 에러 → Alert + 재시도, 성공 → 두 섹션 렌더
 * - 모든 user-visible 문자열은 i18n t() 경유 (onboarding.*)
 *
 * Note: 다른 admin 페이지와 일관성을 위해 Container 패턴 사용.
 * ContentLayout은 `awsui_scrolling-background_*` 요소를 DOM에 주입해
 * 글로벌 그라디언트 배경과 충돌하므로 사용하지 않는다.
 */
export default function OnboardingLanding() {
  const { t } = useI18n()
  const { status, loading, error, refetch } = useOnboardingStatus()

  const stepsQuests = status?.quests.filter((q) => q.status !== 'info-only') ?? []
  const guideQuests = status?.quests.filter((q) => q.status === 'info-only') ?? []

  return (
    <Container
      header={
        <Header variant="h1" description={t('onboarding.subtitle')}>
          {t('onboarding.title')}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {loading && (
          <Box textAlign="center" padding="l">
            <Spinner size="large" />
          </Box>
        )}

        {!loading && error && (
          <Alert
            type="error"
            header={t('onboarding.errorTitle')}
            action={
              <Button onClick={() => void refetch()}>
                {t('onboarding.retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!loading && !error && status && (
          <SpaceBetween size="xl">
            {stepsQuests.length > 0 && (
              <SpaceBetween size="s">
                <Header variant="h2">{t('onboarding.stepsTitle')}</Header>
                <QuestSteps quests={stepsQuests} />
              </SpaceBetween>
            )}
            {guideQuests.length > 0 && (
              <SpaceBetween size="s">
                <Header
                  variant="h2"
                  description={t('onboarding.guidesSubtitle')}
                >
                  {t('onboarding.guidesTitle')}
                </Header>
                <QuestGuides quests={guideQuests} />
              </SpaceBetween>
            )}
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Container>
  )
}
