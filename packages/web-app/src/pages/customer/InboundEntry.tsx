// nosemgrep
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  Form,
  FormField,
  Input,
  Button,
  SpaceBetween,
  Alert,
  Box,
  Spinner,
} from '@cloudscape-design/components';
import { useI18n } from '../../i18n';
import { inboundApi } from '../../services/api';
import { storePrivacyConsentForSession } from '../../utils/sessionStorage';
import type { InboundCampaignInfo, CreateInboundSessionRequest } from '../../types';

type Step = 'loading' | 'pii' | 'error';

export default function InboundEntry() {
  const { campaignCode } = useParams<{ campaignCode: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>('loading');
  const [campaign, setCampaign] = useState<InboundCampaignInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    customerPhone: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!campaignCode) {
      setErrorMsg(t('inbound.error.noCampaignCode'));
      setStep('error');
      return;
    }
    loadCampaign();
  }, [campaignCode]);

  const loadCampaign = async () => {
    try {
      const info = await inboundApi.getCampaignInfo(campaignCode!);
      setCampaign(info);
      setStep('pii');
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404) {
        setErrorMsg(t('inbound.error.campaignNotFound'));
      } else if (status === 403) {
        setErrorMsg(t('inbound.error.campaignInactive'));
      } else {
        setErrorMsg(t('inbound.error.loadFailed'));
      }
      setStep('error');
    }
  };

  const validatePii = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.customerName.trim()) errors.customerName = t('inbound.pii.nameRequired');
    if (!formData.customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      errors.customerEmail = t('inbound.pii.emailInvalid');
    }
    if (!formData.customerCompany.trim()) errors.customerCompany = t('inbound.pii.companyRequired');
    // E.164 기반 검증: 포맷 문자(공백/-/() /+) 제거 후 숫자만 7~15자리
    const phoneDigits = formData.customerPhone.replace(/\D/g, '');
    if (!formData.customerPhone.trim() || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.customerPhone = t('inbound.pii.phoneInvalid');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePiiSubmit = async () => {
    if (!validatePii()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const req: CreateInboundSessionRequest = {
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerCompany: formData.customerCompany.trim(),
        customerPhone: formData.customerPhone.trim(),
      };
      const result = await inboundApi.createSession(campaignCode!, req);
      if (result.csrfToken) {
        localStorage.setItem(`csrf_${result.sessionId}`, result.csrfToken);
      }
      // 개인정보 동의를 sessionStorage에 저장
      storePrivacyConsentForSession(result.sessionId);
      navigate(`/customer/${result.sessionId}`);
    } catch (err: any) {
      handleSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitError = (err: any) => {
    const status = err?.statusCode;
    if (status === 403) {
      setErrorMsg(t('inbound.error.campaignInactive'));
    } else {
      setErrorMsg(t('inbound.error.createFailed'));
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (step === 'loading') {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (step === 'error') {
    return (
      <Container>
        <Alert type="error" header={t('inbound.error.title')}>{errorMsg}</Alert>
      </Container>
    );
  }

  const renderPiiCompanyPhone = () => (
    <>
      <FormField label={t('inbound.pii.companyLabel')} errorText={formErrors.customerCompany}>
        <Input
          value={formData.customerCompany}
          onChange={({ detail }) => updateField('customerCompany', detail.value)}
          placeholder={t('inbound.pii.companyPlaceholder')}
          invalid={!!formErrors.customerCompany}
        />
      </FormField>
      <FormField
        label={t('inbound.pii.phoneLabel')}
        description={t('inbound.pii.phoneDescription')}
        errorText={formErrors.customerPhone}
      >
        <Input
          value={formData.customerPhone}
          onChange={({ detail }) => updateField('customerPhone', detail.value)}
          placeholder={t('inbound.pii.phonePlaceholder')}
          invalid={!!formErrors.customerPhone}
        />
      </FormField>
    </>
  );

  const renderPiiForm = () => (
    <Form
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={handlePiiSubmit} loading={submitting}>
            {t('inbound.pii.submitButton')}
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="m">
        <FormField label={t('inbound.pii.nameLabel')} errorText={formErrors.customerName}>
          <Input
            value={formData.customerName}
            onChange={({ detail }) => updateField('customerName', detail.value)}
            placeholder={t('inbound.pii.namePlaceholder')}
            invalid={!!formErrors.customerName}
          />
        </FormField>
        <FormField label={t('inbound.pii.emailLabel')} errorText={formErrors.customerEmail}>
          <Input
            value={formData.customerEmail}
            onChange={({ detail }) => updateField('customerEmail', detail.value)}
            placeholder={t('inbound.pii.emailPlaceholder')}
            type="email"
            invalid={!!formErrors.customerEmail}
          />
        </FormField>
        {renderPiiCompanyPhone()}
      </SpaceBetween>
    </Form>
  );

  return (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h1" description={campaign?.description}>
          {campaign?.campaignName}
        </Header>
        {errorMsg && (
          <Alert type="error" dismissible onDismiss={() => setErrorMsg('')}>{errorMsg}</Alert>
        )}
        {step === 'pii' && renderPiiForm()}
      </SpaceBetween>
    </Container>
  );
}
