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
  Tabs,
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import bashHighlight from '@cloudscape-design/code-view/highlight/sh';
import yamlHighlight from '@cloudscape-design/code-view/highlight/yaml';
import { useI18n } from '../i18n';
import type { AssessmentStatus } from '../types';
import { LegalDisclaimerModal } from './LegalDisclaimerModal';
import { RoleArnInputForm } from './RoleArnInputForm';

interface ShipAssessmentGuideProps {
  sessionId: string;
  assessmentStatus: AssessmentStatus;
  codeBuildRoleArn?: string;
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
  codeBuildRoleArn,
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

  const principalArn = codeBuildRoleArn || '<PRECHAT_CODEBUILD_ROLE_ARN>';

  // Option 1: CloudShell CLI 명령어
  const cliCommand = `# 1. ProwlerMemberRole 생성
aws iam create-role \\
  --role-name ProwlerMemberRole \\
  --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "${principalArn}" },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": { "sts:ExternalId": "${sessionId}" }
    }
  }]
}'

# 2. 보안 점검 권한 연결
aws iam attach-role-policy \\
  --role-name ProwlerMemberRole \\
  --policy-arn arn:aws:iam::aws:policy/SecurityAudit

aws iam attach-role-policy \\
  --role-name ProwlerMemberRole \\
  --policy-arn arn:aws:iam::aws:policy/job-function/ViewOnlyAccess

# 3. 출력된 Role ARN을 아래 입력란에 붙여넣으세요
aws iam get-role --role-name ProwlerMemberRole \\
  --query 'Role.Arn' --output text`;

  // Option 2: CloudFormation YAML 템플릿
  const cfnTemplate = `AWSTemplateFormatVersion: '2010-09-09'
Description: SHIP Assessment - ProwlerMemberRole for PreChat

Resources:
  ProwlerMemberRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: ProwlerMemberRole
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: '${principalArn}'
            Action: 'sts:AssumeRole'
            Condition:
              StringEquals:
                'sts:ExternalId': '${sessionId}'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/SecurityAudit
        - arn:aws:iam::aws:policy/job-function/ViewOnlyAccess

Outputs:
  ProwlerMemberRoleArn:
    Description: Role ARN to paste in PreChat
    Value: !GetAtt ProwlerMemberRole.Arn`;

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
              <Tabs
                tabs={[
                  {
                    label: 'CloudShell CLI',
                    id: 'cli',
                    content: (
                      <SpaceBetween size="s">
                        <Box variant="p" fontSize="body-s">
                          {t('ship.guide.cliGuide')}
                        </Box>
                        <CodeView
                          content={cliCommand}
                          highlight={bashHighlight}
                          lineNumbers
                          actions={
                            <CopyToClipboard
                              copyButtonAriaLabel="Copy CLI command"
                              copySuccessText="Copied!"
                              copyErrorText="Copy failed"
                              textToCopy={cliCommand}
                              variant="icon"
                            />
                          }
                        />
                      </SpaceBetween>
                    ),
                  },
                  {
                    label: 'CloudFormation',
                    id: 'cfn',
                    content: (
                      <SpaceBetween size="s">
                        <Box variant="p" fontSize="body-s">
                          {t('ship.guide.cfnGuide')}
                        </Box>
                        <CodeView
                          content={cfnTemplate}
                          highlight={yamlHighlight}
                          lineNumbers
                          actions={
                            <CopyToClipboard
                              copyButtonAriaLabel="Copy CFN template"
                              copySuccessText="Copied!"
                              copyErrorText="Copy failed"
                              textToCopy={cfnTemplate}
                              variant="icon"
                            />
                          }
                        />
                        <Button
                          iconName="download"
                          onClick={() => {
                            const blob = new Blob([cfnTemplate], { type: 'text/yaml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'prowler-member-role.yaml';
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          {t('ship.guide.downloadCfn')}
                        </Button>
                      </SpaceBetween>
                    ),
                  },
                ]}
              />
              <Box variant="p" fontSize="body-s" color="text-status-inactive">
                ExternalId: <strong>{sessionId}</strong>
              </Box>
              <Alert type="warning">
                {t('ship.guide.pasteArnHint')}
              </Alert>
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
