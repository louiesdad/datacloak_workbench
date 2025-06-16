import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes';
import { ConfigService } from '../services/config.service';

// Mock ConfigService
jest.mock('../services/config.service', () => ({
  ConfigService: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const config: any = {
          ADMIN_USERNAME: 'admin',
          ADMIN_PASSWORD: 'testpassword',
          JWT_SECRET: 'test-secret-key',
        };
        return config[key];
      }),
    })),
  },
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  describe('POST /api/auth/login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'testpassword',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.expiresIn).toBe(3600);
    });

    it('should return 401 for invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'wronguser',
          password: 'testpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('POST /api/auth/verify', () => {
    let validToken: string;

    beforeEach(async () => {
      // Get a valid token first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'testpassword',
        });
      validToken = loginResponse.body.token;
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: validToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.username).toBe('admin');
      expect(response.body.role).toBe('admin');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token is required');
    });
  });
});