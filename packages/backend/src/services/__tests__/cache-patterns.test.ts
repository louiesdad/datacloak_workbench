import { CachePatternsService, DataLoader, DataWriter } from '../cache-patterns.service';
import { ICacheService, MemoryCacheService, CacheConfig } from '../cache.service';

describe('CachePatternsService', () => {
  let cacheService: ICacheService;
  let cachePatterns: CachePatternsService;
  let mockLoader: jest.MockedFunction<DataLoader<any>>;
  let mockWriter: jest.MockedFunction<DataWriter<any>>;
  
  const cacheConfig: CacheConfig = {
    enabled: true,
    type: 'memory',
    defaultTTL: 60,
    maxMemoryUsage: 1024 * 1024,
    compressionThreshold: 1024
  };

  beforeEach(() => {
    cacheService = new MemoryCacheService(cacheConfig);
    cachePatterns = new CachePatternsService(cacheService);
    mockLoader = jest.fn();
    mockWriter = jest.fn();
  });

  afterEach(async () => {
    await cacheService.close();
  });

  describe('Cache-Aside Pattern', () => {
    test('should return cached value on hit', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      // Pre-populate cache
      await cacheService.set(key, value);
      
      const result = await cachePatterns.cacheAside(key, mockLoader);
      
      expect(result).toEqual(value);
      expect(mockLoader).not.toHaveBeenCalled();
    });

    test('should load and cache on miss', async () => {
      const key = 'test-key';
      const value = { data: 'loaded value' };
      
      mockLoader.mockResolvedValue(value);
      
      const result = await cachePatterns.cacheAside(key, mockLoader);
      
      expect(result).toEqual(value);
      expect(mockLoader).toHaveBeenCalledWith(key);
      
      // Verify value was cached
      const cached = await cacheService.get(key);
      expect(cached).toEqual(value);
    });

    test('should handle loader errors', async () => {
      const key = 'test-key';
      const error = new Error('Load failed');
      
      mockLoader.mockRejectedValue(error);
      
      await expect(cachePatterns.cacheAside(key, mockLoader)).rejects.toThrow('Load failed');
      
      // Verify nothing was cached
      const cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    test('should use namespace when provided', async () => {
      const key = 'test-key';
      const namespace = 'users';
      const value = { id: 1, name: 'John' };
      
      mockLoader.mockResolvedValue(value);
      
      await cachePatterns.cacheAside(key, mockLoader, { namespace });
      
      // Check that namespaced key was used
      const namespacedValue = await cacheService.get(`${namespace}:${key}`);
      expect(namespacedValue).toEqual(value);
      
      // Raw key should not have value
      const rawValue = await cacheService.get(key);
      expect(rawValue).toBeNull();
    });

    test('should emit appropriate events', async () => {
      const events: any[] = [];
      cachePatterns.on('cache:hit', (e) => events.push({ type: 'hit', ...e }));
      cachePatterns.on('cache:miss', (e) => events.push({ type: 'miss', ...e }));
      cachePatterns.on('cache:loaded', (e) => events.push({ type: 'loaded', ...e }));
      
      // Test cache hit
      await cacheService.set('hit-key', 'value');
      await cachePatterns.cacheAside('hit-key', mockLoader);
      
      // Test cache miss
      mockLoader.mockResolvedValue('loaded');
      await cachePatterns.cacheAside('miss-key', mockLoader);
      
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('hit');
      expect(events[1].type).toBe('miss');
      expect(events[2].type).toBe('loaded');
    });
  });

  describe('Write-Through Pattern', () => {
    test('should write to both cache and store', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      mockWriter.mockResolvedValue(undefined);
      
      await cachePatterns.writeThrough(key, value, mockWriter);
      
      // Verify both writes occurred
      expect(mockWriter).toHaveBeenCalledWith(key, value);
      const cached = await cacheService.get(key);
      expect(cached).toEqual(value);
    });

    test('should rollback cache on store write failure', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      mockWriter.mockRejectedValue(new Error('Store write failed'));
      
      await expect(
        cachePatterns.writeThrough(key, value, mockWriter)
      ).rejects.toThrow('Store write failed');
      
      // Cache should be rolled back
      const cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    test('should invalidate pattern on write when configured', async () => {
      const key = 'item-1';
      const namespace = 'items';
      const value = { id: 1, name: 'Item 1' };
      
      // Pre-populate some related cache entries
      await cacheService.set('items:item-1', { old: true });
      await cacheService.set('items:item-2', { old: true });
      await cacheService.set('items:summary', { count: 2 });
      
      mockWriter.mockResolvedValue(undefined);
      
      await cachePatterns.writeThrough(key, value, mockWriter, {
        namespace,
        invalidateOnWrite: true
      });
      
      // New value should be cached
      const cached = await cacheService.get('items:item-1');
      expect(cached).toEqual(value);
      
      // Other items should be invalidated
      const item2 = await cacheService.get('items:item-2');
      const summary = await cacheService.get('items:summary');
      expect(item2).toBeNull();
      expect(summary).toBeNull();
    });
  });

  describe('Write-Behind Pattern', () => {
    test('should write to cache immediately and store later', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      mockWriter.mockResolvedValue(undefined);
      
      await cachePatterns.writeBehind(key, value, mockWriter, { delay: 10 });
      
      // Cache should be written immediately
      const cached = await cacheService.get(key);
      expect(cached).toEqual(value);
      
      // Store should not be written yet
      expect(mockWriter).not.toHaveBeenCalled();
      
      // Wait for delayed write
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Now store should be written
      expect(mockWriter).toHaveBeenCalledWith(key, value);
    });

    test('should remove from cache if delayed write fails', async () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      
      mockWriter.mockRejectedValue(new Error('Store write failed'));
      
      await cachePatterns.writeBehind(key, value, mockWriter, { delay: 10 });
      
      // Cache should be written immediately
      let cached = await cacheService.get(key);
      expect(cached).toEqual(value);
      
      // Wait for delayed write to fail
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Cache should be cleared after failure
      cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    test('should emit events for both phases', async () => {
      const events: any[] = [];
      cachePatterns.on('cache:write-behind:cached', (e) => events.push({ phase: 'cached', ...e }));
      cachePatterns.on('cache:write-behind:persisted', (e) => events.push({ phase: 'persisted', ...e }));
      
      mockWriter.mockResolvedValue(undefined);
      
      await cachePatterns.writeBehind('key', 'value', mockWriter, { delay: 10 });
      
      // Should have cached event immediately
      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('cached');
      
      // Wait for persist
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(events).toHaveLength(2);
      expect(events[1].phase).toBe('persisted');
    });
  });

  describe('Refresh-Ahead Pattern', () => {
    test('should return cached value without refresh when TTL is high', async () => {
      const key = 'test-key';
      const value = { data: 'cached value' };
      
      // Set with long TTL
      await cacheService.set(key, value, { ttl: 100 });
      
      const result = await cachePatterns.refreshAhead(key, mockLoader, {
        ttl: 100,
        refreshThreshold: 0.8
      });
      
      expect(result).toEqual(value);
      expect(mockLoader).not.toHaveBeenCalled();
    });

    test('should trigger background refresh when TTL is low', async () => {
      const key = 'test-key';
      const oldValue = { data: 'old value' };
      const newValue = { data: 'new value' };
      
      // Set with short TTL
      await cacheService.set(key, oldValue, { ttl: 2 });
      
      // Wait a bit so TTL is below threshold
      await new Promise(resolve => setTimeout(resolve, 500));
      
      mockLoader.mockResolvedValue(newValue);
      
      const result = await cachePatterns.refreshAhead(key, mockLoader, {
        ttl: 2,
        refreshThreshold: 0.8
      });
      
      // Should return old value immediately
      expect(result).toEqual(oldValue);
      
      // Loader should be called in background
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockLoader).toHaveBeenCalledWith(key);
      
      // New value should be cached
      const cached = await cacheService.get(key);
      expect(cached).toEqual(newValue);
    });

    test('should fall back to cache-aside on miss', async () => {
      const key = 'test-key';
      const value = { data: 'loaded value' };
      
      mockLoader.mockResolvedValue(value);
      
      const result = await cachePatterns.refreshAhead(key, mockLoader);
      
      expect(result).toEqual(value);
      expect(mockLoader).toHaveBeenCalledWith(key);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate by pattern', async () => {
      // Set up test data
      await cacheService.set('user:1', { id: 1 });
      await cacheService.set('user:2', { id: 2 });
      await cacheService.set('post:1', { id: 1 });
      
      const invalidated = await cachePatterns.invalidatePattern('user:*');
      
      expect(invalidated).toBe(2);
      
      // User keys should be gone
      expect(await cacheService.get('user:1')).toBeNull();
      expect(await cacheService.get('user:2')).toBeNull();
      
      // Post key should remain
      expect(await cacheService.get('post:1')).toEqual({ id: 1 });
    });

    test('should invalidate by tag', async () => {
      // Set up tagged data
      await cacheService.set('data:tag:products:item1', { id: 1 });
      await cacheService.set('data:tag:products:item2', { id: 2 });
      await cacheService.set('data:tag:users:user1', { id: 1 });
      
      const invalidated = await cachePatterns.invalidateByTag('products');
      
      expect(invalidated).toBe(2);
      
      // Product tagged items should be gone
      expect(await cacheService.get('data:tag:products:item1')).toBeNull();
      expect(await cacheService.get('data:tag:products:item2')).toBeNull();
      
      // User tagged item should remain
      expect(await cacheService.get('data:tag:users:user1')).toEqual({ id: 1 });
    });
  });

  describe('Batch Operations', () => {
    test('should batch get with cache-aside', async () => {
      const keys = ['item1', 'item2', 'item3'];
      
      // Pre-cache one item
      await cacheService.set('item1', { id: 1, cached: true });
      
      // Mock loader for missing items
      mockLoader.mockResolvedValue(new Map([
        ['item2', { id: 2, loaded: true }],
        ['item3', { id: 3, loaded: true }]
      ]));
      
      const result = await cachePatterns.batchCacheAside(keys, mockLoader);
      
      expect(result.size).toBe(3);
      expect(result.get('item1')).toEqual({ id: 1, cached: true });
      expect(result.get('item2')).toEqual({ id: 2, loaded: true });
      expect(result.get('item3')).toEqual({ id: 3, loaded: true });
      
      // Loader should only be called with missing keys
      expect(mockLoader).toHaveBeenCalledWith(['item2', 'item3']);
      
      // All items should now be cached
      expect(await cacheService.get('item2')).toEqual({ id: 2, loaded: true });
      expect(await cacheService.get('item3')).toEqual({ id: 3, loaded: true });
    });

    test('should handle batch loader errors', async () => {
      const keys = ['item1', 'item2'];
      
      mockLoader.mockRejectedValue(new Error('Batch load failed'));
      
      await expect(
        cachePatterns.batchCacheAside(keys, mockLoader)
      ).rejects.toThrow('Batch load failed');
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with provided data', async () => {
      const keys = ['item1', 'item2', 'item3'];
      
      mockLoader.mockResolvedValue(new Map([
        ['item1', { id: 1 }],
        ['item2', { id: 2 }],
        ['item3', { id: 3 }]
      ]));
      
      const result = await cachePatterns.warmCache(keys, mockLoader);
      
      expect(result.loaded).toBe(3);
      expect(result.failed).toBe(0);
      
      // All items should be cached
      expect(await cacheService.get('item1')).toEqual({ id: 1 });
      expect(await cacheService.get('item2')).toEqual({ id: 2 });
      expect(await cacheService.get('item3')).toEqual({ id: 3 });
    });

    test('should handle partial warming failures', async () => {
      const keys = ['item1', 'item2'];
      
      // Mock loader returns only one item
      mockLoader.mockResolvedValue(new Map([
        ['item1', { id: 1 }]
      ]));
      
      const result = await cachePatterns.warmCache(keys, mockLoader);
      
      expect(result.loaded).toBe(1);
      expect(result.failed).toBe(0); // item2 just wasn't returned
      
      expect(await cacheService.get('item1')).toEqual({ id: 1 });
      expect(await cacheService.get('item2')).toBeNull();
    });

    test('should handle complete warming failure', async () => {
      const keys = ['item1', 'item2'];
      
      mockLoader.mockRejectedValue(new Error('Load failed'));
      
      const result = await cachePatterns.warmCache(keys, mockLoader);
      
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(2);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high load cache-aside pattern', async () => {
      const iterations = 1000;
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);
      
      // Pre-warm some cache entries
      for (let i = 0; i < 50; i++) {
        await cacheService.set(`key-${i}`, { id: i, cached: true });
      }
      
      mockLoader.mockImplementation(async (key) => {
        // Simulate some latency
        await new Promise(resolve => setTimeout(resolve, 1));
        return { id: parseInt(key.split('-')[1]), loaded: true };
      });
      
      const startTime = Date.now();
      const promises: Promise<any>[] = [];
      
      // Simulate concurrent requests
      for (let i = 0; i < iterations; i++) {
        const key = keys[i % keys.length];
        promises.push(cachePatterns.cacheAside(key, mockLoader));
      }
      
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // Should complete reasonably fast due to caching
      expect(duration).toBeLessThan(1000); // Less than 1 second for 1000 operations
      
      // Loader should only be called for uncached keys
      expect(mockLoader).toHaveBeenCalledTimes(50); // Only the 50 uncached keys
    });

    test('should handle concurrent write-through operations', async () => {
      mockWriter.mockResolvedValue(undefined);
      
      const writes = Array.from({ length: 100 }, (_, i) => ({
        key: `item-${i}`,
        value: { id: i, data: `value-${i}` }
      }));
      
      const startTime = Date.now();
      
      await Promise.all(
        writes.map(({ key, value }) => 
          cachePatterns.writeThrough(key, value, mockWriter)
        )
      );
      
      const duration = Date.now() - startTime;
      
      // All items should be cached
      for (const { key, value } of writes) {
        expect(await cacheService.get(key)).toEqual(value);
      }
      
      // All writes should have gone through
      expect(mockWriter).toHaveBeenCalledTimes(100);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(500);
    });

    test('should efficiently invalidate large patterns', async () => {
      // Create many cache entries
      const promises: Promise<boolean>[] = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(cacheService.set(`prefix:${i}`, { id: i }));
      }
      await Promise.all(promises);
      
      const startTime = Date.now();
      const invalidated = await cachePatterns.invalidatePattern('prefix:*');
      const duration = Date.now() - startTime;
      
      expect(invalidated).toBe(1000);
      expect(duration).toBeLessThan(100); // Should be fast
      
      // All should be gone
      expect(await cacheService.keys('prefix:*')).toHaveLength(0);
    });
  });

  describe('Event Tracking', () => {
    test('should emit comprehensive events for monitoring', async () => {
      const events: any[] = [];
      
      // Listen to all events
      cachePatterns.on('cache:hit', (e) => events.push({ event: 'hit', ...e }));
      cachePatterns.on('cache:miss', (e) => events.push({ event: 'miss', ...e }));
      cachePatterns.on('cache:loaded', (e) => events.push({ event: 'loaded', ...e }));
      cachePatterns.on('cache:write-through', (e) => events.push({ event: 'write-through', ...e }));
      cachePatterns.on('cache:invalidated', (e) => events.push({ event: 'invalidated', ...e }));
      cachePatterns.on('cache:batch-result', (e) => events.push({ event: 'batch-result', ...e }));
      cachePatterns.on('cache:warmed', (e) => events.push({ event: 'warmed', ...e }));
      
      mockLoader.mockResolvedValue({ data: 'test' });
      mockWriter.mockResolvedValue(undefined);
      
      // Perform various operations
      await cachePatterns.cacheAside('test1', mockLoader);
      await cachePatterns.cacheAside('test1', mockLoader); // hit
      await cachePatterns.writeThrough('test2', { data: 'write' }, mockWriter);
      await cachePatterns.invalidatePattern('test*');
      
      await cachePatterns.batchCacheAside(['batch1', 'batch2'], async (keys) => 
        new Map(keys.map(k => [k, { id: k }]))
      );
      
      await cachePatterns.warmCache(['warm1', 'warm2'], async (keys) =>
        new Map(keys.map(k => [k, { id: k }]))
      );
      
      // Should have events for all operations
      expect(events.find(e => e.event === 'miss')).toBeDefined();
      expect(events.find(e => e.event === 'loaded')).toBeDefined();
      expect(events.find(e => e.event === 'hit')).toBeDefined();
      expect(events.find(e => e.event === 'write-through')).toBeDefined();
      expect(events.find(e => e.event === 'invalidated')).toBeDefined();
      expect(events.find(e => e.event === 'batch-result')).toBeDefined();
      expect(events.find(e => e.event === 'warmed')).toBeDefined();
      
      // Events should contain useful metrics
      const loadedEvent = events.find(e => e.event === 'loaded');
      expect(loadedEvent).toHaveProperty('loadLatency');
      expect(loadedEvent).toHaveProperty('totalLatency');
      
      const batchEvent = events.find(e => e.event === 'batch-result');
      expect(batchEvent).toHaveProperty('hits');
      expect(batchEvent).toHaveProperty('misses');
    });
  });
});