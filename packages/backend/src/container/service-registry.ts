import { getContainer } from './service-container';
import { SERVICE_TOKENS } from './interfaces';
import { LoggerService } from '../services/logger.service';

export class ServiceRegistry {
  static registerCoreServices(): void {
    const container = getContainer();

    // Register Logger first as other services may depend on it
    container.registerProvider({
      provide: SERVICE_TOKENS.Logger,
      useClass: LoggerService,
      singleton: true
    });

    // Register Config Service
    container.registerProvider({
      provide: SERVICE_TOKENS.Config,
      useFactory: () => {
        const { ConfigService } = require('../services/config.service');
        return ConfigService.getInstance();
      },
      singleton: true
    });

    // Register Event Service
    container.registerProvider({
      provide: SERVICE_TOKENS.EventBus,
      useFactory: () => {
        const { EventService } = require('../services/event.service');
        return EventService.getInstance();
      },
      singleton: true
    });

    // Register Cache Service (placeholder for now)
    container.registerProvider({
      provide: SERVICE_TOKENS.Cache,
      useFactory: () => {
        const config = container.resolve(SERVICE_TOKENS.Config);
        const logger = container.resolve(SERVICE_TOKENS.Logger);
        return {
          get: async () => null,
          set: async () => {},
          delete: async () => false,
          exists: async () => false,
          clear: async () => {},
          keys: async () => []
        };
      },
      singleton: true
    });

    // Register Rate Limiter
    container.registerProvider({
      provide: SERVICE_TOKENS.RateLimiter,
      useFactory: () => {
        const { RateLimiterService } = require('../services/rate-limiter.service');
        const config = container.resolve(SERVICE_TOKENS.Config);
        const cache = container.resolve(SERVICE_TOKENS.Cache);
        const logger = container.resolve(SERVICE_TOKENS.Logger);
        return new RateLimiterService(config, cache, logger);
      },
      singleton: true
    });

    // Register the container itself for introspection
    container.registerProvider({
      provide: SERVICE_TOKENS.Container,
      useValue: container
    });
  }

  static registerTestServices(): void {
    const container = getContainer();

    // Register mock implementations for testing
    container.registerProvider({
      provide: SERVICE_TOKENS.Logger,
      useFactory: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        child: jest.fn(() => ({
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn()
        }))
      }),
      singleton: true
    });

    container.registerProvider({
      provide: SERVICE_TOKENS.Config,
      useFactory: () => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          const testConfig: Record<string, any> = {
            'NODE_ENV': 'test',
            'PORT': 3000,
            'DATABASE_URL': ':memory:',
            'REDIS_URL': 'redis://localhost:6379',
            'JWT_SECRET': 'test-secret',
            'RATE_LIMIT_WINDOW': 60000,
            'RATE_LIMIT_MAX': 100
          };
          return testConfig[key] ?? defaultValue;
        }),
        set: jest.fn(),
        has: jest.fn((key: string) => ['NODE_ENV', 'PORT'].includes(key)),
        reload: jest.fn()
      }),
      singleton: true
    });

    container.registerProvider({
      provide: SERVICE_TOKENS.EventBus,
      useFactory: () => ({
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn()
      }),
      singleton: true
    });

    container.registerProvider({
      provide: SERVICE_TOKENS.Cache,
      useFactory: () => ({
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn(),
        clear: jest.fn(),
        keys: jest.fn()
      }),
      singleton: true
    });

    container.registerProvider({
      provide: SERVICE_TOKENS.RateLimiter,
      useFactory: () => ({
        consume: jest.fn().mockResolvedValue(true),
        reset: jest.fn().mockResolvedValue(undefined),
        getRemaining: jest.fn().mockResolvedValue(100),
        getStatus: jest.fn().mockReturnValue({ 
          enabled: true, 
          windowMs: 60000, 
          maxRequests: 100 
        })
      }),
      singleton: true
    });
  }

  static reset(): void {
    const container = getContainer();
    container.clear();
  }
}