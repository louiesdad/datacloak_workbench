import { EventEmitter } from 'events';
import { CachePatternsService, DataLoader, DataWriter, CachePatternOptions } from '../cache-patterns.service';
import { ICacheService, CacheStats } from '../cache.service';

// Mock cache service
class MockCacheService extends EventEmitter implements ICacheService {
  private store = new Map<string, any>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    totalOperations: 0
  };

  async get<T = any>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      this.emit('cache:hit', { key });
      return value;
    }
    this.stats.misses++;
    this.emit('cache:miss', { key });
    return null;
  }

  async set<T = any>(key: string, value: T, options?: any): Promise<boolean> {
    this.store.set(key, value);
    this.stats.sets++;
    this.emit('cache:set', { key, value });
    return true;
  }

  async del(key: string): Promise<boolean> {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.emit('cache:delete', { key });
    }
    return deleted;
  }

  async clear(): Promise<boolean> {
    this.store.clear();
    this.emit('cache:clear');
    return true;
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    if (!pattern) return allKeys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    // Mock implementation
    return this.store.has(key);
  }

  async ttl(key: string): Promise<number> {
    // Mock implementation
    return this.store.has(key) ? 3600 : -2;
  }

  getStats(): CacheStats {
    this.stats.totalOperations = this.stats.hits + this.stats.misses;
    this.stats.hitRate = this.stats.totalOperations > 0 
      ? this.stats.hits / this.stats.totalOperations 
      : 0;
    return { ...this.stats };
  }

  getConfig(): any {
    return {
      enabled: true,
      type: 'mock',
      defaultTTL: 3600
    };
  }

  async close(): Promise<void> {
    this.store.clear();
  }

  // Test helper methods
  _clear(): void {
    this.store.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalOperations: 0
    };
  }

  _getStore(): Map<string, any> {
    return this.store;
  }
}

