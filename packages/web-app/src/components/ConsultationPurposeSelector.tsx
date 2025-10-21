// nosemgrep
import { useState } from 'react'
import {
  Box,
  SpaceBetween,
  Header,
<<<<<<< HEAD
  Tiles
} from '@cloudscape-design/components'

export interface ConsultationPurpose {
  value: string
=======
  Button,
  Checkbox,
  Grid,
  Alert
} from '@cloudscape-design/components'

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
>>>>>>> dev
  label: string
  description: string
  icon: string
}

export const CONSULTATION_PURPOSES: ConsultationPurpose[] = [
  {
<<<<<<< HEAD
    value: 'new-adoption',
=======
    value: ConsultationPurposeEnum.NEW_ADOPTION,
>>>>>>> dev
    label: '신규 도입 문의',
    description: 'AWS 클라우드 서비스 신규 도입을 검토하고 계신가요?',
    icon: 'add-plus'
  },
  {
<<<<<<< HEAD
    value: 'migration',
=======
    value: ConsultationPurposeEnum.MIGRATION,
>>>>>>> dev
    label: '마이그레이션 상담',
    description: '기존 시스템을 AWS로 이전하는 방안을 논의하고 싶으신가요?',
    icon: 'share'
  },
  {
<<<<<<< HEAD
    value: 'technical-support',
=======
    value: ConsultationPurposeEnum.TECHNICAL_SUPPORT,
>>>>>>> dev
    label: '기술 지원 문의',
    description: '현재 사용 중인 AWS 서비스의 기술적 이슈나 개선 방안을 문의하시나요?',
    icon: 'settings'
  },
  {
<<<<<<< HEAD
    value: 'cost-optimization',
=======
    value: ConsultationPurposeEnum.COST_OPTIMIZATION,
>>>>>>> dev
    label: '비용 최적화 상담',
    description: 'AWS 사용 비용을 최적화하고 효율성을 높이고 싶으신가요?',
    icon: 'calculator'
  },
  {
<<<<<<< HEAD
    value: 'partner-inquiry',
=======
    value: ConsultationPurposeEnum.PARTNER_INQUIRY,
>>>>>>> dev
    label: '파트너 관련 문의',
    description: 'AWS 파트너 프로그램이나 파트너사와의 협업을 문의하시나요?',
    icon: 'contact'
  },
  {
<<<<<<< HEAD
    value: 'other',
=======
    value: ConsultationPurposeEnum.OTHER,
>>>>>>> dev
    label: '기타 문의',
    description: '위 항목에 해당하지 않는 기타 문의사항이 있으신가요?',
    icon: 'ellipsis'
  }
]

