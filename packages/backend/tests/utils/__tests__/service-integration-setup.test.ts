/**
 * Test for Service Integration Setup
 * Validates that the service container fixes integration issues
 */

import { 
  setupTestServiceContainer, 
  cleanupTestServiceContainer, 
  getTestService,
  mockService,
  mockServiceWithFactory
} from '../service-integration-setup';
import { getContainer } from '../../../src/container/service-container';
import { SERVICE_TOKENS } from '../../../src/container/interfaces';

describe('Service Integration Setup', () => {
  beforeEach(() => {
    setupTestServiceContainer();
  });

  afterEach(() => {
    cleanupTestServiceContainer();
  });

  describe('Core Service Registration', () => {
    it('should register all core services without errors', () => {
      const container = getContainer();
      
      // Verify core services are registered
      expect(container.has(SERVICE_TOKENS.Logger)).toBe(true);
      expect(container.has(SERVICE_TOKENS.Config)).toBe(true);
      expect(container.has(SERVICE_TOKENS.EventBus)).toBe(true);
      expect(container.has(SERVICE_TOKENS.Cache)).toBe(true);
      expect(container.has(SERVICE_TOKENS.RateLimiter)).toBe(true);
    });

    it('should register test-specific services', () => {
      const container = getContainer();
      
      expect(container.has('EnhancedDatabase')).toBe(true);
      expect(container.has('ApiClient')).toBe(true);
      expect(container.has('TransformPersistence')).toBe(true);
      expect(container.has('DatabaseConnection')).toBe(true);
    });

    it('should resolve services without circular dependencies', () => {
      const logger = getTestService(SERVICE_TOKENS.Logger);
      const config = getTestService(SERVICE_TOKENS.Config);
      const eventBus = getTestService(SERVICE_TOKENS.EventBus);
      
      expect(logger).toBeDefined();
      expect(config).toBeDefined();
      expect(eventBus).toBeDefined();
    });
  });

  describe('Mock Service Functionality', () => {
    it('should provide working mock for EnhancedDatabase', async () => {
      const db = getTestService<any>('EnhancedDatabase');
      
      const result = await db.executeQuery('SELECT * FROM test');
      expect(result).toEqual([]);
      
      const healthCheck = await db.healthCheck();
      expect(healthCheck.overall).toBe(true);
    });

    it('should provide working mock for ApiClient', async () => {
      const apiClient = getTestService<any>('ApiClient');
      
      const loginResult = await apiClient.login('test', 'password');
      expect(loginResult.success).toBe(true);
      
      const healthStatus = await apiClient.getHealthStatus();
      expect(healthStatus.status).toBe('healthy');
    });

    it('should provide working mock for TransformPersistence', async () => {
      const transformPersistence = getTestService<any>('TransformPersistence');
      
      const saveResult = await transformPersistence.saveTransform('test', []);
      expect(saveResult.id).toBe('test-transform');
      
      const transforms = await transformPersistence.getTransforms();
      expect(Array.isArray(transforms)).toBe(true);
    });
  });

  describe('Service Mocking Utilities', () => {
    it('should allow mocking specific services', () => {
      const mockImpl = {
        customMethod: jest.fn().mockReturnValue('mocked')
      };
      
      mockService('CustomService', mockImpl);
      
      const service = getTestService<any>('CustomService');
      expect(service.customMethod()).toBe('mocked');
    });

    it('should allow factory-based service mocking', () => {
      mockServiceWithFactory('FactoryService', () => ({
        getValue: () => 'factory-created',
        getDependency: (dep: any) => `using-${dep.name}`
      }), [SERVICE_TOKENS.Config]);
      
      const service = getTestService<any>('FactoryService');
      expect(service.getValue()).toBe('factory-created');
    });
  });

  describe('Service Dependencies', () => {
    it('should inject dependencies properly', () => {
      const config = getTestService<any>(SERVICE_TOKENS.Config);
      const logger = getTestService<any>(SERVICE_TOKENS.Logger);
      
      // Verify that services can be retrieved and used
      expect(typeof config.get).toBe('function');
      expect(typeof logger.info).toBe('function');
      
      // Test that they work as expected
      const configValue = config.get('NODE_ENV', 'development');
      expect(configValue).toBe('test');
    });

    it('should handle nested dependencies without circular issues', () => {
      // This should not throw due to circular dependency detection
      expect(() => {
        getTestService(SERVICE_TOKENS.RateLimiter);
      }).not.toThrow();
    });
  });

  describe('Container State Management', () => {
    it('should clear container state between tests', () => {
      // Add a custom service
      mockService('TempService', { value: 'temp' });
      expect(getContainer().has('TempService')).toBe(true);
      
      // Cleanup and setup again
      cleanupTestServiceContainer();
      setupTestServiceContainer();
      
      // Custom service should be gone, core services should be back
      expect(getContainer().has('TempService')).toBe(false);
      expect(getContainer().has(SERVICE_TOKENS.Logger)).toBe(true);
    });

    it('should maintain singleton behavior', () => {
      const service1 = getTestService(SERVICE_TOKENS.Config);
      const service2 = getTestService(SERVICE_TOKENS.Config);
      
      expect(service1).toBe(service2);
    });
  });

  describe('Performance and Reliability', () => {
    it('should resolve services quickly without blocking', async () => {
      const startTime = Date.now();
      
      // Resolve multiple services
      getTestService(SERVICE_TOKENS.Logger);
      getTestService(SERVICE_TOKENS.Config);
      getTestService('EnhancedDatabase');
      getTestService('ApiClient');
      
      const endTime = Date.now();
      
      // Should resolve very quickly (under 100ms for all services)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle service errors gracefully', () => {
      // Mock a service that throws during creation
      mockServiceWithFactory('ErrorService', () => {
        throw new Error('Service initialization failed');
      });
      
      expect(() => {
        getTestService('ErrorService');
      }).toThrow('Service initialization failed');
      
      // Other services should still work
      expect(() => {
        getTestService(SERVICE_TOKENS.Logger);
      }).not.toThrow();
    });
  });
});