describe('CachePatternsService', () => {
  let cacheService: MockCacheService;
  let cachePatternsService: CachePatternsService;

  beforeEach(() => {
    cacheService = new MockCacheService();
    cachePatternsService = new CachePatternsService(cacheService);
  });

  afterEach(() => {
    cacheService._clear();
  });

  describe('Cache-Aside Pattern', () => {
    test('should return cached value on hit', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const loader = jest.fn<DataLoader<typeof value>>().mockResolvedValue(value);

      // Pre-populate cache
      await cacheService.set(key, value);

      const result = await cachePatternsService.cacheAside(key, loader);

      expect(result).toEqual(value);
      expect(loader).not.toHaveBeenCalled();
    });

    test('should load and cache value on miss', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const loader = jest.fn<DataLoader<typeof value>>().mockResolvedValue(value);

      const result = await cachePatternsService.cacheAside(key, loader);

      expect(result).toEqual(value);
      expect(loader).toHaveBeenCalledWith(key);
      expect(await cacheService.get(key)).toEqual(value);
    });

    test('should handle namespace option', async () => {
      const key = 'test-key';
      const namespace = 'users';
      const value = { data: 'test value' };
      const loader = jest.fn<DataLoader<typeof value>>().mockResolvedValue(value);

      await cachePatternsService.cacheAside(key, loader, { namespace });

      const expectedKey = `${namespace}:${key}`;
      expect(await cacheService.get(expectedKey)).toEqual(value);
    });

    test('should prevent cache stampede', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      let resolveLoader: (value: any) => void;
      const loaderPromise = new Promise<typeof value>(resolve => {
        resolveLoader = resolve;
      });
      const loader = jest.fn<DataLoader<typeof value>>().mockReturnValue(loaderPromise);

      // Start multiple concurrent requests
      const promise1 = cachePatternsService.cacheAside(key, loader);
      const promise2 = cachePatternsService.cacheAside(key, loader);
      const promise3 = cachePatternsService.cacheAside(key, loader);

      // Give a tiny bit of time for the async operations to register
      await new Promise(resolve => setImmediate(resolve));

      // Loader should only be called once
      expect(loader).toHaveBeenCalledTimes(1);

      // Resolve the loader
      resolveLoader!(value);

      // All promises should resolve to the same value
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toEqual(value);
      expect(result2).toEqual(value);
      expect(result3).toEqual(value);
    });

    test('should emit cache events', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const loader = jest.fn<DataLoader<typeof value>>().mockResolvedValue(value);

      const hitEvent = jest.fn();
      const missEvent = jest.fn();
      const loadedEvent = jest.fn();

      cachePatternsService.on('cache:hit', hitEvent);
      cachePatternsService.on('cache:miss', missEvent);
      cachePatternsService.on('cache:loaded', loadedEvent);

      // First call - cache miss
      await cachePatternsService.cacheAside(key, loader);
      expect(missEvent).toHaveBeenCalled();
      expect(loadedEvent).toHaveBeenCalled();

      // Second call - cache hit
      await cachePatternsService.cacheAside(key, loader);
      expect(hitEvent).toHaveBeenCalled();
    });
  });

  describe('Write-Through Pattern', () => {
    test('should write to cache and data store', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const writer = jest.fn<DataWriter<typeof value>>().mockResolvedValue(undefined);

      const result = await cachePatternsService.writeThrough(key, value, writer);

      expect(result).toBe(true);
      expect(writer).toHaveBeenCalledWith(key, value);
      expect(await cacheService.get(key)).toEqual(value);
    });

    test('should handle write errors', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const writer = jest.fn<DataWriter<typeof value>>().mockRejectedValue(new Error('Write failed'));

      await expect(cachePatternsService.writeThrough(key, value, writer)).rejects.toThrow('Write failed');
      expect(await cacheService.get(key)).toBeNull(); // Should not cache on error
    });

    test('should invalidate related cache entries', async () => {
      const key = 'user:123';
      const value = { name: 'Updated User' };
      const writer = jest.fn<DataWriter<typeof value>>().mockResolvedValue(undefined);

      // Pre-populate related cache entries
      await cacheService.set('user:123:profile', { old: 'data' });
      await cacheService.set('user:123:settings', { old: 'data' });

      await cachePatternsService.writeThrough(key, value, writer, {
        invalidateOnWrite: true,
        namespace: 'user'
      });

      // Related entries should be invalidated
      const keys = await cacheService.keys('user:123*');
      expect(keys).toHaveLength(1); // Only the new value
    });
  });

  describe('Write-Behind Pattern', () => {
    test('should cache immediately and write asynchronously', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const writer = jest.fn<DataWriter<typeof value>>().mockResolvedValue(undefined);

      const result = await cachePatternsService.writeBehind(key, value, writer);

      expect(result).toBe(true);
      expect(await cacheService.get(key)).toEqual(value);
      
      // Writer should be called asynchronously
      expect(writer).not.toHaveBeenCalled();
      
      // Wait for async write
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(writer).toHaveBeenCalledWith(key, value);
    });

    test('should handle batch writes', async () => {
      const writer = jest.fn<DataWriter<any>>().mockResolvedValue(undefined);
      const batchSize = 3;

      // Configure batch writing
      cachePatternsService['batchSize'] = batchSize;
      cachePatternsService['batchInterval'] = 50;

      // Write multiple values
      for (let i = 0; i < 5; i++) {
        await cachePatternsService.writeBehind(`key${i}`, { value: i }, writer);
      }

      // Should have batched the writes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Writer should be called for all items (may be in batches)
      expect(writer).toHaveBeenCalledTimes(5);
    });
  });

  describe('Refresh-Ahead Pattern', () => {
    test('should proactively refresh cache before expiration', async () => {
      const key = 'test-key';
      const value1 = { data: 'initial value' };
      const value2 = { data: 'refreshed value' };
      
      let callCount = 0;
      const loader = jest.fn<DataLoader<any>>().mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? value1 : value2;
      });

      // Initial load
      const result1 = await cachePatternsService.refreshAhead(key, loader, {
        ttl: 100, // 100 second TTL
        refreshThreshold: 0.5 // Refresh at 50% of TTL
      });

      expect(result1).toEqual(value1);
      expect(loader).toHaveBeenCalledTimes(1);

      // Mock the TTL to be at 40% remaining (below threshold)
      jest.spyOn(cacheService, 'ttl').mockResolvedValueOnce(40);

      // Access again - should trigger refresh
      const result2 = await cachePatternsService.refreshAhead(key, loader, {
        ttl: 100,
        refreshThreshold: 0.5
      });

      // Should still return cached value immediately
      expect(result2).toEqual(value1);

      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Loader should have been called again for refresh
      expect(loader).toHaveBeenCalledTimes(2);

      // Next access should return refreshed value from cache
      const result3 = await cachePatternsService.refreshAhead(key, loader, {
        ttl: 100,
        refreshThreshold: 0.5
      });

      expect(result3).toEqual(value2);
      // Loader should not be called again since value is in cache
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const loader = jest.fn().mockImplementation(async (keyList: string[]) => {
        const result = new Map<string, any>();
        keyList.forEach(k => result.set(k, { data: `value for ${k}` }));
        return result;
      });

      const warmed = await cachePatternsService.warmCache(keys, loader);

      expect(warmed.loaded).toBe(keys.length);
      expect(warmed.failed).toBe(0);
      expect(loader).toHaveBeenCalledWith(keys);

      // All keys should be cached
      for (const key of keys) {
        expect(await cacheService.get(key)).toEqual({ data: `value for ${key}` });
      }
    });

    test('should handle partial warming failures', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const loader = jest.fn().mockImplementation(async (keyList: string[]) => {
        const result = new Map<string, any>();
        // Only return data for some keys
        result.set('key1', { data: 'value1' });
        result.set('key3', { data: 'value3' });
        return result;
      });

      const warmed = await cachePatternsService.warmCache(keys, loader);

      expect(warmed.loaded).toBe(2); // Only 2 keys warmed
      expect(warmed.failed).toBe(0);
      expect(await cacheService.get('key1')).toEqual({ data: 'value1' });
      expect(await cacheService.get('key2')).toBeNull();
      expect(await cacheService.get('key3')).toEqual({ data: 'value3' });
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate by pattern', async () => {
      // Set up test data
      await cacheService.set('user:123:profile', { name: 'John' });
      await cacheService.set('user:123:settings', { theme: 'dark' });
      await cacheService.set('user:456:profile', { name: 'Jane' });
      await cacheService.set('product:789', { name: 'Widget' });

      const invalidated = await cachePatternsService.invalidatePattern('user:123:*');

      expect(invalidated).toBe(2);
      expect(await cacheService.get('user:123:profile')).toBeNull();
      expect(await cacheService.get('user:123:settings')).toBeNull();
      expect(await cacheService.get('user:456:profile')).toEqual({ name: 'Jane' });
      expect(await cacheService.get('product:789')).toEqual({ name: 'Widget' });
    });

    test('should invalidate by tags', async () => {
      // Store cache entries with tags
      await cachePatternsService.setWithTags('item1', { data: 'value1' }, ['user:123', 'product']);
      await cachePatternsService.setWithTags('item2', { data: 'value2' }, ['user:123', 'order']);
      await cachePatternsService.setWithTags('item3', { data: 'value3' }, ['user:456', 'product']);

      // Invalidate by tag
      const invalidated = await cachePatternsService.invalidateByTags(['user:123']);

      expect(invalidated).toBe(2);
      expect(await cacheService.get('item1')).toBeNull();
      expect(await cacheService.get('item2')).toBeNull();
      expect(await cacheService.get('item3')).toEqual({ data: 'value3' });
    });

    test('should emit invalidation events', async () => {
      const invalidateEvent = jest.fn();
      cachePatternsService.on('cache:invalidated', invalidateEvent);

      await cacheService.set('test:1', { data: 'value1' });
      await cacheService.set('test:2', { data: 'value2' });

      await cachePatternsService.invalidatePattern('test:*');

      expect(invalidateEvent).toHaveBeenCalledWith({
        pattern: 'test:*',
        count: 2
      });
    });
  });

  describe('Distributed Cache Coordination', () => {
    test('should handle cache sync events', async () => {
      const syncEvent = jest.fn();
      cachePatternsService.on('cache:sync', syncEvent);

      // Simulate cache sync from another node
      cachePatternsService.handleCacheSync({
        operation: 'invalidate',
        keys: ['key1', 'key2'],
        source: 'node2'
      });

      expect(syncEvent).toHaveBeenCalled();
    });

    test('should broadcast cache operations', async () => {
      const broadcastEvent = jest.fn();
      cachePatternsService.on('cache:broadcast', broadcastEvent);

      await cachePatternsService.distributedSet('key1', { data: 'value' }, {
        broadcast: true
      });

      expect(broadcastEvent).toHaveBeenCalledWith({
        operation: 'set',
        key: 'key1',
        source: expect.any(String)
      });
    });
  });

  describe('Performance Optimization', () => {
    test('should track cache performance metrics', async () => {
      const key = 'perf-test';
      const value = { data: 'test' };
      const loader = jest.fn().mockResolvedValue(value);

      // Generate some cache activity
      await cachePatternsService.cacheAside(key, loader); // Miss
      await cachePatternsService.cacheAside(key, loader); // Hit
      await cachePatternsService.cacheAside(key, loader); // Hit

      const metrics = cachePatternsService.getMetrics();
      
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(0.667, 2);
    });

    test('should optimize based on access patterns', async () => {
      // Simulate frequent access pattern
      const hotKey = 'hot-key';
      const loader = jest.fn().mockResolvedValue({ data: 'hot data' });

      // Access multiple times
      for (let i = 0; i < 10; i++) {
        await cachePatternsService.cacheAside(hotKey, loader);
      }

      // Should identify as hot key
      const hotKeys = cachePatternsService.getHotKeys();
      expect(hotKeys).toContain(hotKey);
    });
  });

  describe('Error Handling', () => {
    test('should handle loader errors gracefully', async () => {
      const key = 'error-key';
      const loader = jest.fn().mockRejectedValue(new Error('Load failed'));

      await expect(cachePatternsService.cacheAside(key, loader)).rejects.toThrow('Load failed');
      
      // Should not cache error results
      expect(await cacheService.get(key)).toBeNull();
    });

    test('should handle cache service errors', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      
      // Mock cache service error
      jest.spyOn(cacheService, 'set').mockRejectedValue(new Error('Cache error'));

      const writer = jest.fn().mockResolvedValue(undefined);
      const result = await cachePatternsService.writeThrough(key, value, writer);

      // Should still write to data store even if cache fails
      expect(writer).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});