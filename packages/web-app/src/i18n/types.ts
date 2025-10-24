export interface TranslationEntry {
  key: string;
  korean: string;
  english: string;
  context?: string;
  variables?: string[];
}

export interface LocaleConfig {
  code: 'ko' | 'en';
  name: string;
  nativeName: string;
  direction: 'ltr';
  dateFormat: string;
  numberFormat: Intl.NumberFormatOptions;
}

export interface TranslationContext {
  currentLocale: string;
  availableLocales: LocaleConfig[];
  translations: Record<string, string>;
  isLoading: boolean;
  error?: string;
}

export type SupportedLocale = 'ko' | 'en';

export interface UseI18nReturn {
  t: (key: string, variables?: Record<string, any>) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  isLoading: boolean;
  error?: string;
  hasTranslations: boolean;
  retryLoading: () => void;
  clearError: () => void;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { 
    code: 'ko', 
    name: 'Korean', 
    nativeName: '한국어', 
    direction: 'ltr', 
    dateFormat: 'ko-KR', 
    numberFormat: {} 
  },
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English', 
    direction: 'ltr', 
    dateFormat: 'en-US', 
    numberFormat: {} 
  }
];

export const DEFAULT_LOCALE: SupportedLocale = 'ko';

// Campaign-specific translation keys interface
export interface CampaignTranslations {
  // Navigation
  'campaign_management': string;
  'campaigns': string;
  
  // Campaign List
  'campaign_list_title': string;
  'campaign_name': string;
  'campaign_code': string;
  'campaign_owner': string;
  'campaign_status': string;
  'campaign_sessions': string;
  'create_campaign': string;
  'all_campaigns': string;
  'campaign_analytics': string;
  
  // Campaign Form
  'campaign_form_title': string;
  'edit_campaign_title': string;
  'campaign_name_label': string;
  'campaign_code_label': string;
  'campaign_description_label': string;
  'start_date_label': string;
  'end_date_label': string;
  'campaign_owner_label': string;
  'campaign_status_label': string;
  'save_campaign': string;
  'cancel': string;
  
  // Campaign Details
  'campaign_details_title': string;
  'campaign_details': string;
  'associated_sessions': string;
  'total_sessions': string;
  'completion_rate': string;
  'active_sessions': string;
  'completed_sessions': string;
  'average_session_duration': string;
  'top_consultation_purposes': string;
  'sessions_by_date': string;
  'customer_companies': string;
  'edit_campaign': string;
  'delete_campaign': string;
  'view_sessions': string;
  
  // Validation Messages
  'campaign_name_required': string;
  'campaign_code_required': string;
  'campaign_description_required': string;
  'start_date_required': string;
  'end_date_required': string;
  'owner_required': string;
  'invalid_date_range': string;
  'campaign_code_exists': string;
  
  // Status Values
  'campaign_status_active': string;
  'campaign_status_completed': string;
  'campaign_status_paused': string;
  'campaign_status_cancelled': string;
  
  // Actions and Messages
  'campaign_created_successfully': string;
  'campaign_updated_successfully': string;
  'campaign_deleted_successfully': string;
  'session_associated_successfully': string;
  'loading_campaigns': string;
  'no_campaigns_found': string;
  'no_sessions_found': string;
  'confirm_delete_campaign': string;
  'delete_campaign_warning': string;
  
  // Session Association
  'associate_with_campaign': string;
  'select_campaign': string;
  'no_campaign': string;
  'campaign_association': string;
  'remove_campaign_association': string;
}