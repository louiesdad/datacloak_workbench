import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../../src/middleware/error.middleware';
import { asyncHandler } from '../../src/middleware/validation.middleware';

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
  });
});