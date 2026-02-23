// nosemgrep
import { useState } from 'react'
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Tabs,
  Header
} from '@cloudscape-design/components'
import ReactMarkdown from 'react-markdown'
import { useI18n } from '../i18n'

interface PrivacyTermsModalProps {
  visible: boolean
  onDismiss: () => void
  initialTab?: 'privacy' | 'terms'
}



export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  visible,
  onDismiss,
  initialTab = 'privacy'
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <Modal
      onDismiss={onDismiss}
      visible={visible}
      size="large"
      header={
        <Header variant="h1">
          {t('welcome.privacyTermsModal.title')}
        </Header>
      }
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            {t('welcome.privacyTermsModal.confirmButton')}
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Box>
          {t('welcome.privacyTermsModal.description')}
        </Box>
        
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId as 'privacy' | 'terms')}
          tabs={[
            {
              label: t('welcome.privacyTermsModal.privacyPolicyTab'),
              id: 'privacy',
              content: (
                <Box padding="s">
                  <div style={{ 
                    maxHeight: '60vh', 
                    overflowY: 'auto',
                    lineHeight: '1.6'
                  }}>
                    <ReactMarkdown>{t('welcome.privacyTermsModal.privacyPolicyContent')}</ReactMarkdown>
                  </div>
                </Box>
              )
            },
            {
              label: t('welcome.privacyTermsModal.termsOfServiceTab'),
              id: 'terms',
              content: (
                <Box padding="s">
                  <div style={{ 
                    maxHeight: '60vh', 
                    overflowY: 'auto',
                    lineHeight: '1.6'
                  }}>
                    <ReactMarkdown>{t('welcome.privacyTermsModal.termsOfServiceContent')}</ReactMarkdown>
                  </div>
                </Box>
              )
            }
          ]}
        />
      </SpaceBetween>
    </Modal>
  )
}