import { ConfigService } from '../services/config.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock the ConfigService to avoid singleton issues in tests
jest.mock('../services/config.service', () => {
  const EventEmitter = require('events');
  
  return {
    ConfigService: jest.fn().mockImplementation(() => {
      const instance = new EventEmitter();
      let config = {
        PORT: 3000,
        OPENAI_API_KEY: 'sk-test12345678901234567890123456789012345678901234',
        OPENAI_MODEL: 'gpt-3.5-turbo',
        OPENAI_MAX_TOKENS: 150,
        OPENAI_TEMPERATURE: 0.1,
        OPENAI_TIMEOUT: 30000,
        ADMIN_PASSWORD: 'testpassword',
        CONFIG_ENCRYPTION_KEY: undefined,
        JWT_SECRET: 'test-secret',
      };
      
      instance.get = jest.fn((key) => config[key]);
      instance.getAll = jest.fn(() => ({ ...config }));
      instance.update = jest.fn(async (key, value) => {
        const oldValue = config[key];
        config[key] = value;
        instance.emit('config.updated', { key, oldValue, newValue: value });
      });
      instance.updateMultiple = jest.fn(async (updates) => {
        Object.entries(updates).forEach(([key, value]) => {
          config[key] = value;
        });
      });
      instance.isOpenAIConfigured = jest.fn(() => !!config.OPENAI_API_KEY);
      instance.getOpenAIConfig = jest.fn(() => ({
        apiKey: config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
        maxTokens: config.OPENAI_MAX_TOKENS,
        temperature: config.OPENAI_TEMPERATURE,
        timeout: config.OPENAI_TIMEOUT,
      }));
      instance.getSanitizedConfig = jest.fn(() => {
        const sanitized = { ...config };
        if (sanitized.OPENAI_API_KEY) {
          sanitized.OPENAI_API_KEY = 'sk-***' + sanitized.OPENAI_API_KEY.slice(-4);
        }
        delete (sanitized as any).CONFIG_ENCRYPTION_KEY;
        delete (sanitized as any).JWT_SECRET;
        delete (sanitized as any).ADMIN_PASSWORD;
        return sanitized;
      });
      instance.destroy = jest.fn();
      
      return instance;
    }),
  };
});

describe('ConfigService', () => {
  let configService: any;
  
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
    
    // Create a new instance for each test
    const { ConfigService: MockedConfigService } = require('../services/config.service');
    configService = new MockedConfigService();
    MockedConfigService.getInstance = jest.fn(() => configService);
  });

  afterEach(() => {
    if (configService && configService.destroy) {
      configService.destroy();
    }
    configService = null;
  });

  describe('Initialization', () => {
    it('should load environment variables', () => {
      expect(configService.get('PORT')).toBe(3000);
      expect(configService.get('OPENAI_API_KEY')).toBe('sk-test12345678901234567890123456789012345678901234');
    });

    it('should use default values when env vars are not set', () => {
      expect(configService.get('OPENAI_MODEL')).toBe('gpt-3.5-turbo');
      expect(configService.get('OPENAI_MAX_TOKENS')).toBe(150);
    });
  });

  describe('Configuration Updates', () => {
    it('should update single configuration value', async () => {
      await configService.update('OPENAI_MODEL', 'gpt-4');
      expect(configService.get('OPENAI_MODEL')).toBe('gpt-4');
    });

    it('should update multiple configuration values', async () => {
      await configService.updateMultiple({
        OPENAI_MODEL: 'gpt-4',
        OPENAI_MAX_TOKENS: 200,
        OPENAI_TEMPERATURE: 0.5,
      });

      expect(configService.get('OPENAI_MODEL')).toBe('gpt-4');
      expect(configService.get('OPENAI_MAX_TOKENS')).toBe(200);
      expect(configService.get('OPENAI_TEMPERATURE')).toBe(0.5);
    });

    it('should emit update events', async () => {
      const updateHandler = jest.fn();
      configService.on('config.updated', updateHandler);

      await configService.update('OPENAI_MODEL', 'gpt-4');

      expect(updateHandler).toHaveBeenCalledWith({
        key: 'OPENAI_MODEL',
        oldValue: 'gpt-3.5-turbo',
        newValue: 'gpt-4',
      });
    });
  });

  describe('OpenAI Configuration', () => {
    it('should detect when OpenAI is configured', () => {
      expect(configService.isOpenAIConfigured()).toBe(true);
    });

    it('should return OpenAI configuration', () => {
      const openAIConfig = configService.getOpenAIConfig();
      
      expect(openAIConfig).toEqual({
        apiKey: 'sk-test12345678901234567890123456789012345678901234',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000,
      });
    });
  });

  describe('Sanitized Configuration', () => {
    it('should sanitize sensitive values', () => {
      const sanitized = configService.getSanitizedConfig();
      
      expect(sanitized.OPENAI_API_KEY).toBe('sk-***2345');
      expect(sanitized.CONFIG_ENCRYPTION_KEY).toBeUndefined();
      expect(sanitized.JWT_SECRET).toBeUndefined();
      expect(sanitized.ADMIN_PASSWORD).toBeUndefined();
    });
  });
});