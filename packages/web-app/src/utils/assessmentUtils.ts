import { AssessmentStatus } from '../types';

/**
 * Assessment 상태 전이 유효성 맵
 * 각 상태에서 전이 가능한 다음 상태 목록을 정의한다.
 */
const VALID_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  pending: ['legal_agreed'],
  legal_agreed: ['role_submitted'],
  role_submitted: ['scanning'],
  scanning: ['completed', 'failed'],
  completed: [],
  failed: ['role_submitted'],
};

/**
 * 상태 전이 유효성 검증
 * @param from 현재 상태
 * @param to 전이할 상태
 * @returns 유효한 전이이면 true
 */
export const isValidTransition = (
  from: AssessmentStatus,
  to: AssessmentStatus
): boolean => {
  return VALID_TRANSITIONS[from].includes(to);
};

/**
 * 상태별 UI 라벨 매핑
 * @param status Assessment 상태
 * @returns 상태에 대응하는 라벨 문자열
 */
export const getAssessmentStatusLabel = (
  status: AssessmentStatus
): string => {
  const labels: Record<AssessmentStatus, string> = {
    pending: 'Pending',
    legal_agreed: 'Legal Agreed',
    role_submitted: 'Role Submitted',
    scanning: 'Scanning',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status];
};

/**
 * 상태별 Cloudscape StatusIndicator 배지 타입 매핑
 * @param status Assessment 상태
 * @returns Cloudscape StatusIndicator type 값
 */
export const getAssessmentBadgeType = (
  status: AssessmentStatus
): 'pending' | 'in-progress' | 'success' | 'error' | 'info' => {
  const badgeTypes: Record<
    AssessmentStatus,
    'pending' | 'in-progress' | 'success' | 'error' | 'info'
  > = {
    pending: 'pending',
    legal_agreed: 'info',
    role_submitted: 'in-progress',
    scanning: 'in-progress',
    completed: 'success',
    failed: 'error',
  };
  return badgeTypes[status];
};

/**
 * S3 레포트 키 생성
 * @param sessionId 세션 ID
 * @returns S3 레포트 키 프리픽스
 */
export const generateReportS3Key = (sessionId: string): string => {
  return `assessments/${sessionId}/html/`;
};

/**
 * Role ARN 형식 검증
 * @param arn 검증할 ARN 문자열
 * @returns 유효한 Role ARN 형식이면 true
 */
export const isValidRoleArn = (arn: string): boolean => {
  const roleArnPattern = /^arn:aws:iam::\d{12}:role\/.+$/;
  return roleArnPattern.test(arn);
};
