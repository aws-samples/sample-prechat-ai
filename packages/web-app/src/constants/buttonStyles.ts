import type { ButtonProps } from '@cloudscape-design/components/button'

/**
 * 온보딩 Quest CTA 버튼에 사용하는 커스텀 스타일.
 *
 * Cloudscape 기본 primary 버튼(파랑 둥근 pill)이 반복 노출 시 단조로워
 * 보인다는 피드백에 따라, 공식 Button Style API로 teal 계열의 flat
 * 버튼을 정의한다. Cloudscape 문서의 "With custom style" 예시를 기반으로
 * light/dark 모드 모두에서 대비를 유지한다.
 *
 * 적용 대상:
 * - QuestCard의 CTA (Step 상세 영역 기본 행동 유도)
 * - QuestGuides의 Alert action (info 안내의 바로가기)
 */
export const ONBOARDING_CTA_BUTTON_STYLE: ButtonProps.Style = {
  root: {
    background: {
      active: 'light-dark(rgb(0, 64, 77), rgb(0, 150, 177))',
      default: 'light-dark(rgb(4, 125, 149), rgb(0, 184, 217))',
      hover: 'light-dark(rgb(0, 85, 102), rgb(0, 167, 197))',
    },
    color: {
      active: 'light-dark(white, rgb(242, 243, 243))',
      default: 'light-dark(white, rgb(242, 243, 243))',
      hover: 'light-dark(white, rgb(242, 243, 243))',
    },
    borderRadius: '4px',
    borderWidth: '0px',
    paddingBlock: '10px',
    paddingInline: '16px',
  },
}
