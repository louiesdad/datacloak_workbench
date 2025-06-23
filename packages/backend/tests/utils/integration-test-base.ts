import { Application } from 'express';
import supertest from 'supertest';
import { TestDatabaseFactory } from './database-factory';
import { ExpressAppFactory } from './express-app-factory';
import { EventTestHelpers } from './event-test-helpers';
import { ServiceRegistry, getContainer, resetContainer } from '../../src/container';
import { TestHelpers } from './test-helpers';

export interface IntegrationTestConfig {
  useDatabase?: boolean;
  useEventCapture?: boolean;
  useRealServices?: boolean;
  customServices?: Array<{ token: any; implementation: any }>;
  environmentOverrides?: Record<string, string>;
}

export abstract class IntegrationTestBase {
  protected app: Application;
  protected request: supertest.SuperTest<supertest.Test>;
  protected db: any;
  protected envRestore: any;
  protected config: IntegrationTestConfig;

  constructor(config: IntegrationTestConfig = {}) {
    this.config = {
      useDatabase: true,
      useEventCapture: true,
      useRealServices: false,
      ...config
    };
  }

  async setup(): Promise<void> {
    // Setup environment overrides
    if (this.config.environmentOverrides) {
      this.envRestore = TestHelpers.mockEnvironment(this.config.environmentOverrides);
    }

    // Reset and setup dependency injection
    resetContainer();
    
    if (this.config.useRealServices) {
      ServiceRegistry.registerCoreServices();
    } else {
      ServiceRegistry.registerTestServices();
    }

    // Register custom services if provided
    if (this.config.customServices) {
      const container = getContainer();
      this.config.customServices.forEach(({ token, implementation }) => {
        container.registerProvider({
          provide: token,
          useValue: implementation
        });
      });
    }

    // Setup database
    if (this.config.useDatabase) {
      this.db = TestDatabaseFactory.createInMemory('integration-test');
      await this.seedDatabase();
    }

    // Setup event capture
    if (this.config.useEventCapture) {
      EventTestHelpers.setupEventCapture();
    }

    // Create Express app
    this.app = ExpressAppFactory.createIntegrationTestApp();
    this.request = supertest(this.app);

    // Custom setup hook
    await this.customSetup();
  }

  async teardown(): Promise<void> {
    // Custom teardown hook
    await this.customTeardown();

    // Cleanup event capture
    if (this.config.useEventCapture) {
      EventTestHelpers.teardownEventCapture();
    }

    // Cleanup database
    if (this.config.useDatabase && this.db) {
      TestDatabaseFactory.cleanup('integration-test');
    }

    // Restore environment
    if (this.envRestore) {
      this.envRestore.restore();
    }

    // Reset container
    resetContainer();
  }

  // Abstract methods for subclasses to implement
  protected abstract seedDatabase(): Promise<void>;
  protected abstract customSetup(): Promise<void>;
  protected abstract customTeardown(): Promise<void>;

  // Common helper methods
  protected async authenticateAsUser(): Promise<string> {
    const token = 'valid-test-token';
    return token;
  }

  protected async authenticateAsAdmin(): Promise<string> {
    const token = 'admin-test-token';
    return token;
  }

