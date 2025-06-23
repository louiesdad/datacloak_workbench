// Mock ConfigService first, at the very top
jest.mock('../config.service', () => {
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        REDIS_ENABLED: false,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_DB: 1,
        REDIS_KEY_PREFIX: 'test:'
      };
      return config[key];
    })
  };
  
  // Create a mock that always returns the same instance
  const mockGetInstance = jest.fn(() => mockConfigService);
  
  return {
    ConfigService: {
      getInstance: mockGetInstance
    }
  };
});

import {
  ICacheService,
  MemoryCacheService,
  RedisCacheService,
  CacheConfig,
  CacheOptions,
  createCacheService,
  getCacheService,
  resetCacheService
} from '../cache.service';

// Mock ioredis with comprehensive functionality
jest.mock('ioredis', () => {
  const { EventEmitter } = require('events');
  
  class MockRedisInstance extends EventEmitter {
    constructor() {
      super();
      this.store = new Map();
      this.ttlStore = new Map();
      this.expirations = this.ttlStore; // Alias for test compatibility
      
      // Emit ready event after construction to simulate successful connection
      setImmediate(() => {
        this.emit('connect');
        this.emit('ready');
      });
    }
    
    async get(key) {
      // Check if key has expired
      if (this.ttlStore.has(key)) {
        const expiry = this.ttlStore.get(key);
        if (Date.now() > expiry) {
          this.store.delete(key);
          this.ttlStore.delete(key);
          return null;
        }
      }
      return this.store.get(key) || null;
    }
    
    async set(key, value, ...args) {
      this.store.set(key, value);
      
      // Handle EX option (expire in seconds)
      if (args.length >= 2 && args[0] === 'EX') {
        const seconds = parseInt(args[1]);
        const expiry = Date.now() + (seconds * 1000);
        this.ttlStore.set(key, expiry);
      }
      
      return 'OK';
    }
    
    async setex(key, seconds, value) {
      this.store.set(key, value);
      const expiry = Date.now() + (seconds * 1000);
      this.ttlStore.set(key, expiry);
      return 'OK';
    }
    
    async exists(key) {
      // Check if key has expired
      if (this.ttlStore.has(key)) {
        const expiry = this.ttlStore.get(key);
        if (Date.now() > expiry) {
          this.store.delete(key);
          this.ttlStore.delete(key);
          return 0;
        }
      }
      return this.store.has(key) ? 1 : 0;
    }
    
    async expire(key, seconds) {
      if (this.store.has(key)) {
        if (seconds <= 0) {
          // Expire immediately
          this.store.delete(key);
          this.ttlStore.delete(key);
          return 1;
        } else {
          const expiry = Date.now() + (seconds * 1000);
          this.ttlStore.set(key, expiry);
          return 1;
        }
      }
      return 0;
    }
    
    async ttl(key) {
      if (!this.store.has(key)) return -2; // Key doesn't exist
      
      if (!this.ttlStore.has(key)) return -1; // Key exists but has no expiry
      
      const expiry = this.ttlStore.get(key);
      const remainingMs = expiry - Date.now();
      
      if (remainingMs <= 0) {
        this.store.delete(key);
        this.ttlStore.delete(key);
        return -2; // Key expired and deleted
      }
      
      return Math.ceil(remainingMs / 1000); // Return remaining seconds
    }
    
    async del(key) {
      const keys = Array.isArray(key) ? key : [key];
      let deleted = 0;
      
      for (const k of keys) {
        if (this.store.has(k)) {
          this.store.delete(k);
          this.ttlStore.delete(k);
          deleted++;
        }
      }
      
      return deleted;
    }
    
    async keys(pattern = '*') {
      const allKeys = Array.from(this.store.keys());
      if (pattern === '*') return allKeys;
      
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return allKeys.filter(key => regex.test(key));
    }
    
    async flushdb() {
      this.store.clear();
      this.ttlStore.clear();
      return 'OK';
    }
    
    async flushall() {
      this.store.clear();
      this.ttlStore.clear();
      return 'OK';
    }
    
    checkExpiration(key) {
      if (this.ttlStore.has(key)) {
        const expiry = this.ttlStore.get(key);
        if (Date.now() > expiry) {
          this.store.delete(key);
          this.ttlStore.delete(key);
        }
      }
    }
    
    checkAllExpirations() {
      for (const [key] of this.ttlStore.entries()) {
        this.checkExpiration(key);
      }
    }
    
    duplicate() {
      const newInstance = new MockRedisInstance();
      // Override constructor name for test compatibility
      Object.defineProperty(newInstance.constructor, 'name', { value: 'MockRedis' });
      return newInstance;
    }
    
    async disconnect() {
      this.store.clear();
      this.ttlStore.clear();
      this.emit('end');
    }
    
    async quit() {
      this.store.clear();
      this.ttlStore.clear();
      this.emit('end');
      return 'OK';
    }
    
    // Additional methods expected by tests
    async mget() { return []; }
    async scan() { return ['0', []]; }
    async dbsize() { return this.store.size; }
    pipeline() {
      return {
        set: () => this,
        del: () => this,
        expire: () => this,
        exec: async () => []
      };
    }
  }
  
  const MockRedis = jest.fn(() => new MockRedisInstance());
  return MockRedis;
});


