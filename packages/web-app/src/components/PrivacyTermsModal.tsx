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
          {t('privacy_terms_modal_title')}
        </Header>
      }
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            {t('modal_confirm_button')}
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Box>
          {t('privacy_terms_modal_description')}
        </Box>
        
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId as 'privacy' | 'terms')}
          tabs={[
            {
              label: t('privacy_policy_tab'),
              id: 'privacy',
              content: (
                <Box padding="s">
                  <div style={{ 
                    maxHeight: '60vh', 
                    overflowY: 'auto',
                    lineHeight: '1.6'
                  }}>
                    <ReactMarkdown>{t('privacy_policy_content')}</ReactMarkdown>
                  </div>
                </Box>
              )
            },
            {
              label: t('terms_of_service_tab'),
              id: 'terms',
              content: (
                <Box padding="s">
                  <div style={{ 
                    maxHeight: '60vh', 
                    overflowY: 'auto',
                    lineHeight: '1.6'
                  }}>
                    <ReactMarkdown>{t('terms_of_service_content')}</ReactMarkdown>
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