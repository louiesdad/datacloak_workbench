import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Browser API mocks for Node.js environment
export const mockBrowserAPIs = () => {
  // Mock localStorage
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  };

  // Mock sessionStorage
  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  };

  // Mock window
  global.window = {
    location: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: ''
    },
    navigator: {
      userAgent: 'node.js'
    }
  } as any;

  // Mock fetch
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      headers: new Map()
    } as any)
  );
};

// Express mock helpers
export const mockRequest = (options: Partial<Request> = {}): Partial<Request> => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    get: jest.fn(),
    header: jest.fn(),
    ...options
  };
};

export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    write: jest.fn().mockReturnThis(),
    writeHead: jest.fn().mockReturnThis()
  };
  return res;
};

export const mockNextFunction = (): NextFunction => {
  return jest.fn();
};

// Service mock factory
export const createServiceMock = <T>(methods: string[]): jest.Mocked<T> => {
  const mock: any = {};
  methods.forEach(method => {
    mock[method] = jest.fn();
  });
  return mock;
};

// JWT helpers
export const createTestToken = (payload: any, secret: string = 'test-secret'): string => {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

// Async test helpers
export const waitForAsync = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const flushPromises = (): Promise<void> => {
  return new Promise(resolve => setImmediate(resolve));
};

// Database mock helpers
export const mockDatabase = () => {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    transaction: jest.fn().mockImplementation(async (fn) => {
      const trx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        commit: jest.fn().mockResolvedValue({}),
        rollback: jest.fn().mockResolvedValue({})
      };
      try {
        const result = await fn(trx);
        await trx.commit();
        return result;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    })
  };
};

// Event emitter mock
export const mockEventEmitter = () => {
  const listeners = new Map<string, Function[]>();
  
  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    emit: jest.fn((event: string, ...args: any[]) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach(handler => handler(...args));
    }),
    removeListener: jest.fn((event: string, handler: Function) => {
      const handlers = listeners.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }),
    removeAllListeners: jest.fn((event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    })
  };
};

// WebSocket mock
export class MockWebSocket {
  public readyState: number = 1; // OPEN
  public url: string;
  public onopen?: Function;
  public onclose?: Function;
  public onerror?: Function;
  public onmessage?: Function;
  
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  });

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(error: Error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

// SSE Response mock
export const mockSSEResponse = () => {
  const events: string[] = [];
  return {
    writeHead: jest.fn(),
    write: jest.fn((data: string) => {
      events.push(data);
      return true;
    }),
    end: jest.fn(),
    on: jest.fn(),
    events,
    getEvents: () => events
  };
};

// Error handling helpers
export const expectAsyncError = async (fn: Function, errorMessage?: string) => {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error: any) {
    if (errorMessage) {
      expect(error.message).toContain(errorMessage);
    }
    return error;
  }
};

// Cleanup helper
export const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  if (global.localStorage) delete (global as any).localStorage;
  if (global.sessionStorage) delete (global as any).sessionStorage;
  if (global.window) delete (global as any).window;
  if (global.fetch) delete (global as any).fetch;
};