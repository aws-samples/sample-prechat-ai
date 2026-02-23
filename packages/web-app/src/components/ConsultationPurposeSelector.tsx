// nosemgrep
import { useState } from 'react'
import {
  Box,
  SpaceBetween,
  Header,
  Button,
  Checkbox,
  Grid,
  Alert
} from '@cloudscape-design/components'
import { useI18n } from '../i18n'

// ENUM for consultation purposes
export enum ConsultationPurposeEnum {
  NEW_ADOPTION = 'NEW_ADOPTION',
  MIGRATION = 'MIGRATION',
  TECHNICAL_SUPPORT = 'TECHNICAL_SUPPORT',
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  PARTNER_INQUIRY = 'PARTNER_INQUIRY',
  OTHER = 'OTHER'
}

export interface ConsultationPurpose {
  value: ConsultationPurposeEnum
  labelKey: string
  descriptionKey: string
  icon: string
}

export const CONSULTATION_PURPOSE_DEFS: ConsultationPurpose[] = [
  {
    value: ConsultationPurposeEnum.NEW_ADOPTION,
    labelKey: 'customer.purposeSelector.purposeNewAdoption',
    descriptionKey: 'customer.purposeSelector.purposeNewAdoptionDesc',
    icon: 'add-plus'
  },
  {
    value: ConsultationPurposeEnum.MIGRATION,
    labelKey: 'customer.purposeSelector.purposeMigration',
    descriptionKey: 'customer.purposeSelector.purposeMigrationDesc',
    icon: 'share'
  },
  {
    value: ConsultationPurposeEnum.TECHNICAL_SUPPORT,
    labelKey: 'customer.purposeSelector.purposeTechnicalSupport',
    descriptionKey: 'customer.purposeSelector.purposeTechnicalSupportDesc',
    icon: 'settings'
  },
  {
    value: ConsultationPurposeEnum.COST_OPTIMIZATION,
    labelKey: 'customer.purposeSelector.purposeCostOptimization',
    descriptionKey: 'customer.purposeSelector.purposeCostOptimizationDesc',
    icon: 'calculator'
  },
  {
    value: ConsultationPurposeEnum.PARTNER_INQUIRY,
    labelKey: 'customer.purposeSelector.purposePartnerInquiry',
    descriptionKey: 'customer.purposeSelector.purposePartnerInquiryDesc',
    icon: 'contact'
  },
  {
    value: ConsultationPurposeEnum.OTHER,
    labelKey: 'customer.purposeSelector.purposeOther',
    descriptionKey: 'customer.purposeSelector.purposeOtherDesc',
    icon: 'ellipsis'
  }
]

// Static label map for formatPurposesForDisplay (used by admin pages without i18n context)
const PURPOSE_STATIC_LABELS: Record<ConsultationPurposeEnum, string> = {
  [ConsultationPurposeEnum.NEW_ADOPTION]: '신규 도입 문의',
  [ConsultationPurposeEnum.MIGRATION]: '마이그레이션 상담',
  [ConsultationPurposeEnum.TECHNICAL_SUPPORT]: '기술 지원 문의',
  [ConsultationPurposeEnum.COST_OPTIMIZATION]: '비용 최적화 상담',
  [ConsultationPurposeEnum.PARTNER_INQUIRY]: '파트너 관련 문의',
  [ConsultationPurposeEnum.OTHER]: '기타 문의',
}

// Legacy static array kept for backward compatibility
export const CONSULTATION_PURPOSES = CONSULTATION_PURPOSE_DEFS.map(def => ({
  value: def.value,
  label: PURPOSE_STATIC_LABELS[def.value],
  description: def.descriptionKey,
  icon: def.icon
}))

// Utility functions for purpose handling
export const formatPurposesForDisplay = (purposeString: string): string => {
  if (!purposeString) return ''
  const purposes = purposeString.split('|').filter(p => p.trim())
  const labels = purposes.map(purpose => {
    const key = purpose.trim() as ConsultationPurposeEnum
    return PURPOSE_STATIC_LABELS[key] ?? purpose
  })
  return labels.join(', ')
}

export const formatPurposesForStorage = (purposes: ConsultationPurposeEnum[]): string => {
  return purposes.join('|')
}

export const parsePurposesFromStorage = (purposeString: string): ConsultationPurposeEnum[] => {
  if (!purposeString) return []
  
  return purposeString.split('|')
    .map(p => p.trim() as ConsultationPurposeEnum)
    .filter(p => Object.values(ConsultationPurposeEnum).includes(p))
}

interface ConsultationPurposeSelectorProps {
  onSelect: (purposes: ConsultationPurposeEnum[]) => void
  selectedPurposes?: ConsultationPurposeEnum[]
  allowEdit?: boolean
  onCancel?: () => void
}

