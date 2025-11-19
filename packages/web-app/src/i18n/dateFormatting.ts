import { SupportedLocale } from './types';

/**
 * Campaign-specific date formatting utilities
 * Provides localized date formatting for campaign dates and durations
 */

export interface CampaignDateFormatOptions {
  locale: SupportedLocale;
  includeTime?: boolean;
  relative?: boolean;
  format?: 'short' | 'medium' | 'long' | 'full';
}

/**
 * Format a date for campaign display based on locale
 */
export function formatCampaignDate(
  date: Date | string,
  options: CampaignDateFormatOptions
): string {
  const { locale, includeTime = false, relative = false, format = 'medium' } = options;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  // Handle relative dates
  if (relative) {
    return formatRelativeDate(dateObj, locale);
  }
  
  // Handle absolute dates
  const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'short' ? 'numeric' : format === 'long' ? 'long' : 'short',
    day: 'numeric',
  };
  
  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = locale === 'en';
  }
  
  return new Intl.DateTimeFormat(localeCode, formatOptions).format(dateObj);
}

/**
 * Format a date range for campaign display
 */
export function formatCampaignDateRange(
  startDate: Date | string,
  endDate: Date | string,
  locale: SupportedLocale
): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Date Range';
  }
  
  const startFormatted = formatCampaignDate(start, { locale, format: 'short' });
  const endFormatted = formatCampaignDate(end, { locale, format: 'short' });
  
  const separator = locale === 'ko' ? ' ~ ' : ' - ';
  return `${startFormatted}${separator}${endFormatted}`;
}

/**
 * Calculate and format campaign duration
 */
export function formatCampaignDuration(
  startDate: Date | string,
  endDate: Date | string,
  locale: SupportedLocale
): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Duration';
  }
  
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return locale === 'ko' ? '잘못된 기간' : 'Invalid Duration';
  }
  
  if (diffDays === 0) {
    return locale === 'ko' ? '당일' : 'Same Day';
  }
  
  if (diffDays === 1) {
    return locale === 'ko' ? '1일' : '1 Day';
  }
  
  if (diffDays < 7) {
    return locale === 'ko' ? `${diffDays}일` : `${diffDays} Days`;
  }
  
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;
    
    if (remainingDays === 0) {
      return locale === 'ko' ? `${weeks}주` : `${weeks} Week${weeks > 1 ? 's' : ''}`;
    }
    
    return locale === 'ko' 
      ? `${weeks}주 ${remainingDays}일`
      : `${weeks} Week${weeks > 1 ? 's' : ''} ${remainingDays} Day${remainingDays > 1 ? 's' : ''}`;
  }
  
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  
  if (remainingDays === 0) {
    return locale === 'ko' ? `${months}개월` : `${months} Month${months > 1 ? 's' : ''}`;
  }
  
  return locale === 'ko'
    ? `${months}개월 ${remainingDays}일`
    : `${months} Month${months > 1 ? 's' : ''} ${remainingDays} Day${remainingDays > 1 ? 's' : ''}`;
}

/**
 * Format relative dates (e.g., "2 days ago", "Yesterday")
 */
function formatRelativeDate(date: Date, locale: SupportedLocale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  
  // Future dates
  if (diffMs < 0) {
    const futureDays = Math.abs(diffDays);
    if (futureDays === 0) {
      return locale === 'ko' ? '오늘' : 'Today';
    }
    if (futureDays === 1) {
      return locale === 'ko' ? '내일' : 'Tomorrow';
    }
    if (futureDays < 7) {
      return locale === 'ko' ? `${futureDays}일 후` : `In ${futureDays} day${futureDays > 1 ? 's' : ''}`;
    }
    if (futureDays < 30) {
      const futureWeeks = Math.floor(futureDays / 7);
      return locale === 'ko' ? `${futureWeeks}주 후` : `In ${futureWeeks} week${futureWeeks > 1 ? 's' : ''}`;
    }
    const futureMonths = Math.floor(futureDays / 30);
    return locale === 'ko' ? `${futureMonths}개월 후` : `In ${futureMonths} month${futureMonths > 1 ? 's' : ''}`;
  }
  
  // Past dates
  if (diffDays === 0) {
    return locale === 'ko' ? '오늘' : 'Today';
  }
  
  if (diffDays === 1) {
    return locale === 'ko' ? '어제' : 'Yesterday';
  }
  
  if (diffDays < 7) {
    return locale === 'ko' ? `${diffDays}일 전` : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  
  if (diffWeeks === 1) {
    return locale === 'ko' ? '지난 주' : 'Last week';
  }
  
  if (diffDays < 30) {
    return locale === 'ko' ? `${diffWeeks}주 전` : `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  }
  
  if (diffMonths === 1) {
    return locale === 'ko' ? '지난 달' : 'Last month';
  }
  
  return locale === 'ko' ? `${diffMonths}개월 전` : `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
}

/**
 * Get campaign status display text with localization
 */
export function formatCampaignStatus(
  status: 'active' | 'completed' | 'paused' | 'cancelled',
  locale: SupportedLocale
): string {
  const statusMap = {
    ko: {
      active: '활성',
      completed: '완료',
      paused: '일시정지',
      cancelled: '취소됨'
    },
    en: {
      active: 'Active',
      completed: 'Completed',
      paused: 'Paused',
      cancelled: 'Cancelled'
    }
  };
  
  return statusMap[locale][status] || status;
}

/**
 * Format campaign metrics with locale-appropriate number formatting
 */
export function formatCampaignMetric(
  value: number,
  type: 'count' | 'percentage' | 'duration' | 'rate',
  locale: SupportedLocale
): string {
  const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';
  
  switch (type) {
    case 'count':
      return new Intl.NumberFormat(localeCode).format(value);
    
    case 'percentage':
      return new Intl.NumberFormat(localeCode, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(value / 100);
    
    case 'rate':
      return new Intl.NumberFormat(localeCode, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    
    case 'duration':
      // Format duration in minutes
      const hours = Math.floor(value / 60);
      const minutes = Math.floor(value % 60);
      
      if (hours === 0) {
        return locale === 'ko' ? `${minutes}분` : `${minutes}m`;
      }
      
      if (minutes === 0) {
        return locale === 'ko' ? `${hours}시간` : `${hours}h`;
      }
      
      return locale === 'ko' ? `${hours}시간 ${minutes}분` : `${hours}h ${minutes}m`;
    
    default:
      return value.toString();
  }
}

/**
 * Validate date range for campaigns
 */
export function validateCampaignDateRange(
  startDate: Date | string,
  endDate: Date | string
): { isValid: boolean; error?: string } {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }
  
  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }
  
  if (end.getTime() <= start.getTime()) {
    return { isValid: false, error: 'End date must be after start date' };
  }
  
  return { isValid: true };
}