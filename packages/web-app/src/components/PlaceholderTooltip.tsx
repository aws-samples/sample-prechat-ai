// nosemgrep
import { useState } from 'react'
import {
  Button,
  Popover,
  Box,
  SpaceBetween,
  Header,
  ColumnLayout
} from '@cloudscape-design/components'

interface PlaceholderInfo {
  placeholder: string
  description: string
  example?: string
}

const PLACEHOLDER_DICTIONARY: PlaceholderInfo[] = [
  {
    placeholder: '{{sales_rep.name}}',
    description: '담당자 이름',
    example: '김영업'
  },
  {
    placeholder: '{{sales_rep.phone}}',
    description: '담당자 연락처',
    example: '010-1234-5678'
  },
  {
    placeholder: '{{sales_rep.email}}',
    description: '담당자 이메일',
    example: 'kim.sales@aws.com'
  },
  {
    placeholder: 'EOF',
    description: '대화 종료 토큰 (End of File)',
    example: 'EOF'
  }
]

export const PlaceholderTooltip: React.FC = () => {
  const [showPopover, setShowPopover] = useState(false)

  return (
    <Popover
      size="large"
      position="top"
      triggerType="custom"
      dismissButton={false}
      content={
        <Box padding="m">
          <SpaceBetween size="m">
            <Header variant="h3">플레이스홀더 사전</Header>
            <Box>
              에이전트 지침에서 사용할 수 있는 플레이스홀더들입니다. 
              고객과의 채팅에서 실제 값으로 자동 치환됩니다.
            </Box>
            <ColumnLayout columns={1} variant="text-grid">
              {PLACEHOLDER_DICTIONARY.map((item, index) => (
                <Box key={index}>
                  <Box fontWeight="bold" color="text-status-info">
                    {item.placeholder}
                  </Box>
                  <Box fontSize="body-s" margin={{ top: 'xxs', bottom: 'xs' }}>
                    {item.description}
                  </Box>
                  {item.example && (
                    <Box 
                      fontSize="body-s" 
                      color="text-status-inactive"
                      padding="xxs"
                    >
                      <code style={{ 
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--awsui-color-background-container-content)',
                        padding: '2px 4px',
                        borderRadius: '4px'
                      }}>
                        예시: {item.example}
                      </code>
                    </Box>
                  )}
                </Box>
              ))}
            </ColumnLayout>
          </SpaceBetween>
        </Box>
      }
    >
      <Button
        variant="icon"
        iconName="status-info"
        ariaLabel="플레이스홀더 사전 보기"
        onClick={() => setShowPopover(!showPopover)}
      />
    </Popover>
  )
}