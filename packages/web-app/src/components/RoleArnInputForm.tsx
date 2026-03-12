import { useState } from 'react';
import {
  FormField,
  Input,
  Button,
  SpaceBetween,
  Alert,
  Box,
} from '@cloudscape-design/components';
import { useI18n } from '../i18n';

const ROLE_ARN_REGEX = /^arn:aws:iam::\d{12}:role\/.+$/;

interface RoleArnInputFormProps {
  onSubmit: (roleArn: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export const RoleArnInputForm: React.FC<RoleArnInputFormProps> = ({
  onSubmit,
  loading = false,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [roleArn, setRoleArn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  const validate = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError(t('ship.roleArn.required'));
      return false;
    }
    if (!ROLE_ARN_REGEX.test(value.trim())) {
      setValidationError(t('ship.roleArn.invalidFormat'));
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSubmit = async () => {
    const trimmed = roleArn.trim();
    if (!validate(trimmed)) return;

    setError(null);
    try {
      await onSubmit(trimmed);
      // 제출 성공 후 입력 필드 초기화 (로컬 저장소에 저장하지 않음)
      setRoleArn('');
    } catch (e: any) {
      setError(e.message || t('ship.roleArn.submitError'));
    }
  };

  return (
    <SpaceBetween size="m">
      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <FormField
        label={t('ship.roleArn.label')}
        description={t('ship.roleArn.description')}
        errorText={validationError}
      >
        <Input
          value={roleArn}
          onChange={({ detail }) => {
            setRoleArn(detail.value);
            if (validationError) validate(detail.value);
          }}
          placeholder="arn:aws:iam::123456789012:role/ProwlerMemberRole"
          disabled={disabled || loading}
        />
      </FormField>

      <Box>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={loading}
          disabled={disabled || !roleArn.trim()}
        >
          {t('ship.roleArn.submitButton')}
        </Button>
      </Box>
    </SpaceBetween>
  );
};
