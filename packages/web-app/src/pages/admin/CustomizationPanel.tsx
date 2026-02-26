// 관리자 UI 커스터마이징 패널
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  FormField,
  Input,
  Textarea,
  Tabs,
  Flashbar,
  FlashbarProps,
  Box,
  ColumnLayout,
  Modal,
} from '@cloudscape-design/components';
import { useI18n } from '../../i18n';
import { useCustomization } from '../../hooks/useCustomization';
import {
  CustomizingSet,
  DEFAULT_CUSTOMIZING_SET,
  LocalizedString,
} from '../../types/customization';
import {
  validateImageExtension,
  validateFileSize,
  validateHexColor,
  validateHttpsUrl,
  MAX_LOGO_SIZE,
  MAX_LEGAL_DOC_SIZE,
  MAX_HEADER_LABEL_LENGTH,
  MAX_WELCOME_TITLE_LENGTH,
  MAX_WELCOME_SUBTITLE_LENGTH,
  MAX_SUPPORT_CHANNEL_LENGTH,
} from '../../utils/customizationValidation';

type SelectedLocale = 'ko' | 'en';

const CustomizationPanel: React.FC = () => {
  const { t } = useI18n();
  const {
    isLoading,
    error: apiError,
    fetchCustomization,
    saveCustomization,
    resetCustomization,
    uploadLogo,
    uploadLegalDoc,
  } = useCustomization();

  const [data, setData] = useState<CustomizingSet>(DEFAULT_CUSTOMIZING_SET);
  const [selectedLocale, setSelectedLocale] = useState<SelectedLocale>('ko');
  const [flashItems, setFlashItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    const load = async () => {
      const result = await fetchCustomization();
      if (result) {
        setData({ ...DEFAULT_CUSTOMIZING_SET, ...result });
      }
    };
    load();
  }, [fetchCustomization]);

  // 알림 헬퍼
  const showFlash = useCallback(
    (type: 'success' | 'error', messageKey: string) => {
      setFlashItems([
        {
          type,
          content: t(messageKey),
          dismissible: true,
          onDismiss: () => setFlashItems([]),
          id: `flash-${Date.now()}`,
        },
      ]);
    },
    [t]
  );

  // LocalizedString 필드 업데이트 헬퍼
  const updateLocalized = (
    path: 'header.label' | 'welcome.title' | 'welcome.subtitle',
    value: string
  ) => {
    setData((prev) => {
      const next = { ...prev };
      const [section, field] = path.split('.') as [keyof CustomizingSet, string];
      const sectionData = { ...(next[section] as Record<string, unknown>) };
      const current = (sectionData[field] as LocalizedString) || { ko: '', en: '' };
      sectionData[field] = { ...current, [selectedLocale]: value };
      (next as Record<string, unknown>)[section] = sectionData;
      return next as CustomizingSet;
    });
  };

  // 단일 값 필드 업데이트 헬퍼
  const updateField = (path: string, value: string | null) => {
    setData((prev) => {
      const next = { ...prev };
      const [section, field] = path.split('.') as [keyof CustomizingSet, string];
      const sectionData = { ...(next[section] as Record<string, unknown>) };
      sectionData[field] = value;
      (next as Record<string, unknown>)[section] = sectionData;
      return next as CustomizingSet;
    });
  };

  // 현재 로케일의 LocalizedString 값 가져오기
  const getLocalizedFieldValue = (value: LocalizedString): string => {
    if (!value) return '';
    return value[selectedLocale] || '';
  };

  // 검증
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // 환영 문구 로고 링크 검증
    if (data.welcome.logoLink && !validateHttpsUrl(data.welcome.logoLink)) {
      newErrors['welcome.logoLink'] = t('adminCustomizing.welcome.logo.errorInvalidUrl');
    }

    // 헤더 라벨 검증 (양쪽 로케일)
    if (data.header.label) {
      if (data.header.label.ko && data.header.label.ko.length > MAX_HEADER_LABEL_LENGTH) {
        newErrors['header.label.ko'] = t('adminCustomizing.header.label.errorTooLong');
      }
      if (data.header.label.en && data.header.label.en.length > MAX_HEADER_LABEL_LENGTH) {
        newErrors['header.label.en'] = t('adminCustomizing.header.label.errorTooLong');
      }
    }

    // 라벨 링크 검증
    if (data.header.labelLink && !validateHttpsUrl(data.header.labelLink)) {
      newErrors['header.labelLink'] = t('adminCustomizing.header.label.errorInvalidUrl');
    }

    // 웰컴 제목 검증
    if (data.welcome.title) {
      if (data.welcome.title.ko && data.welcome.title.ko.length > MAX_WELCOME_TITLE_LENGTH) {
        newErrors['welcome.title.ko'] = t('adminCustomizing.welcome.errorTitleTooLong');
      }
      if (data.welcome.title.en && data.welcome.title.en.length > MAX_WELCOME_TITLE_LENGTH) {
        newErrors['welcome.title.en'] = t('adminCustomizing.welcome.errorTitleTooLong');
      }
    }

    // 웰컴 부제목 검증
    if (data.welcome.subtitle) {
      if (data.welcome.subtitle.ko && data.welcome.subtitle.ko.length > MAX_WELCOME_SUBTITLE_LENGTH) {
        newErrors['welcome.subtitle.ko'] = t('adminCustomizing.welcome.errorSubtitleTooLong');
      }
      if (data.welcome.subtitle.en && data.welcome.subtitle.en.length > MAX_WELCOME_SUBTITLE_LENGTH) {
        newErrors['welcome.subtitle.en'] = t('adminCustomizing.welcome.errorSubtitleTooLong');
      }
    }

    // 배경 그라디언트 색상 검증
    if (data.background.startColor && !validateHexColor(data.background.startColor)) {
      newErrors['background.startColor'] = t('adminCustomizing.background.errorInvalidHex');
    }
    if (data.background.endColor && !validateHexColor(data.background.endColor)) {
      newErrors['background.endColor'] = t('adminCustomizing.background.errorInvalidHex');
    }

    // 지원 채널 검증
    if (data.legal.supportChannel && data.legal.supportChannel.length > MAX_SUPPORT_CHANNEL_LENGTH) {
      newErrors['legal.supportChannel'] = t('adminCustomizing.legal.errorSupportTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data, t]);

  // 로고 파일 업로드 핸들러
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageExtension(file.name)) {
      setErrors((prev) => ({ ...prev, 'welcome.logo': t('adminCustomizing.welcome.logo.errorInvalidExtension') }));
      return;
    }
    if (!validateFileSize(file.size, MAX_LOGO_SIZE)) {
      setErrors((prev) => ({ ...prev, 'welcome.logo': t('adminCustomizing.welcome.logo.errorFileTooLarge') }));
      return;
    }

    setErrors((prev) => { const n = { ...prev }; delete n['welcome.logo']; return n; });
    const url = await uploadLogo(file);
    if (url) {
      updateField('welcome.logoUrl', url);
      showFlash('success', 'adminCustomizing.notification.uploadSuccess');
    } else {
      showFlash('error', 'adminCustomizing.notification.uploadError');
    }
  };

  // 리갈 문서 업로드 핸들러
  const handleLegalUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'privacy' | 'service'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const errorKey = `legal.${docType}`;
    if (!file.name.toLowerCase().endsWith('.md')) {
      setErrors((prev) => ({ ...prev, [errorKey]: t('adminCustomizing.legal.errorInvalidExtension') }));
      return;
    }
    if (!validateFileSize(file.size, MAX_LEGAL_DOC_SIZE)) {
      setErrors((prev) => ({ ...prev, [errorKey]: t('adminCustomizing.legal.errorFileTooLarge') }));
      return;
    }

    setErrors((prev) => { const n = { ...prev }; delete n[errorKey]; return n; });
    const url = await uploadLegalDoc(file, docType, selectedLocale);
    if (url) {
      // LocalizedString 업데이트
      const fieldName = docType === 'privacy' ? 'privacyTermUrl' : 'serviceTermUrl';
      setData((prev) => {
        const currentVal = prev.legal[fieldName] || { ko: '', en: '' };
        return {
          ...prev,
          legal: {
            ...prev.legal,
            [fieldName]: { ...currentVal, [selectedLocale]: url },
          },
        };
      });
      showFlash('success', 'adminCustomizing.notification.uploadSuccess');
    } else {
      showFlash('error', 'adminCustomizing.notification.uploadError');
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    const updatedData = {
      ...data,
      meta: { ...data.meta, updatedAt: new Date().toISOString() },
    };
    const success = await saveCustomization(updatedData);
    setIsSaving(false);
    if (success) {
      setData(updatedData);
      showFlash('success', 'adminCustomizing.notification.saveSuccess');
    } else {
      showFlash('error', 'adminCustomizing.notification.saveError');
    }
  };

  // 리셋 핸들러
  const handleReset = async () => {
    setShowResetModal(false);
    setIsResetting(true);
    const result = await resetCustomization();
    setIsResetting(false);
    if (result) {
      setData(DEFAULT_CUSTOMIZING_SET);
      setErrors({});
      showFlash('success', 'adminCustomizing.notification.resetSuccess');
    } else {
      showFlash('error', 'adminCustomizing.notification.resetError');
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <SpaceBetween size="l">
      <Flashbar items={flashItems} />

      <Header
        variant="h1"
        description={t('adminCustomizing.panel.description')}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="normal"
              onClick={() => setShowResetModal(true)}
              loading={isResetting}
              disabled={isSaving || isLoading}
            >
              {t('adminCustomizing.actions.reset')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={isSaving || isLoading}
              disabled={hasErrors}
            >
              {isSaving ? t('adminCustomizing.actions.saving') : t('adminCustomizing.actions.save')}
            </Button>
          </SpaceBetween>
        }
      >
        {t('adminCustomizing.panel.title')}
      </Header>

      {/* 로케일 탭 */}
      <Tabs
        activeTabId={selectedLocale}
        onChange={({ detail }) => setSelectedLocale(detail.activeTabId as SelectedLocale)}
        tabs={[
          { label: t('adminCustomizing.panel.localeTabs.ko'), id: 'ko' },
          { label: t('adminCustomizing.panel.localeTabs.en'), id: 'en' },
        ]}
      />

      {/* 환영 문구 로고 섹션 */}
      <Container header={<Header variant="h2">{t('adminCustomizing.welcome.logo.sectionTitle')}</Header>}>
        <SpaceBetween size="m">
          <FormField
            label={t('adminCustomizing.welcome.logo.uploadLabel')}
            description={t('adminCustomizing.welcome.logo.uploadDescription')}
            errorText={errors['welcome.logo']}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={handleLogoUpload}
              style={{ marginBottom: '8px' }}
            />
            {data.welcome.logoUrl && (
              <Box margin={{ top: 's' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  {t('adminCustomizing.welcome.logo.currentPreview')}
                </div>
                <img
                  src={data.welcome.logoUrl}
                  alt="Logo preview"
                  style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                />
              </Box>
            )}
          </FormField>
          <FormField
            label={t('adminCustomizing.welcome.logo.linkLabel')}
            errorText={errors['welcome.logoLink']}
          >
            <Input
              value={data.welcome.logoLink || ''}
              placeholder={t('adminCustomizing.welcome.logo.linkPlaceholder')}
              onChange={({ detail }) => updateField('welcome.logoLink', detail.value || null)}
            />
          </FormField>
        </SpaceBetween>
      </Container>

      {/* 헤더 라벨 섹션 */}
      <Container header={<Header variant="h2">{t('adminCustomizing.header.label.sectionTitle')}</Header>}>
        <SpaceBetween size="m">
          <FormField
            label={t('adminCustomizing.header.label.textLabel')}
            errorText={errors[`header.label.${selectedLocale}`]}
          >
            <Input
              value={getLocalizedFieldValue(data.header.label)}
              placeholder={t('adminCustomizing.header.label.textPlaceholder')}
              onChange={({ detail }) => updateLocalized('header.label', detail.value)}
            />
          </FormField>
          <FormField
            label={t('adminCustomizing.header.label.linkLabel')}
            errorText={errors['header.labelLink']}
          >
            <Input
              value={data.header.labelLink || ''}
              placeholder={t('adminCustomizing.header.label.linkPlaceholder')}
              onChange={({ detail }) => updateField('header.labelLink', detail.value || null)}
            />
          </FormField>
        </SpaceBetween>
      </Container>

      {/* 웰컴 문구 섹션 */}
      <Container header={<Header variant="h2">{t('adminCustomizing.welcome.sectionTitle')}</Header>}>
        <SpaceBetween size="m">
          <FormField
            label={t('adminCustomizing.welcome.titleLabel')}
            errorText={errors[`welcome.title.${selectedLocale}`]}
          >
            <Input
              value={getLocalizedFieldValue(data.welcome.title)}
              placeholder={t('adminCustomizing.welcome.titlePlaceholder')}
              onChange={({ detail }) => updateLocalized('welcome.title', detail.value)}
            />
          </FormField>
          <FormField
            label={t('adminCustomizing.welcome.subtitleLabel')}
            errorText={errors[`welcome.subtitle.${selectedLocale}`]}
          >
            <Textarea
              value={getLocalizedFieldValue(data.welcome.subtitle)}
              placeholder={t('adminCustomizing.welcome.subtitlePlaceholder')}
              onChange={({ detail }) => updateLocalized('welcome.subtitle', detail.value)}
              rows={4}
            />
          </FormField>
        </SpaceBetween>
      </Container>

      {/* 배경 그라디언트 섹션 */}
      <Container header={<Header variant="h2">{t('adminCustomizing.background.sectionTitle')}</Header>}>
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField
              label={t('adminCustomizing.background.startColorLabel')}
              errorText={errors['background.startColor']}
            >
              <Input
                value={data.background.startColor || ''}
                placeholder={t('adminCustomizing.background.colorPlaceholder')}
                onChange={({ detail }) => updateField('background.startColor', detail.value || null)}
              />
            </FormField>
            <FormField label={t('adminCustomizing.background.startColorPickerLabel')}>
              <input
                type="color"
                value={data.background.startColor || '#ffeef8'}
                onChange={(e) => updateField('background.startColor', e.target.value)}
                style={{ width: '60px', height: '36px', border: 'none', cursor: 'pointer' }}
              />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2}>
            <FormField
              label={t('adminCustomizing.background.endColorLabel')}
              errorText={errors['background.endColor']}
            >
              <Input
                value={data.background.endColor || ''}
                placeholder={t('adminCustomizing.background.colorPlaceholder')}
                onChange={({ detail }) => updateField('background.endColor', detail.value || null)}
              />
            </FormField>
            <FormField label={t('adminCustomizing.background.endColorPickerLabel')}>
              <input
                type="color"
                value={data.background.endColor || '#e8f4fd'}
                onChange={(e) => updateField('background.endColor', e.target.value)}
                style={{ width: '60px', height: '36px', border: 'none', cursor: 'pointer' }}
              />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      {/* 리갈 문서 섹션 */}
      <Container header={<Header variant="h2">{t('adminCustomizing.legal.sectionTitle')}</Header>}>
        <SpaceBetween size="m">
          <FormField
            label={t('adminCustomizing.legal.privacyLabel')}
            errorText={errors['legal.privacy']}
          >
            <input
              type="file"
              accept=".md"
              onChange={(e) => handleLegalUpload(e, 'privacy')}
            />
            {data.legal.privacyTermUrl && getLocalizedFieldValue(data.legal.privacyTermUrl) && (
              <Box margin={{ top: 'xs' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {t('adminCustomizing.legal.currentFile')}: {selectedLocale}
                </span>
              </Box>
            )}
          </FormField>
          <FormField
            label={t('adminCustomizing.legal.serviceLabel')}
            errorText={errors['legal.service']}
          >
            <input
              type="file"
              accept=".md"
              onChange={(e) => handleLegalUpload(e, 'service')}
            />
            {data.legal.serviceTermUrl && getLocalizedFieldValue(data.legal.serviceTermUrl) && (
              <Box margin={{ top: 'xs' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {t('adminCustomizing.legal.currentFile')}: {selectedLocale}
                </span>
              </Box>
            )}
          </FormField>
          <FormField
            label={t('adminCustomizing.legal.supportLabel')}
            errorText={errors['legal.supportChannel']}
          >
            <Textarea
              value={data.legal.supportChannel || ''}
              placeholder={t('adminCustomizing.legal.supportPlaceholder')}
              onChange={({ detail }) => updateField('legal.supportChannel', detail.value || null)}
              rows={2}
            />
          </FormField>
        </SpaceBetween>
      </Container>

      {apiError && (
        <Flashbar
          items={[
            {
              type: 'error',
              content: apiError,
              dismissible: true,
              id: 'api-error',
            },
          ]}
        />
      )}

      {/* 리셋 확인 모달 */}
      <Modal
        visible={showResetModal}
        onDismiss={() => setShowResetModal(false)}
        header={t('adminCustomizing.resetModal.title')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowResetModal(false)}>
                {t('adminCustomizing.resetModal.cancelButton')}
              </Button>
              <Button variant="primary" onClick={handleReset}>
                {t('adminCustomizing.resetModal.confirmButton')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {t('adminCustomizing.resetModal.description')}
      </Modal>
    </SpaceBetween>
  );
};

export default CustomizationPanel;
