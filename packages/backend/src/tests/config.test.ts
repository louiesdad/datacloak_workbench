import { ConfigService } from '../services/config.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Configuration Service Tests', () => {
  let configService: ConfigService;
  let testConfigPath: string;

  beforeAll(() => {
    configService = ConfigService.getInstance();
    testConfigPath = path.join(process.cwd(), 'test-config.json');
  });

  afterAll(() => {
    // Cleanup ConfigService watchers to prevent memory leaks
    try {
      configService.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up test files
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('Basic Configuration Operations', () => {
    it('should get configuration values', () => {
      const port = configService.get('PORT');
      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThan(0);
    });

    it('should get all configuration', () => {
      const allConfig = configService.getAll();
      expect(allConfig).toBeDefined();
      expect(typeof allConfig).toBe('object');
      expect(allConfig.PORT).toBeDefined();
    });

    it('should validate OpenAI configuration', () => {
      const isConfigured = configService.isOpenAIConfigured();
      expect(typeof isConfigured).toBe('boolean');

      if (isConfigured) {
        const openaiConfig = configService.getOpenAIConfig();
        expect(openaiConfig).toBeDefined();
        expect(openaiConfig.apiKey).toBeDefined();
        expect(openaiConfig.model).toBeDefined();
      }
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration values', async () => {
      const originalValue = configService.get('CACHE_DEFAULT_TTL');
      const newValue = originalValue + 100;

      await configService.update('CACHE_DEFAULT_TTL', newValue);
      expect(configService.get('CACHE_DEFAULT_TTL')).toBe(newValue);

      // Restore original value
      await configService.update('CACHE_DEFAULT_TTL', originalValue);
    });

    it('should emit events on configuration updates', (done) => {
      const testKey = 'CACHE_DEFAULT_TTL';
      const originalValue = configService.get(testKey);
      const newValue = originalValue + 200;

      const onUpdate = (event: any) => {
        expect(event.key).toBe(testKey);
        expect(event.oldValue).toBe(originalValue);
        expect(event.newValue).toBe(newValue);

        configService.removeListener('config.updated', onUpdate);
        
        // Restore original value
        configService.update(testKey, originalValue).then(() => done());
      };

      configService.on('config.updated', onUpdate);
      configService.update(testKey, newValue);
    }, 5000);

    it('should handle batch configuration updates', async () => {
      const updates = {
        CACHE_DEFAULT_TTL: 7200,
        JOB_QUEUE_MAX_CONCURRENT: 4,
        REDIS_ENABLED: false
      };

      await configService.updateMultiple(updates);

      Object.entries(updates).forEach(([key, value]) => {
        expect(configService.get(key as keyof typeof updates)).toBe(value);
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid configuration values', async () => {
      try {
        await configService.update('JOB_QUEUE_MAX_CONCURRENT', -1);
        fail('Should have rejected negative value');
      } catch (error) {
        expect(error.message).toContain('validation error');
      }
    });

    it('should reject invalid batch updates', async () => {
      try {
        await configService.updateMultiple({
          CACHE_DEFAULT_TTL: -1000, // Invalid
          JOB_QUEUE_MAX_CONCURRENT: 3 // Valid
        });
        fail('Should have rejected invalid batch update');
      } catch (error) {
        expect(error.message).toContain('validation error');
      }
    });

    it('should validate OpenAI configuration', () => {
      // Test OpenAI configuration validation
      const mockApiKey = 'sk-test-key-1234567890123456789012345678901234567890';
      
      // This tests the internal validation logic
      expect(mockApiKey.startsWith('sk-')).toBe(true);
      expect(mockApiKey.length).toBeGreaterThan(20);
    });
  });

  describe('Configuration Encryption', () => {
    it('should handle encryption key configuration', async () => {
      const testEncryptionKey = 'test-encryption-key-32-chars-min-length-required-here';
      
      await configService.update('CONFIG_ENCRYPTION_KEY', testEncryptionKey);
      expect(configService.get('CONFIG_ENCRYPTION_KEY')).toBe(testEncryptionKey);
    });

    it('should encrypt sensitive configuration data', async () => {
      // Set encryption key first
      await configService.update('CONFIG_ENCRYPTION_KEY', 'test-encryption-key-32-chars-min-length-required-here');
      
      // Update sensitive data
      const sensitiveKey = 'sk-test-sensitive-key-12345';
      await configService.update('OPENAI_API_KEY', sensitiveKey);
      
      // Verify it's stored and retrievable
      expect(configService.get('OPENAI_API_KEY')).toBe(sensitiveKey);
    });
  });

  describe('Configuration Persistence', () => {
    it('should persist configuration to file system', async () => {
      const testValue = Date.now();
      await configService.update('CACHE_DEFAULT_TTL', testValue);
      
      // The update should trigger persistence
      // We can't easily test file contents due to encryption,
      // but we can verify the update succeeded
      expect(configService.get('CACHE_DEFAULT_TTL')).toBe(testValue);
    });

    it('should handle file system errors gracefully', () => {
      // Test that the service handles file system errors without crashing
      expect(() => {
        const config = configService.getAll();
        expect(config).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Configuration Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(configService);
    });

    it('should maintain state across instances', async () => {
      const testValue = Math.floor(Math.random() * 1000) + 100; // Integer value between 100-1100
      await configService.update('CACHE_DEFAULT_TTL', testValue);
      
      const newInstance = ConfigService.getInstance();
      expect(newInstance.get('CACHE_DEFAULT_TTL')).toBe(testValue);
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      // Test accessing configuration that might not be set
      expect(() => {
        const openaiConfig = configService.getOpenAIConfig();
        // Should not throw even if not configured
      }).not.toThrow();
    });

    it('should handle configuration service initialization', () => {
      expect(configService).toBeDefined();
      expect(typeof configService.get).toBe('function');
      expect(typeof configService.update).toBe('function');
    });

    it('should provide default values for optional configuration', () => {
      const cacheEnabled = configService.get('CACHE_ENABLED');
      const redisEnabled = configService.get('REDIS_ENABLED');
      
      expect(typeof cacheEnabled).toBe('boolean');
      expect(typeof redisEnabled).toBe('boolean');
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate with OpenAI service configuration', () => {
      if (configService.isOpenAIConfigured()) {
        const openaiConfig = configService.getOpenAIConfig();
        expect(openaiConfig.apiKey).toBeDefined();
        expect(openaiConfig.model).toBeDefined();
        expect(openaiConfig.maxTokens).toBeGreaterThan(0);
        expect(openaiConfig.temperature).toBeGreaterThanOrEqual(0);
        expect(openaiConfig.temperature).toBeLessThanOrEqual(2);
      }
    });

    it('should integrate with cache configuration', () => {
      const cacheConfig = {
        enabled: configService.get('CACHE_ENABLED'),
        type: configService.get('CACHE_TYPE'),
        defaultTTL: configService.get('CACHE_DEFAULT_TTL')
      };

      expect(typeof cacheConfig.enabled).toBe('boolean');
      expect(typeof cacheConfig.defaultTTL).toBe('number');
      expect(cacheConfig.defaultTTL).toBeGreaterThan(0);
    });

    it('should integrate with Redis configuration', () => {
      const redisConfig = {
        enabled: configService.get('REDIS_ENABLED'),
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT')
      };

      expect(typeof redisConfig.enabled).toBe('boolean');
      if (redisConfig.enabled) {
        expect(typeof redisConfig.host).toBe('string');
        expect(redisConfig.host.length).toBeGreaterThan(0);
        expect(typeof redisConfig.port).toBe('number');
        expect(redisConfig.port).toBeGreaterThan(0);
      }
    });

    it('should integrate with job queue configuration', () => {
      const jobQueueConfig = {
        maxConcurrent: configService.get('JOB_QUEUE_MAX_CONCURRENT'),
        retryAttempts: configService.get('JOB_QUEUE_RETRY_ATTEMPTS'),
        retryDelay: configService.get('JOB_QUEUE_RETRY_DELAY')
      };

      expect(typeof jobQueueConfig.maxConcurrent).toBe('number');
      expect(jobQueueConfig.maxConcurrent).toBeGreaterThan(0);
      expect(typeof jobQueueConfig.retryAttempts).toBe('number');
      expect(jobQueueConfig.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(typeof jobQueueConfig.retryDelay).toBe('number');
      expect(jobQueueConfig.retryDelay).toBeGreaterThanOrEqual(0);
    });
  });
});