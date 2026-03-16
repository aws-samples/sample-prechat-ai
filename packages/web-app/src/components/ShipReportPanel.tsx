import { useState } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  StatusIndicator,
  Button,
  Alert,
  Box,
  ColumnLayout,
} from '@cloudscape-design/components';
import { useI18n } from '../i18n';
import type { AssessmentStatus, ReportType } from '../types';

interface ShipReportPanelProps {
  assessmentStatus: AssessmentStatus;
  hasHtmlReport?: boolean;
  hasCsvReport?: boolean;
  onDownloadReport: (reportType: ReportType) => Promise<string | null>;
  onRetry: () => void;
}

export const ShipReportPanel: React.FC<ShipReportPanelProps> = ({
  assessmentStatus,
  hasHtmlReport = true,
  hasCsvReport = false,
  onDownloadReport,
  onRetry,
}) => {
  const { t } = useI18n();
  const [downloadingType, setDownloadingType] = useState<ReportType | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (reportType: ReportType) => {
    setDownloadingType(reportType);
    setError(null);
    try {
      const url = await onDownloadReport(reportType);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (e: any) {
      setError(e.message || t('ship.report.downloadError'));
    } finally {
      setDownloadingType(null);
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
          assessmentStatus === 'role_submitted') && (
          <StatusIndicator type="pending">
            {t('ship.report.waiting')}
          </StatusIndicator>
        )}

        {assessmentStatus === 'scanning' && (
          <StatusIndicator type="in-progress">
            {t('ship.report.generating')}
          </StatusIndicator>
        )}

        {assessmentStatus === 'completed' && (
          <SpaceBetween size="s">
            <StatusIndicator type="success">
              {t('ship.report.ready')}
            </StatusIndicator>
            <ColumnLayout columns={3}>
              {hasHtmlReport && (
                <Box>
                  <Button
                    iconName="download"
                    onClick={() => handleDownload('html')}
                    loading={downloadingType === 'html'}
                    fullWidth
                  >
                    Prowler HTML
                  </Button>
                </Box>
              )}
              {hasCsvReport && (
                <Box>
                  <Button
                    iconName="download"
                    onClick={() => handleDownload('csv')}
                    loading={downloadingType === 'csv'}
                    fullWidth
                  >
                    Prowler CSV
                  </Button>
                </Box>
              )}
              {hasHtmlReport && (
                <Box>
                  <Button
                    iconName="external"
                    onClick={() => handleDownload('dashboard')}
                    loading={downloadingType === 'dashboard'}
                    fullWidth
                  >
                    {t('ship.report.dashboard')}
                  </Button>
                </Box>
              )}
            </ColumnLayout>
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