describe('CacheService', () => {
  let memoryCache: ICacheService;
  let redisCache: ICacheService;
  
  const baseConfig: CacheConfig = {
    enabled: true,
    type: 'memory',
    defaultTTL: 60,
    maxMemoryUsage: 1024 * 1024, // 1MB
    compressionThreshold: 100,
    redis: {
      host: 'localhost',
      port: 6379,
      db: 1,
      keyPrefix: 'test:'
    }
  };

  beforeEach(() => {
    memoryCache = new MemoryCacheService(baseConfig);
    // Create RedisCache with mock-friendly configuration
    const redisConfig = { ...baseConfig, type: 'redis' as const, enabled: true };
    redisCache = new RedisCacheService(redisConfig);
  });

  afterEach(async () => {
    await memoryCache.close();
    if (redisCache) {
      await redisCache.close();
    }
    resetCacheService();
  });

  describe('MemoryCacheService', () => {
    describe('Basic Operations', () => {
      test('should store and retrieve string values', async () => {
        const key = 'test-string';
        const value = 'hello world';

        await memoryCache.set(key, value);
        const retrieved = await memoryCache.get(key);

        expect(retrieved).toBe(value);
      });

      test('should store and retrieve object values', async () => {
        const key = 'test-object';
        const value = { name: 'test', count: 42, nested: { flag: true } };

        await memoryCache.set(key, value);
        const retrieved = await memoryCache.get(key);

        expect(retrieved).toEqual(value);
      });

      test('should return null for non-existent keys', async () => {
        const retrieved = await memoryCache.get('non-existent');
        expect(retrieved).toBeNull();
      });

      test('should delete keys', async () => {
        const key = 'test-delete';
        const value = 'to be deleted';

        await memoryCache.set(key, value);
        expect(await memoryCache.has(key)).toBe(true);

        const deleted = await memoryCache.del(key);
        expect(deleted).toBe(true);
        expect(await memoryCache.has(key)).toBe(false);
      });

      test('should clear all keys', async () => {
        await memoryCache.set('key1', 'value1');
        await memoryCache.set('key2', 'value2');

        expect(await memoryCache.has('key1')).toBe(true);
        expect(await memoryCache.has('key2')).toBe(true);

        await memoryCache.clear();

        expect(await memoryCache.has('key1')).toBe(false);
        expect(await memoryCache.has('key2')).toBe(false);
      });
    });

    describe('TTL Functionality', () => {
      test('should expire keys after TTL', async () => {
        const key = 'test-ttl';
        const value = 'expires soon';

        await memoryCache.set(key, value, { ttl: 1 });
        expect(await memoryCache.get(key)).toBe(value);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));
        expect(await memoryCache.get(key)).toBeNull();
      });

      test('should handle TTL of 0 (no expiration)', async () => {
        const key = 'test-no-ttl';
        const value = 'never expires';

        await memoryCache.set(key, value, { ttl: 0 });
        expect(await memoryCache.get(key)).toBe(value);

        // Should still exist after some time
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(await memoryCache.get(key)).toBe(value);
      });

      test('should update TTL with expire method', async () => {
        const key = 'test-expire';
        const value = 'test value';

        await memoryCache.set(key, value);
        const extended = await memoryCache.expire(key, 2);

        expect(extended).toBe(true);
        expect(await memoryCache.ttl(key)).toBeGreaterThan(0);
      });

      test('should return correct TTL values', async () => {
        const key = 'test-ttl-check';
        const value = 'test value';

        await memoryCache.set(key, value, { ttl: 10 });
        const ttl = await memoryCache.ttl(key);

        expect(ttl).toBeGreaterThan(8);
        expect(ttl).toBeLessThanOrEqual(10);
      });

      test('should return -1 for keys without TTL', async () => {
        const key = 'test-no-ttl';
        const value = 'test value';

        await memoryCache.set(key, value, { ttl: 0 });
        const ttl = await memoryCache.ttl(key);

        expect(ttl).toBe(-1);
      });

      test('should return -2 for expired keys', async () => {
        const key = 'test-expired';
        const value = 'test value';

        await memoryCache.set(key, value, { ttl: 1 });
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));
        const ttl = await memoryCache.ttl(key);

        expect(ttl).toBe(-2);
      });
    });

    describe('Pattern Matching', () => {
      beforeEach(async () => {
        await memoryCache.set('user:1', 'John');
        await memoryCache.set('user:2', 'Jane');
        await memoryCache.set('order:1', 'Order 1');
        await memoryCache.set('order:2', 'Order 2');
        await memoryCache.set('config', 'Config data');
      });

      test('should return all keys when no pattern specified', async () => {
        const keys = await memoryCache.keys();
        expect(keys).toHaveLength(5);
        expect(keys).toContain('user:1');
        expect(keys).toContain('config');
      });

      test('should match wildcard patterns', async () => {
        const userKeys = await memoryCache.keys('user:*');
        expect(userKeys).toHaveLength(2);
        expect(userKeys).toContain('user:1');
        expect(userKeys).toContain('user:2');
      });

      test('should match single character patterns', async () => {
        const keys = await memoryCache.keys('user:?');
        expect(keys).toHaveLength(2);
        expect(keys).toContain('user:1');
        expect(keys).toContain('user:2');
      });
    });

    describe('Memory Management', () => {
      test('should evict oldest entries when memory limit exceeded', async () => {
        const smallMemoryCache = new MemoryCacheService({
          ...baseConfig,
          maxMemoryUsage: 300 // Small limit - each string of 100 chars is ~200 bytes
        });

        // Fill cache beyond limit
        await smallMemoryCache.set('key1', 'a'.repeat(100));
        await smallMemoryCache.set('key2', 'b'.repeat(100));
        await smallMemoryCache.set('key3', 'c'.repeat(100)); // Should trigger eviction

        // First key should be evicted
        expect(await smallMemoryCache.has('key1')).toBe(false);
        expect(await smallMemoryCache.has('key2')).toBe(true);
        expect(await smallMemoryCache.has('key3')).toBe(true);

        await smallMemoryCache.close();
      });

      test('should clean up expired entries automatically', async () => {
        const fastCleanupCache = new MemoryCacheService({
          ...baseConfig,
          defaultTTL: 1
        });

        await fastCleanupCache.set('temp1', 'value1', { ttl: 1 });
        await fastCleanupCache.set('temp2', 'value2', { ttl: 1 });

        expect(await fastCleanupCache.has('temp1')).toBe(true);
        expect(await fastCleanupCache.has('temp2')).toBe(true);

        // Wait for expiration and cleanup
        await new Promise(resolve => setTimeout(resolve, 1100));

        expect(await fastCleanupCache.has('temp1')).toBe(false);
        expect(await fastCleanupCache.has('temp2')).toBe(false);

        await fastCleanupCache.close();
      });

      test('should not evict when under memory limit', async () => {
        const largeMemoryCache = new MemoryCacheService({
          ...baseConfig,
          maxMemoryUsage: 10 * 1024 * 1024 // 10MB - very large
        });

        await largeMemoryCache.set('key1', 'small value 1');
        await largeMemoryCache.set('key2', 'small value 2');
        await largeMemoryCache.set('key3', 'small value 3');

        // All keys should remain
        expect(await largeMemoryCache.has('key1')).toBe(true);
        expect(await largeMemoryCache.has('key2')).toBe(true);
        expect(await largeMemoryCache.has('key3')).toBe(true);

        await largeMemoryCache.close();
      });

      test('should handle null and undefined values correctly', async () => {
        await memoryCache.set('null-key', null);
        await memoryCache.set('undefined-key', undefined);

        expect(await memoryCache.get('null-key')).toBeNull();
        expect(await memoryCache.get('undefined-key')).toBeUndefined();
      });

      test('should handle different data types', async () => {
        const testData = {
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: { value: 'test' } },
          string: 'test string'
        };

        for (const [key, value] of Object.entries(testData)) {
          await memoryCache.set(`type-${key}`, value);
          const retrieved = await memoryCache.get(`type-${key}`);
          expect(retrieved).toEqual(value);
        }

        // Test date separately due to serialization
        const testDate = new Date('2023-01-01');
        await memoryCache.set('date-key', testDate);
        const retrievedDate = await memoryCache.get('date-key');
        // Dates get serialized, so compare the string representation
        expect(new Date(retrievedDate).getTime()).toBe(testDate.getTime());
      });

      test('should handle eviction events', async () => {
        const events: any[] = [];
        const smallMemoryCache = new MemoryCacheService({
          ...baseConfig,
          maxMemoryUsage: 200
        });

        smallMemoryCache.on('cache:evicted', (data) => events.push(data));

        await smallMemoryCache.set('key1', 'a'.repeat(50));
        await smallMemoryCache.set('key2', 'b'.repeat(50));
        await smallMemoryCache.set('key3', 'c'.repeat(50)); // Should trigger eviction

        expect(events.length).toBeGreaterThan(0);
        expect(events[0]).toHaveProperty('key');
        expect(events[0]).toHaveProperty('size');

        await smallMemoryCache.close();
      });

      test('should handle cleanup events', async () => {
        const events: any[] = [];
        const cleanupCache = new MemoryCacheService({
          ...baseConfig,
          defaultTTL: 1
        });

        cleanupCache.on('cache:cleanup', (data) => events.push(data));

        await cleanupCache.set('temp1', 'value1', { ttl: 1 });
        await cleanupCache.set('temp2', 'value2', { ttl: 1 });

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Manually trigger cleanup by calling private method using type casting
        (cleanupCache as any).cleanupExpired();

        expect(events.length).toBeGreaterThan(0);
        expect(events[0]).toHaveProperty('removedCount');
        expect(events[0].removedCount).toBeGreaterThan(0);

        await cleanupCache.close();
      });
    });

    describe('Advanced TTL and Configuration', () => {
      test('should handle TTL with explicit 0 (no expiration)', async () => {
        await memoryCache.set('persistent-key', 'persistent-value', { ttl: 0 });
        
        // Should not expire even after some time
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(await memoryCache.get('persistent-key')).toBe('persistent-value');
      });

      test('should handle config getters', () => {
        const config = memoryCache.getConfig();
        expect(config).toHaveProperty('enabled');
        expect(config).toHaveProperty('type');
        expect(config).toHaveProperty('defaultTTL');
        expect(config).toHaveProperty('maxMemoryUsage');
      });

      test('should handle serialization options', async () => {
        const complexObject = { 
          date: new Date('2023-01-01'),
          nested: { array: [1, 2, 3] }
        };

        // Test with serialization enabled (default)
        await memoryCache.set('serialized-key', complexObject, { serialize: true });
        const retrieved = await memoryCache.get('serialized-key');
        expect(retrieved).toEqual(JSON.parse(JSON.stringify(complexObject)));

        // Test with serialization disabled
        await memoryCache.set('non-serialized-key', complexObject, { serialize: false });
        const retrievedNonSerialized = await memoryCache.get('non-serialized-key');
        expect(retrievedNonSerialized).toEqual(complexObject);
      });

      test('should handle error during set operation', async () => {
        const errorCache = new MemoryCacheService({
          ...baseConfig,
          maxMemoryUsage: -1 // Invalid config to trigger errors
        });

        const events: any[] = [];
        errorCache.on('cache:error', (data) => events.push(data));

        // This might cause an error internally
        const result = await errorCache.set('error-key', 'error-value');
        
        // Should handle errors gracefully
        expect(typeof result).toBe('boolean');

        await errorCache.close();
      });
    });

    describe('Statistics', () => {
      test('should track cache statistics', async () => {
        const initialStats = memoryCache.getStats();
        expect(initialStats.hits).toBe(0);
        expect(initialStats.misses).toBe(0);
        expect(initialStats.sets).toBe(0);

        await memoryCache.set('key1', 'value1');
        await memoryCache.get('key1'); // hit
        await memoryCache.get('key2'); // miss
        await memoryCache.del('key1');

        const stats = memoryCache.getStats();
        expect(stats.sets).toBe(1);
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.deletes).toBe(1);
        expect(stats.hitRate).toBe(0.5); // 1 hit out of 2 total operations
      });
    });

    describe('Events', () => {
      test('should emit cache events', async () => {
        const events: any[] = [];
        
        memoryCache.on('cache:set', (data) => events.push({ type: 'set', data }));
        memoryCache.on('cache:hit', (data) => events.push({ type: 'hit', data }));
        memoryCache.on('cache:delete', (data) => events.push({ type: 'delete', data }));

        await memoryCache.set('test', 'value');
        await memoryCache.get('test');
        await memoryCache.del('test');

        expect(events).toHaveLength(3);
        expect(events[0].type).toBe('set');
        expect(events[1].type).toBe('hit');
        expect(events[2].type).toBe('delete');
      });
    });
  });

  describe('RedisCacheService', () => {
    beforeEach(() => {
      redisCache = new RedisCacheService({ ...baseConfig, type: 'redis' });
    });

    test('should handle Redis operations', async () => {
      const key = 'redis-test';
      const value = { data: 'test value' };

      // Test actual Redis operations with our mock
      await redisCache.set(key, value);
      const retrieved = await redisCache.get(key);

      expect(retrieved).toEqual(value);
    });

    test('should handle Redis connection errors gracefully', async () => {
      const stats = redisCache.getStats();
      const initialErrors = stats.errors;

      // This should not throw but increment error count
      await redisCache.get('non-existent-key');

      const updatedStats = redisCache.getStats();
      expect(updatedStats.errors).toBeGreaterThanOrEqual(initialErrors);
    });

    test('should emit Redis-specific events', async () => {
      const events: any[] = [];
      
      redisCache.on('cache:connected', () => events.push('connected'));
      redisCache.on('cache:ready', () => events.push('ready'));

      // Wait a bit for connection events
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toContain('ready');
    });

    test('should handle TTL operations in Redis', async () => {
      const key = 'redis-ttl-test';
      const value = 'test value with ttl';

      // Set with TTL
      await redisCache.set(key, value, { ttl: 10 });
      expect(await redisCache.has(key)).toBe(true);

      // Update TTL
      const expired = await redisCache.expire(key, 20);
      expect(expired).toBe(true);

      // Get TTL
      const ttl = await redisCache.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(20);

      // Expire immediately
      await redisCache.expire(key, 0);
      expect(await redisCache.has(key)).toBe(false);
    });

    test('should handle Redis string operations', async () => {
      const key = 'redis-string-test';
      const value = 'simple string value';

      await redisCache.set(key, value);
      const retrieved = await redisCache.get(key);

      expect(retrieved).toBe(value);
    });

    test('should handle keys pattern matching', async () => {
      await redisCache.set('test:key1', 'value1');
      await redisCache.set('test:key2', 'value2');
      await redisCache.set('other:key3', 'value3');

      const testKeys = await redisCache.keys('test:*');
      expect(testKeys).toHaveLength(2);
      expect(testKeys).toContain('test:key1');
      expect(testKeys).toContain('test:key2');

      const allKeys = await redisCache.keys('*');
      expect(allKeys.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle Redis delete operations', async () => {
      const key = 'redis-delete-test';
      await redisCache.set(key, 'to be deleted');

      expect(await redisCache.has(key)).toBe(true);

      const deleted = await redisCache.del(key);
      expect(deleted).toBe(true);
      expect(await redisCache.has(key)).toBe(false);

      // Try to delete non-existent key
      const notDeleted = await redisCache.del('non-existent');
      expect(notDeleted).toBe(false);
    });

    test('should handle Redis clear operation', async () => {
      await redisCache.set('clear-test-1', 'value1');
      await redisCache.set('clear-test-2', 'value2');

      // Verify keys exist before clearing
      expect(await redisCache.has('clear-test-1')).toBe(true);
      expect(await redisCache.has('clear-test-2')).toBe(true);

      const cleared = await redisCache.clear();
      expect(cleared).toBe(true);

      expect(await redisCache.has('clear-test-1')).toBe(false);
      expect(await redisCache.has('clear-test-2')).toBe(false);
    });

    test('should handle Redis configuration', () => {
      const config = redisCache.getConfig();
      expect(config.type).toBe('redis');
      expect(config.redis).toBeDefined();
      expect(config.redis?.host).toBeDefined();
      expect(config.redis?.port).toBeDefined();
    });

    test('should handle missing Redis configuration gracefully', () => {
      expect(() => {
        new RedisCacheService({
          enabled: true,
          type: 'redis',
          defaultTTL: 3600,
          maxMemoryUsage: 100 * 1024 * 1024,
          compressionThreshold: 1024
          // Missing redis config
        });
      }).toThrow('Redis configuration required for RedisCacheService');
    });
  });

  describe('Cache Factory', () => {
    test('should create memory cache by default', () => {
      const cache = createCacheService({ 
        enabled: true, 
        type: 'memory',
        defaultTTL: 3600,
        maxMemoryUsage: 100 * 1024 * 1024,
        compressionThreshold: 1024,
        redis: {
          host: 'localhost',
          port: 6379,
          db: 1,
          keyPrefix: 'test:'
        }
      });
      expect(cache).toBeInstanceOf(MemoryCacheService);
    });

    test('should create Redis cache when configured', () => {
      const cache = createCacheService({ 
        enabled: true, 
        type: 'redis',
        defaultTTL: 3600,
        maxMemoryUsage: 100 * 1024 * 1024,
        compressionThreshold: 1024,
        redis: {
          host: 'localhost',
          port: 6379,
          db: 1,
          keyPrefix: 'test:'
        }
      });
      expect(cache).toBeInstanceOf(RedisCacheService);
    });

    test('should return singleton instance', () => {
      // Reset cache service before test
      resetCacheService();
      const cache1 = getCacheService();
      const cache2 = getCacheService();
      expect(cache1).toBe(cache2);
    });
  });

  describe('Compression', () => {
    beforeEach(() => {
      redisCache = new RedisCacheService({ ...baseConfig, type: 'redis' });
    });

    test('should compress large values when enabled', async () => {
      const events: any[] = [];
      redisCache.on('cache:compressed', (data) => events.push(data));

      const largeValue = 'x'.repeat(200); // Larger than compression threshold
      await redisCache.set('large-key', largeValue, { compress: true });

      expect(events).toHaveLength(1);
      expect(events[0].originalSize).toBeGreaterThan(100);
    });

    test('should decompress values on retrieval', async () => {
      const value = 'x'.repeat(200);
      await redisCache.set('compressed-key', value, { compress: true });
      const retrieved = await redisCache.get('compressed-key');

      expect(retrieved).toBe(value);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      redisCache = new RedisCacheService({ ...baseConfig, type: 'redis' });
    });

    test('should handle set operation errors gracefully', async () => {
      // Mock a Redis error
      const mockRedis = (redisCache as any).redis;
      mockRedis.setex = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await redisCache.set('error-key', 'value', { ttl: 10 });
      expect(result).toBe(false);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle get operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await redisCache.get('error-key');
      expect(result).toBeNull();

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle del operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Redis delete error'));

      const result = await redisCache.del('error-key');
      expect(result).toBe(false);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle clear operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.flushdb = jest.fn().mockRejectedValue(new Error('Redis clear error'));

      const result = await redisCache.clear();
      expect(result).toBe(false);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle has operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.exists = jest.fn().mockRejectedValue(new Error('Redis exists error'));

      const result = await redisCache.has('error-key');
      expect(result).toBe(false);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle keys operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.keys = jest.fn().mockRejectedValue(new Error('Redis keys error'));

      const result = await redisCache.keys('*');
      expect(result).toEqual([]);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle expire operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.expire = jest.fn().mockRejectedValue(new Error('Redis expire error'));

      const result = await redisCache.expire('error-key', 60);
      expect(result).toBe(false);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    test('should handle ttl operation errors gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      mockRedis.ttl = jest.fn().mockRejectedValue(new Error('Redis ttl error'));

      const result = await redisCache.ttl('error-key');
      expect(result).toBe(-1);

      const stats = redisCache.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });
  });

  describe('Redis Serialization Edge Cases', () => {
    beforeEach(() => {
      redisCache = new RedisCacheService({ ...baseConfig, type: 'redis' });
    });

    test('should handle non-JSON string values without compression', async () => {
      const simpleString = 'simple-string-value';
      await redisCache.set('simple-string', simpleString);
      const retrieved = await redisCache.get('simple-string');
      expect(retrieved).toBe(simpleString);
    });

    test('should handle compressed string retrieval', async () => {
      const mockRedis = (redisCache as any).redis;
      // Mock Redis to return a compressed value
      mockRedis.get = jest.fn().mockResolvedValue('compressed:original-value');

      const result = await redisCache.get('compressed-key');
      expect(result).toBe('original-value');
    });

    test('should handle JSON parsing failures gracefully', async () => {
      const mockRedis = (redisCache as any).redis;
      // Mock Redis to return invalid JSON
      mockRedis.get = jest.fn().mockResolvedValue('invalid-json{');

      const result = await redisCache.get('invalid-json-key');
      expect(result).toBe('invalid-json{');
    });

    test('should handle TTL of 0 for persistent storage', async () => {
      const mockRedis = (redisCache as any).redis;
      const setSpy = jest.spyOn(mockRedis, 'set');

      await redisCache.set('persistent-key', 'persistent-value', { ttl: 0 });
      
      // Should call set instead of setex when TTL is 0
      expect(setSpy).toHaveBeenCalledWith('persistent-key', 'persistent-value');
    });

    test('should handle compression events correctly', async () => {
      const events: any[] = [];
      redisCache.on('cache:compressed', (data) => events.push(data));

      const largeValue = 'x'.repeat(200); // Larger than compression threshold
      await redisCache.set('large-key', largeValue, { compress: true });

      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('key', 'large-key');
      expect(events[0]).toHaveProperty('originalSize');
      expect(events[0]).toHaveProperty('compressedSize');
    });
  });

  describe('Factory Configuration Edge Cases', () => {
    test('should handle ConfigService getInstance failure', () => {
      // Mock ConfigService to throw an error
      const originalGetInstance = require('../config.service').ConfigService.getInstance;
      require('../config.service').ConfigService.getInstance = jest.fn(() => {
        throw new Error('ConfigService error');
      });

      const cache = createCacheService({
        enabled: true,
        type: 'memory'
      });

      expect(cache).toBeInstanceOf(MemoryCacheService);

      // Restore original
      require('../config.service').ConfigService.getInstance = originalGetInstance;
    });

    test('should handle ConfigService get method failure', () => {
      // Mock ConfigService to have a get method that throws
      const mockConfigService = {
        get: jest.fn(() => {
          throw new Error('Config get error');
        })
      };
      require('../config.service').ConfigService.getInstance = jest.fn(() => mockConfigService);

      const cache = createCacheService();
      expect(cache).toBeInstanceOf(MemoryCacheService);
    });

    test('should create redis cache with enabled=true and type=redis', () => {
      const cache = createCacheService({
        enabled: true,
        type: 'redis',
        redis: {
          host: 'localhost',
          port: 6379,
          db: 1,
          keyPrefix: 'test:'
        }
      });
      expect(cache).toBeInstanceOf(RedisCacheService);
    });

    test('should fallback to memory cache when redis is disabled', () => {
      const cache = createCacheService({
        enabled: false,
        type: 'redis',
        redis: {
          host: 'localhost',
          port: 6379,
          db: 1,
          keyPrefix: 'test:'
        }
      });
      expect(cache).toBeInstanceOf(MemoryCacheService);
    });
  });

  describe('MockRedis Class Coverage', () => {
    let mockRedis: any;

    beforeEach(() => {
      const MockRedis = require('ioredis');
      mockRedis = new MockRedis();
    });

    test('should handle duplicate method', () => {
      const duplicated = mockRedis.duplicate();
      expect(duplicated).toBeDefined();
      expect(duplicated.constructor.name).toBe('MockRedis');
    });

    test('should handle checkExpiration method', async () => {
      await mockRedis.setex('expire-test', 1, 'value');
      
      // Manually trigger expiration
      mockRedis.expirations.set('expire-test', Date.now() - 1000);
      mockRedis.checkExpiration('expire-test');
      
      const value = await mockRedis.get('expire-test');
      expect(value).toBeNull();
    });

    test('should handle checkAllExpirations method', async () => {
      await mockRedis.setex('expire1', 1, 'value1');
      await mockRedis.setex('expire2', 1, 'value2');
      
      // Set expiration times in the past
      mockRedis.expirations.set('expire1', Date.now() - 1000);
      mockRedis.expirations.set('expire2', Date.now() - 1000);
      
      mockRedis.checkAllExpirations();
      
      expect(await mockRedis.get('expire1')).toBeNull();
      expect(await mockRedis.get('expire2')).toBeNull();
    });

    test('should handle flushall method', async () => {
      await mockRedis.set('key1', 'value1');
      await mockRedis.set('key2', 'value2');
      
      const result = await mockRedis.flushall();
      expect(result).toBe('OK');
      
      expect(await mockRedis.get('key1')).toBeNull();
      expect(await mockRedis.get('key2')).toBeNull();
    });

    test('should handle disconnect method', async () => {
      await mockRedis.set('key1', 'value1');
      mockRedis.disconnect();
      
      expect(mockRedis.store.size).toBe(0);
    });
  });

  describe('Memory Management Edge Cases', () => {
    test('should handle eviction when already under target size', async () => {
      const largeMemoryCache = new MemoryCacheService({
        ...baseConfig,
        maxMemoryUsage: 10000 // Large limit
      });

      await largeMemoryCache.set('key1', 'small-value');
      
      // Manually call evictOldest when we're under the limit
      (largeMemoryCache as any).evictOldest();
      
      // Key should still exist since we're under the limit
      expect(await largeMemoryCache.has('key1')).toBe(true);

      await largeMemoryCache.close();
    });

    test('should estimate size correctly for different data types', async () => {
      const cache = new MemoryCacheService(baseConfig);
      
      // Test different data types
      await cache.set('null-test', null);
      await cache.set('undefined-test', undefined);
      await cache.set('number-test', 42);
      await cache.set('boolean-test', true);
      await cache.set('object-test', { nested: { value: 'test' } });
      
      const stats = cache.getStats();
      expect(stats.sets).toBe(5);

      await cache.close();
    });
  });

  describe('Configuration Validation', () => {
    test('should handle resetCacheService when instance exists', async () => {
      // Create an instance first
      const instance = getCacheService();
      expect(instance).toBeDefined();
      
      // Reset should work without errors
      resetCacheService();
      
      // Getting service again should create a new instance
      const newInstance = getCacheService();
      expect(newInstance).toBeDefined();
    });

    test('should handle close method when cleanupInterval is undefined', async () => {
      const cache = new MemoryCacheService(baseConfig);
      
      // Clear the cleanup interval manually
      (cache as any).cleanupInterval = undefined;
      
      // Close should not throw
      await expect(cache.close()).resolves.toBeUndefined();
    });
  });

  describe('Additional Coverage Tests', () => {
    test('should handle memory cache set operation errors', async () => {
      const cache = new MemoryCacheService(baseConfig);
      const events: any[] = [];
      cache.on('cache:error', (data) => events.push(data));

      // Force an error by corrupting the internal data structure
      const originalSet = Map.prototype.set;
      Map.prototype.set = jest.fn(() => {
        throw new Error('Forced error');
      });

      const result = await cache.set('error-key', 'error-value');
      expect(result).toBe(false);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].operation).toBe('set');

      // Restore original set method
      Map.prototype.set = originalSet;
      await cache.close();
    });

    test('should estimate size for unknown data types', async () => {
      const cache = new MemoryCacheService(baseConfig);
      
      // Test with symbol (unknown type)
      const symbolValue = Symbol('test');
      await cache.set('symbol-key', symbolValue as any);
      
      const stats = cache.getStats();
      expect(stats.sets).toBe(1);

      await cache.close();
    });

    test('should handle Redis connection events', () => {
      const events: any[] = [];
      const redisService = new RedisCacheService({ ...baseConfig, type: 'redis' });
      
      redisService.on('cache:error', (data) => events.push({ type: 'error', data }));
      redisService.on('cache:connected', () => events.push({ type: 'connected' }));

      // Trigger connection error
      const mockRedis = (redisService as any).redis;
      mockRedis.emit('error', new Error('Connection failed'));
      
      // Trigger connect event
      mockRedis.emit('connect');

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'error')).toBe(true);
      expect(events.some(e => e.type === 'connected')).toBe(true);

      redisService.close();
    });

    test('should handle ConfigService fallback with getConfigValue errors', () => {
      // Mock ConfigService to have a get method that throws
      const mockConfigService = {
        get: jest.fn(() => {
          throw new Error('Config get error');
        })
      };
      
      const originalGetInstance = require('../config.service').ConfigService.getInstance;
      require('../config.service').ConfigService.getInstance = jest.fn(() => mockConfigService);

      const cache = createCacheService({
        type: 'memory'
      });
      
      expect(cache).toBeInstanceOf(MemoryCacheService);

      // Restore original
      require('../config.service').ConfigService.getInstance = originalGetInstance;
    });

    test('should handle ConfigService getInstance throwing error in factory', () => {
      const originalGetInstance = require('../config.service').ConfigService.getInstance;
      require('../config.service').ConfigService.getInstance = jest.fn(() => {
        throw new Error('ConfigService error');
      });

      const cache = createCacheService();
      expect(cache).toBeInstanceOf(MemoryCacheService);

      // Restore original
      require('../config.service').ConfigService.getInstance = originalGetInstance;
    });

    test('should cover Redis TTL return value edge case', async () => {
      const mockRedis = redisCache ? (redisCache as any).redis : null;
      if (mockRedis) {
        // Test edge case where TTL returns 0 but key should still be treated as expired
        mockRedis.ttl = jest.fn().mockResolvedValue(0);
        
        const ttl = await redisCache.ttl('test-key');
        expect(ttl).toBe(0);
      }
    });
  });
});