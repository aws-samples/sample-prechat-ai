import { SupportedLocale } from './types';

/**
 * Campaign form validation message utilities
 * Provides localized validation messages for campaign forms
 */

export interface CampaignValidationError {
  field: string;
  type: 'required' | 'invalid' | 'exists' | 'range' | 'format' | 'length';
  message: string;
  params?: Record<string, any>;
}

export interface CampaignFormData {
  campaignName?: string;
  campaignCode?: string;
  description?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  ownerId?: string;
  status?: string;
}

/**
 * Validate campaign form data and return localized error messages
 */
export function validateCampaignForm(
  data: CampaignFormData,
  locale: SupportedLocale,
  existingCodes: string[] = []
): CampaignValidationError[] {
  const errors: CampaignValidationError[] = [];
  
  // Campaign name validation
  if (!data.campaignName || data.campaignName.trim().length === 0) {
    errors.push({
      field: 'campaignName',
      type: 'required',
      message: getValidationMessage('campaign_name_required', locale)
    });
  } else if (data.campaignName.length > 100) {
    errors.push({
      field: 'campaignName',
      type: 'length',
      message: getValidationMessage('campaign_name_too_long', locale, { max: 100 })
    });
  }
  
  // Campaign code validation
  if (!data.campaignCode || data.campaignCode.trim().length === 0) {
    errors.push({
      field: 'campaignCode',
      type: 'required',
      message: getValidationMessage('campaign_code_required', locale)
    });
  } else {
    // Check format (alphanumeric and hyphens only)
    const codePattern = /^[a-zA-Z0-9-_]+$/;
    if (!codePattern.test(data.campaignCode)) {
      errors.push({
        field: 'campaignCode',
        type: 'format',
        message: getValidationMessage('campaign_code_invalid_format', locale)
      });
    }
    
    // Check length
    if (data.campaignCode.length > 50) {
      errors.push({
        field: 'campaignCode',
        type: 'length',
        message: getValidationMessage('campaign_code_too_long', locale, { max: 50 })
      });
    }
    
    // Check uniqueness
    if (existingCodes.includes(data.campaignCode)) {
      errors.push({
        field: 'campaignCode',
        type: 'exists',
        message: getValidationMessage('campaign_code_exists', locale)
      });
    }
  }
  
  // Description validation
  if (!data.description || data.description.trim().length === 0) {
    errors.push({
      field: 'description',
      type: 'required',
      message: getValidationMessage('campaign_description_required', locale)
    });
  } else if (data.description.length > 500) {
    errors.push({
      field: 'description',
      type: 'length',
      message: getValidationMessage('campaign_description_too_long', locale, { max: 500 })
    });
  }
  
  // Start date validation
  if (!data.startDate) {
    errors.push({
      field: 'startDate',
      type: 'required',
      message: getValidationMessage('start_date_required', locale)
    });
  } else {
    const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'startDate',
        type: 'invalid',
        message: getValidationMessage('start_date_invalid', locale)
      });
    }
  }
  
  // End date validation
  if (!data.endDate) {
    errors.push({
      field: 'endDate',
      type: 'required',
      message: getValidationMessage('end_date_required', locale)
    });
  } else {
    const endDate = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'endDate',
        type: 'invalid',
        message: getValidationMessage('end_date_invalid', locale)
      });
    }
    
    // Date range validation
    if (data.startDate) {
      const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        if (endDate.getTime() <= startDate.getTime()) {
          errors.push({
            field: 'endDate',
            type: 'range',
            message: getValidationMessage('invalid_date_range', locale)
          });
        }
      }
    }
  }
  
  // Owner validation
  if (!data.ownerId || data.ownerId.trim().length === 0) {
    errors.push({
      field: 'ownerId',
      type: 'required',
      message: getValidationMessage('owner_required', locale)
    });
  }
  
  return errors;
}

/**
 * Get localized validation message
 */
function getValidationMessage(
  key: string,
  locale: SupportedLocale,
  params?: Record<string, any>
): string {
  const messages = getValidationMessages(locale);
  let message = messages[key] || key;
  
  // Replace parameters in message
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
    });
  }
  
  return message;
}

/**
 * Get all validation messages for a locale
 */
