import type { ButtonProps } from '@cloudscape-design/components/button'

/**
 * 온보딩 Quest CTA 버튼에 사용하는 커스텀 스타일.
 *
 * 하얀 배경 + 짙은 테두리/텍스트의 중립적인 플랫 버튼.
 * Cloudscape 기본 primary(파랑) 대신 페이지 배경과 톤을 맞추어
 * 카드 안에서 조용히 CTA 역할만 수행한다.
 *
 * 적용 대상:
 * - QuestCard의 CTA (Step 상세 영역 기본 행동 유도)
 */
export const ONBOARDING_CTA_BUTTON_STYLE: ButtonProps.Style = {
  root: {
    background: {
      active: 'light-dark(rgb(235, 235, 240), rgb(45, 55, 70))',
      default: 'light-dark(rgb(255, 255, 255), rgb(30, 40, 55))',
      hover: 'light-dark(rgb(246, 246, 249), rgb(38, 48, 63))',
    },
    color: {
      active: 'light-dark(rgb(15, 20, 26), rgb(242, 243, 243))',
      default: 'light-dark(rgb(15, 20, 26), rgb(242, 243, 243))',
      hover: 'light-dark(rgb(15, 20, 26), rgb(242, 243, 243))',
    },
    borderColor: {
      active: 'light-dark(rgb(15, 20, 26), rgb(200, 200, 210))',
      default: 'light-dark(rgb(15, 20, 26), rgb(200, 200, 210))',
      hover: 'light-dark(rgb(15, 20, 26), rgb(220, 220, 230))',
    },
    borderRadius: '8px',
    borderWidth: '2px',
    paddingBlock: '8px',
    paddingInline: '20px',
  },
}
