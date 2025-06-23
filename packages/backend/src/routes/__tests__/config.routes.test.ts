import request from 'supertest';
import express from 'express';
import configRoutes from '../config.routes';

const app = express();
app.use(express.json());
app.use('/api/config', configRoutes);

// Mock the config service
const mockConfigService = {
  getSanitizedConfig: jest.fn(() => ({
    PORT: 3000,
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    OPENAI_MODEL: 'gpt-3.5-turbo'
  })),
  update: jest.fn(),
  updateMultiple: jest.fn(),
  getOpenAIConfig: jest.fn(() => ({
    apiKey: 'sk-test1234567890abcdef1234567890abcdef',
    model: 'gpt-3.5-turbo',
    maxTokens: 1000
  })),
  isOpenAIConfigured: jest.fn(() => true),
  getAll: jest.fn(() => ({
    PORT: 3000,
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'sk-test1234567890abcdef1234567890abcdef'
  }))
};

jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: jest.fn(() => mockConfigService)
  }
}));

// Mock admin auth middleware
jest.mock('../../middleware/admin-auth.middleware', () => ({
  adminAuthMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'admin', role: 'admin' };
    next();
  })
}));

// Mock config schema
jest.mock('../../config/config.schema', () => ({
  configSchema: {
    validate: jest.fn((config) => {
      // Simulate validation logic
      if (config.PORT && (config.PORT < 1000 || config.PORT > 65535)) {
        return {
          error: {
            details: [{
              path: ['PORT'],
              message: 'Port must be between 1000 and 65535'
            }]
          }
        };
      }
      return { error: null };
    })
  }
}));

