// nosemgrep
import { Box, Header } from '@cloudscape-design/components'
import { useI18n } from '../i18n'

export default function PageHeader() {
  const { t } = useI18n();

  return (
    <div
      style={{
        background: 'linear-gradient(-45deg, #232f3e, #ff9900, #146eb4, #232f3e)',
        backgroundSize: '400% 400%',
        padding: '16px',
        textAlign: 'center'
      }}
    >
      <Header variant="h1" className="typewriter fade-in-up">
        <span style={{ color: 'white' }}>{t('welcome.pageHeader.title')}</span>
      </Header>
      <Box fontSize="body-m" padding={{ top: 's' }} textAlign="left">
        <span style={{ color: 'white' }}>
          {t('welcome.pageHeader.description')}
        </span>
      </Box>
    </div>
  )
}