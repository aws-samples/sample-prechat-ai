// nosemgrep
import { useState } from 'react'
import {
  Box,
  SpaceBetween,
  Header,
  Tiles
} from '@cloudscape-design/components'

export interface ConsultationPurpose {
  value: string
  label: string
  description: string
  icon: string
}

export const CONSULTATION_PURPOSES: ConsultationPurpose[] = [
  {
    value: 'new-adoption',
    label: '신규 도입 문의',
    description: 'AWS 클라우드 서비스 신규 도입을 검토하고 계신가요?',
    icon: 'add-plus'
  },
  {
    value: 'migration',
    label: '마이그레이션 상담',
    description: '기존 시스템을 AWS로 이전하는 방안을 논의하고 싶으신가요?',
    icon: 'share'
  },
  {
    value: 'technical-support',
    label: '기술 지원 문의',
    description: '현재 사용 중인 AWS 서비스의 기술적 이슈나 개선 방안을 문의하시나요?',
    icon: 'settings'
  },
  {
    value: 'cost-optimization',
    label: '비용 최적화 상담',
    description: 'AWS 사용 비용을 최적화하고 효율성을 높이고 싶으신가요?',
    icon: 'calculator'
  },
  {
    value: 'partner-inquiry',
    label: '파트너 관련 문의',
    description: 'AWS 파트너 프로그램이나 파트너사와의 협업을 문의하시나요?',
    icon: 'contact'
  },
  {
    value: 'other',
    label: '기타 문의',
    description: '위 항목에 해당하지 않는 기타 문의사항이 있으신가요?',
    icon: 'ellipsis'
  }
]

interface ConsultationPurposeSelectorProps {
  onSelect: (purpose: ConsultationPurpose) => void
  selectedPurpose?: string
}

export default function ConsultationPurposeSelector({ 
  onSelect, 
  selectedPurpose 
}: ConsultationPurposeSelectorProps) {
  const [hoveredPurpose, setHoveredPurpose] = useState<string | null>(null)

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <Header
          variant="h2"
          description="상담을 시작하기 전에 문의 목적을 선택해 주세요. 선택하신 목적에 따라 더 적합한 상담을 제공해 드립니다."
        >
          상담 목적을 선택해 주세요
        </Header>

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