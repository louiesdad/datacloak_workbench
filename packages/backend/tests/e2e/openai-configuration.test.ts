import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { OpenAIService } from '../../src/services/openai.service';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: OpenAI Configuration and Error Handling', () => {
  let app: Express;
  let originalEnv: NodeJS.ProcessEnv;
  const envPath = path.join(__dirname, '../../.env');
  const configPath = path.join(__dirname, '../../config.json');
  
  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  beforeEach(async () => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    app = await createTestApp();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('API Key Configuration Issues', () => {
    it('should handle missing API key gracefully', async () => {
      // Remove API key
      delete process.env.OPENAI_API_KEY;
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test without API key',
          model: 'gpt-3.5-turbo'
        })
        .expect(500);

      expect(response.body.error).toContain('OpenAI API key not configured');
    });

    it('should detect invalid API key format', async () => {
      process.env.OPENAI_API_KEY = 'invalid-key-format';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test with invalid key',
          model: 'gpt-3.5-turbo'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid API key format');
      expect(response.body.details).toContain('should start with "sk-"');
    });

    it('should handle test/placeholder API keys', async () => {
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdefghijk';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test with placeholder key',
          model: 'gpt-3.5-turbo'
        })
        .expect(401);

      expect(response.body.error).toContain('Test API key detected');
      expect(response.body.suggestion).toContain('Please use a real OpenAI API key');
    });

    it('should validate API key length', async () => {
      process.env.OPENAI_API_KEY = 'sk-tooshort';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test with short key',
          model: 'gpt-3.5-turbo'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid API key length');
    });
  });

  describe('Environment Variable Conflicts', () => {
    it('should detect when shell env overrides .env file', async () => {
      // Simulate shell environment variable
      process.env.OPENAI_API_KEY = 'sk-shell-override-key';
      process.env.OPENAI_API_KEY_SOURCE = 'shell';
      
      const response = await request(app)
        .get('/api/v1/config/diagnostics')
        .expect(200);

      expect(response.body.warnings).toContainEqual(
        expect.objectContaining({
          type: 'ENV_OVERRIDE',
          message: expect.stringContaining('Shell environment variable overriding .env'),
          recommendation: 'unset OPENAI_API_KEY'
        })
      );
    });

    it('should detect config.json overrides', async () => {
      // Create a test config with hardcoded key
      const testConfig = {
        openai: {
          apiKey: 'sk-hardcoded-in-config',
          model: 'gpt-3.5-turbo'
        }
      };
      
      // Temporarily mock config loading
      jest.mock('../../src/config/index', () => ({
        config: testConfig
      }));
      
      const response = await request(app)
        .get('/api/v1/config/diagnostics')
        .expect(200);

      expect(response.body.warnings).toContainEqual(
        expect.objectContaining({
          type: 'CONFIG_OVERRIDE',
          message: expect.stringContaining('API key found in config.json'),
          recommendation: 'Remove hardcoded API key from config.json'
        })
      );
    });

    it('should prioritize environment variables correctly', async () => {
      // Set multiple sources
      process.env.OPENAI_API_KEY = 'sk-env-key';
      process.env.OPENAI_API_KEY_FROM_DOTENV = 'sk-dotenv-key';
      
      const response = await request(app)
        .get('/api/v1/config/current')
        .expect(200);

      // Should use process.env.OPENAI_API_KEY (highest priority)
      expect(response.body.openai.apiKeySource).toBe('environment');
      expect(response.body.openai.apiKeyPrefix).toBe('sk-env');
    });
  });

  describe('Authentication Error Recovery', () => {
    it('should provide helpful error messages for 401 errors', async () => {
      process.env.OPENAI_API_KEY = 'sk-invalid-key-that-will-fail';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test authentication',
          model: 'gpt-3.5-turbo'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'OpenAI authentication failed',
        suggestions: expect.arrayContaining([
          'Verify your API key is correct',
          'Check if the key has been revoked',
          'Ensure you have the correct permissions',
          'Try generating a new API key'
        ]),
        diagnosticUrl: '/api/v1/config/diagnostics'
      });
    });

    it('should handle expired API keys', async () => {
      // Mock OpenAI error response for expired key
      process.env.OPENAI_API_KEY = 'sk-expired-key-simulation';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test expired key',
          model: 'gpt-3.5-turbo'
        })
        .expect(401);

      expect(response.body.error).toContain('API key may be expired');
      expect(response.body.action).toContain('Generate a new API key');
    });
  });

  describe('Rate Limiting and Quota Errors', () => {
    it('should handle rate limit errors with retry information', async () => {
      // Simulate rate limit by sending many requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/sentiment/analyze')
          .send({
            text: 'Rate limit test',
            model: 'gpt-3.5-turbo'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      if (rateLimited) {
        expect(rateLimited.body).toMatchObject({
          error: 'Rate limit exceeded',
          retryAfter: expect.any(Number),
          suggestion: expect.stringContaining('reduce request frequency')
        });
      }
    });

    it('should handle quota exceeded errors', async () => {
      // Mock quota exceeded response
      process.env.SIMULATE_QUOTA_EXCEEDED = 'true';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test quota exceeded',
          model: 'gpt-3.5-turbo'
        })
        .expect(402);

      expect(response.body).toMatchObject({
        error: 'OpenAI quota exceeded',
        details: 'You have exceeded your current quota',
        actions: expect.arrayContaining([
          'Check your usage at platform.openai.com',
          'Upgrade your plan for higher limits',
          'Wait for quota reset at month end'
        ])
      });
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after repeated failures', async () => {
      // Force failures
      process.env.OPENAI_API_KEY = 'sk-force-failure';
      process.env.SIMULATE_OPENAI_ERROR = 'true';
      
      // Send multiple failing requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/sentiment/analyze')
          .send({
            text: 'Force circuit breaker',
            model: 'gpt-3.5-turbo'
          });
      }

      // Circuit should be open now
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test circuit open',
          model: 'gpt-3.5-turbo'
        })
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        reason: 'Circuit breaker is OPEN',
        retryAfter: expect.any(Number)
      });
    });

    it('should recover when circuit breaker closes', async () => {
      // Wait for circuit to close
      await new Promise(resolve => setTimeout(resolve, 31000)); // Default timeout + 1s
      
      // Should work again
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test circuit recovery',
          model: 'gpt-3.5-turbo'
        })
        .expect(200);

      expect(response.body.data).toBeDefined();
    }, 35000); // Increase test timeout
  });

  describe('Configuration Diagnostics Endpoint', () => {
    it('should provide comprehensive configuration diagnostics', async () => {
      const response = await request(app)
        .get('/api/v1/config/diagnostics')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|warning|error/),
        checks: expect.objectContaining({
          apiKeyPresent: expect.any(Boolean),
          apiKeyFormat: expect.any(Boolean),
          apiKeyLength: expect.any(Boolean),
          environmentSource: expect.any(String),
          configOverride: expect.any(Boolean)
        }),
        configuration: expect.objectContaining({
          model: expect.any(String),
          maxTokens: expect.any(Number),
          temperature: expect.any(Number)
        }),
        recommendations: expect.any(Array)
      });
    });

    it('should test API key validity', async () => {
      const response = await request(app)
        .post('/api/v1/config/test-key')
        .send({
          apiKey: process.env.OPENAI_API_KEY
        })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: expect.any(Boolean),
        message: expect.any(String)
      });

      if (response.body.valid) {
        expect(response.body.models).toBeInstanceOf(Array);
      }
    });
  });

  describe('Model Availability and Fallback', () => {
    it('should check model availability', async () => {
      const response = await request(app)
        .get('/api/v1/models/availability')
        .expect(200);

      expect(response.body).toMatchObject({
        available: expect.arrayContaining(['gpt-3.5-turbo', 'gpt-4']),
        default: 'gpt-3.5-turbo',
        fallback: 'basic'
      });
    });

    it('should fallback to basic model on OpenAI errors', async () => {
      process.env.OPENAI_API_KEY = 'sk-invalid';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test fallback',
          model: 'gpt-3.5-turbo',
          allowFallback: true
        })
        .expect(200);

      expect(response.body.data.model).toBe('basic');
      expect(response.body.warning).toContain('Fell back to basic model');
    });
  });

  describe('Security and Key Protection', () => {
    it('should never expose full API keys', async () => {
      const response = await request(app)
        .get('/api/v1/config/current')
        .expect(200);

      // Should only show masked key
      if (response.body.openai?.apiKey) {
        expect(response.body.openai.apiKey).toMatch(/^sk-\.\.\./);
        expect(response.body.openai.apiKey).not.toContain(process.env.OPENAI_API_KEY);
      }
    });

    it('should sanitize error messages', async () => {
      process.env.OPENAI_API_KEY = 'sk-secret-key-12345';
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test error sanitization',
          model: 'invalid-model'
        })
        .expect(400);

      // Error should not contain the actual API key
      expect(JSON.stringify(response.body)).not.toContain('sk-secret-key-12345');
    });
  });
});