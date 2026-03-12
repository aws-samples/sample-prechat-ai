import axios from 'axios';
import type {
  LegalConsentRequest,
  RoleArnSubmitRequest,
  AssessmentStatusResponse,
  ReportDownloadUrlResponse,
} from '../types';
import { API_BASE_URL } from '../config/api';

const assessmentApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// 에러 처리 유틸리티
const handleError = (error: unknown, context: string): never => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error || error.message;
    const statusCode = error.response?.status;
    console.error(`Assessment API Error [${context}]:`, {
      message,
      statusCode,
    });
    const enhanced = new Error(`${context}: ${message}`);
    (enhanced as any).statusCode = statusCode;
    throw enhanced;
  }
  throw new Error(`${context}: An unexpected error occurred`);
};

/**
 * 법적 규약 동의 제출
 */
export const submitLegalConsent = async (
  sessionId: string,
  pin: string
): Promise<{ assessmentStatus: string; legalConsentTimestamp: string }> => {
  try {
    const body: LegalConsentRequest = { agreed: true };
    const response = await assessmentApi.post(
      `/sessions/${sessionId}/assessment/legal-consent`,
      body,
      { headers: { 'x-pin-number': pin } }
    );
    return response.data;
  } catch (error) {
    return handleError(error, 'submitLegalConsent');
  }
};

/**
 * Role ARN 제출 및 스캔 시작
 */
export const submitRoleArn = async (
  sessionId: string,
  pin: string,
  roleArn: string
): Promise<{ assessmentStatus: string; codeBuildId: string }> => {
  try {
    const body: RoleArnSubmitRequest = { roleArn };
    const response = await assessmentApi.post(
      `/sessions/${sessionId}/assessment/role`,
      body,
      { headers: { 'x-pin-number': pin } }
    );
    return response.data;
  } catch (error) {
    return handleError(error, 'submitRoleArn');
  }
};

/**
 * Assessment 상태 조회
 */
export const getAssessmentStatus = async (
  sessionId: string,
  pin: string
): Promise<AssessmentStatusResponse> => {
  try {
    const response = await assessmentApi.get(
      `/sessions/${sessionId}/assessment/status`,
      { headers: { 'x-pin-number': pin } }
    );
    return response.data;
  } catch (error) {
    return handleError(error, 'getAssessmentStatus');
  }
};

/**
 * 레포트 다운로드 Pre-signed URL 조회
 */
export const getReportDownloadUrl = async (
  sessionId: string,
  pin: string
): Promise<ReportDownloadUrlResponse> => {
  try {
    const response = await assessmentApi.get(
      `/sessions/${sessionId}/assessment/report-url`,
      { headers: { 'x-pin-number': pin } }
    );
    return response.data;
  } catch (error) {
    return handleError(error, 'getReportDownloadUrl');
  }
};