<<<<<<< HEAD
interface ConsultationPurposeSelectorProps {
  onSelect: (purpose: ConsultationPurpose) => void
  selectedPurpose?: string
=======
// Utility functions for purpose handling
export const formatPurposesForDisplay = (purposeString: string): string => {
  if (!purposeString) return ''
  
  const purposes = purposeString.split('|').filter(p => p.trim())
  const labels = purposes.map(purpose => {
    const found = CONSULTATION_PURPOSES.find(p => p.value === purpose.trim())
    return found ? found.label : purpose
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
>>>>>>> dev
}

export default function ConsultationPurposeSelector({ 
  onSelect, 
<<<<<<< HEAD
  selectedPurpose 
}: ConsultationPurposeSelectorProps) {
  const [hoveredPurpose, setHoveredPurpose] = useState<string | null>(null)
=======
  selectedPurposes = [],
  allowEdit = false,
  onCancel
}: ConsultationPurposeSelectorProps) {
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
                수정
              </Button>
            }
          >
            선택된 상담 목적
          </Header>
          
          <Grid gridDefinition={localSelectedPurposes.length <= 2 ? 
            [{ colspan: 6 }, { colspan: 6 }] : 
            [{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]
          }>
            {localSelectedPurposes.map(purposeValue => {
              const purpose = CONSULTATION_PURPOSES.find(p => p.value === purposeValue)
              return purpose ? (
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
                      {getIconForPurpose(purpose.icon)}
                    </span>
                    <Box fontSize="body-m" fontWeight="bold">
                      {purpose.label}
                    </Box>
                  </div>
                  <div style={{ fontSize: '12px', color: '#5f6b7a', lineHeight: '1.3' }}>
                    {purpose.description}
                  </div>
                </div>
              ) : null
            })}
          </Grid>
        </SpaceBetween>
      </Box>
    )
  }
>>>>>>> dev

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <Header
          variant="h2"
<<<<<<< HEAD
          description="상담을 시작하기 전에 문의 목적을 선택해 주세요. 선택하신 목적에 따라 더 적합한 상담을 제공해 드립니다."
=======
          description="상담을 시작하기 전에 문의 목적을 선택해 주세요. 여러 목적을 선택하실 수 있습니다."
>>>>>>> dev
        >
          상담 목적을 선택해 주세요
        </Header>

<<<<<<< HEAD
        <Tiles
          onChange={({ detail }) => {
            const purpose = CONSULTATION_PURPOSES.find(p => p.value === detail.value)
            if (purpose) {
              onSelect(purpose)
            }
          }}
          value={selectedPurpose || null}
          items={CONSULTATION_PURPOSES.map(purpose => ({
            label: purpose.label,
            description: purpose.description,
            value: purpose.value,
            image: (
              <div 
                style={{ textAlign: 'center', padding: '8px', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPurpose(purpose.value)}
                onMouseLeave={() => setHoveredPurpose(null)}
              >
                <div 
                  style={{ 
                    fontSize: '2rem',
                    color: hoveredPurpose === purpose.value ? '#0972d3' : '#5f6b7a',
                    transition: 'color 0.2s ease'
                  }}
                >
                  {getIconForPurpose(purpose.icon)}
                </div>
              </div>
            )
          }))}
        />
=======
        {localSelectedPurposes.length === 0 && (
          <Alert type="info">
            최소 하나 이상의 상담 목적을 선택해 주세요.
          </Alert>
        )}

        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
          {CONSULTATION_PURPOSES.map(purpose => (
            <div
              key={purpose.value}
              style={{
                border: localSelectedPurposes.includes(purpose.value) 
                  ? '2px solid #0972d3' 
                  : '1px solid #e9ebed',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                backgroundColor: localSelectedPurposes.includes(purpose.value) 
                  ? '#f0f8ff' 
                  : '#ffffff',
                transition: 'all 0.2s ease',
                minHeight: '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => handlePurposeToggle(purpose.value, !localSelectedPurposes.includes(purpose.value))}
              onMouseEnter={(e) => {
                if (!localSelectedPurposes.includes(purpose.value)) {
                  e.currentTarget.style.borderColor = '#879596'
                  e.currentTarget.style.backgroundColor = '#fafbfc'
                }
              }}
              onMouseLeave={(e) => {
                if (!localSelectedPurposes.includes(purpose.value)) {
                  e.currentTarget.style.borderColor = '#e9ebed'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                }
              }}
            >
              <Box>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>
                    {getIconForPurpose(purpose.icon)}
                  </span>
                  <Checkbox
                    checked={localSelectedPurposes.includes(purpose.value)}
                    onChange={() => {}} // Handled by parent div click
                  />
                </div>
                <Box fontSize="body-m" fontWeight="bold" margin={{ bottom: 'xs' }}>
                  {purpose.label}
                </Box>
              </Box>
              <div style={{ fontSize: '12px', color: '#5f6b7a', lineHeight: '1.3' }}>
                {purpose.description}
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
                취소
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={localSelectedPurposes.length === 0}
            >
              선택 완료 ({localSelectedPurposes.length}개 선택됨)
            </Button>
          </SpaceBetween>
        </Box>
>>>>>>> dev
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