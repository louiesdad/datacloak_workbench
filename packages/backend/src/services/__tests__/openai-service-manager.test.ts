import { ConfigService } from '../config.service';
import { getOpenAIServiceInstance, isOpenAIConfigured } from '../openai-service-manager';
import { OpenAIService } from '../openai.service';

// Mock dependencies
jest.mock('../config.service');
jest.mock('../openai.service');
jest.mock('../cache.service', () => ({
  getCacheService: jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([])
  })
}));

describe('OpenAIServiceManager', () => {
  let mockConfigService: jest.Mocked<ConfigService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();
    
    // Setup config service mock
    mockConfigService = {
      isOpenAIConfigured: jest.fn(),
      getOpenAIConfig: jest.fn(),
      on: jest.fn(),
      get: jest.fn(),
      getInstance: jest.fn()
    } as any;
    
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
  });

  afterEach(() => {
    // Clean up singleton instance
    const manager = require('../openai-service-manager');
    if (manager.OpenAIServiceManager) {
      manager.OpenAIServiceManager.instance = null;
    }
  });

  describe('getOpenAIServiceInstance', () => {
    it('should return null when OpenAI is not configured', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(false);
      
      const service = getOpenAIServiceInstance();
      
      expect(service).toBeNull();
      expect(mockConfigService.isOpenAIConfigured).toHaveBeenCalled();
    });

    it('should return OpenAI service instance when properly configured', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000
      });
      
      const service = getOpenAIServiceInstance();
      
      expect(service).toBeInstanceOf(OpenAIService);
      expect(mockConfigService.getOpenAIConfig).toHaveBeenCalled();
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      });
      
      const service1 = getOpenAIServiceInstance();
      const service2 = getOpenAIServiceInstance();
      
      expect(service1).toBe(service2);
      expect(mockConfigService.getOpenAIConfig).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle missing API key gracefully', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        model: 'gpt-3.5-turbo',
        // apiKey is missing
      });
      
      const service = getOpenAIServiceInstance();
      
      expect(service).toBeNull();
    });
  });

  describe('isOpenAIConfigured', () => {
    it('should return false when service is not configured', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(false);
      
      const result = isOpenAIConfigured();
      
      expect(result).toBe(false);
    });

    it('should return true when service is configured', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      });
      
      // Initialize the service first
      getOpenAIServiceInstance();
      
      const result = isOpenAIConfigured();
      
      expect(result).toBe(true);
    });
  });

  describe('Configuration updates', () => {
    it('should listen for OpenAI configuration updates', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      });
      
      // Initialize the service
      getOpenAIServiceInstance();
      
      expect(mockConfigService.on).toHaveBeenCalledWith(
        'config.updated',
        expect.any(Function)
      );
    });

    it('should reinitialize service when OpenAI config is updated', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      });
      
      let configUpdateCallback: any;
      mockConfigService.on.mockImplementation((event, callback) => {
        if (event === 'config.updated') {
          configUpdateCallback = callback;
        }
      });
      
      // Initialize the service
      getOpenAIServiceInstance();
      
      // Update config
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'new-api-key',
        model: 'gpt-4'
      });
      
      // Trigger config update
      configUpdateCallback({ key: 'OPENAI_API_KEY' });
      
      // Should have been called twice (initial + update)
      expect(mockConfigService.getOpenAIConfig).toHaveBeenCalledTimes(2);
    });

    it('should not reinitialize for non-OpenAI config updates', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo'
      });
      
      let configUpdateCallback: any;
      mockConfigService.on.mockImplementation((event, callback) => {
        if (event === 'config.updated') {
          configUpdateCallback = callback;
        }
      });
      
      // Initialize the service
      getOpenAIServiceInstance();
      
      // Trigger non-OpenAI config update
      configUpdateCallback({ key: 'DATABASE_URL' });
      
      // Should only have been called once (initial)
      expect(mockConfigService.getOpenAIConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle initialization errors gracefully', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockImplementation(() => {
        throw new Error('Config error');
      });
      
      const service = getOpenAIServiceInstance();
      
      expect(service).toBeNull();
    });

    it('should log errors during initialization', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockConfigService.isOpenAIConfigured.mockReturnValue(true);
      mockConfigService.getOpenAIConfig.mockImplementation(() => {
        throw new Error('Config error');
      });
      
      getOpenAIServiceInstance();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize OpenAI service:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});