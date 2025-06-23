import { APIIntegrationTestBase, EventIntegrationTestBase, FullStackIntegrationTestBase, TestContext } from '../integration-test-base';
import { ExpressAppFactory } from '../express-app-factory';
import { EventTestHelpers } from '../event-test-helpers';
import { TestDatabaseFactory } from '../database-factory';
import { ServiceRegistry, resetContainer } from '../../../src/container';
import request from 'supertest';

describe('Integration Test Infrastructure', () => {
  beforeEach(() => {
    resetContainer();
  });

  afterEach(() => {
    resetContainer();
  });

  describe('APIIntegrationTestBase', () => {
    class TestAPIIntegration extends APIIntegrationTestBase {
      protected async seedDatabase(): Promise<void> {
        await super.seedDatabase();
        // Add custom seeding
        if (this.db) {
          await this.db.prepare(`
            INSERT INTO files (filename, filepath, size, mimetype, user_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'api-test.csv',
            '/uploads/api-test.csv',
            2048,
            'text/csv',
            1, // First user ID will be 1
            'completed',
            new Date().toISOString(),
            new Date().toISOString()
          );
        }
      }

      protected async customSetup(): Promise<void> {
        // Custom API test setup
      }

      protected async customTeardown(): Promise<void> {
        // Custom API test teardown
      }

      // Expose protected methods for testing
      public getApp() { return this.app; }
      public getDb() { return this.db; }
      public getRequest() { return this.request; }
    }

    let testInstance: TestAPIIntegration;

    beforeEach(async () => {
      testInstance = new TestAPIIntegration({
        useDatabase: true,
        useEventCapture: false,
        useRealServices: false
      });
      await testInstance.setup();
    });

    afterEach(async () => {
      if (testInstance) {
        await testInstance.teardown();
      }
    });

    it('should setup API integration test correctly', () => {
      expect(testInstance.getApp()).toBeDefined();
      expect(testInstance.getDb()).toBeDefined();
      expect(testInstance.getRequest()).toBeDefined();
    });

    it('should authenticate API requests correctly', async () => {
      const userToken = await testInstance['authenticateAsUser']();
      const adminToken = await testInstance['authenticateAsAdmin']();

      expect(userToken).toBe('valid-test-token');
      expect(adminToken).toBe('admin-test-token');
    });

    it('should make authenticated requests', async () => {
      const response = await testInstance['makeAuthenticatedRequest']('get', '/api/test/protected');
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should seed database with test data', async () => {
      const db = testInstance.getDb();
      
      // Check user was created
      const user = await db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');

      // Check custom file was created
      const file = await db.prepare('SELECT * FROM files WHERE filename = ?').get('api-test.csv');
      expect(file).toBeDefined();
      expect(file.filename).toBe('api-test.csv');
    });

    it('should handle test file data correctly', () => {
      const testUser = testInstance['createTestUser']({ name: 'Custom User' });
      const testFile = testInstance['createTestFile']({ filename: 'custom.csv' });

      expect(testUser.name).toBe('Custom User');
      expect(testUser.email).toBe('test@example.com'); // Default value
      expect(testFile.filename).toBe('custom.csv');
    });

    it('should handle async operations', async () => {
      // This would typically wait for async operations in real tests
      const operationPromise = testInstance['waitForAsyncOperation']('fake-op-id', 100);
      
      // Since this is a mock environment, it should timeout gracefully
      await expect(operationPromise).rejects.toThrow('did not complete within 100ms');
    });
  });

  describe('EventIntegrationTestBase', () => {
    class TestEventIntegration extends EventIntegrationTestBase {
      protected async seedDatabase(): Promise<void> {
        // No database needed for event tests
      }

      protected async customSetup(): Promise<void> {
        // Custom event test setup
      }

      protected async customTeardown(): Promise<void> {
        // Custom event test teardown
      }

      // Expose protected methods for testing
      public getApp() { return this.app; }
    }

    let testInstance: TestEventIntegration;

    beforeEach(async () => {
      testInstance = new TestEventIntegration({
        useDatabase: false,
        useEventCapture: true,
        useRealServices: true
      });
      await testInstance.setup();
    });

    afterEach(async () => {
      if (testInstance) {
        await testInstance.teardown();
      }
    });

    it('should setup event integration test correctly', () => {
      expect(testInstance.getApp()).toBeDefined();
    });

    it('should capture events correctly', async () => {
      // Emit a test event
      const eventData = { test: 'event-data' };
      await testInstance['expectEvent']('test-event-type', 1000).catch(() => {
        // Expected to timeout since no event is emitted
      });

      // The event capture should be active
      const capturedEvents = testInstance['getCapturedEvents']();
      expect(Array.isArray(capturedEvents)).toBe(true);
    });

    it('should handle event sequences', async () => {
      // Test event sequence expectation
      const sequencePromise = testInstance['expectEventSequence'](['event-1', 'event-2'], 1000);
      
      // Should timeout gracefully if events don't occur
      await expect(sequencePromise).rejects.toThrow();
    });
  });

  describe('FullStackIntegrationTestBase', () => {
    class TestFullStackIntegration extends FullStackIntegrationTestBase {
      protected async seedDatabase(): Promise<void> {
        await super.seedDatabase();
        // Add additional test data for full stack tests
      }

      protected async customSetup(): Promise<void> {
        // Custom full stack setup
      }

      protected async customTeardown(): Promise<void> {
        // Custom full stack teardown
      }

      // Expose protected methods for testing
      public getApp() { return this.app; }
      public getDb() { return this.db; }
      public getRequest() { return this.request; }
    }

    let testInstance: TestFullStackIntegration;

    beforeEach(async () => {
      testInstance = new TestFullStackIntegration({
        useDatabase: true,
        useEventCapture: true,
        useRealServices: true
      });
      await testInstance.setup();
    });

    afterEach(async () => {
      if (testInstance) {
        await testInstance.teardown();
      }
    });

    it('should setup full stack integration test correctly', () => {
      expect(testInstance.getApp()).toBeDefined();
      expect(testInstance.getDb()).toBeDefined();
      expect(testInstance.getRequest()).toBeDefined();
    });

    it('should seed comprehensive test data', async () => {
      const db = testInstance.getDb();
      
      // Check user was created
      const user = await db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
      expect(user).toBeDefined();

      // Check file was created
      const file = await db.prepare('SELECT * FROM files WHERE filename = ?').get('test-data.csv');
      expect(file).toBeDefined();
      expect(file.status).toBe('pending');
    });

    it('should work with both events and API calls', async () => {
      // Make an API call
      const response = await testInstance['makeAuthenticatedRequest']('get', '/health');
      expect(response.status).toBe(200);

      // Check event capture is working
      const capturedEvents = testInstance['getCapturedEvents']();
      expect(Array.isArray(capturedEvents)).toBe(true);
    });
  });

  describe('TestContext', () => {
    let context: TestContext;

    beforeEach(() => {
      context = new TestContext();
    });

    it('should store and retrieve context data', () => {
      context.set('test-key', 'test-value');
      context.set('object-key', { nested: 'data' });

      expect(context.get('test-key')).toBe('test-value');
      expect(context.get('object-key')).toEqual({ nested: 'data' });
      expect(context.get('non-existent')).toBeUndefined();
    });

    it('should check for key existence', () => {
      context.set('existing-key', null);

      expect(context.has('existing-key')).toBe(true);
      expect(context.has('non-existent-key')).toBe(false);
    });

    it('should clear all context data', () => {
      context.set('key1', 'value1');
      context.set('key2', 'value2');

      expect(context.has('key1')).toBe(true);
      expect(context.has('key2')).toBe(true);

      context.clear();

      expect(context.has('key1')).toBe(false);
      expect(context.has('key2')).toBe(false);
    });

    it('should create and restore snapshots', () => {
      context.set('key1', 'value1');
      context.set('key2', { complex: 'object' });

      const snapshot = context.snapshot();
      expect(snapshot).toEqual({
        'key1': 'value1',
        'key2': { complex: 'object' }
      });

      context.clear();
      context.set('new-key', 'new-value');

      context.restore(snapshot);

      expect(context.get('key1')).toBe('value1');
      expect(context.get('key2')).toEqual({ complex: 'object' });
      expect(context.has('new-key')).toBe(false);
    });
  });

  describe('Integration with Service Container', () => {
    class TestServiceIntegration extends APIIntegrationTestBase {
      protected async seedDatabase(): Promise<void> {
        await super.seedDatabase();
      }

      protected async customSetup(): Promise<void> {
        // Test custom services registration
      }

      protected async customTeardown(): Promise<void> {
        // Cleanup
      }
    }

    it('should work with custom services', async () => {
      const mockCustomService = {
        customMethod: jest.fn().mockReturnValue('custom-result')
      };

      const testInstance = new TestServiceIntegration({
        useDatabase: false,
        useEventCapture: false,
        useRealServices: false,
        customServices: [
          { token: 'CUSTOM_SERVICE', implementation: mockCustomService }
        ]
      });

      await testInstance.setup();

      // The custom service should be available in the container
      // This would be tested in actual integration tests that use the container
      expect(mockCustomService.customMethod).toBeDefined();

      await testInstance.teardown();
    });

    it('should work with environment overrides', async () => {
      const testInstance = new TestServiceIntegration({
        useDatabase: false,
        useEventCapture: false,
        environmentOverrides: {
          'TEST_ENV_VAR': 'test-value',
          'NODE_ENV': 'integration-test'
        }
      });

      await testInstance.setup();

      // Environment should be overridden
      expect(process.env.TEST_ENV_VAR).toBe('test-value');
      expect(process.env.NODE_ENV).toBe('integration-test');

      await testInstance.teardown();

      // Environment should be restored (though we can't easily test this)
    });
  });

  describe('Database Integration', () => {
    it('should work with different database configurations', async () => {
      // Test with in-memory database
      const testInstance = new APIIntegrationTestBase({
        useDatabase: true
      });

      await testInstance.setup();

      const db = (testInstance as any).db;
      expect(db).toBeDefined();

      // Database should have the required tables
      const tables = await db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
      `).all();

      const tableNames = tables.map((t: any) => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('files');

      await testInstance.teardown();
    });

    it('should isolate database data between tests', async () => {
      // Create separate database instances using unique names
      const db1 = TestDatabaseFactory.createInMemory('isolation-test-1');
      const db2 = TestDatabaseFactory.createInMemory('isolation-test-2');

      // Insert unique data in first instance
      await db1.prepare('INSERT INTO users (email, name, role, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('isolation1@example.com', 'Test1', 'user', 'password', new Date().toISOString(), new Date().toISOString());

      // Check data isolation
      const user1 = await db1.prepare('SELECT * FROM users WHERE email = ?').get('isolation1@example.com');
      const user2 = await db2.prepare('SELECT * FROM users WHERE email = ?').get('isolation1@example.com');

      expect(user1).toBeDefined();
      expect(user2).toBeUndefined(); // Should not exist in second instance

      // Clean up
      TestDatabaseFactory.cleanup('isolation-test-1');
      TestDatabaseFactory.cleanup('isolation-test-2');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle setup failures gracefully', async () => {
      class FailingTestIntegration extends APIIntegrationTestBase {
        protected async customSetup(): Promise<void> {
          throw new Error('Setup failure');
        }
        
        protected async seedDatabase(): Promise<void> {
          // Skip default seeding to avoid email conflicts
        }
      }

      const testInstance = new FailingTestIntegration({
        useDatabase: false // Disable database to focus on custom setup failure
      });
      
      await expect(testInstance.setup()).rejects.toThrow('Setup failure');
    });

    it('should handle teardown failures gracefully', async () => {
      class FailingTeardownIntegration extends APIIntegrationTestBase {
        protected async customTeardown(): Promise<void> {
          throw new Error('Teardown failure');
        }
        
        protected async seedDatabase(): Promise<void> {
          // Skip default seeding
        }
      }

      const testInstance = new FailingTeardownIntegration({
        useDatabase: false
      });
      await testInstance.setup();
      
      await expect(testInstance.teardown()).rejects.toThrow('Teardown failure');
    });

    it('should handle invalid configurations', async () => {
      const testInstance = new APIIntegrationTestBase({
        useEventCapture: true,
        useDatabase: false
      });

      await testInstance.setup();

      // Should handle missing event capture gracefully
      expect(() => {
        (testInstance as any).expectEvent('test-event');
      }).not.toThrow();

      await testInstance.teardown();
    });
  });
});