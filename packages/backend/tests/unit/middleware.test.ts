import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../../src/middleware/error.middleware';
import { asyncHandler, validateRequest } from '../../src/middleware/validation.middleware';

describe('Error Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      url: '/test',
      method: 'GET',
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create an error with default status code', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom status code', () => {
      const error = new AppError('Not found', 404, 'NOT_FOUND');
      
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          status: 400,
        },
      });
    });

    it('should handle generic Error correctly', () => {
      const error = new Error('Generic error');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Generic error',
          code: 'INTERNAL_ERROR',
          status: 500,
        },
      });
    });
  });
});

describe('Validation Middleware', () => {
  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const handler = asyncHandler(mockFn);
      const mockNext = jest.fn();

      await handler({} as Request, {} as Response, mockNext);

      expect(mockFn).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle rejected async function', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(mockFn);
      const mockNext = jest.fn();

      await handler({} as Request, {} as Response, mockNext);

      expect(mockFn).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous functions that throw', async () => {
      const testError = new Error('Sync error');
      const mockFn = jest.fn().mockImplementation(() => {
        throw testError;
      });
      const handler = asyncHandler(mockFn);
      const mockNext = jest.fn();

      // Call the handler
      handler({} as Request, {} as Response, mockNext);

      // Wait for the next tick to allow Promise.resolve().catch() to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockFn).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(testError);
    });
  });

  describe('validateRequest', () => {
    const mockSchema = {
      validate: jest.fn()
    };

    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRequest = { body: { test: 'data' } };
      mockResponse = {};
      mockNext = jest.fn();
      mockSchema.validate.mockClear();
    });

    it('should call next when validation passes', () => {
      mockSchema.validate.mockReturnValue({ error: null });
      const middleware = validateRequest(mockSchema);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSchema.validate).toHaveBeenCalledWith({ test: 'data' }, { abortEarly: false });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw AppError when validation fails', () => {
      const validationError = {
        details: [
          { message: 'Field is required' },
          { message: 'Invalid format' }
        ]
      };
      mockSchema.validate.mockReturnValue({ error: validationError });
      
      const middleware = validateRequest(mockSchema);

      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow('Field is required, Invalid format');
    });

    it('should throw AppError with single validation error', () => {
      const validationError = {
        details: [
          { message: 'Field is required' }
        ]
      };
      mockSchema.validate.mockReturnValue({ error: validationError });
      
      const middleware = validateRequest(mockSchema);

      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow('Field is required');
    });
  });
});