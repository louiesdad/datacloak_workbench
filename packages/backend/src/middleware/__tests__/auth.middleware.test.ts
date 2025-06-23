import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { authenticate, authorize, authenticateOrBypass, generateToken, validateJWTSecret } from '../auth.middleware';
import { ConfigService } from '../../services/config.service';

// Mock the ConfigService
jest.mock('../../services/config.service');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    mockConfigService = {
      get: jest.fn(),
      getInstance: jest.fn()
    } as any;

    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
    mockConfigService.get.mockReturnValue('8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid JWT token', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' };
      const token = jwt.sign(payload, '8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74');
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toMatchObject({
        id: 'user123',
        username: 'testuser',
        role: 'user'
      });
    });

    it('should reject request without authorization header', () => {
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No valid authorization header provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', () => {
      mockRequest.headers = {
        authorization: 'Invalid token'
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No valid authorization header provided'
      });
    });

    it('should reject request with expired token', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' };
      const token = jwt.sign(payload, '8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74', { expiresIn: '-1h' });
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired'
      });
    });

    it('should reject request with invalid JWT secret', () => {
      mockConfigService.get.mockReturnValue('short');

      const token = 'valid.jwt.token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server configuration error'
      });
    });

    it('should handle malformed JWT tokens', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token format'
      });
    });
  });

  describe('authorize', () => {
    it('should allow access for user with correct role', () => {
      mockRequest.user = { id: 'user123', role: 'admin' };
      const middleware = authorize(['admin', 'moderator']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user without correct role', () => {
      mockRequest.user = { id: 'user123', role: 'user' };
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions'
      });
    });

    it('should deny access for unauthenticated user', () => {
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authenticated'
      });
    });
  });

  describe('authenticateOrBypass', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should bypass authentication in test environment', () => {
      process.env.NODE_ENV = 'test';

      authenticateOrBypass(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        id: 'test-user-123',
        username: 'testuser',
        role: 'user'
      });
    });

    it('should bypass authentication in development with special header', () => {
      process.env.NODE_ENV = 'development';
      mockRequest.headers = { 'x-dev-bypass': 'true' };

      authenticateOrBypass(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        id: 'dev-user-123',
        username: 'devuser',
        role: 'admin'
      });
    });

    it('should use standard authentication in production', () => {
      process.env.NODE_ENV = 'production';
      mockRequest.headers = { authorization: 'Bearer invalid' };

      authenticateOrBypass(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' };
      
      const token = generateToken(payload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, '8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74') as any;
      expect(decoded.id).toBe('user123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('user');
    });

    it('should throw error with invalid JWT secret', () => {
      mockConfigService.get.mockReturnValue('short');
      const payload = { id: 'user123', username: 'testuser', role: 'user' };

      expect(() => generateToken(payload)).toThrow('Invalid JWT secret configuration');
    });
  });

  describe('validateJWTSecret', () => {
    it('should validate strong JWT secret', () => {
      const strongSecret = '8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74';
      expect(validateJWTSecret(strongSecret)).toBe(true);
    });

    it('should reject short JWT secret', () => {
      expect(validateJWTSecret('short')).toBe(false);
    });

    it('should reject default JWT secret', () => {
      expect(validateJWTSecret('your-super-secret-jwt-key-here-12345678')).toBe(false);
    });

    it('should reject empty or null secret', () => {
      expect(validateJWTSecret('')).toBe(false);
      expect(validateJWTSecret(null as any)).toBe(false);
      expect(validateJWTSecret(undefined as any)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle token with invalid payload structure', () => {
      const invalidPayload = { invalidField: 'value' };
      const token = jwt.sign(invalidPayload, '8bb3a1da6fed782a909873f9f49f232e4a67ec99646abd7e71b9c9e401808e74');
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token payload'
      });
    });

    it('should handle token signed with different secret', () => {
      const payload = { id: 'user123', username: 'testuser', role: 'user' };
      const token = jwt.sign(payload, 'different-secret');
      
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token format'
      });
    });
  });
});