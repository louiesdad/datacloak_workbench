// Error handling utilities for network requests and validation

export interface NetworkError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  timeout?: boolean;
  offline?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, any>;
  code?: string;
  validationErrors?: ValidationError[];
}

// Network error handling
export class NetworkErrorHandler {
  private static readonly TIMEOUT_MS = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second

  static async fetchWithRetry<T>(
    url: string, 
    options: RequestInit = {},
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.createNetworkError(response, url);
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        // Handle abort/timeout
        if (error.name === 'AbortError') {
          const timeoutError: NetworkError = new Error('Request timeout') as NetworkError;
          timeoutError.timeout = true;
          timeoutError.url = url;
          throw timeoutError;
        }

        // Handle network errors
        if (error.message.includes('fetch')) {
          const networkError: NetworkError = new Error('Network error') as NetworkError;
          networkError.offline = !navigator.onLine;
          networkError.url = url;
          throw networkError;
        }
      }

      // Retry logic for certain types of errors
      if (retries > 0 && this.shouldRetry(error)) {
        const delay = this.calculateRetryDelay(this.MAX_RETRIES - retries);
        await this.delay(delay);
        return this.fetchWithRetry(url, options, retries - 1);
      }

      throw error;
    }
  }

  private static async createNetworkError(response: Response, url: string): Promise<NetworkError> {
    const error: NetworkError = new Error(`HTTP ${response.status}: ${response.statusText}`) as NetworkError;
    error.status = response.status;
    error.statusText = response.statusText;
    error.url = url;

    // Try to get error details from response body
    try {
      const errorData: ApiErrorResponse = await response.json();
      if (errorData.error) {
        error.message = errorData.error;
      }
    } catch {
      // Response body is not JSON or is empty
    }

    return error;
  }

  private static shouldRetry(error: any): boolean {
    if (error instanceof NetworkError) {
      // Retry on network errors or server errors (5xx)
      return error.offline || (error.status && error.status >= 500);
    }
    return false;
  }

  private static calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.RETRY_DELAY_BASE * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // User-friendly error messages
  static getErrorMessage(error: any): string {
    if (error instanceof NetworkError) {
      if (error.timeout) {
        return 'The request timed out. Please check your connection and try again.';
      }
      
      if (error.offline) {
        return 'You appear to be offline. Please check your internet connection.';
      }

      if (error.status) {
        switch (error.status) {
          case 400:
            return 'Invalid request. Please check your input and try again.';
          case 401:
            return 'Authentication required. Please log in and try again.';
          case 403:
            return 'You do not have permission to perform this action.';
          case 404:
            return 'The requested resource was not found.';
          case 409:
            return 'There was a conflict with the current state. Please refresh and try again.';
          case 413:
            return 'The file is too large. Please select a smaller file.';
          case 429:
            return 'Too many requests. Please wait a moment and try again.';
          case 500:
            return 'Server error. Please try again later.';
          case 502:
          case 503:
          case 504:
            return 'Service temporarily unavailable. Please try again later.';
          default:
            return `Network error (${error.status}). Please try again.`;
        }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}

// Validation utilities
export class ValidationUtils {
  static validateEmail(email: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        field: 'email',
        message: 'Please enter a valid email address',
        code: 'INVALID_EMAIL'
      };
    }
    return null;
  }

  static validateFileSize(file: File, maxSizeGB: number): ValidationError | null {
    const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        field: 'file',
        message: `File size must be less than ${maxSizeGB}GB`,
        code: 'FILE_TOO_LARGE'
      };
    }
    return null;
  }

  static validateFileType(file: File, allowedTypes: string[]): ValidationError | null {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      return {
        field: 'file',
        message: `File type not supported. Allowed types: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      };
    }
    return null;
  }

  static validateRequired(value: any, fieldName: string): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return {
        field: fieldName,
        message: `${fieldName} is required`,
        code: 'REQUIRED'
      };
    }
    return null;
  }

  static validateMinLength(value: string, minLength: number, fieldName: string): ValidationError | null {
    if (value.length < minLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${minLength} characters`,
        code: 'MIN_LENGTH'
      };
    }
    return null;
  }

  static validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationError | null {
    if (value.length > maxLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be no more than ${maxLength} characters`,
        code: 'MAX_LENGTH'
      };
    }
    return null;
  }

  static validateRange(value: number, min: number, max: number, fieldName: string): ValidationError | null {
    if (value < min || value > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be between ${min} and ${max}`,
        code: 'OUT_OF_RANGE'
      };
    }
    return null;
  }

  // Batch validation
  static validateForm(data: Record<string, any>, rules: ValidationRule[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const value = data[rule.field];
      const error = this.validateField(value, rule);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  private static validateField(value: any, rule: ValidationRule): ValidationError | null {
    switch (rule.type) {
      case 'required':
        return this.validateRequired(value, rule.field);
      
      case 'email':
        return value ? this.validateEmail(value) : null;
      
      case 'minLength':
        return value && rule.minLength ? this.validateMinLength(value, rule.minLength, rule.field) : null;
      
      case 'maxLength':
        return value && rule.maxLength ? this.validateMaxLength(value, rule.maxLength, rule.field) : null;
      
      case 'range':
        return typeof value === 'number' && rule.min !== undefined && rule.max !== undefined 
          ? this.validateRange(value, rule.min, rule.max, rule.field) 
          : null;
      
      case 'custom':
        return rule.validator ? rule.validator(value, rule.field) : null;
      
      default:
        return null;
    }
  }
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'range' | 'custom';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  validator?: (value: any, field: string) => ValidationError | null;
}

// React hook for form validation
export const useFormValidation = (rules: ValidationRule[]) => {
  const [errors, setErrors] = React.useState<ValidationError[]>([]);

  const validateForm = (data: Record<string, any>): boolean => {
    const validationErrors = ValidationUtils.validateForm(data, rules);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const clearErrors = () => setErrors([]);

  const getFieldError = (fieldName: string): string | null => {
    const error = errors.find(e => e.field === fieldName);
    return error ? error.message : null;
  };

  const hasErrors = errors.length > 0;

  return {
    errors,
    validateForm,
    clearErrors,
    getFieldError,
    hasErrors
  };
};

// Enhanced platform bridge with error handling
export const createEnhancedPlatformBridge = (originalBridge: any) => {
  return {
    ...originalBridge,
    backend: {
      ...originalBridge.backend,
      
      // Wrap all backend methods with error handling
      getHealthStatus: () => 
        NetworkErrorHandler.fetchWithRetry('/api/v1/health/status'),
      
      getReadinessStatus: () => 
        NetworkErrorHandler.fetchWithRetry('/api/v1/health/ready'),
      
      uploadData: async (file: File) => {
        // Validate file before upload
        const sizeError = ValidationUtils.validateFileSize(file, 50);
        if (sizeError) throw new Error(sizeError.message);
        
        const typeError = ValidationUtils.validateFileType(file, ['.csv', '.xlsx', '.xls', '.tsv']);
        if (typeError) throw new Error(typeError.message);
        
        const formData = new FormData();
        formData.append('file', file);
        
        return NetworkErrorHandler.fetchWithRetry('/api/v1/data/upload', {
          method: 'POST',
          body: formData,
        });
      },
      
      getDatasets: (page = 1, limit = 20) => 
        NetworkErrorHandler.fetchWithRetry(`/api/v1/data/datasets?page=${page}&limit=${limit}`),
      
      // Add error handling to other methods...
    }
  };
};

// React hook for network status
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Add React import
import React from 'react';