// nosemgrep
import { useState, useEffect } from 'react'
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
import { useCustomizationContext } from '../contexts/CustomizationContext'

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
  const { customizingSet, getLocalizedValue } = useCustomizationContext();
  const [activeTab, setActiveTab] = useState(initialTab)
  const [privacyContent, setPrivacyContent] = useState<string | null>(null)
  const [serviceContent, setServiceContent] = useState<string | null>(null)

  // 커스텀 리갈 문서 fetch
  useEffect(() => {
    if (!visible) return;

    const privacyUrl = getLocalizedValue(customizingSet.legal.privacyTermUrl);
    const serviceUrl = getLocalizedValue(customizingSet.legal.serviceTermUrl);

    if (privacyUrl) {
      fetch(privacyUrl, { cache: 'no-store' })
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => setPrivacyContent(text))
        .catch(() => setPrivacyContent(null));
    } else {
      setPrivacyContent(null);
    }

    if (serviceUrl) {
      fetch(serviceUrl, { cache: 'no-store' })
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => setServiceContent(text))
        .catch(() => setServiceContent(null));
    } else {
      setServiceContent(null);
    }
  }, [visible, customizingSet.legal, getLocalizedValue]);

  const supportChannel = customizingSet.legal.supportChannel;

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
                    <ReactMarkdown>{privacyContent || t('welcome.privacyTermsModal.privacyPolicyContent')}</ReactMarkdown>
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
                    <ReactMarkdown>{serviceContent || t('welcome.privacyTermsModal.termsOfServiceContent')}</ReactMarkdown>
                  </div>
                </Box>
              )
            }
          ]}
        />

        {supportChannel && (
          <Box>
            <strong>{t('adminCustomizing.legal.supportLabel')}:</strong>{' '}
            {supportChannel.startsWith('https://') ? (
              <a href={supportChannel} target="_blank" rel="noopener noreferrer">{supportChannel}</a>
            ) : (
              supportChannel
            )}
          </Box>
        )}
      </SpaceBetween>
    </Modal>
  )
}