describe('Config Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/config', () => {
    test('should return sanitized configuration', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          PORT: 3000,
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
          OPENAI_MODEL: 'gpt-3.5-turbo'
        }
      });

      expect(mockConfigService.getSanitizedConfig).toHaveBeenCalledTimes(1);
    });

    test('should require admin authentication', async () => {
      const { adminAuthMiddleware } = require('../../middleware/admin-auth.middleware');
      
      await request(app).get('/api/config');
      
      expect(adminAuthMiddleware).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/config', () => {
    test('should update single configuration value', async () => {
      const updateData = {
        key: 'LOG_LEVEL',
        value: 'debug'
      };

      const response = await request(app)
        .put('/api/config')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Configuration updated successfully'
      });

      expect(mockConfigService.update).toHaveBeenCalledWith('LOG_LEVEL', 'debug');
    });

    test('should return 400 when key is missing', async () => {
      const response = await request(app)
        .put('/api/config')
        .send({ value: 'debug' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Configuration key is required'
      });
    });

    test('should handle update errors', async () => {
      mockConfigService.update.mockRejectedValueOnce(new Error('Invalid configuration'));

      const response = await request(app)
        .put('/api/config')
        .send({ key: 'INVALID_KEY', value: 'test' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid configuration'
      });
    });
  });

  describe('PUT /api/config/batch', () => {
    test('should update multiple configuration values', async () => {
      const updateData = {
        updates: {
          LOG_LEVEL: 'debug',
          PORT: 3001
        }
      };

      const response = await request(app)
        .put('/api/config/batch')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Configuration updated successfully'
      });

      expect(mockConfigService.updateMultiple).toHaveBeenCalledWith({
        LOG_LEVEL: 'debug',
        PORT: 3001
      });
    });

    test('should return 400 when updates object is missing', async () => {
      const response = await request(app)
        .put('/api/config/batch')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Updates object is required'
      });
    });

    test('should return 400 when updates is not an object', async () => {
      const response = await request(app)
        .put('/api/config/batch')
        .send({ updates: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Updates object is required'
      });
    });

    test('should handle batch update errors', async () => {
      mockConfigService.updateMultiple.mockRejectedValueOnce(new Error('Validation failed'));

      const response = await request(app)
        .put('/api/config/batch')
        .send({ updates: { INVALID_KEY: 'test' } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed'
      });
    });
  });

  describe('PUT /api/config/openai-key', () => {
    test('should update OpenAI API key', async () => {
      const apiKeyData = {
        apiKey: 'sk-new1234567890abcdef1234567890abcdef'
      };

      const response = await request(app)
        .put('/api/config/openai-key')
        .send(apiKeyData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'OpenAI API key updated successfully'
      });

      expect(mockConfigService.update).toHaveBeenCalledWith('OPENAI_API_KEY', apiKeyData.apiKey);
    });

    test('should return 400 when API key is missing', async () => {
      const response = await request(app)
        .put('/api/config/openai-key')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'API key is required'
      });
    });

    test('should validate API key format - missing sk- prefix', async () => {
      const response = await request(app)
        .put('/api/config/openai-key')
        .send({ apiKey: 'invalid-key' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid OpenAI API key format'
      });
    });

    test('should validate API key format - too short', async () => {
      const response = await request(app)
        .put('/api/config/openai-key')
        .send({ apiKey: 'sk-short' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid OpenAI API key format'
      });
    });

    test('should handle update errors', async () => {
      mockConfigService.update.mockRejectedValueOnce(new Error('Failed to save'));

      const response = await request(app)
        .put('/api/config/openai-key')
        .send({ apiKey: 'sk-valid1234567890abcdef1234567890abcdef' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to save'
      });
    });
  });

  describe('GET /api/config/openai', () => {
    test('should return OpenAI configuration with sanitized API key', async () => {
      const response = await request(app)
        .get('/api/config/openai')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          configured: true,
          apiKey: 'sk-***cdef',
          model: 'gpt-3.5-turbo',
          maxTokens: 1000
        }
      });

      expect(mockConfigService.getOpenAIConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigService.isOpenAIConfigured).toHaveBeenCalledTimes(1);
    });

    test('should handle missing API key in config', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValueOnce({
        model: 'gpt-3.5-turbo',
        maxTokens: 1000
      });
      mockConfigService.isOpenAIConfigured.mockReturnValueOnce(false);

      const response = await request(app)
        .get('/api/config/openai')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          configured: false,
          model: 'gpt-3.5-turbo',
          maxTokens: 1000
        }
      });
    });
  });

  describe('POST /api/config/validate', () => {
    test('should validate configuration successfully', async () => {
      const validationData = {
        updates: {
          PORT: 3001,
          LOG_LEVEL: 'debug'
        }
      };

      const response = await request(app)
        .post('/api/config/validate')
        .send(validationData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        valid: true,
        message: 'Configuration is valid'
      });

      const { configSchema } = require('../../config/config.schema');
      expect(configSchema.validate).toHaveBeenCalledWith({
        PORT: 3000,
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test1234567890abcdef1234567890abcdef',
        ...validationData.updates
      });
    });

    test('should return validation errors', async () => {
      const invalidData = {
        updates: {
          PORT: 999 // Invalid port number
        }
      };

      const response = await request(app)
        .post('/api/config/validate')
        .send(invalidData)
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        valid: false,
        errors: [{
          field: 'PORT',
          message: 'Port must be between 1000 and 65535'
        }]
      });
    });

    test('should return 400 when updates object is missing', async () => {
      const response = await request(app)
        .post('/api/config/validate')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Updates object is required'
      });
    });

    test('should return 400 when updates is not an object', async () => {
      const response = await request(app)
        .post('/api/config/validate')
        .send({ updates: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Updates object is required'
      });
    });

    test('should handle validation errors', async () => {
      mockConfigService.getAll.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/config/validate')
        .send({ updates: { PORT: 3001 } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('Authentication and Middleware', () => {
    test('should require admin authentication for all endpoints', async () => {
      const { adminAuthMiddleware } = require('../../middleware/admin-auth.middleware');
      
      await request(app).get('/api/config');
      await request(app).put('/api/config').send({ key: 'test', value: 'test' });
      await request(app).put('/api/config/batch').send({ updates: {} });
      await request(app).put('/api/config/openai-key').send({ apiKey: 'sk-test123' });
      await request(app).get('/api/config/openai');
      await request(app).post('/api/config/validate').send({ updates: {} });

      expect(adminAuthMiddleware).toHaveBeenCalledTimes(6);
    });
  });

  describe('Edge Cases', () => {
    test('should handle configuration keys with special characters', async () => {
      await request(app)
        .put('/api/config')
        .send({ key: 'REDIS_URL', value: 'redis://localhost:6379' })
        .expect(200);
    });

    test('should handle numeric configuration values', async () => {
      await request(app)
        .put('/api/config')
        .send({ key: 'MAX_CONNECTIONS', value: 100 })
        .expect(200);
    });

    test('should handle boolean configuration values', async () => {
      await request(app)
        .put('/api/config')
        .send({ key: 'DEBUG_MODE', value: true })
        .expect(200);
    });

    test('should handle null/undefined values in batch updates', async () => {
      await request(app)
        .put('/api/config/batch')
        .send({ updates: { OPTIONAL_KEY: null } })
        .expect(200);
    });
  });
});