  protected async makeAuthenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', path: string, token?: string) {
    const authToken = token || await this.authenticateAsUser();
    return this.request[method](path).set('Authorization', `Bearer ${authToken}`);
  }

  protected async uploadTestFile(filepath: string, token?: string) {
    const authToken = token || await this.authenticateAsUser();
    return this.request
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', filepath);
  }

  protected async waitForAsyncOperation(operationId: string, timeoutMs: number = 5000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const response = await this.makeAuthenticatedRequest('get', `/api/operations/${operationId}`);
      
      if (response.status === 200 && response.body.status === 'completed') {
        return response.body;
      }
      
      if (response.body.status === 'failed') {
        throw new Error(`Operation ${operationId} failed: ${response.body.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Operation ${operationId} did not complete within ${timeoutMs}ms`);
  }

  protected createTestUser(overrides: any = {}) {
    return {
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      ...overrides
    };
  }

  protected createTestFile(overrides: any = {}) {
    return {
      filename: 'test-data.csv',
      originalname: 'test-data.csv',
      size: 1024,
      mimetype: 'text/csv',
      ...overrides
    };
  }

  protected async expectEventSequence(eventTypes: string[], timeoutMs: number = 5000): Promise<void> {
    if (!this.config.useEventCapture) {
      throw new Error('Event capture is not enabled for this test');
    }

    await EventTestHelpers.waitForEventSequence(eventTypes, timeoutMs);
  }

  protected async expectEvent(eventType: string, timeoutMs: number = 5000): Promise<any> {
    if (!this.config.useEventCapture) {
      throw new Error('Event capture is not enabled for this test');
    }

    return await EventTestHelpers.waitForEvent(eventType, timeoutMs);
  }

  protected getCapturedEvents() {
    if (!this.config.useEventCapture) {
      throw new Error('Event capture is not enabled for this test');
    }

    return EventTestHelpers.getCapturedEvents();
  }
}

// Specialized base classes for different types of integration tests

export abstract class APIIntegrationTestBase extends IntegrationTestBase {
  constructor(config: IntegrationTestConfig = {}) {
    super({
      useDatabase: true,
      useEventCapture: false,
      useRealServices: false,
      ...config
    });
  }

  protected async seedDatabase(): Promise<void> {
    // Create test user
    const user = this.createTestUser();
    await this.db.prepare(`
      INSERT INTO users (email, name, role, password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.email, 
      user.name,
      user.role,
      '$2b$10$test.hash.here',
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  protected async customSetup(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async customTeardown(): Promise<void> {
    // Override in subclasses if needed
  }
}

export abstract class EventIntegrationTestBase extends IntegrationTestBase {
  constructor(config: IntegrationTestConfig = {}) {
    super({
      useDatabase: false,
      useEventCapture: true,
      useRealServices: true,
      ...config
    });
  }

  protected async seedDatabase(): Promise<void> {
    // No database needed for event tests
  }

  protected async customSetup(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async customTeardown(): Promise<void> {
    // Override in subclasses if needed
  }
}

export abstract class FullStackIntegrationTestBase extends IntegrationTestBase {
  constructor(config: IntegrationTestConfig = {}) {
    super({
      useDatabase: true,
      useEventCapture: true,
      useRealServices: true,
      ...config
    });
  }

  protected async seedDatabase(): Promise<void> {
    // Create comprehensive test data
    const user = this.createTestUser();
    const file = this.createTestFile();

    // Insert test user
    const userResult = await this.db.prepare(`
      INSERT INTO users (email, name, role, password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      user.email, 
      user.name,
      user.role,
      '$2b$10$test.hash.here',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Insert test file
    await this.db.prepare(`
      INSERT INTO files (filename, filepath, size, mimetype, user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      file.filename,
      `/uploads/${file.filename}`,
      file.size,
      file.mimetype,
      userResult.lastInsertRowid,
      'pending',
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  protected async customSetup(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async customTeardown(): Promise<void> {
    // Override in subclasses if needed
  }
}

// Test context manager for complex scenarios
export class TestContext {
  private contexts: Map<string, any> = new Map();

  set(key: string, value: any): void {
    this.contexts.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.contexts.get(key);
  }

  has(key: string): boolean {
    return this.contexts.has(key);
  }

  clear(): void {
    this.contexts.clear();
  }

  snapshot(): Record<string, any> {
    return Object.fromEntries(this.contexts);
  }

  restore(snapshot: Record<string, any>): void {
    this.contexts.clear();
    Object.entries(snapshot).forEach(([key, value]) => {
      this.contexts.set(key, value);
    });
  }
}