import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

export interface MockRequest extends Partial<Request> {
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  user?: any;
  file?: any;
  files?: any;
}

export interface MockResponse extends Partial<Response> {
  statusCode?: number;
  jsonData?: any;
  sendData?: any;
  headers?: Record<string, string>;
}

export class MockFactory {
  static createRequest(overrides: MockRequest = {}): Request {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      method: 'GET',
      url: '/',
      baseUrl: '',
      originalUrl: '/',
      path: '/',
      get: jest.fn((header: string) => overrides.headers?.[header]),
      header: jest.fn((header: string) => overrides.headers?.[header]),
      accepts: jest.fn(),
      acceptsCharsets: jest.fn(),
      acceptsEncodings: jest.fn(),
      acceptsLanguages: jest.fn(),
      is: jest.fn(),
      ...overrides
    } as any;
  }

  static createResponse(): Response & MockResponse {
    const res: any = {
      statusCode: 200,
      headers: {},
      locals: {}
    };

    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    });

    res.json = jest.fn((data: any) => {
      res.jsonData = data;
      return res;
    });

    res.send = jest.fn((data: any) => {
      res.sendData = data;
      return res;
    });

    res.set = jest.fn((field: string | object, value?: string) => {
      if (typeof field === 'object') {
        Object.assign(res.headers, field);
      } else if (value) {
        res.headers[field] = value;
      }
      return res;
    });

    res.header = res.set;
    res.setHeader = jest.fn((name: string, value: string) => {
      res.headers[name] = value;
    });

    res.end = jest.fn();
    res.write = jest.fn();
    res.redirect = jest.fn();
    res.render = jest.fn();
    res.sendFile = jest.fn();
    res.sendStatus = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    });

    return res;
  }

  static createNextFunction(): NextFunction {
    return jest.fn();
  }

  static createEventEmitter(): EventEmitter {
    return new EventEmitter();
  }

  static createRedisClient() {
    const client: any = {
      connected: true,
      data: new Map(),
      expirations: new Map()
    };

    client.get = jest.fn(async (key: string) => {
      const expiration = client.expirations.get(key);
      if (expiration && Date.now() > expiration) {
        client.data.delete(key);
        client.expirations.delete(key);
        return null;
      }
      return client.data.get(key) || null;
    });

    client.set = jest.fn(async (key: string, value: string, ...args: any[]) => {
      client.data.set(key, value);
      
      // Handle expiration
      for (let i = 0; i < args.length; i++) {
        if (args[i] === 'EX' && args[i + 1]) {
          const ttl = parseInt(args[i + 1]) * 1000;
          client.expirations.set(key, Date.now() + ttl);
          break;
        }
      }
      
      return 'OK';
    });

    client.del = jest.fn(async (key: string) => {
      const existed = client.data.has(key);
      client.data.delete(key);
      client.expirations.delete(key);
      return existed ? 1 : 0;
    });

    client.exists = jest.fn(async (key: string) => {
      const expiration = client.expirations.get(key);
      if (expiration && Date.now() > expiration) {
        client.data.delete(key);
        client.expirations.delete(key);
        return 0;
      }
      return client.data.has(key) ? 1 : 0;
    });

    client.expire = jest.fn(async (key: string, seconds: number) => {
      if (client.data.has(key)) {
        client.expirations.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    });

    client.ttl = jest.fn(async (key: string) => {
      const expiration = client.expirations.get(key);
      if (!expiration) return -1;
      
      const ttl = Math.floor((expiration - Date.now()) / 1000);
      return ttl > 0 ? ttl : -2;
    });

    client.keys = jest.fn(async (pattern: string) => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return Array.from(client.data.keys()).filter(key => regex.test(key));
    });

    client.flushall = jest.fn(async () => {
      client.data.clear();
      client.expirations.clear();
      return 'OK';
    });

    client.quit = jest.fn(async () => {
      client.connected = false;
      return 'OK';
    });

    client.on = jest.fn();
    client.off = jest.fn();
    client.emit = jest.fn();

    return client;
  }

  static createWebSocket() {
    const ws: any = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
      pong: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    return ws;
  }

  static createLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      child: jest.fn(() => this.createLogger())
    };
  }

  static createTimer() {
    let time = 0;
    return {
      start: () => { time = Date.now(); },
      stop: () => Date.now() - time,
      elapsed: () => Date.now() - time
    };
  }

  static createService<T>(methods: string[]): T {
    const mock: any = {};
    
    methods.forEach(method => {
      mock[method] = jest.fn();
    });
    
    return mock as T;
  }

  // Service-specific mock factories with proper interfaces
  static createConfigService() {
    return {
      get: jest.fn((key: string, defaultValue?: any) => {
        const configs: Record<string, any> = {
          'NODE_ENV': 'test',
          'PORT': 3001,
          'DATABASE_URL': ':memory:',
          'REDIS_ENABLED': false,
          'REDIS_HOST': 'localhost',
          'REDIS_PORT': 6379,
          'JWT_SECRET': 'test-secret',
          'RATE_LIMIT_WINDOW': 60000,
          'RATE_LIMIT_MAX': 100,
          'LOG_LEVEL': 'error',
          'CACHE_ENABLED': true,
          'CACHE_TYPE': 'memory',
          'CACHE_DEFAULT_TTL': 300,
          'OPENAI_API_KEY': undefined,
          'OPENAI_MODEL': 'gpt-3.5-turbo'
        };
        return configs[key] ?? defaultValue;
      }),
      set: jest.fn(),
      has: jest.fn((key: string) => ['NODE_ENV', 'PORT', 'DATABASE_URL'].includes(key)),
      reload: jest.fn(),
      getAll: jest.fn(() => ({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: ':memory:'
      })),
      getSanitizedConfig: jest.fn(() => ({
        NODE_ENV: 'test',
        PORT: 3001
      })),
      isOpenAIConfigured: jest.fn(() => false),
      getOpenAIConfig: jest.fn(() => ({
        apiKey: undefined,
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000
      })),
      update: jest.fn(),
      updateMultiple: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
  }

  static createFileStreamService() {
    return {
      createReadStream: jest.fn(() => ({
        on: jest.fn(),
        pipe: jest.fn(),
        read: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        destroy: jest.fn()
      })),
      readFileChunk: jest.fn().mockResolvedValue({
        chunkInfo: {
          index: 0,
          size: 1024,
          offset: 0,
          isLast: false
        },
        data: [{ test: 'data' }],
        processedRows: 1,
        hasMore: true
      }),
      getFileChunks: jest.fn().mockResolvedValue([
        {
          chunkInfo: { index: 0, size: 1024, offset: 0, isLast: true },
          data: [{ test: 'data' }],
          processedRows: 1,
          hasMore: false
        }
      ]),
      estimateMemoryUsage: jest.fn().mockReturnValue(1024),
      processFileInChunks: jest.fn().mockResolvedValue({
        totalRows: 1,
        processedRows: 1,
        chunks: 1
      })
    };
  }

  static createDataCloakService() {
    return {
      detectPII: jest.fn().mockResolvedValue({
        hasPII: false,
        detectedTypes: [],
        maskedData: 'test data'
      }),
      maskData: jest.fn().mockResolvedValue('masked data'),
      validateCompliance: jest.fn().mockResolvedValue({
        isCompliant: true,
        violations: []
      }),
      processData: jest.fn().mockResolvedValue({
        originalData: 'test',
        maskedData: 'masked',
        piiDetected: false
      }),
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      getStats: jest.fn().mockReturnValue({
        totalProcessed: 0,
        piiDetected: 0,
        compliance: { violations: 0 }
      })
    };
  }

  static createWebSocketService() {
    const clients = new Map();
    const rooms = new Map();
    
    return {
      handleConnection: jest.fn((ws: any, req: any) => {
        const clientId = Math.random().toString(36);
        clients.set(clientId, { ws, authenticated: false });
        return clientId;
      }),
      authenticateClient: jest.fn().mockResolvedValue(true),
      broadcastToRoom: jest.fn(),
      sendToClient: jest.fn(),
      subscribeToTopic: jest.fn(),
      unsubscribeFromTopic: jest.fn(),
      getConnectedClients: jest.fn(() => Array.from(clients.keys())),
      getRoomClients: jest.fn(() => []),
      disconnect: jest.fn((clientId: string) => {
        clients.delete(clientId);
      }),
      isClientConnected: jest.fn((clientId: string) => clients.has(clientId)),
      getClientInfo: jest.fn((clientId: string) => clients.get(clientId)),
      broadcast: jest.fn(),
      handleMessage: jest.fn(),
      setupHeartbeat: jest.fn(),
      cleanup: jest.fn()
    };
  }

  static createOpenAIService() {
    return {
      analyzeSentiment: jest.fn().mockResolvedValue({
        sentiment: 'positive',
        score: 0.8,
        confidence: 0.9
      }),
      analyzeBatch: jest.fn().mockResolvedValue([
        { sentiment: 'positive', score: 0.8, confidence: 0.9 }
      ]),
      streamAnalysis: jest.fn().mockImplementation(async function* () {
        yield { sentiment: 'positive', score: 0.8, confidence: 0.9 };
      }),
      validateApiKey: jest.fn().mockResolvedValue(true),
      getUsage: jest.fn().mockResolvedValue({
        tokens: 100,
        cost: 0.001
      }),
      isConfigured: jest.fn().mockReturnValue(true),
      testConnection: jest.fn().mockResolvedValue(true)
    };
  }

  static createSSEService() {
    const connections = new Map();
    
    return {
      addClient: jest.fn((req: any, res: any) => {
        const clientId = Math.random().toString(36);
        connections.set(clientId, { req, res, topics: new Set() });
        return clientId;
      }),
      removeClient: jest.fn((clientId: string) => {
        connections.delete(clientId);
      }),
      broadcast: jest.fn(),
      sendToClient: jest.fn(),
      subscribeToTopic: jest.fn(),
      unsubscribeFromTopic: jest.fn(),
      getConnectedClients: jest.fn(() => Array.from(connections.keys())),
      getClientsByTopic: jest.fn(() => []),
      isClientConnected: jest.fn((clientId: string) => connections.has(clientId)),
      cleanup: jest.fn(),
      setupHeartbeat: jest.fn(),
      sendEvent: jest.fn()
    };
  }

  static createCacheService() {
    const cache = new Map();
    
    return {
      get: jest.fn(async (key: string) => cache.get(key) || null),
      set: jest.fn(async (key: string, value: any, ttl?: number) => {
        cache.set(key, value);
      }),
      delete: jest.fn(async (key: string) => {
        const existed = cache.has(key);
        cache.delete(key);
        return existed;
      }),
      exists: jest.fn(async (key: string) => cache.has(key)),
      clear: jest.fn(async () => cache.clear()),
      keys: jest.fn(async (pattern?: string) => {
        if (!pattern) return Array.from(cache.keys());
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(cache.keys()).filter(key => regex.test(key));
      }),
      getStats: jest.fn(() => ({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        size: cache.size
      })),
      flush: jest.fn(async () => cache.clear()),
      compress: jest.fn(),
      decompress: jest.fn()
    };
  }

  static createJobQueueService() {
    const jobs = new Map();
    
    return {
      add: jest.fn(async (type: string, data: any, options?: any) => {
        const jobId = Math.random().toString(36);
        jobs.set(jobId, { id: jobId, type, data, status: 'pending', ...options });
        return jobId;
      }),
      process: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getJob: jest.fn(async (id: string) => jobs.get(id) || null),
      removeJob: jest.fn(async (id: string) => {
        const existed = jobs.has(id);
        jobs.delete(id);
        return existed;
      }),
      getJobs: jest.fn(async () => Array.from(jobs.values())),
      getQueueStatus: jest.fn(() => ({
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0
      })),
      cleanup: jest.fn(),
      shutdown: jest.fn()
    };
  }
}