import { useCallback } from 'react';
import { useNotifications } from '../components/NotificationToast';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: number;
  retryable?: boolean;
}

export interface ApiErrorContext {
  operation: string;
  component: string;
  userMessage?: string;
}

export function useApiErrorHandler() {
  const { addNotification } = useNotifications();

  const handleApiError = useCallback((error: any, context: ApiErrorContext): ApiError => {
    const timestamp = Date.now();
    let apiError: ApiError;

    // Parse different error types
    if (error?.response) {
      // HTTP response errors
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          apiError = {
            code: 'BAD_REQUEST',
            message: data?.message || 'Invalid request. Please check your input and try again.',
            details: data,
            timestamp,
            retryable: false
          };
          break;
        case 401:
          apiError = {
            code: 'UNAUTHORIZED',
            message: 'Authentication failed. Please refresh the page and try again.',
            details: data,
            timestamp,
            retryable: true
          };
          break;
        case 403:
          apiError = {
            code: 'FORBIDDEN',
            message: 'Access denied. You may not have permission to perform this action.',
            details: data,
            timestamp,
            retryable: false
          };
          break;
        case 404:
          apiError = {
            code: 'NOT_FOUND',
            message: 'Resource not found. The requested data may have been moved or deleted.',
            details: data,
            timestamp,
            retryable: false
          };
          break;
        case 409:
          apiError = {
            code: 'CONFLICT',
            message: 'Request conflict. The resource may have been modified by another user.',
            details: data,
            timestamp,
            retryable: true
          };
          break;
        case 413:
          apiError = {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'File or data too large. Please try with a smaller dataset or contact support.',
            details: data,
            timestamp,
            retryable: false
          };
          break;
        case 429:
          apiError = {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please wait a moment and try again.',
            details: data,
            timestamp,
            retryable: true
          };
          break;
        case 500:
          apiError = {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Server error occurred. Please try again later or contact support if the problem persists.',
            details: data,
            timestamp,
            retryable: true
          };
          break;
        case 502:
        case 503:
        case 504:
          apiError = {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable. Please try again in a few minutes.',
            details: data,
            timestamp,
            retryable: true
          };
          break;
        default:
          apiError = {
            code: 'HTTP_ERROR',
            message: `Request failed with status ${status}. Please try again or contact support.`,
            details: data,
            timestamp,
            retryable: status >= 500
          };
      }
    } else if (error?.name === 'NetworkError' || !navigator.onLine) {
      // Network connectivity errors
      apiError = {
        code: 'NETWORK_ERROR',
        message: 'Network connection error. Please check your internet connection and try again.',
        details: error,
        timestamp,
        retryable: true
      };
    } else if (error?.name === 'TimeoutError' || error?.code === 'ECONNABORTED') {
      // Timeout errors
      apiError = {
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out. The operation may take longer than expected. Please try again.',
        details: error,
        timestamp,
        retryable: true
      };
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      // DNS/Connection errors
      apiError = {
        code: 'CONNECTION_ERROR',
        message: 'Cannot connect to the service. Please check your connection or try again later.',
        details: error,
        timestamp,
        retryable: true
      };
    } else if (error?.message?.includes('JSON')) {
      // JSON parsing errors
      apiError = {
        code: 'PARSE_ERROR',
        message: 'Invalid response from server. Please try again or contact support.',
        details: error,
        timestamp,
        retryable: true
      };
    } else if (error?.code === 'insufficient_quota') {
      // OpenAI specific errors
      apiError = {
        code: 'QUOTA_EXCEEDED',
        message: 'API quota exceeded. Please try again later or contact support to increase your quota.',
        details: error,
        timestamp,
        retryable: false
      };
    } else if (error?.code === 'model_overloaded') {
      apiError = {
        code: 'MODEL_OVERLOADED',
        message: 'AI model is currently overloaded. Please try again in a few minutes.',
        details: error,
        timestamp,
        retryable: true
      };
    } else if (error?.code === 'context_length_exceeded') {
      apiError = {
        code: 'CONTEXT_TOO_LONG',
        message: 'Text input is too long for analysis. Please try with shorter text or split into smaller chunks.',
        details: error,
        timestamp,
        retryable: false
      };
    } else {
      // Generic/unknown errors
      apiError = {
        code: 'UNKNOWN_ERROR',
        message: error?.message || 'An unexpected error occurred. Please try again or contact support.',
        details: error,
        timestamp,
        retryable: true
      };
    }

    // Add contextual information
    const contextualMessage = context.userMessage || 
      `Error in ${context.component} during ${context.operation}: ${apiError.message}`;

    // Show notification to user
    addNotification({
      type: 'error',
      message: contextualMessage,
      duration: apiError.retryable ? 8000 : 12000,
      actions: apiError.retryable ? [
        {
          label: 'Retry',
          action: () => {
            // This will be handled by the calling component
            console.log('Retry requested for:', context);
          }
        }
      ] : undefined
    });

    // Log for debugging
    console.error(`API Error [${apiError.code}] in ${context.component}:`, {
      context,
      error: apiError,
      originalError: error
    });

    return apiError;
  }, [addNotification]);

  const isRetryableError = useCallback((error: ApiError): boolean => {
    return error.retryable === true;
  }, []);

  const getRetryDelay = useCallback((error: ApiError, retryCount: number): number => {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    let delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    delay += jitter;
    
    // Special cases for specific error types
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        delay = Math.max(delay, 5000); // Minimum 5 seconds
        break;
      case 'MODEL_OVERLOADED':
        delay = Math.max(delay, 10000); // Minimum 10 seconds
        break;
      case 'SERVICE_UNAVAILABLE':
        delay = Math.max(delay, 3000); // Minimum 3 seconds
        break;
    }
    
    return Math.floor(delay);
  }, []);

  return {
    handleApiError,
    isRetryableError,
    getRetryDelay
  };
}

// Helper hook for automatic retry logic
export function useApiWithRetry() {
  const { handleApiError, isRetryableError, getRetryDelay } = useApiErrorHandler();

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: ApiErrorContext,
    maxRetries: number = 3
  ): Promise<T> => {
    let lastError: ApiError | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = handleApiError(error, {
          ...context,
          operation: `${context.operation} (attempt ${attempt + 1}/${maxRetries + 1})`
        });
        
        // Don't retry on the last attempt or non-retryable errors
        if (attempt === maxRetries || !isRetryableError(lastError)) {
          throw lastError;
        }
        
        // Wait before retrying
        const delay = getRetryDelay(lastError, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }, [handleApiError, isRetryableError, getRetryDelay]);

  return {
    executeWithRetry,
    handleApiError,
    isRetryableError,
    getRetryDelay
  };
}