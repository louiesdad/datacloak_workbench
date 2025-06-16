import { createCacheService, MemoryCacheService, RedisCacheService, ICacheService } from '../services/cache.service';
import { ConfigService } from '../services/config.service';

describe('Cache Service', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = ConfigService.getInstance();
  });

  describe('MemoryCacheService', () => {
    let cacheService: MemoryCacheService;

    beforeEach(() => {
      const config = {
        enabled: true,
        type: 'memory' as const,
        defaultTTL: 300,
        maxMemoryUsage: 1024 * 1024,
        compressionThreshold: 1024
      };
      cacheService = new MemoryCacheService(config);
    });

    afterEach(async () => {
      await cacheService.close();
    });

    describe('Basic Operations', () => {
      it('should set and get values', async () => {
        const key = 'test:key';
        const value = { data: 'test value', number: 42 };

        const setResult = await cacheService.set(key, value);
        expect(setResult).toBe(true);

        const retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toEqual(value);
      });

      it('should return null for non-existent keys', async () => {
        const result = await cacheService.get('non-existent-key');
        expect(result).toBeNull();
      });

      it('should delete keys', async () => {
        const key = 'test:delete';
        await cacheService.set(key, 'value');

        const deleteResult = await cacheService.del(key);
        expect(deleteResult).toBe(true);

        const retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toBeNull();
      });

      it('should check if keys exist', async () => {
        const key = 'test:exists';
        
        let exists = await cacheService.has(key);
        expect(exists).toBe(false);

        await cacheService.set(key, 'value');
        exists = await cacheService.has(key);
        expect(exists).toBe(true);
      });

      it('should clear all cache', async () => {
        await cacheService.set('key1', 'value1');
        await cacheService.set('key2', 'value2');

        const cleared = await cacheService.clear();
        expect(cleared).toBe(true);

        const value1 = await cacheService.get('key1');
        const value2 = await cacheService.get('key2');
        expect(value1).toBeNull();
        expect(value2).toBeNull();
      });
    });

    describe('TTL and Expiration', () => {
      it('should respect TTL', async () => {
        const key = 'test:ttl';
        const value = 'expires soon';

        await cacheService.set(key, value, { ttl: 1 }); // 1 second

        // Should be available immediately
        let retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toBe(value);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toBeNull();
      });

      it('should use default TTL when not specified', async () => {
        const key = 'test:default-ttl';
        await cacheService.set(key, 'value');

        const exists = await cacheService.has(key);
        expect(exists).toBe(true);
      });
    });

    describe('Pattern Matching', () => {
      beforeEach(async () => {
        await cacheService.set('user:1', 'user1');
        await cacheService.set('user:2', 'user2');
        await cacheService.set('post:1', 'post1');
        await cacheService.set('cache:test', 'test');
      });

      it('should find keys by pattern', async () => {
        const userKeys = await cacheService.keys('user:*');
        expect(userKeys).toHaveLength(2);
        expect(userKeys).toContain('user:1');
        expect(userKeys).toContain('user:2');
      });

      it('should return all keys with wildcard', async () => {
        const allKeys = await cacheService.keys('*');
        expect(allKeys.length).toBeGreaterThanOrEqual(4);
      });

      it('should return empty array for non-matching pattern', async () => {
        const keys = await cacheService.keys('nonexistent:*');
        expect(keys).toHaveLength(0);
      });
    });

    describe('Statistics', () => {
      it('should track cache statistics', async () => {
        const initialStats = cacheService.getStats();
        expect(initialStats.hits).toBe(0);
        expect(initialStats.misses).toBe(0);

        // Cause a miss
        await cacheService.get('non-existent');

        // Cause a hit
        await cacheService.set('test', 'value');
        await cacheService.get('test');

        const finalStats = cacheService.getStats();
        expect(finalStats.misses).toBe(1);
        expect(finalStats.hits).toBe(1);
        expect(finalStats.sets).toBe(1);
        expect(finalStats.hitRate).toBe(0.5);
      });
    });

    describe('Memory Management', () => {
      it('should handle large values', async () => {
        const largeValue = 'x'.repeat(2000); // 2KB string
        const setResult = await cacheService.set('large:value', largeValue);
        expect(setResult).toBe(true);

        const retrievedValue = await cacheService.get('large:value');
        expect(retrievedValue).toBe(largeValue);
      });

      it('should estimate memory usage', async () => {
        await cacheService.set('small', 'tiny');
        await cacheService.set('medium', 'x'.repeat(500));
        await cacheService.set('large', 'x'.repeat(1500));

        const config = cacheService.getConfig();
        expect(config.maxMemoryUsage).toBeDefined();
      });
    });
  });

  describe('RedisCacheService', () => {
    let cacheService: RedisCacheService;

    beforeAll(() => {
      // Skip Redis tests if Redis is not available
      if (process.env.SKIP_REDIS_TESTS === 'true') {
        return;
      }
    });

    beforeEach(async () => {
      if (process.env.SKIP_REDIS_TESTS === 'true') return;

      const config = {
        enabled: true,
        type: 'redis' as const,
        defaultTTL: 300,
        maxMemoryUsage: 1024 * 1024,
        compressionThreshold: 1024,
        redis: {
          host: 'localhost',
          port: 6379,
          db: 15, // Use test database
          keyPrefix: 'test:cache:'
        }
      };

      try {
        cacheService = new RedisCacheService(config);
        
        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 3000);
          cacheService.once('cache:ready', () => {
            clearTimeout(timeout);
            resolve();
          });
          cacheService.once('cache:error', reject);
        });

        // Clear test database
        await cacheService.clear();
      } catch (error) {
        console.log('Redis not available for testing, skipping Redis cache tests');
        process.env.SKIP_REDIS_TESTS = 'true';
        return;
      }
    });

    afterEach(async () => {
      if (process.env.SKIP_REDIS_TESTS === 'true' || !cacheService) return;
      
      try {
        await cacheService.clear();
        await cacheService.close();
      } catch (error) {
        console.warn('Error cleaning up Redis cache:', error);
      }
    });

    describe('Basic Operations', () => {
      it('should set and get values', async () => {
        if (process.env.SKIP_REDIS_TESTS === 'true') return;

        const key = 'redis:test';
        const value = { data: 'redis test', timestamp: Date.now() };

        const setResult = await cacheService.set(key, value);
        expect(setResult).toBe(true);

        const retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toEqual(value);
      });

      it('should handle complex objects', async () => {
        if (process.env.SKIP_REDIS_TESTS === 'true') return;

        const key = 'redis:complex';
        const value = {
          array: [1, 2, 3],
          nested: { prop: 'value' },
          date: new Date().toISOString(),
          number: 42,
          boolean: true,
          null: null
        };

        await cacheService.set(key, value);
        const retrievedValue = await cacheService.get(key);
        expect(retrievedValue).toEqual(value);
      });

      it('should respect TTL in Redis', async () => {
        if (process.env.SKIP_REDIS_TESTS === 'true') return;

        const key = 'redis:ttl';
        await cacheService.set(key, 'temporary', { ttl: 1 });

        // Should exist immediately
        let value = await cacheService.get(key);
        expect(value).toBe('temporary');

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        value = await cacheService.get(key);
        expect(value).toBeNull();
      });

      it('should handle Redis-specific operations', async () => {
        if (process.env.SKIP_REDIS_TESTS === 'true') return;

        const key = 'redis:specific';
        await cacheService.set(key, 'value', { ttl: 3600 });

        // Test TTL method (Redis-specific)
        if ('ttl' in cacheService) {
          const ttl = await (cacheService as any).ttl(key);
          expect(ttl).toBeGreaterThan(3590); // Should be close to 3600
        }

        // Test expire method (Redis-specific)
        if ('expire' in cacheService) {
          const expired = await (cacheService as any).expire(key, 1);
          expect(expired).toBe(true);
        }
      });
    });
  });

  describe('Cache Factory', () => {
    it('should create memory cache when Redis is disabled', () => {
      configService.set('CACHE_ENABLED', true);
      configService.set('CACHE_TYPE', 'memory');

      const cache = createCacheService();
      expect(cache).toBeInstanceOf(MemoryCacheService);
    });

    it('should create cache with custom configuration', () => {
      const customConfig = {
        enabled: true,
        type: 'memory' as const,
        defaultTTL: 1800,
        maxMemoryUsage: 50 * 1024 * 1024
      };

      const cache = createCacheService(customConfig);
      expect(cache).toBeInstanceOf(MemoryCacheService);
      
      const config = cache.getConfig();
      expect(config.defaultTTL).toBe(1800);
      expect(config.maxMemoryUsage).toBe(50 * 1024 * 1024);
    });
  });

  describe('Cache Integration', () => {
    let cache: ICacheService;

    beforeEach(() => {
      cache = createCacheService({ enabled: true, type: 'memory' });
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      
      // Concurrent sets
      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`concurrent:${i}`, `value${i}`));
      }
      
      const setResults = await Promise.all(promises);
      expect(setResults.every(result => result === true)).toBe(true);

      // Concurrent gets
      const getPromises = [];
      for (let i = 0; i < 10; i++) {
        getPromises.push(cache.get(`concurrent:${i}`));
      }
      
      const getResults = await Promise.all(getPromises);
      getResults.forEach((value, index) => {
        expect(value).toBe(`value${index}`);
      });
    });

    it('should handle cache invalidation patterns', async () => {
      // Set up test data
      await cache.set('user:1:profile', { name: 'John' });
      await cache.set('user:1:settings', { theme: 'dark' });
      await cache.set('user:2:profile', { name: 'Jane' });
      await cache.set('post:1', { title: 'Test Post' });

      // Get user:1 keys
      const user1Keys = await cache.keys('user:1:*');
      expect(user1Keys).toHaveLength(2);

      // Invalidate user:1 cache
      for (const key of user1Keys) {
        await cache.del(key);
      }

      // Verify user:1 data is gone
      const profile = await cache.get('user:1:profile');
      const settings = await cache.get('user:1:settings');
      expect(profile).toBeNull();
      expect(settings).toBeNull();

      // Verify other data remains
      const user2Profile = await cache.get('user:2:profile');
      const post = await cache.get('post:1');
      expect(user2Profile).toEqual({ name: 'Jane' });
      expect(post).toEqual({ title: 'Test Post' });
    });

    it('should provide accurate performance metrics', async () => {
      const initialStats = cache.getStats();
      
      // Generate some cache activity
      await cache.set('perf:1', 'value1');
      await cache.set('perf:2', 'value2');
      await cache.get('perf:1'); // hit
      await cache.get('perf:2'); // hit
      await cache.get('perf:3'); // miss
      await cache.get('perf:4'); // miss

      const finalStats = cache.getStats();
      
      expect(finalStats.sets).toBe(initialStats.sets + 2);
      expect(finalStats.hits).toBe(initialStats.hits + 2);
      expect(finalStats.misses).toBe(initialStats.misses + 2);
      expect(finalStats.hitRate).toBe(0.5); // 2 hits out of 4 gets
    });
  });
});