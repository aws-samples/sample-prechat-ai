import { useState } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  ProgressBar,
  StatusIndicator,
  Box,
  Button,
  Alert,
  CopyToClipboard,
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import jsonHighlight from '@cloudscape-design/code-view/highlight/json';
import { useI18n } from '../i18n';
import type { AssessmentStatus } from '../types';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';
import { RoleArnInputForm } from './RoleArnInputForm';

interface ShipAssessmentGuideProps {
  sessionId: string;
  assessmentStatus: AssessmentStatus;
  onLegalConsent: () => Promise<void>;
  onRoleSubmit: (roleArn: string) => Promise<void>;
  onRetry: () => void;
}

// 상태별 단계 인덱스 매핑
const STATUS_STEP_MAP: Record<AssessmentStatus, number> = {
  pending: 0,
  legal_agreed: 1,
  role_submitted: 2,
  scanning: 2,
  completed: 3,
  failed: 2,
};

const TOTAL_STEPS = 4;

export const ShipAssessmentGuide: React.FC<ShipAssessmentGuideProps> = ({
  sessionId,
  assessmentStatus,
  onLegalConsent,
  onRoleSubmit,
  onRetry,
}) => {
  const { t } = useI18n();
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalLoading, setLegalLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const currentStep = STATUS_STEP_MAP[assessmentStatus] || 0;
  const progressPercent = Math.round(
    ((currentStep + (assessmentStatus === 'completed' ? 1 : 0)) / TOTAL_STEPS) * 100
  );

  const handleLegalAgree = async () => {
    setLegalLoading(true);
    try {
      await onLegalConsent();
      setShowLegalModal(false);
    } finally {
      setLegalLoading(false);
    }
  };

  const handleRoleSubmit = async (roleArn: string) => {
    setRoleLoading(true);
    try {
      await onRoleSubmit(roleArn);
    } finally {
      setRoleLoading(false);
    }
  };

  // Trust Policy JSON (CodeView + CopyToClipboard 공유)
  const trustPolicyJson = JSON.stringify({
    Effect: 'Allow',
    Principal: { AWS: '<PreChat CodeBuild Role ARN>' },
    Action: 'sts:AssumeRole',
    Condition: {
      StringEquals: {
        'sts:ExternalId': sessionId,
      },
    },
  }, null, 2);

  const steps = [
    { label: t('ship.guide.step1'), description: t('ship.guide.step1Desc') },
    { label: t('ship.guide.step2'), description: t('ship.guide.step2Desc') },
    { label: t('ship.guide.step3'), description: t('ship.guide.step3Desc') },
    { label: t('ship.guide.step4'), description: t('ship.guide.step4Desc') },
  ];

  return (
    <>
      <Container
        header={
          <Header variant="h2">
            {t('ship.guide.title')}
          </Header>
        }
      >
        <SpaceBetween size="l">
          {/* 진행률 표시 */}
          <ProgressBar
            value={progressPercent}
            label={t('ship.guide.progressLabel')}
            description={`${t('ship.guide.step')} ${currentStep + 1} / ${TOTAL_STEPS}`}
          />

          {/* 단계별 상태 표시 */}
          <SpaceBetween size="s">
            {steps.map((step, idx) => {
              let status: 'success' | 'in-progress' | 'pending' | 'error' = 'pending';
              if (idx < currentStep) status = 'success';
              else if (idx === currentStep && assessmentStatus === 'failed') status = 'error';
              else if (idx === currentStep) status = 'in-progress';

              return (
                <Box key={idx}>
                  <StatusIndicator
                    type={
                      status === 'success' ? 'success' :
                      status === 'in-progress' ? 'in-progress' :
                      status === 'error' ? 'error' :
                      'pending'
                    }
                  >
                    <strong>{step.label}</strong> — {step.description}
                  </StatusIndicator>
                </Box>
              );
            })}
          </SpaceBetween>

          {/* 현재 단계별 액션 영역 */}
          {assessmentStatus === 'pending' && (
            <Box>
              <Button variant="primary" onClick={() => setShowLegalModal(true)}>
                {t('ship.guide.startLegal')}
              </Button>
            </Box>
          )}

          {assessmentStatus === 'legal_agreed' && (
            <SpaceBetween size="m">
              <Alert type="info">
                <Box variant="p">
                  {t('ship.guide.roleSetupIntro')}
                </Box>
              </Alert>
              <CodeView
                content={trustPolicyJson}
                highlight={jsonHighlight}
                lineNumbers
                actions={
                  <CopyToClipboard
                    copyButtonAriaLabel="Copy Trust Policy"
                    copySuccessText="Copied!"
                    copyErrorText="Copy failed"
                    textToCopy={trustPolicyJson}
                    variant="icon"
                  />
                }
              />
              <Box variant="p" fontSize="body-s" color="text-status-inactive">
                ExternalId: <strong>{sessionId}</strong>
              </Box>
              <RoleArnInputForm
                onSubmit={handleRoleSubmit}
                loading={roleLoading}
              />
            </SpaceBetween>
          )}

          {(assessmentStatus === 'role_submitted' || assessmentStatus === 'scanning') && (
            <Alert type="info">
              {t('ship.guide.scanningMessage')}
            </Alert>
          )}

          {assessmentStatus === 'completed' && (
            <Alert type="success">
              {t('ship.guide.completedMessage')}
            </Alert>
          )}

          {assessmentStatus === 'failed' && (
            <SpaceBetween size="s">
              <Alert type="error">
                {t('ship.guide.failedMessage')}
              </Alert>
              <Button onClick={onRetry}>
                {t('ship.guide.retryButton')}
              </Button>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </Container>

      <LegalDisclaimerModal
        visible={showLegalModal}
        onDismiss={() => setShowLegalModal(false)}
        onAgree={handleLegalAgree}
        loading={legalLoading}
      />
    </>
  );
};
