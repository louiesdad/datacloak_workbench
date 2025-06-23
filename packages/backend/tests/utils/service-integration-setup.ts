/**
 * Service Integration Setup for Tests
 * TASK: Repair service integration layer - Fix dependency injection
 * 
 * This module provides proper service container setup for tests,
 * preventing module load time failures and circular dependencies.
 */

import { getContainer, resetContainer } from '../../src/container/service-container';
import { ServiceRegistry } from '../../src/container/service-registry';
import { SERVICE_TOKENS } from '../../src/container/interfaces';

/**
 * Initialize service container for test environment
 */
export function setupTestServiceContainer(): void {
  resetContainer();
  
  // Register test-specific services that don't cause module load issues
  ServiceRegistry.registerTestServices();
  
  const container = getContainer();
  
  // Register additional services that are needed for integration tests
  registerTestOnlyServices(container);
}

/**
 * Register services that are only needed for tests
 */
function registerTestOnlyServices(container: any): void {
  // Enhanced Database Service Mock
  container.registerProvider({
    provide: 'EnhancedDatabase',
    useFactory: () => ({
      executeQuery: jest.fn().mockResolvedValue([]),
      batchExecute: jest.fn().mockResolvedValue([]),
      importCSV: jest.fn().mockResolvedValue({ rowsImported: 0, errors: [] }),
      exportTable: jest.fn().mockResolvedValue(''),
      createTable: jest.fn().mockResolvedValue(undefined),
      getTableSchema: jest.fn().mockResolvedValue(null),
      createIndex: jest.fn().mockResolvedValue(undefined),
      analyze: jest.fn().mockResolvedValue(undefined),
      vacuum: jest.fn().mockResolvedValue(undefined),
      runAnalyticsQuery: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue({
        sqlite: true,
        duckdb: true,
        overall: true
      })
    }),
    singleton: true
  });

  // API Client Mock
  container.registerProvider({
    provide: 'ApiClient',
    useFactory: () => ({
      login: jest.fn().mockResolvedValue({ success: true, token: 'test-token' }),
      logout: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(false),
      getToken: jest.fn().mockReturnValue(undefined),
      setToken: jest.fn(),
      verifyToken: jest.fn().mockResolvedValue({ success: true, valid: true }),
      getHealthStatus: jest.fn().mockResolvedValue({ status: 'healthy' }),
      uploadFile: jest.fn().mockResolvedValue({ data: { id: 'test-upload' } }),
      getDatasets: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
      deleteDataset: jest.fn().mockResolvedValue({ success: true }),
      analyzeSentiment: jest.fn().mockResolvedValue({ data: { sentiment: 'positive' } }),
      getDashboardMetrics: jest.fn().mockResolvedValue({ data: {} }),
      getConfiguration: jest.fn().mockResolvedValue({ data: {} }),
      estimateCost: jest.fn().mockResolvedValue({ estimatedCost: 0.05 }),
      testConnection: jest.fn().mockResolvedValue({
        data: { connected: true, latency: 10, version: '1.0.0' }
      })
    }),
    singleton: true
  });

  // Transform Persistence Service Mock (to prevent database issues)
  container.registerProvider({
    provide: 'TransformPersistence',
    useFactory: () => ({
      saveTransform: jest.fn().mockResolvedValue({ id: 'test-transform' }),
      getTransforms: jest.fn().mockResolvedValue([]),
      getTransformById: jest.fn().mockResolvedValue(null),
      deleteTransform: jest.fn().mockResolvedValue(true),
      getTemplates: jest.fn().mockResolvedValue([]),
      saveHistory: jest.fn().mockResolvedValue('test-history-id'),
      getHistory: jest.fn().mockResolvedValue([])
    }),
    singleton: true
  });

  // Database Connection Mock
  container.registerProvider({
    provide: 'DatabaseConnection',
    useFactory: () => ({
      prepare: jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null),
        run: jest.fn().mockReturnValue({ changes: 0, lastInsertRowid: 1 })
      }),
      exec: jest.fn(),
      close: jest.fn(),
      transaction: jest.fn((fn) => fn())
    }),
    singleton: true
  });
}

/**
 * Get a service from the test container
 */
export function getTestService<T>(token: string | symbol): T {
  const container = getContainer();
  return container.resolve<T>(token);
}

/**
 * Clean up service container after tests
 */
export function cleanupTestServiceContainer(): void {
  resetContainer();
}

/**
 * Setup jest environment for service container tests
 */
export function setupJestServiceContainer(): void {
  // Set NODE_ENV to test to enable test-specific behavior
  process.env.NODE_ENV = 'test';
  
  beforeEach(() => {
    setupTestServiceContainer();
  });

  afterEach(() => {
    cleanupTestServiceContainer();
  });
}

/**
 * Mock a specific service in the container
 */
export function mockService<T>(token: string | symbol, mockImplementation: T): void {
  const container = getContainer();
  container.registerProvider({
    provide: token,
    useValue: mockImplementation
  });
}

/**
 * Replace a service with a factory-created mock
 */
export function mockServiceWithFactory<T>(
  token: string | symbol, 
  factory: () => T, 
  dependencies: Array<string | symbol> = []
): void {
  const container = getContainer();
  container.registerProvider({
    provide: token,
    useFactory: factory,
    deps: dependencies,
    singleton: true
  });
}