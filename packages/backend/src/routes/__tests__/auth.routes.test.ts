import request from 'supertest';
import express from 'express';
import * as jwt from 'jsonwebtoken';
import authRoutes from '../auth.routes';
import { ConfigService } from '../../services/config.service';

// Mock dependencies
jest.mock('../../services/config.service');
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(false)
}));

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      getInstance: jest.fn().mockReturnThis(),
      get: jest.fn(),
    } as any;
    
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
    
    // Default config values
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return 'test-password';
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Completely recreate the mock to avoid state bleeding
    mockConfigService = {
      getInstance: jest.fn().mockReturnThis(),
      get: jest.fn(),
    } as any;
    
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
    
    // Restore default config mock
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return 'test-password';
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        username: 'admin',
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn', 3600);
      expect(typeof response.body.token).toBe('string');
    });

    it('should reject login with missing username', async () => {
      const loginData = {
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required'
      });
    });

    it('should reject login with missing password', async () => {
      const loginData = {
        username: 'admin'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required'
      });
    });

    it('should reject login with invalid username', async () => {
      const loginData = {
        username: 'invalid-user',
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrong-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });


    it('should handle configuration service errors', async () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Config service error');
      });

      const loginData = {
        username: 'admin',
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication failed'
      });
    });
  });

  describe('POST /auth/verify', () => {
    let validToken: string;

    beforeEach(() => {
      const jwtSecret = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
      validToken = jwt.sign(
        {
          username: 'admin',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
        },
        jwtSecret,
        { expiresIn: 3600 }
      );
    });

    it('should verify valid token successfully', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({ token: validToken })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        valid: true,
        username: 'admin',
        role: 'admin'
      });
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Token is required'
      });
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        valid: false,
        error: 'Invalid or expired token'
      });
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        {
          username: 'admin',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        },
        'test-jwt-secret-key-for-testing-purposes-only-32-chars-min',
        { expiresIn: -3600 } // Expired 1 hour ago
      );

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: expiredToken })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        valid: false,
        error: 'Invalid or expired token'
      });
    });

    it('should handle malformed token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'malformed.token.here' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        valid: false,
        error: 'Invalid or expired token'
      });
    });
  });

  describe('Rate Limiting & Security', () => {
    it('should handle multiple rapid login attempts', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrong-password'
      };

      // Simulate multiple rapid requests
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // All should return 401 for invalid credentials
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrong-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      // Should not reveal whether username or password was wrong
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('username');
    });
  });

  describe('Input Validation', () => {
    it('should handle SQL injection attempts in username', async () => {
      const maliciousData = {
        username: "admin'; DROP TABLE users; --",
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(maliciousData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle XSS attempts in username', async () => {
      const maliciousData = {
        username: '<script>alert("xss")</script>',
        password: 'test-password'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(maliciousData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle oversized payloads', async () => {
      const oversizedData = {
        username: 'a'.repeat(10000),
        password: 'b'.repeat(10000)
      };

      const response = await request(app)
        .post('/auth/login')
        .send(oversizedData);

      // Should handle gracefully (either 400 or 401)
      expect([400, 401, 413]).toContain(response.status);
    });
  });
});