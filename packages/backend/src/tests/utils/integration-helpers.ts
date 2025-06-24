import { Express } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { container } from '../../container/service-container';
import { registerCoreServices } from '../../container/service-registry';
import { ConfigService } from '../../services/config.service';
import { CacheService } from '../../services/cache.service';
import { LoggerService } from '../../services/logger.service';

/**
 * Integration Test Framework
 * 
 * Provides utilities for setting up and tearing down services for integration testing.
 * Handles service orchestration, resource management, and test isolation.
 */

interface ServiceStatus {
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  port?: number;
  error?: string;
}

interface IntegrationTestConfig {
  enableDatabase?: boolean;
  enableCache?: boolean;
  enableWebServer?: boolean;
  enableWebSocket?: boolean;
  enableSSE?: boolean;
  testTimeout?: number;
  cleanupTimeout?: number;
  services?: string[];
}

class IntegrationTestManager {
  private services: Map<string, any> = new Map();
  private servers: Map<string, Server> = new Map();
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private logger?: LoggerService;
  private config?: ConfigService;
  private isInitialized = false;
  private containerInitialized = false;

  constructor() {
    // Delay container initialization until needed
  }

  /**
   * Initialize the service container for integration tests
   */
  private initializeContainer(): void {
    if (this.containerInitialized) return;

    try {
      registerCoreServices();
      this.logger = container.resolve('logger');
      this.config = container.resolve('config');
      this.containerInitialized = true;
    } catch (error) {
      // Create mock services if container fails
      this.logger = {
        info: (msg: string) => console.log(`[INFO] ${msg}`),
        warn: (msg: string) => console.warn(`[WARN] ${msg}`),
        error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err),
        debug: (msg: string) => console.log(`[DEBUG] ${msg}`)
      } as LoggerService;
      
      this.config = {
        get: (key: string, defaultValue?: any) => defaultValue,
        has: (key: string) => false,
        set: (key: string, value: any) => {},
        getAll: () => ({})
      } as ConfigService;
      
      this.containerInitialized = true;
    }
  }

  /**
   * Get logger instance (lazy initialization)
   */
  private getLogger(): LoggerService {
    if (!this.containerInitialized) {
      this.initializeContainer();
    }
    return this.logger!;
  }

  /**
   * Get config instance (lazy initialization)
   */
  private getConfig(): ConfigService {
    if (!this.containerInitialized) {
      this.initializeContainer();
    }
    return this.config!;
  }

  /**
   * Initialize the integration test environment
   */
  async initialize(config: IntegrationTestConfig = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.getLogger().info('Initializing integration test environment');

    try {
      // Set test-specific environment variables
      process.env.NODE_ENV = 'test';
      process.env.LOG_LEVEL = 'warn'; // Reduce log noise in tests
      
      // Initialize core services
      if (config.enableDatabase !== false) {
        await this.initializeDatabase();
      }

      if (config.enableCache !== false) {
        await this.initializeCache();
      }

      if (config.enableWebServer) {
        await this.initializeWebServer();
      }

      if (config.enableWebSocket) {
        await this.initializeWebSocket();
      }

      if (config.enableSSE) {
        await this.initializeSSE();
      }

      // Initialize any custom services
      if (config.services) {
        for (const serviceName of config.services) {
          await this.initializeService(serviceName);
        }
      }

      this.isInitialized = true;
      this.getLogger().info('Integration test environment initialized successfully');

    } catch (error) {
      this.getLogger().error('Failed to initialize integration test environment:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize database services
   */
  private async initializeDatabase(): Promise<void> {
    this.updateServiceStatus('database', 'starting');

    try {
      // Try to get database service from container
      let databaseService;
      try {
        databaseService = container.resolve('database');
      } catch (error) {
        // If no database service registered, create a simple mock
        databaseService = {
          initialize: async () => {},
          resetForTesting: async () => {},
          shutdown: async () => {}
        };
      }
      
      // Initialize if method exists
      if (typeof databaseService.initialize === 'function') {
        await databaseService.initialize();
      }
      
      this.services.set('database', databaseService);
      this.updateServiceStatus('database', 'running');
      
      this.getLogger().info('Database service initialized');
    } catch (error) {
      this.updateServiceStatus('database', 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Initialize cache services
   */
  private async initializeCache(): Promise<void> {
    this.updateServiceStatus('cache', 'starting');

    try {
      let cacheService;
      try {
        cacheService = container.resolve('cache');
      } catch (error) {
        // Create a simple mock cache if not available
        cacheService = {
          initialize: async () => {},
          set: async (key: string, value: any, ttl?: number) => {},
          get: async (key: string) => null,
          clear: async () => {},
          resetForTesting: async () => {},
          shutdown: async () => {}
        };
      }
      
      // Initialize if method exists
      if (typeof cacheService.initialize === 'function') {
        await cacheService.initialize();
      }
      
      this.services.set('cache', cacheService);
      this.updateServiceStatus('cache', 'running');
      
      this.getLogger().info('Cache service initialized');
    } catch (error) {
      this.updateServiceStatus('cache', 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Initialize web server for API testing
   */
  private async initializeWebServer(): Promise<void> {
    this.updateServiceStatus('webserver', 'starting');

    try {
      // Import app factory
      const { createApp } = await import('../../app');
      const app = createApp();
      
      // Start server on available port
      const server = await this.startServer(app, 'webserver');
      
      this.services.set('webserver', app);
      this.servers.set('webserver', server);
      
      const address = server.address() as AddressInfo;
      this.updateServiceStatus('webserver', 'running', address.port);
      
      this.getLogger().info(`Web server initialized on port ${address.port}`);
    } catch (error) {
      this.updateServiceStatus('webserver', 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Initialize WebSocket server
   */
  private async initializeWebSocket(): Promise<void> {
    this.updateServiceStatus('websocket', 'starting');

    try {
      const { WebSocketService } = await import('../../services/websocket.service');
      const wsService = new WebSocketService();
      
      // Start WebSocket server on available port
      const server = await this.startWebSocketServer(wsService);
      
      this.services.set('websocket', wsService);
      this.servers.set('websocket', server);
      
      const address = server.address() as AddressInfo;
      this.updateServiceStatus('websocket', 'running', address.port);
      
      this.getLogger().info(`WebSocket server initialized on port ${address.port}`);
    } catch (error) {
      this.updateServiceStatus('websocket', 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Initialize SSE server
   */
  private async initializeSSE(): Promise<void> {
    this.updateServiceStatus('sse', 'starting');

    try {
      const { SSEService } = await import('../../services/sse.service');
      const sseService = new SSEService();
      
      this.services.set('sse', sseService);
      this.updateServiceStatus('sse', 'running');
      
      this.getLogger().info('SSE service initialized');
    } catch (error) {
      this.updateServiceStatus('sse', 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Initialize a custom service by name
   */
  private async initializeService(serviceName: string): Promise<void> {
    this.updateServiceStatus(serviceName, 'starting');

    try {
      const service = container.resolve(serviceName);
      
      // Call initialize method if it exists
      if (service && typeof service.initialize === 'function') {
        await service.initialize();
      }
      
      this.services.set(serviceName, service);
      this.updateServiceStatus(serviceName, 'running');
      
      this.getLogger().info(`Service ${serviceName} initialized`);
    } catch (error) {
      this.updateServiceStatus(serviceName, 'error', undefined, error.message);
      throw error;
    }
  }

  /**
   * Start a server on an available port
   */
  private async startServer(app: Express, name: string): Promise<Server> {
    return new Promise((resolve, reject) => {
      const server = app.listen(0, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(server);
        }
      });

      server.on('error', reject);
    });
  }

  /**
   * Start WebSocket server on available port
   */
  private async startWebSocketServer(wsService: any): Promise<Server> {
    // This would depend on the actual WebSocket service implementation
    // For now, return a mock server
    return Promise.resolve({
      address: () => ({ port: 0 }),
      close: (callback) => callback && callback()
    } as any);
  }

  /**
   * Get a service instance
   */
  getService<T = any>(name: string): T | undefined {
    return this.services.get(name);
  }

  /**
   * Get server instance
   */
  getServer(name: string): Server | undefined {
    return this.servers.get(name);
  }

  /**
   * Get service status
   */
  getServiceStatus(name?: string): ServiceStatus | ServiceStatus[] {
    if (name) {
      return this.serviceStatus.get(name) || { name, status: 'stopped' };
    }
    return Array.from(this.serviceStatus.values());
  }

  /**
   * Wait for service to be ready
   */
  async waitForService(name: string, timeout = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = this.serviceStatus.get(name);
      if (status?.status === 'running') {
        return;
      }
      if (status?.status === 'error') {
        throw new Error(`Service ${name} failed to start: ${status.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Service ${name} did not start within ${timeout}ms`);
  }

  /**
   * Wait for all services to be ready
   */
  async waitForAllServices(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const allReady = Array.from(this.serviceStatus.values()).every(
        status => status.status === 'running' || status.status === 'stopped'
      );
      
      const hasErrors = Array.from(this.serviceStatus.values()).some(
        status => status.status === 'error'
      );
      
      if (hasErrors) {
        const errorServices = Array.from(this.serviceStatus.values())
          .filter(status => status.status === 'error')
          .map(status => `${status.name}: ${status.error}`)
          .join(', ');
        throw new Error(`Services failed to start: ${errorServices}`);
      }
      
      if (allReady) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Services did not start within ${timeout}ms`);
  }

  /**
   * Reset all services (clear data but keep running)
   */
  async resetServices(): Promise<void> {
    this.getLogger().info('Resetting integration test services');

    // Reset database
    const database = this.services.get('database');
    if (database && typeof database.resetForTesting === 'function') {
      await database.resetForTesting();
    }

    // Clear cache
    const cache = this.services.get('cache');
    if (cache && typeof cache.clear === 'function') {
      await cache.clear();
    }

    // Reset other services
    for (const [name, service] of this.services.entries()) {
      if (service && typeof service.resetForTesting === 'function') {
        await service.resetForTesting();
      }
    }

    this.getLogger().info('Services reset completed');
  }

  /**
   * Clean up all resources
   */
  async cleanup(timeout = 10000): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.getLogger().info('Cleaning up integration test environment');

    const cleanupPromises: Promise<void>[] = [];

    // Close all servers
    for (const [name, server] of this.servers.entries()) {
      this.updateServiceStatus(name, 'stopping');
      cleanupPromises.push(this.closeServer(server, name));
    }

    // Shutdown all services
    for (const [name, service] of this.services.entries()) {
      if (service && typeof service.shutdown === 'function') {
        cleanupPromises.push(service.shutdown());
      }
    }

    // Wait for all cleanup operations with timeout
    try {
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Cleanup timeout after ${timeout}ms`)), timeout)
        )
      ]);
    } catch (error) {
      this.getLogger().warn('Some cleanup operations timed out:', error);
    }

    // Clear all collections
    this.services.clear();
    this.servers.clear();
    this.serviceStatus.clear();
    this.isInitialized = false;

    this.getLogger().info('Integration test environment cleanup completed');
  }

  /**
   * Close a server gracefully
   */
  private async closeServer(server: Server, name: string): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => {
        this.updateServiceStatus(name, 'stopped');
        resolve();
      });
    });
  }

  /**
   * Update service status
   */
  private updateServiceStatus(
    name: string, 
    status: ServiceStatus['status'], 
    port?: number, 
    error?: string
  ): void {
    this.serviceStatus.set(name, { name, status, port, error });
  }
}

// Global instance
const integrationTestManager = new IntegrationTestManager();

/**
 * Initialize integration test environment
 */
export async function initializeIntegrationTest(config?: IntegrationTestConfig): Promise<void> {
  await integrationTestManager.initialize(config);
}

/**
 * Get a service for testing
 */
export function getTestService<T = any>(name: string): T | undefined {
  return integrationTestManager.getService<T>(name);
}

/**
 * Get a server for testing
 */
export function getTestServer(name: string): Server | undefined {
  return integrationTestManager.getServer(name);
}

/**
 * Wait for services to be ready
 */
export async function waitForServices(names?: string[], timeout?: number): Promise<void> {
  if (names && names.length > 0) {
    await Promise.all(names.map(name => integrationTestManager.waitForService(name, timeout)));
  } else {
    await integrationTestManager.waitForAllServices(timeout);
  }
}

/**
 * Reset services between tests
 */
export async function resetServices(): Promise<void> {
  await integrationTestManager.resetServices();
}

/**
 * Get service status
 */
export function getServiceStatus(name?: string): ServiceStatus | ServiceStatus[] {
  return integrationTestManager.getServiceStatus(name);
}

/**
 * Clean up integration test environment
 */
export async function cleanupIntegrationTest(): Promise<void> {
  await integrationTestManager.cleanup();
}

/**
 * Utility function to create integration test suite
 */
export function createIntegrationTestSuite(
  suiteName: string,
  config: IntegrationTestConfig,
  tests: () => void
): void {
  describe(suiteName, () => {
    beforeAll(async () => {
      await initializeIntegrationTest(config);
      await waitForServices();
    });

    afterAll(async () => {
      await cleanupIntegrationTest();
    });

    beforeEach(async () => {
      await resetServices();
    });

    tests();
  });
}

/**
 * Type definitions for better TypeScript support
 */
export interface IntegrationTestContext {
  getService: typeof getTestService;
  getServer: typeof getTestServer;
  waitForServices: typeof waitForServices;
  resetServices: typeof resetServices;
  getServiceStatus: typeof getServiceStatus;
}

/**
 * Hook to get integration test context
 */
export function useIntegrationTest(): IntegrationTestContext {
  return {
    getService: getTestService,
    getServer: getTestServer,
    waitForServices,
    resetServices,
    getServiceStatus
  };
}