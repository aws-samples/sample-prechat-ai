import { describe, it, expect } from 'vitest';
import { 
  formatCampaignDate, 
  formatCampaignDateRange, 
  formatCampaignDuration,
  formatCampaignStatus,
  formatCampaignMetric,
  validateCampaignDateRange
} from '../dateFormatting';
import { 
  validateCampaignForm,
  formatValidationErrors,
  getFieldValidationError,
  hasValidationErrors
} from '../campaignValidation';

describe('Campaign i18n Functionality', () => {
  describe('Date Formatting', () => {
    it('should format campaign dates correctly for Korean locale', () => {
      const date = new Date('2024-01-15');
      const formatted = formatCampaignDate(date, { locale: 'ko' });
      expect(formatted).toContain('2024');
      expect(formatted).toContain('1');
      expect(formatted).toContain('15');
    });

    it('should format campaign dates correctly for English locale', () => {
      const date = new Date('2024-01-15');
      const formatted = formatCampaignDate(date, { locale: 'en' });
      expect(formatted).toContain('2024');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });

    it('should format date ranges correctly', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-02-15');
      
      const koRange = formatCampaignDateRange(start, end, 'ko');
      const enRange = formatCampaignDateRange(start, end, 'en');
      
      expect(koRange).toContain('~');
      expect(enRange).toContain('-');
    });

    it('should calculate campaign duration correctly', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-01-22'); // 7 days = 1 week
      
      const koDuration = formatCampaignDuration(start, end, 'ko');
      const enDuration = formatCampaignDuration(start, end, 'en');
      
      // 7 days should be formatted as 1 week
      expect(koDuration).toContain('1');
      expect(enDuration).toContain('1');
      expect(koDuration).toContain('주');
      expect(enDuration).toContain('Week');
    });

    it('should validate date ranges correctly', () => {
      const validStart = new Date('2024-01-15');
      const validEnd = new Date('2024-02-15');
      const invalidEnd = new Date('2024-01-10');
      
      const validResult = validateCampaignDateRange(validStart, validEnd);
      const invalidResult = validateCampaignDateRange(validStart, invalidEnd);
      
      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('Status Formatting', () => {
    it('should format campaign status correctly for Korean locale', () => {
      expect(formatCampaignStatus('active', 'ko')).toBe('활성');
      expect(formatCampaignStatus('completed', 'ko')).toBe('완료');
      expect(formatCampaignStatus('paused', 'ko')).toBe('일시정지');
      expect(formatCampaignStatus('cancelled', 'ko')).toBe('취소됨');
    });

    it('should format campaign status correctly for English locale', () => {
      expect(formatCampaignStatus('active', 'en')).toBe('Active');
      expect(formatCampaignStatus('completed', 'en')).toBe('Completed');
      expect(formatCampaignStatus('paused', 'en')).toBe('Paused');
      expect(formatCampaignStatus('cancelled', 'en')).toBe('Cancelled');
    });
  });

  describe('Metric Formatting', () => {
    it('should format campaign metrics correctly', () => {
      expect(formatCampaignMetric(1234, 'count', 'ko')).toBe('1,234');
      expect(formatCampaignMetric(1234, 'count', 'en')).toBe('1,234');
      
      expect(formatCampaignMetric(75, 'percentage', 'ko')).toContain('75');
      expect(formatCampaignMetric(75, 'percentage', 'en')).toContain('75');
      
      expect(formatCampaignMetric(125, 'duration', 'ko')).toContain('2');
      expect(formatCampaignMetric(125, 'duration', 'en')).toContain('2');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields correctly', () => {
      const invalidData = {
        campaignName: '',
        campaignCode: '',
        description: '',
        startDate: undefined,
        endDate: undefined,
        ownerId: ''
      };
      
      const koErrors = validateCampaignForm(invalidData, 'ko');
      const enErrors = validateCampaignForm(invalidData, 'en');
      
      expect(koErrors.length).toBeGreaterThan(0);
      expect(enErrors.length).toBeGreaterThan(0);
      expect(hasValidationErrors(koErrors)).toBe(true);
      expect(hasValidationErrors(enErrors)).toBe(true);
    });

    it('should validate date ranges correctly', () => {
      const invalidDateData = {
        campaignName: 'Test Campaign',
        campaignCode: 'TEST-001',
        description: 'Test Description',
        startDate: new Date('2024-02-15'),
        endDate: new Date('2024-01-15'), // End before start
        ownerId: 'user-123'
      };
      
      const koErrors = validateCampaignForm(invalidDateData, 'ko');
      const enErrors = validateCampaignForm(invalidDateData, 'en');
      
      const koDateError = getFieldValidationError(koErrors, 'endDate');
      const enDateError = getFieldValidationError(enErrors, 'endDate');
      
      expect(koDateError).toBeDefined();
      expect(enDateError).toBeDefined();
      expect(koDateError).toContain('시작일');
      expect(enDateError).toContain('start date');
    });

    it('should validate campaign code format correctly', () => {
      const invalidCodeData = {
        campaignName: 'Test Campaign',
        campaignCode: 'TEST@001!', // Invalid characters
        description: 'Test Description',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
        ownerId: 'user-123'
      };
      
      const koErrors = validateCampaignForm(invalidCodeData, 'ko');
      const enErrors = validateCampaignForm(invalidCodeData, 'en');
      
      const koCodeError = getFieldValidationError(koErrors, 'campaignCode');
      const enCodeError = getFieldValidationError(enErrors, 'campaignCode');
      
      expect(koCodeError).toBeDefined();
      expect(enCodeError).toBeDefined();
    });

    it('should format validation errors correctly', () => {
      const errors = [
        { field: 'campaignName', type: 'required' as const, message: 'Campaign name is required' },
        { field: 'campaignCode', type: 'required' as const, message: 'Campaign code is required' }
      ];
      
      const koFormatted = formatValidationErrors(errors, 'ko');
      const enFormatted = formatValidationErrors(errors, 'en');
      
      expect(koFormatted).toContain('오류');
      expect(enFormatted).toContain('errors');
      expect(koFormatted).toContain('•');
      expect(enFormatted).toContain('•');
    });

    it('should validate with existing codes correctly', () => {
      const existingCodes = ['EXISTING-001', 'EXISTING-002'];
      const duplicateCodeData = {
        campaignName: 'Test Campaign',
        campaignCode: 'EXISTING-001', // Duplicate code
        description: 'Test Description',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
        ownerId: 'user-123'
      };
      
      const koErrors = validateCampaignForm(duplicateCodeData, 'ko', existingCodes);
      const enErrors = validateCampaignForm(duplicateCodeData, 'en', existingCodes);
      
      const koCodeError = getFieldValidationError(koErrors, 'campaignCode');
      const enCodeError = getFieldValidationError(enErrors, 'campaignCode');
      
      expect(koCodeError).toBeDefined();
      expect(enCodeError).toBeDefined();
      expect(koCodeError).toContain('존재');
      expect(enCodeError).toContain('exists');
    });
  });
});