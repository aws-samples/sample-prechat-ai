import {
  Alert,
  Box,
  Button,
  Container,
  Header,
  SpaceBetween,
  Spinner,
} from '@cloudscape-design/components'
import { QuestSteps } from '../../components'
import { useI18n } from '../../i18n'
import { useOnboardingStatus } from '../../hooks'

/**
 * `/onboarding` 어드민 랜딩 페이지.
 *
 * - useOnboardingStatus 훅으로 6개 Quest 상태 수급
 * - 6개 Quest 모두 QuestSteps로 렌더 (info-only는 info 아이콘으로 구분)
 * - 로딩 → Spinner, 에러 → Alert + 재시도, 성공 → QuestSteps 렌더
 * - 모든 user-visible 문자열은 i18n t() 경유 (onboarding.*)
 *
 * Note: ContentLayout은 `awsui_scrolling-background_*` 요소를 DOM에 주입해
 * 글로벌 그라디언트 배경과 충돌하므로 Container 패턴을 사용한다.
 */
export default function OnboardingLanding() {
  const { t } = useI18n()
  const { status, loading, error, refetch } = useOnboardingStatus()

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
          <QuestSteps quests={status.quests} />
        )}
      </SpaceBetween>
    </Container>
  )
}
