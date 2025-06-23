import request from 'supertest';
import express from 'express';
import configRoutes from '../routes/config.routes';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';
import { ConfigService } from '../services/config.service';

// Mock dependencies before imports
jest.mock('../services/config.service');
jest.mock('../middleware/admin-auth.middleware', () => ({
  adminAuthMiddleware: jest.fn((req, res, next) => {
    // Mock successful authentication
    req.admin = { username: 'admin', role: 'admin' };
    next();
  }),
}));

// Add timeout for all tests in this suite
jest.setTimeout(10000);

describe('Config Routes', () => {
  let app: express.Application;
  let mockConfigService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/config', configRoutes);

    // Setup mock ConfigService
    mockConfigService = {
      getSanitizedConfig: jest.fn().mockReturnValue({
        PORT: 3000,
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-***1234',
        OPENAI_MODEL: 'gpt-3.5-turbo',
      }),
      update: jest.fn().mockResolvedValue(undefined),
      updateMultiple: jest.fn().mockResolvedValue(undefined),
      isOpenAIConfigured: jest.fn().mockReturnValue(true),
      getOpenAIConfig: jest.fn().mockReturnValue({
        apiKey: 'sk-***1234',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000,
      }),
      getAll: jest.fn().mockReturnValue({
        PORT: 3000,
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-test12345678901234567890123456789012345678901234',
      }),
      getInstance: jest.fn().mockReturnThis(),
    };

    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
  });

  afterEach(() => {
    // Clear all mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('GET /api/config', () => {
    it('should return sanitized configuration', async () => {
      const response = await request(app)
        .get('/api/config')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        PORT: 3000,
        NODE_ENV: 'development',
        OPENAI_API_KEY: 'sk-***1234',
        OPENAI_MODEL: 'gpt-3.5-turbo',
      });
      expect(mockConfigService.getSanitizedConfig).toHaveBeenCalled();
    });
  });

  describe('PUT /api/config', () => {
    it('should update single configuration value', async () => {
      const response = await request(app)
        .put('/api/config')
        .set('Authorization', 'Bearer valid-token')
        .send({
          key: 'OPENAI_MODEL',
          value: 'gpt-4',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Configuration updated successfully');
      expect(mockConfigService.update).toHaveBeenCalledWith('OPENAI_MODEL', 'gpt-4');
    });

    it('should return 400 for missing key', async () => {
      const response = await request(app)
        .put('/api/config')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: 'gpt-4',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Configuration key is required');
    });

    it('should handle update errors', async () => {
      mockConfigService.update.mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .put('/api/config')
        .set('Authorization', 'Bearer valid-token')
        .send({
          key: 'INVALID_KEY',
          value: 'value',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Update failed');
    });
  });

  describe('PUT /api/config/batch', () => {
    it('should update multiple configuration values', async () => {
      const updates = {
        OPENAI_MODEL: 'gpt-4',
        OPENAI_MAX_TOKENS: 200,
        OPENAI_TEMPERATURE: 0.5,
      };

      const response = await request(app)
        .put('/api/config/batch')
        .set('Authorization', 'Bearer valid-token')
        .send({ updates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Configuration updated successfully');
      expect(mockConfigService.updateMultiple).toHaveBeenCalledWith(updates);
    });

    it('should return 400 for missing updates', async () => {
      const response = await request(app)
        .put('/api/config/batch')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Updates object is required');
    });
  });

  describe('PUT /api/config/openai-key', () => {
    it('should update OpenAI API key', async () => {
      const validApiKey = 'sk-test12345678901234567890123456789012345678901234';

      const response = await request(app)
        .put('/api/config/openai-key')
        .set('Authorization', 'Bearer valid-token')
        .send({ apiKey: validApiKey });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OpenAI API key updated successfully');
      expect(mockConfigService.update).toHaveBeenCalledWith('OPENAI_API_KEY', validApiKey);
    });

    it('should return 400 for invalid API key format', async () => {
      const response = await request(app)
        .put('/api/config/openai-key')
        .set('Authorization', 'Bearer valid-token')
        .send({ apiKey: 'invalid-key' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid OpenAI API key format');
    });

    it('should return 400 for missing API key', async () => {
      const response = await request(app)
        .put('/api/config/openai-key')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key is required');
    });
  });

  describe('GET /api/config/openai', () => {
    it('should return OpenAI configuration', async () => {
      const response = await request(app)
        .get('/api/config/openai')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        configured: true,
        apiKey: 'sk-***1234',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000,
      });
    });
  });

  describe('POST /api/config/validate', () => {
    it('should validate configuration successfully', async () => {
      const response = await request(app)
        .post('/api/config/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          updates: {
            PORT: 3001,
            OPENAI_MODEL: 'gpt-4',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.message).toBe('Configuration is valid');
    });

    it('should return 400 for missing updates', async () => {
      const response = await request(app)
        .post('/api/config/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Updates object is required');
    });
  });
});