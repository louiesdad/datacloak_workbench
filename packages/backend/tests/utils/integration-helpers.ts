import { Express } from 'express';
import { Server } from 'http';
import { createApp } from '../../src/app';
import { initializeDatabases, closeSQLiteConnection } from '../../src/database';
import { WebSocketService } from '../../src/services/websocket.service';
import { SSEService } from '../../src/services/sse.service';
import { connectionStatusService } from '../../src/services/connection-status.service';
import { realTimeSentimentFeedService } from '../../src/services/realtime-sentiment-feed.service';

export interface TestServer {
  app: Express;
  server: Server;
  port: number;
  wsService?: WebSocketService;
  sseService?: SSEService;
}

export interface IntegrationTestOptions {
  initializeWebSocket?: boolean;
  initializeSSE?: boolean;
  initializeDatabase?: boolean;
  port?: number;
}

/**
 * Start a test server with optional services
 */
export async function startTestServer(options: IntegrationTestOptions = {}): Promise<TestServer> {
  const {
    initializeWebSocket = false,
    initializeSSE = false,
    initializeDatabase = true,
    port = 0  // 0 means random available port
  } = options;

  // Initialize databases if requested
  if (initializeDatabase) {
    await initializeDatabases();
  }

  // Create Express app
  const app = createApp();

  // Start server
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, () => resolve(s));
    s.on('error', reject);
  });

  const actualPort = (server.address() as any).port;
  const result: TestServer = {
    app,
    server,
    port: actualPort
  };

  // Initialize optional services
  if (initializeWebSocket) {
    result.wsService = new WebSocketService();
    result.wsService.initialize(server);
  }

  if (initializeSSE) {
    result.sseService = new SSEService();
  }

  return result;
}

/**
 * Stop a test server and cleanup resources
 */
export async function stopTestServer(testServer: TestServer): Promise<void> {
  const { server, wsService, sseService } = testServer;

  // Shutdown services
  if (connectionStatusService) {
    connectionStatusService.shutdown();
  }

  if (realTimeSentimentFeedService) {
    realTimeSentimentFeedService.shutdown();
  }

  if (wsService) {
    wsService.shutdown();
  }

  if (sseService) {
    sseService.stopPingInterval();
  }

  // Close server
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Close database connections
  await closeSQLiteConnection();
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a test database with clean state
 */
export async function createTestDatabase(name: string = 'test'): Promise<string> {
  const dbPath = `/tmp/test-${name}-${Date.now()}.db`;
  process.env.SQLITE_DB_PATH = dbPath;
  await initializeDatabases();
  return dbPath;
}

/**
 * Clean up a test database
 */
export async function cleanupTestDatabase(dbPath: string): Promise<void> {
  await closeSQLiteConnection();
  
  // Delete the database file
  const fs = require('fs').promises;
  try {
    await fs.unlink(dbPath);
    await fs.unlink(`${dbPath}-shm`);
    await fs.unlink(`${dbPath}-wal`);
  } catch (error) {
    // Ignore errors if files don't exist
  }
}

/**
 * Create a mock service instance
 */
export function createMockService<T>(name: string, methods: (keyof T)[]): jest.Mocked<T> {
  const mock: any = {
    __mockName: name
  };
  
  methods.forEach(method => {
    mock[method] = jest.fn();
  });
  
  return mock as jest.Mocked<T>;
}

/**
 * Reset all services to clean state
 */
export async function resetServices(): Promise<void> {
  // Clear all service caches
  const { getCacheService } = await import('../../src/services/cache.service');
  const cacheService = getCacheService();
  await cacheService.clear();
  
  // Reset any singleton instances
  // Add more service resets as needed
}

/**
 * Setup common test data
 */
export async function setupTestData(): Promise<void> {
  // Add common test data setup here
  // This could include creating test users, datasets, etc.
}

/**
 * Run a test in isolation with full setup and teardown
 */
export async function runIsolatedTest(
  name: string,
  testFn: (server: TestServer) => Promise<void>,
  options: IntegrationTestOptions = {}
): Promise<void> {
  let server: TestServer | null = null;
  
  try {
    // Setup
    server = await startTestServer(options);
    await resetServices();
    await setupTestData();
    
    // Run test
    await testFn(server);
  } finally {
    // Cleanup
    if (server) {
      await stopTestServer(server);
    }
  }
}