import { Request, Response, NextFunction } from 'express';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';
import { ConfigService } from '../services/config.service';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../services/config.service');
jest.mock('jsonwebtoken');

describe('Admin Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockConfigService: any;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: any = {
          ADMIN_USERNAME: 'admin',
          ADMIN_PASSWORD: 'testpassword',
          JWT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    };

    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
  });

  describe('Bearer Token Authentication', () => {
    it('should accept valid JWT token', async () => {
      const validToken = 'valid-jwt-token';
      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      (jwt.verify as jest.Mock).mockReturnValue({
        username: 'admin',
        role: 'admin',
      });

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.verify).toHaveBeenCalledWith(validToken, 'test-secret');
      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).admin).toEqual({
        username: 'admin',
        role: 'admin',
      });
    });

    it('should reject invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token without admin role', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (jwt.verify as jest.Mock).mockReturnValue({
        username: 'user',
        role: 'user', // Not admin
      });

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Basic Authentication', () => {
    it('should accept valid credentials', async () => {
      const credentials = Buffer.from('admin:testpassword').toString('base64');
      mockRequest.headers = {
        authorization: `Basic ${credentials}`,
      };

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).admin).toEqual({
        username: 'admin',
        role: 'admin',
      });
    });

    it('should reject invalid username', async () => {
      const credentials = Buffer.from('wronguser:testpassword').toString('base64');
      mockRequest.headers = {
        authorization: `Basic ${credentials}`,
      };

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid password', async () => {
      const credentials = Buffer.from('admin:wrongpassword').toString('base64');
      mockRequest.headers = {
        authorization: `Basic ${credentials}`,
      };

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No authorization header provided',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization method', async () => {
      mockRequest.headers = {
        authorization: 'Invalid method',
      };

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization method',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle config service errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      (ConfigService.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error('Config service error');
      });

      await adminAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});