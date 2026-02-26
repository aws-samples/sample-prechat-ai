// UI Customization 검증 유틸리티
// 모든 검증 함수는 순수 함수로 구현

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** 이미지 파일 확장자 검증 (대소문자 무관) */
export const validateImageExtension = (filename: string): boolean => {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return false;
  const ext = filename.toLowerCase().slice(dotIndex);
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
};

/** 마크다운 파일 확장자 검증 */
export const validateMarkdownExtension = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.md');
};

/** 파일 크기 검증 */
export const validateFileSize = (sizeInBytes: number, maxSizeInBytes: number): boolean => {
  return sizeInBytes > 0 && sizeInBytes <= maxSizeInBytes;
};

/** HEX 색상 코드 검증 (#RRGGBB) */
export const validateHexColor = (color: string): boolean => {
  return HEX_COLOR_PATTERN.test(color);
};

/** HTTPS URL 검증 */
export const validateHttpsUrl = (url: string): boolean => {
  return url.startsWith('https://') && url.length > 8;
};

/** 텍스트 길이 검증 (비공백 + 최대 길이) */
export const validateTextLength = (text: string, maxLength: number): boolean => {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
};

// 파일 크기 상수
export const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_LEGAL_DOC_SIZE = 1 * 1024 * 1024; // 1MB
export const MAX_HEADER_LABEL_LENGTH = 100;
export const MAX_WELCOME_TITLE_LENGTH = 100;
export const MAX_WELCOME_SUBTITLE_LENGTH = 500;
export const MAX_SUPPORT_CHANNEL_LENGTH = 500;
