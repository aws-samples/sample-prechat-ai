import { useState } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  StatusIndicator,
  Button,
  Link,
  Alert,
  Box,
} from '@cloudscape-design/components';
import { useI18n } from '../i18n';
import type { AssessmentStatus } from '../types';

interface ShipReportPanelProps {
  assessmentStatus: AssessmentStatus;
  onDownloadReport: () => Promise<string | null>;
  onRetry: () => void;
}

export const ShipReportPanel: React.FC<ShipReportPanelProps> = ({
  assessmentStatus,
  onDownloadReport,
  onRetry,
}) => {
  const { t } = useI18n();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const url = await onDownloadReport();
      if (url) {
        setDownloadUrl(url);
        window.open(url, '_blank');
      }
    } catch (e: any) {
      setError(e.message || t('ship.report.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  // Assessment가 시작되지 않은 경우 패널을 표시하지 않음
  if (!assessmentStatus || assessmentStatus === 'pending') {
    return null;
  }

  return (
    <Container
      header={
        <Header variant="h3">
          {t('ship.report.title')}
        </Header>
      }
    >
      <SpaceBetween size="m">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {(assessmentStatus === 'legal_agreed' ||
          assessmentStatus === 'role_submitted' ||
          assessmentStatus === 'scanning') && (
          <StatusIndicator type="in-progress">
            {t('ship.report.generating')}
          </StatusIndicator>
        )}

        {assessmentStatus === 'completed' && (
          <SpaceBetween size="s">
            <StatusIndicator type="success">
              {t('ship.report.ready')}
            </StatusIndicator>
            <Box>
              {downloadUrl ? (
                <Link href={downloadUrl} external>
                  {t('ship.report.downloadLink')}
                </Link>
              ) : (
                <Button
                  iconName="download"
                  onClick={handleDownload}
                  loading={downloading}
                >
                  {t('ship.report.downloadButton')}
                </Button>
              )}
            </Box>
          </SpaceBetween>
        )}

        {assessmentStatus === 'failed' && (
          <SpaceBetween size="s">
            <StatusIndicator type="error">
              {t('ship.report.failed')}
            </StatusIndicator>
            <Button onClick={onRetry}>
              {t('ship.report.retryButton')}
            </Button>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Container>
  );
};
