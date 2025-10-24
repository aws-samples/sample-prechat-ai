import React, { useState } from 'react';
import { 
  Container, 
  Header, 
  Box, 
  SpaceBetween, 
  Button, 
  Alert,
  ColumnLayout,
  StatusIndicator
} from '@cloudscape-design/components';
import { useTranslationPerformance } from '../i18n';

export const TranslationPerformanceMonitor: React.FC = () => {
  const { metrics, isCollecting, collectMetrics } = useTranslationPerformance();
  const [showDetails, setShowDetails] = useState(false);

  if (!metrics) {
    return (
      <Container>
        <Header>Translation Performance Monitor</Header>
        <Box>Loading performance metrics...</Box>
      </Container>
    );
  }

  const { coverageStats, loadingStats } = metrics;
  const overallCoverage = (coverageStats.coverage.ko + coverageStats.coverage.en) / 2;

  return (
    <Container>
      <Header
        variant="h2"
        description="Monitor i18n system performance and translation coverage"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              onClick={collectMetrics} 
              loading={isCollecting}
              iconName="refresh"
            >
              Refresh
            </Button>

            <Button 
              onClick={() => setShowDetails(!showDetails)}
              iconName={showDetails ? "angle-up" : "angle-down"}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          </SpaceBetween>
        }
      >
        Translation Performance Monitor
      </Header>

      <SpaceBetween size="l">
        {/* Overall Status */}
        <Alert
          type={overallCoverage >= 95 ? "success" : overallCoverage >= 80 ? "warning" : "error"}
          header="Translation Coverage Status"
        >
          Overall coverage: {overallCoverage.toFixed(1)}% 
          ({coverageStats.translatedKeys.ko + coverageStats.translatedKeys.en} of {coverageStats.totalKeys * 2} translations)
        </Alert>

        {/* Performance Metrics */}
        <ColumnLayout columns={2} variant="text-grid">
          <Box>
            <Header variant="h3">Translation Coverage</Header>
            <SpaceBetween size="s">
              <div>
                <Box variant="awsui-key-label">Korean</Box>
                <StatusIndicator type={coverageStats.coverage.ko >= 95 ? "success" : "warning"}>
                  {coverageStats.coverage.ko.toFixed(1)}%
                </StatusIndicator>
              </div>
              <div>
                <Box variant="awsui-key-label">English</Box>
                <StatusIndicator type={coverageStats.coverage.en >= 95 ? "success" : "warning"}>
                  {coverageStats.coverage.en.toFixed(1)}%
                </StatusIndicator>
              </div>
            </SpaceBetween>
          </Box>

          <Box>
            <Header variant="h3">Loading Status</Header>
            <SpaceBetween size="s">
              <div>
                <Box variant="awsui-key-label">Loaded Locales</Box>
                <Box>{loadingStats.loadedLocales.join(', ') || 'None'}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Failed Locales</Box>
                <Box>{loadingStats.failedLocales.join(', ') || 'None'}</Box>
              </div>
            </SpaceBetween>
          </Box>
        </ColumnLayout>

        {/* Recommendations */}
        {coverageStats.recommendations.length > 0 && (
          <Alert type="info" header="Recommendations">
            <ul>
              {coverageStats.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Detailed Information */}
        {showDetails && (
          <Container>
            <Header variant="h3">Detailed Information</Header>
            <ColumnLayout columns={2}>
              <Box>
                <Header variant="h3">Missing Keys</Header>
                <SpaceBetween size="s">
                  {Object.entries(coverageStats.missingKeys).map(([locale, keys]) => (
                    <div key={locale}>
                      <Box variant="awsui-key-label">{locale.toUpperCase()}</Box>
                      <Box>
                        {keys.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {keys.slice(0, 10).map((key, index) => (
                              <li key={index} style={{ fontSize: '12px' }}>{key}</li>
                            ))}
                            {keys.length > 10 && (
                              <li style={{ fontSize: '12px', fontStyle: 'italic' }}>
                                ... and {keys.length - 10} more
                              </li>
                            )}
                          </ul>
                        ) : (
                          <StatusIndicator type="success">No missing keys</StatusIndicator>
                        )}
                      </Box>
                    </div>
                  ))}
                </SpaceBetween>
              </Box>

              <Box>
                <Header variant="h3">Performance Stats</Header>
                <SpaceBetween size="s">
                  <div>
                    <Box variant="awsui-key-label">Total Translation Keys</Box>
                    <Box>{coverageStats.totalKeys}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">Korean Keys</Box>
                    <Box>{coverageStats.translatedKeys.ko}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">English Keys</Box>
                    <Box>{coverageStats.translatedKeys.en}</Box>
                  </div>
                </SpaceBetween>
              </Box>
            </ColumnLayout>
          </Container>
        )}
      </SpaceBetween>
    </Container>
  );
};