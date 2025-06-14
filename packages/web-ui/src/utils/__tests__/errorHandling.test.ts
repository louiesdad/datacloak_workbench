import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, ValidationError, NetworkError, ApiError } from '../errorHandling';

// Mock fetch for network tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleError', () => {
    it('should handle generic errors', () => {
      const error = new Error('Generic error');
      const result = ErrorHandler.handleError(error);

      expect(result).toEqual({
        type: 'error',
        message: 'Generic error',
        code: 'UNKNOWN_ERROR',
        recoverable: false
      });
    });

    it('should handle validation errors', () => {
      const error = new ValidationError('Invalid input', 'email');
      const result = ErrorHandler.handleError(error);

      expect(result).toEqual({
        type: 'validation',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        field: 'email',
        recoverable: true
      });
    });

    it('should handle network errors', () => {
      const error = new NetworkError('Network failed', 500);
      const result = ErrorHandler.handleError(error);

      expect(result).toEqual({
        type: 'network',
        message: 'Network failed',
        code: 'NETWORK_ERROR',
        statusCode: 500,
        recoverable: true
      });
    });

    it('should handle API errors', () => {
      const error = new ApiError('API error', 'INVALID_REQUEST', { detail: 'Missing field' });
      const result = ErrorHandler.handleError(error);

      expect(result).toEqual({
        type: 'api',
        message: 'API error',
        code: 'INVALID_REQUEST',
        details: { detail: 'Missing field' },
        recoverable: true
      });
    });
  });

  describe('fetchWithRetry', () => {
    it('should succeed on first try', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'success' }) };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await ErrorHandler.fetchWithRetry('https://api.example.com/data');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on network failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'success' }) });

      const result = await ErrorHandler.fetchWithRetry('https://api.example.com/data', {}, 3);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      await expect(
        ErrorHandler.fetchWithRetry('https://api.example.com/data', {}, 2)
      ).rejects.toThrow('Persistent network error');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = { 
        ok: false, 
        status: 500, 
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error details')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        ErrorHandler.fetchWithRetry('https://api.example.com/data')
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should use custom retry delay', async () => {
      vi.useFakeTimers();
      
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'success' }) });

      const fetchPromise = ErrorHandler.fetchWithRetry(
        'https://api.example.com/data', 
        {}, 
        2,
        (attempt) => attempt * 100
      );

      // Advance timers to trigger retry
      vi.advanceTimersByTime(100);

      const result = await fetchPromise;
      expect(result).toEqual({ data: 'success' });

      vi.useRealTimers();
    });
  });

  describe('reportError', () => {
    it('should report error to console in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      ErrorHandler.reportError(error, { component: 'TestComponent' });

      expect(console.error).toHaveBeenCalledWith(
        'Error in TestComponent:',
        error,
        { component: 'TestComponent' }
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should send error to service in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock error reporting service
      const mockErrorService = vi.fn();
      (window as any).errorReportingService = { report: mockErrorService };

      const error = new Error('Production error');
      ErrorHandler.reportError(error, { userId: '123' });

      expect(mockErrorService).toHaveBeenCalledWith({
        message: 'Production error',
        stack: error.stack,
        context: { userId: '123' },
        timestamp: expect.any(Date),
        userAgent: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
      delete (window as any).errorReportingService;
    });
  });

  describe('isRecoverable', () => {
    it('should identify recoverable errors', () => {
      expect(ErrorHandler.isRecoverable(new ValidationError('Invalid', 'field'))).toBe(true);
      expect(ErrorHandler.isRecoverable(new NetworkError('Network', 503))).toBe(true);
      expect(ErrorHandler.isRecoverable(new ApiError('API', 'RATE_LIMITED'))).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      expect(ErrorHandler.isRecoverable(new Error('Generic error'))).toBe(false);
      expect(ErrorHandler.isRecoverable(new NetworkError('Network', 404))).toBe(false);
      expect(ErrorHandler.isRecoverable(new ApiError('API', 'UNAUTHORIZED'))).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly messages', () => {
      expect(ErrorHandler.getUserFriendlyMessage(new ValidationError('Required', 'email')))
        .toBe('Please check your input for email');

      expect(ErrorHandler.getUserFriendlyMessage(new NetworkError('Failed', 503)))
        .toBe('Service temporarily unavailable. Please try again later.');

      expect(ErrorHandler.getUserFriendlyMessage(new Error('Complex technical error')))
        .toBe('An unexpected error occurred. Please try again.');
    });
  });
});

describe('Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with field', () => {
      const error = new ValidationError('Invalid email format', 'email');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.recoverable).toBe(true);
    });

    it('should create validation error without field', () => {
      const error = new ValidationError('Form invalid');

      expect(error.field).toBeUndefined();
      expect(error.recoverable).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should create network error with status code', () => {
      const error = new NetworkError('Connection failed', 500);

      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.recoverable).toBe(true);
    });

    it('should determine recoverability based on status code', () => {
      expect(new NetworkError('Server error', 500).recoverable).toBe(true);
      expect(new NetworkError('Service unavailable', 503).recoverable).toBe(true);
      expect(new NetworkError('Not found', 404).recoverable).toBe(false);
      expect(new NetworkError('Unauthorized', 401).recoverable).toBe(false);
    });
  });

  describe('ApiError', () => {
    it('should create API error with details', () => {
      const error = new ApiError('Validation failed', 'VALIDATION_ERROR', { 
        fields: ['email', 'password'] 
      });

      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ fields: ['email', 'password'] });
      expect(error.recoverable).toBe(true);
    });

    it('should determine recoverability based on error code', () => {
      expect(new ApiError('Rate limited', 'RATE_LIMITED').recoverable).toBe(true);
      expect(new ApiError('Validation error', 'VALIDATION_ERROR').recoverable).toBe(true);
      expect(new ApiError('Unauthorized', 'UNAUTHORIZED').recoverable).toBe(false);
      expect(new ApiError('Forbidden', 'FORBIDDEN').recoverable).toBe(false);
    });
  });
});