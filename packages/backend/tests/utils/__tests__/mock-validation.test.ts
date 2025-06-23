import { MockFactory } from '../mock-factory';
import { ExpressAppFactory } from '../express-app-factory';
import { EventTestHelpers } from '../event-test-helpers';
import { IntegrationTestBase, APIIntegrationTestBase } from '../integration-test-base';

describe('Mock Interface Validation', () => {
  describe('Service Mocks', () => {
    it('should create ConfigService mock with all required methods', () => {
      const configMock = MockFactory.createConfigService();
      
      // Test all expected methods exist
      expect(typeof configMock.get).toBe('function');
      expect(typeof configMock.set).toBe('function');
      expect(typeof configMock.has).toBe('function');
      expect(typeof configMock.reload).toBe('function');
      expect(typeof configMock.getAll).toBe('function');
      expect(typeof configMock.getSanitizedConfig).toBe('function');
      expect(typeof configMock.isOpenAIConfigured).toBe('function');
      expect(typeof configMock.getOpenAIConfig).toBe('function');
      expect(typeof configMock.update).toBe('function');
      expect(typeof configMock.updateMultiple).toBe('function');
      expect(typeof configMock.destroy).toBe('function');
      expect(typeof configMock.on).toBe('function');
      expect(typeof configMock.off).toBe('function');
      expect(typeof configMock.emit).toBe('function');

      // Test return values
      expect(configMock.get('NODE_ENV')).toBe('test');
      expect(configMock.get('PORT')).toBe(3001);
      expect(configMock.has('NODE_ENV')).toBe(true);
      expect(configMock.has('NONEXISTENT')).toBe(false);
      expect(configMock.isOpenAIConfigured()).toBe(false);
    });

    it('should create WebSocketService mock with proper state management', () => {
      const wsMock = MockFactory.createWebSocketService();
      
      // Test connection management
      const clientId = wsMock.handleConnection({}, {});
      expect(typeof clientId).toBe('string');
      expect(wsMock.isClientConnected(clientId)).toBe(true);
      
      // Test disconnection
      wsMock.disconnect(clientId);
      expect(wsMock.isClientConnected(clientId)).toBe(false);
      
      // Test client list
      const clientId2 = wsMock.handleConnection({}, {});
      const clients = wsMock.getConnectedClients();
      expect(clients).toContain(clientId2);
    });

    it('should create CacheService mock with working cache operations', async () => {
      const cacheMock = MockFactory.createCacheService();
      
      // Test cache operations
      await cacheMock.set('test-key', 'test-value');
      const value = await cacheMock.get('test-key');
      expect(value).toBe('test-value');
      
      const exists = await cacheMock.exists('test-key');
      expect(exists).toBe(true);
      
      const deleted = await cacheMock.delete('test-key');
      expect(deleted).toBe(true);
      
      const notExists = await cacheMock.exists('test-key');
      expect(notExists).toBe(false);
    });

    it('should create JobQueueService mock with job lifecycle', async () => {
      const jobMock = MockFactory.createJobQueueService();
      
      // Test job creation
      const jobId = await jobMock.add('test-job', { data: 'test' });
      expect(typeof jobId).toBe('string');
      
      // Test job retrieval
      const job = await jobMock.getJob(jobId);
      expect(job).toMatchObject({
        id: jobId,
        type: 'test-job',
        data: { data: 'test' },
        status: 'pending'
      });
      
      // Test job removal
      const removed = await jobMock.removeJob(jobId);
      expect(removed).toBe(true);
      
      const notFound = await jobMock.getJob(jobId);
      expect(notFound).toBeNull();
    });

    it('should create OpenAI service mock with async operations', async () => {
      const openaiMock = MockFactory.createOpenAIService();
      
      // Test sentiment analysis
      const result = await openaiMock.analyzeSentiment('test text');
      expect(result).toMatchObject({
        sentiment: 'positive',
        score: 0.8,
        confidence: 0.9
      });
      
      // Test batch analysis
      const batchResults = await openaiMock.analyzeBatch(['text1', 'text2']);
      expect(Array.isArray(batchResults)).toBe(true);
      expect(batchResults).toHaveLength(1);
      
      // Test configuration check
      expect(openaiMock.isConfigured()).toBe(true);
      expect(await openaiMock.testConnection()).toBe(true);
    });

    it('should create DataCloak service mock with PII detection', async () => {
      const dataCloakMock = MockFactory.createDataCloakService();
      
      // Test PII detection
      const piiResult = await dataCloakMock.detectPII('test data');
      expect(piiResult).toMatchObject({
        hasPII: false,
        detectedTypes: [],
        maskedData: 'test data'
      });
      
      // Test data masking
      const masked = await dataCloakMock.maskData('sensitive data');
      expect(masked).toBe('masked data');
      
      // Test compliance validation
      const compliance = await dataCloakMock.validateCompliance({});
      expect(compliance).toMatchObject({
        isCompliant: true,
        violations: []
      });
    });

    it('should create FileStreamService mock with chunking support', async () => {
      const fileStreamMock = MockFactory.createFileStreamService();
      
      // Test chunk reading
      const chunk = await fileStreamMock.readFileChunk('test-file', 0, 1024);
      expect(chunk).toMatchObject({
        chunkInfo: {
          index: 0,
          size: 1024,
          offset: 0,
          isLast: false
        },
        data: [{ test: 'data' }],
        processedRows: 1,
        hasMore: true
      });
      
      // Test memory estimation
      const memoryUsage = fileStreamMock.estimateMemoryUsage(1024);
      expect(memoryUsage).toBe(1024);
    });
  });

  describe('Express App Factory', () => {
    it('should create test app with proper middleware', () => {
      const app = ExpressAppFactory.createTestApp();
      expect(app).toBeDefined();
      
      // App should have basic middleware
      expect(app._router).toBeDefined();
    });

    it('should create integration test app with auth and rate limiting', () => {
      const app = ExpressAppFactory.createIntegrationTestApp();
      expect(app).toBeDefined();
    });

    it('should create unit test app without extra middleware', () => {
      const app = ExpressAppFactory.createUnitTestApp();
      expect(app).toBeDefined();
    });
  });

  describe('Event Test Helpers', () => {
    beforeEach(() => {
      EventTestHelpers.setupEventCapture();
    });

    afterEach(() => {
      EventTestHelpers.teardownEventCapture();
    });

    it('should capture events correctly', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      mockEmitter.emit('test-event', { data: 'test' });
      
      const capturedEvents = (mockEmitter as any).getCapturedEvents();
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0]).toMatchObject({
        eventType: 'test-event',
        data: { data: 'test' }
      });
    });

    it('should wait for specific events', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      // Emit event after a delay
      setTimeout(() => {
        mockEmitter.emit('delayed-event', { success: true });
      }, 10);
      
      // Wait for the event
      const eventPromise = new Promise((resolve) => {
        mockEmitter.on('delayed-event', (data) => {
          resolve(data);
        });
      });
      
      const eventData = await eventPromise;
      expect(eventData).toMatchObject({ success: true });
    });

    it('should filter events by type', () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      mockEmitter.emit('type-a', { id: 1 });
      mockEmitter.emit('type-b', { id: 2 });
      mockEmitter.emit('type-a', { id: 3 });
      
      const typeAEvents = (mockEmitter as any).getEventsByType('type-a');
      expect(typeAEvents).toHaveLength(2);
      expect(typeAEvents[0].data.id).toBe(1);
      expect(typeAEvents[1].data.id).toBe(3);
    });
  });

  describe('Integration Test Base Classes', () => {
    class TestAPIIntegration extends APIIntegrationTestBase {
      protected async seedDatabase(): Promise<void> {
        await super.seedDatabase();
      }

      protected async customSetup(): Promise<void> {
        // Custom setup
      }

      protected async customTeardown(): Promise<void> {
        // Custom teardown
      }
    }

    it('should setup and teardown API integration test properly', async () => {
      const test = new TestAPIIntegration({
        useDatabase: true,
        useEventCapture: false
      });
      
      await test.setup();
      expect(test['app']).toBeDefined();
      expect(test['request']).toBeDefined();
      expect(test['db']).toBeDefined();
      
      // Test authentication
      const userToken = await test['authenticateAsUser']();
      expect(userToken).toBe('valid-test-token');
      
      const adminToken = await test['authenticateAsAdmin']();
      expect(adminToken).toBe('admin-test-token');
      
      await test.teardown();
    });
  });

  describe('Redis Mock Interface', () => {
    it('should validate Redis mock has EventEmitter interface', () => {
      const Redis = require('../../services/__mocks__/ioredis');
      const redis = new Redis();
      
      // Test EventEmitter methods
      expect(typeof redis.on).toBe('function');
      expect(typeof redis.emit).toBe('function');
      expect(typeof redis.removeListener).toBe('function');
      
      // Test Redis-specific methods
      expect(typeof redis.get).toBe('function');
      expect(typeof redis.set).toBe('function');
      expect(typeof redis.del).toBe('function');
      expect(typeof redis.exists).toBe('function');
      
      // Test Redis event handling
      let readyEventFired = false;
      redis.on('ready', () => {
        readyEventFired = true;
      });
      
      // Give time for ready event to fire
      setTimeout(() => {
        expect(readyEventFired).toBe(true);
      }, 5);
    });

    it('should handle Redis operations correctly', async () => {
      const Redis = require('../../services/__mocks__/ioredis');
      const redis = new Redis();
      
      // Test basic operations
      await redis.set('test-key', 'test-value');
      const value = await redis.get('test-key');
      expect(value).toBe('test-value');
      
      const exists = await redis.exists('test-key');
      expect(exists).toBe(1);
      
      await redis.del('test-key');
      const notExists = await redis.exists('test-key');
      expect(notExists).toBe(0);
    });
  });
});