export default function ConsultationPurposeSelector({ 
  onSelect, 
  selectedPurposes = [],
  allowEdit = false,
  onCancel
}: ConsultationPurposeSelectorProps) {
  const { t } = useI18n()
  const [localSelectedPurposes, setLocalSelectedPurposes] = useState<ConsultationPurposeEnum[]>(selectedPurposes)
  const [isEditing, setIsEditing] = useState(!allowEdit || selectedPurposes.length === 0)

  const handlePurposeToggle = (purpose: ConsultationPurposeEnum, checked: boolean) => {
    let newPurposes: ConsultationPurposeEnum[]
    
    if (checked) {
      newPurposes = [...localSelectedPurposes, purpose]
    } else {
      newPurposes = localSelectedPurposes.filter(p => p !== purpose)
    }
    
    setLocalSelectedPurposes(newPurposes)
  }

  const handleConfirm = () => {
    if (localSelectedPurposes.length === 0) return
    
    onSelect(localSelectedPurposes)
    setIsEditing(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  // If not editing and has selected purposes, show summary view
  if (!isEditing && localSelectedPurposes.length > 0) {
    return (
      <Box padding="l">
        <SpaceBetween size="l">
          <Header
            variant="h2"
            actions={
              <Button
                variant="normal"
                iconName="edit"
                onClick={handleEdit}
              >
                {t('customer.purposeSelector.editButton')}
              </Button>
            }
          >
            {t('customer.purposeSelector.selectedTitle')}
          </Header>
          
          <Grid gridDefinition={localSelectedPurposes.length <= 2 ? 
            [{ colspan: 6 }, { colspan: 6 }] : 
            [{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]
          }>
            {localSelectedPurposes.map(purposeValue => {
              const purposeDef = CONSULTATION_PURPOSE_DEFS.find(p => p.value === purposeValue)
              return purposeDef ? (
                <div
                  key={purposeValue}
                  style={{
                    border: '2px solid #0972d3',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f0f8ff',
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>
                      {getIconForPurpose(purposeDef.icon)}
                    </span>
                    <Box fontSize="body-m" fontWeight="bold">
                      {t(purposeDef.labelKey)}
                    </Box>
                  </div>
                  <div style={{ fontSize: '12px', color: '#5f6b7a', lineHeight: '1.3' }}>
                    {t(purposeDef.descriptionKey)}
                  </div>
                </div>
              ) : null
            })}
          </Grid>
        </SpaceBetween>
      </Box>
    )
  }

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <Header
          variant="h2"
          description={t('customer.purposeSelector.headerDescription')}
        >
          {t('customer.purposeSelector.headerTitle')}
        </Header>

        {localSelectedPurposes.length === 0 && (
          <Alert type="info">
            {t('customer.purposeSelector.alertMinimum')}
          </Alert>
        )}

        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
          {CONSULTATION_PURPOSE_DEFS.map(purposeDef => (
            <div
              key={purposeDef.value}
              style={{
                border: localSelectedPurposes.includes(purposeDef.value) 
                  ? '2px solid #0972d3' 
                  : '1px solid #e9ebed',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                backgroundColor: localSelectedPurposes.includes(purposeDef.value) 
                  ? '#f0f8ff' 
                  : '#ffffff',
                transition: 'all 0.2s ease',
                minHeight: '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => handlePurposeToggle(purposeDef.value, !localSelectedPurposes.includes(purposeDef.value))}
              onMouseEnter={(e) => {
                if (!localSelectedPurposes.includes(purposeDef.value)) {
                  e.currentTarget.style.borderColor = '#879596'
                  e.currentTarget.style.backgroundColor = '#fafbfc'
                }
              }}
              onMouseLeave={(e) => {
                if (!localSelectedPurposes.includes(purposeDef.value)) {
                  e.currentTarget.style.borderColor = '#e9ebed'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                }
              }}
            >
              <Box>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>
                    {getIconForPurpose(purposeDef.icon)}
                  </span>
                  <Checkbox
                    checked={localSelectedPurposes.includes(purposeDef.value)}
                    onChange={() => {}} // Handled by parent div click
                  />
                </div>
                <Box fontSize="body-m" fontWeight="bold" margin={{ bottom: 'xs' }}>
                  {t(purposeDef.labelKey)}
                </Box>
              </Box>
              <div style={{ fontSize: '12px', color: '#5f6b7a', lineHeight: '1.3' }}>
                {t(purposeDef.descriptionKey)}
              </div>
            </div>
          ))}
        </Grid>

        <Box textAlign="center">
          <SpaceBetween direction="horizontal" size="xs">
            {onCancel && (
              <Button
                variant="link"
                onClick={onCancel}
              >
                {t('customer.purposeSelector.cancelButton')}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={localSelectedPurposes.length === 0}
            >
              {t('customer.purposeSelector.confirmButton', { count: String(localSelectedPurposes.length) })}
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </Box>
  )
}

function getIconForPurpose(iconName: string): string {
  const iconMap: Record<string, string> = {
    'add-plus': '🚀',
    'share': '📦',
    'settings': '🔧',
    'calculator': '💰',
    'contact': '🤝',
    'ellipsis': '💬'
  }
  return iconMap[iconName] || '💬'
}
