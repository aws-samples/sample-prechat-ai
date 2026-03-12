import { useState } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Header,
  Alert,
} from '@cloudscape-design/components';
import { useI18n } from '../i18n';

interface LegalDisclaimerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onAgree: () => Promise<void>;
  loading?: boolean;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({
  visible,
  onDismiss,
  onAgree,
  loading = false,
}) => {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    setError(null);
    try {
      await onAgree();
    } catch (e: any) {
      setError(
        e.message || t('ship.legal.errorGeneric')
      );
    }
  };

  return (
    <Modal
      onDismiss={onDismiss}
      visible={visible}
      size="large"
      header={
        <Header variant="h1">
          {t('ship.legal.title')}
        </Header>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              {t('ship.legal.disagreeButton')}
            </Button>
            <Button
              variant="primary"
              onClick={handleAgree}
              loading={loading}
            >
              {t('ship.legal.agreeButton')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box>
          <Header variant="h3">
            {t('ship.legal.scopeTitle')}
          </Header>
          <Box variant="p">
            {t('ship.legal.scopeContent')}
          </Box>
        </Box>

        <Box>
          <Header variant="h3">
            {t('ship.legal.dataTitle')}
          </Header>
          <Box variant="p">
            {t('ship.legal.dataContent')}
          </Box>
        </Box>

        <Box>
          <Header variant="h3">
            {t('ship.legal.disclaimerTitle')}
          </Header>
          <Box variant="p">
            {t('ship.legal.disclaimerContent')}
          </Box>
        </Box>
      </SpaceBetween>
    </Modal>
  );
};
