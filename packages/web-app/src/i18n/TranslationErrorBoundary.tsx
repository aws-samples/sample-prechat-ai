import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TranslationError } from './TranslationManager';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class TranslationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    console.error('Translation Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private isTranslationRelatedError(error: Error): boolean {
    // Check if the error is related to translations
    const errorMessage = error.message.toLowerCase();
    const translationKeywords = [
      'translation',
      'locale',
      'i18n',
      'missing key',
      'failed to load translations'
    ];
    
    return translationKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private renderFallbackUI(): ReactNode {
    const { fallback } = this.props;
    const { error } = this.state;
    
    if (fallback) {
      return fallback;
    }

    // Default fallback UI
    if (error && this.isTranslationRelatedError(error)) {
      return (
        <div 
          style={{
            padding: '16px',
            border: '1px solid #ffa726',
            borderRadius: '4px',
            backgroundColor: '#fff3e0',
            color: '#e65100',
            fontSize: '14px',
            margin: '8px 0'
          }}
        >
          <strong>Translation Error:</strong> Some text may not display correctly. 
          Please refresh the page or try switching languages.
        </div>
      );
    }

    // Generic error fallback
    return (
      <div 
        style={{
          padding: '16px',
          border: '1px solid #f44336',
          borderRadius: '4px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          fontSize: '14px',
          margin: '8px 0'
        }}
      >
        <strong>Error:</strong> Something went wrong. Please refresh the page.
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with translation error boundary
export function withTranslationErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WithTranslationErrorBoundary = (props: P) => (
    <TranslationErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </TranslationErrorBoundary>
  );

  WithTranslationErrorBoundary.displayName = 
    `withTranslationErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithTranslationErrorBoundary;
}

// Hook for handling translation errors in functional components
export function useTranslationErrorHandler() {
  const handleError = React.useCallback((error: TranslationError) => {
    // Log error for debugging
    console.warn('Translation error:', error);
    
    // In development, show more detailed error information
    if (process.env.NODE_ENV === 'development') {
      console.group('Translation Error Details');
      console.log('Type:', error.type);
      console.log('Message:', error.message);
      if (error.key) console.log('Key:', error.key);
      if (error.locale) console.log('Locale:', error.locale);
      if (error.originalError) console.log('Original Error:', error.originalError);
      console.groupEnd();
    }
  }, []);

  return { handleError };
}