function getValidationMessages(locale: SupportedLocale): Record<string, string> {
  if (locale === 'ko') {
    return {
      // Required field messages
      'campaign_name_required': '캠페인명은 필수입니다',
      'campaign_code_required': '캠페인 코드는 필수입니다',
      'campaign_description_required': '설명은 필수입니다',
      'start_date_required': '시작일은 필수입니다',
      'end_date_required': '종료일은 필수입니다',
      'owner_required': '캠페인 담당자는 필수입니다',
      
      // Format validation messages
      'campaign_code_invalid_format': '캠페인 코드는 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다',
      'start_date_invalid': '올바른 시작일을 입력해주세요',
      'end_date_invalid': '올바른 종료일을 입력해주세요',
      
      // Length validation messages
      'campaign_name_too_long': '캠페인명은 {{max}}자를 초과할 수 없습니다',
      'campaign_code_too_long': '캠페인 코드는 {{max}}자를 초과할 수 없습니다',
      'campaign_description_too_long': '설명은 {{max}}자를 초과할 수 없습니다',
      
      // Uniqueness validation messages
      'campaign_code_exists': '이미 존재하는 캠페인 코드입니다',
      
      // Range validation messages
      'invalid_date_range': '종료일은 시작일보다 늦어야 합니다',
      
      // Status validation messages
      'invalid_campaign_status': '올바른 캠페인 상태를 선택해주세요',
      
      // General validation messages
      'field_required': '이 필드는 필수입니다',
      'field_invalid': '올바른 값을 입력해주세요',
      'field_too_long': '입력값이 너무 깁니다',
      'field_too_short': '입력값이 너무 짧습니다'
    };
  }
  
  // English messages
  return {
    // Required field messages
    'campaign_name_required': 'Campaign name is required',
    'campaign_code_required': 'Campaign code is required',
    'campaign_description_required': 'Campaign description is required',
    'start_date_required': 'Start date is required',
    'end_date_required': 'End date is required',
    'owner_required': 'Campaign owner is required',
    
    // Format validation messages
    'campaign_code_invalid_format': 'Campaign code can only contain letters, numbers, hyphens (-), and underscores (_)',
    'start_date_invalid': 'Please enter a valid start date',
    'end_date_invalid': 'Please enter a valid end date',
    
    // Length validation messages
    'campaign_name_too_long': 'Campaign name cannot exceed {{max}} characters',
    'campaign_code_too_long': 'Campaign code cannot exceed {{max}} characters',
    'campaign_description_too_long': 'Description cannot exceed {{max}} characters',
    
    // Uniqueness validation messages
    'campaign_code_exists': 'Campaign code already exists',
    
    // Range validation messages
    'invalid_date_range': 'End date must be after start date',
    
    // Status validation messages
    'invalid_campaign_status': 'Please select a valid campaign status',
    
    // General validation messages
    'field_required': 'This field is required',
    'field_invalid': 'Please enter a valid value',
    'field_too_long': 'Input is too long',
    'field_too_short': 'Input is too short'
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(
  errors: CampaignValidationError[],
  locale: SupportedLocale
): string {
  if (errors.length === 0) {
    return '';
  }
  
  if (errors.length === 1) {
    return errors[0].message;
  }
  
  const header = locale === 'ko' 
    ? '다음 오류를 수정해주세요:'
    : 'Please fix the following errors:';
  
  const errorList = errors.map(error => `• ${error.message}`).join('\n');
  
  return `${header}\n${errorList}`;
}

/**
 * Get field-specific validation error
 */
export function getFieldValidationError(
  errors: CampaignValidationError[],
  fieldName: string
): string | undefined {
  const fieldError = errors.find(error => error.field === fieldName);
  return fieldError?.message;
}

/**
 * Check if form has validation errors
 */
export function hasValidationErrors(errors: CampaignValidationError[]): boolean {
  return errors.length > 0;
}

/**
 * Get validation error count by type
 */
export function getValidationErrorStats(errors: CampaignValidationError[]): Record<string, number> {
  const stats: Record<string, number> = {
    required: 0,
    invalid: 0,
    exists: 0,
    range: 0,
    format: 0,
    length: 0
  };
  
  errors.forEach(error => {
    stats[error.type] = (stats[error.type] || 0) + 1;
  });
  
  return stats;
}