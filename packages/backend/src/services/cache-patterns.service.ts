import { ICacheService, CacheOptions } from './cache.service';
import { EventEmitter } from 'events';

export interface DataLoader<T> {
  (key: string): Promise<T>;
}

export interface DataWriter<T> {
  (key: string, value: T): Promise<void>;
}

export interface CacheInvalidator {
  (pattern: string): Promise<number>;
}

export interface CachePatternOptions extends CacheOptions {
  namespace?: string;
  invalidateOnWrite?: boolean;
  refreshOnMiss?: boolean;
}

/**
 * Cache patterns service implementing common caching strategies
 */
export class CachePatternsService extends EventEmitter {
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> keys mapping
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0
  };
  private keyAccessCount: Map<string, number> = new Map();
  private hotKeyThreshold = 5;
  
  constructor(private cache: ICacheService) {
    super();
  }

  /**
   * Cache-Aside Pattern (Lazy Loading)
   * - Check cache first
   * - If miss, load from source and cache
   * - Return data
   */
  async cacheAside<T>(
    key: string,
    loader: DataLoader<T>,
    options?: CachePatternOptions
  ): Promise<T> {
    const cacheKey = this.buildKey(key, options?.namespace);
    
    // Update metrics
    this.metrics.totalRequests++;
    this.updateKeyAccessCount(cacheKey);
    
    // Try to get from cache
    const startTime = Date.now();
    let cached = await this.cache.get<T>(cacheKey);
    
    if (cached !== null) {
      this.metrics.cacheHits++;
      this.updateHitRate();
      this.emit('cache:hit', { 
        key: cacheKey, 
        pattern: 'cache-aside',
        latency: Date.now() - startTime 
      });
      return cached;
    }
    
    // Cache miss - check if already loading (prevent cache stampede)
    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }
    
    this.metrics.cacheMisses++;
    this.updateHitRate();
    this.emit('cache:miss', { 
      key: cacheKey, 
      pattern: 'cache-aside' 
    });
    
    // Create loading promise to prevent duplicate loads
    const loadingPromise = (async () => {
      try {
        const loadStart = Date.now();
        const data = await loader(key);
        const loadLatency = Date.now() - loadStart;
        
        // Cache the loaded data
        await this.cache.set(cacheKey, data, options);
        
        this.emit('cache:loaded', { 
          key: cacheKey, 
          pattern: 'cache-aside',
          loadLatency,
          totalLatency: Date.now() - startTime
        });
        
        return data;
      } catch (error) {
        this.emit('cache:error', { 
          key: cacheKey, 
          pattern: 'cache-aside', 
          error 
        });
        throw error;
      } finally {
        // Clean up loading promise
        this.loadingPromises.delete(cacheKey);
      }
    })();
    
    this.loadingPromises.set(cacheKey, loadingPromise);
    return loadingPromise;
  }

  /**
   * Write-Through Pattern
   * - Write to cache and data store simultaneously
   * - Ensures cache is always in sync
   */
  async writeThrough<T>(
    key: string,
    value: T,
    writer: DataWriter<T>,
    options?: CachePatternOptions
  ): Promise<boolean> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const startTime = Date.now();
    
    try {
      // Write to data store first
      await writer(key, value);
      
      // Then write to cache
      let cacheResult = true;
      try {
        cacheResult = await this.cache.set(cacheKey, value, options);
      } catch (cacheError) {
        // Cache write failed, but data store write succeeded
        this.emit('cache:error', { 
          key: cacheKey, 
          pattern: 'write-through', 
          error: cacheError,
          phase: 'cache-write'
        });
        // Continue - data store write was successful
      }
      
      this.emit('cache:write-through', { 
        key: cacheKey,
        latency: Date.now() - startTime,
        success: true
      });
      
      // Invalidate related cache entries if configured
      if (options?.invalidateOnWrite && options.namespace) {
        // Get all keys with namespace except the one we just wrote
        const pattern = `${options.namespace}:*`;
        const keys = await this.cache.keys(pattern);
        
        for (const k of keys) {
          if (k !== cacheKey) {
            await this.cache.del(k);
          }
        }
      }
      
      return true;
    } catch (error) {
      this.emit('cache:error', { 
        key: cacheKey, 
        pattern: 'write-through', 
        error 
      });
      
      // Try to remove from cache if write to store failed
      await this.cache.del(cacheKey);
      
      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  /**
   * Write-Behind Pattern (Write-Back)
   * - Write to cache immediately
   * - Queue write to data store for later
   */
  async writeBehind<T>(
    key: string,
    value: T,
    writer: DataWriter<T>,
    options?: CachePatternOptions & { delay?: number }
  ): Promise<boolean> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const startTime = Date.now();
    
    // Write to cache immediately
    const cacheResult = await this.cache.set(cacheKey, value, options);
    if (!cacheResult) {
      throw new Error('Failed to write to cache');
    }
    
    this.emit('cache:write-behind:cached', { 
      key: cacheKey,
      cacheLatency: Date.now() - startTime
    });
    
    // Queue write to data store
    const delay = options?.delay || 0;
    setTimeout(async () => {
      try {
        const writeStart = Date.now();
        await writer(key, value);
        
        this.emit('cache:write-behind:persisted', { 
          key: cacheKey,
          persistLatency: Date.now() - writeStart,
          totalDelay: Date.now() - startTime
        });
      } catch (error) {
        this.emit('cache:error', { 
          key: cacheKey, 
          pattern: 'write-behind', 
          error,
          phase: 'persist'
        });
        
        // Mark cache entry as dirty or remove it
        await this.cache.del(cacheKey);
      }
    }, delay);
    
    return true;
  }

  /**
   * Refresh-Ahead Pattern
   * - Proactively refresh cache before expiration
   * - Reduces cache misses for hot data
   */
  async refreshAhead<T>(
    key: string,
    loader: DataLoader<T>,
    options?: CachePatternOptions & { refreshThreshold?: number }
  ): Promise<T> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const refreshThreshold = options?.refreshThreshold || 0.8; // 80% of TTL
    
    // Get current value and TTL
    const [value, ttl] = await Promise.all([
      this.cache.get<T>(cacheKey),
      this.cache.ttl(cacheKey)
    ]);
    
    if (value !== null) {
      // Check if we should refresh
      const originalTTL = options?.ttl || 3600;
      const remainingRatio = ttl / originalTTL;
      
      if (remainingRatio < refreshThreshold && remainingRatio > 0) {
        // Refresh in background
        this.emit('cache:refresh-ahead:triggered', { 
          key: cacheKey,
          remainingTTL: ttl,
          threshold: refreshThreshold
        });
        
        this.refreshInBackground(key, cacheKey, loader, options);
      }
      
      return value;
    }
    
    // Cache miss - use cache-aside pattern
    return this.cacheAside(key, loader, options);
  }

  /**
   * Cache invalidation by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.cache.keys(pattern);
    let invalidated = 0;
    
    for (const key of keys) {
      if (await this.cache.del(key)) {
        invalidated++;
      }
    }
    
    this.emit('cache:invalidated', { 
      pattern,
      count: invalidated
    });
    
    return invalidated;
  }

  /**
   * Cache invalidation by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    return this.invalidatePattern(`*:tag:${tag}:*`);
  }

  /**
   * Batch get with cache-aside pattern
   */
  async batchCacheAside<T>(
    keys: string[],
    loader: (keys: string[]) => Promise<Map<string, T>>,
    options?: CachePatternOptions
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missingKeys: string[] = [];
    const cacheKeyMap = new Map<string, string>();
    
    // Build cache keys and check cache
    for (const key of keys) {
      const cacheKey = this.buildKey(key, options?.namespace);
      cacheKeyMap.set(key, cacheKey);
      
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== null) {
        result.set(key, cached);
      } else {
        missingKeys.push(key);
      }
    }
    
    // Load missing data
    if (missingKeys.length > 0) {
      try {
        const loaded = await loader(missingKeys);
        
        // Cache loaded data
        for (const [key, value] of loaded.entries()) {
          const cacheKey = cacheKeyMap.get(key)!;
          await this.cache.set(cacheKey, value, options);
          result.set(key, value);
        }
      } catch (error) {
        this.emit('cache:error', { 
          pattern: 'batch-cache-aside',
          error,
          missingKeys
        });
        throw error;
      }
    }
    
    this.emit('cache:batch-result', {
      pattern: 'batch-cache-aside',
      requested: keys.length,
      hits: keys.length - missingKeys.length,
      misses: missingKeys.length
    });
    
    return result;
  }

  /**
   * Cache warming - preload cache with data
   */
  async warmCache<T>(
    keys: string[],
    loader: (keys: string[]) => Promise<Map<string, T>>,
    options?: CachePatternOptions
  ): Promise<{ loaded: number; failed: number }> {
    const startTime = Date.now();
    let loaded = 0;
    let failed = 0;
    
    try {
      const data = await loader(keys);
      
      for (const [key, value] of data.entries()) {
        const cacheKey = this.buildKey(key, options?.namespace);
        const success = await this.cache.set(cacheKey, value, options);
        
        if (success) {
          loaded++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      this.emit('cache:error', { 
        pattern: 'warm-cache',
        error,
        keys
      });
      failed = keys.length;
    }
    
    this.emit('cache:warmed', {
      requested: keys.length,
      loaded,
      failed,
      latency: Date.now() - startTime
    });
    
    return { loaded, failed };
  }

  /**
   * Helper to build cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Helper to refresh cache in background
   */
  private async refreshInBackground<T>(
    key: string,
    cacheKey: string,
    loader: DataLoader<T>,
    options?: CachePatternOptions
  ): Promise<void> {
    try {
      const data = await loader(key);
      await this.cache.set(cacheKey, data, options);
      
      this.emit('cache:refresh-ahead:completed', { 
        key: cacheKey,
        success: true
      });
    } catch (error) {
      this.emit('cache:error', { 
        key: cacheKey,
        pattern: 'refresh-ahead',
        error,
        phase: 'background-refresh'
      });
    }
  }

  /**
   * Get cache statistics for patterns
   */
  getPatternStats(): {
    cacheAside: { hits: number; misses: number; errors: number };
    writeThrough: { success: number; errors: number };
    writeBehind: { cached: number; persisted: number; errors: number };
    refreshAhead: { triggered: number; completed: number; errors: number };
    invalidations: { byPattern: number; byTag: number; totalKeys: number };
  } {
    // In a real implementation, these would be tracked
    return {
      cacheAside: { hits: 0, misses: 0, errors: 0 },
      writeThrough: { success: 0, errors: 0 },
      writeBehind: { cached: 0, persisted: 0, errors: 0 },
      refreshAhead: { triggered: 0, completed: 0, errors: 0 },
      invalidations: { byPattern: 0, byTag: 0, totalKeys: 0 }
    };
  }

  /**
   * Set value with tags for invalidation
   */
  async setWithTags<T>(key: string, value: T, tags: string[], options?: CacheOptions): Promise<boolean> {
    // Store the value
    const result = await this.cache.set(key, value, options);
    
    if (result) {
      // Update tag index
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
    
    return result;
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;
    const keysToInvalidate = new Set<string>();
    
    // Collect all keys associated with the tags
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    }
    
    // Invalidate the keys
    for (const key of keysToInvalidate) {
      if (await this.cache.del(key)) {
        invalidated++;
        
        // Remove key from all tag indexes
        for (const [tag, keys] of this.tagIndex.entries()) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }
    
    return invalidated;
  }

  /**
   * Handle cache sync events from other nodes
   */
  handleCacheSync(event: {
    operation: string;
    keys?: string[];
    key?: string;
    source: string;
  }): void {
    this.emit('cache:sync', event);
    
    // Handle the sync operation
    if (event.operation === 'invalidate' && event.keys) {
      // Invalidate keys from other nodes
      event.keys.forEach(key => this.cache.del(key));
    }
  }

  /**
   * Set value with distributed broadcast
   */
  async distributedSet<T>(key: string, value: T, options?: CacheOptions & { broadcast?: boolean }): Promise<boolean> {
    const result = await this.cache.set(key, value, options);
    
    if (result && options?.broadcast) {
      this.emit('cache:broadcast', {
        operation: 'set',
        key,
        source: 'current-node' // In real impl, this would be the node ID
      });
    }
    
    return result;
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      hitRate: this.metrics.hitRate
    };
  }

  /**
   * Get hot keys based on access frequency
   */
  getHotKeys(): string[] {
    const hotKeys: string[] = [];
    
    for (const [key, count] of this.keyAccessCount.entries()) {
      if (count >= this.hotKeyThreshold) {
        hotKeys.push(key);
      }
    }
    
    return hotKeys;
  }

  /**
   * Update key access count
   */
  private updateKeyAccessCount(key: string): void {
    const count = this.keyAccessCount.get(key) || 0;
    this.keyAccessCount.set(key, count + 1);
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate = this.metrics.cacheHits / this.metrics.totalRequests;
    }
  }

  /**
   * Batch size for write-behind operations
   */
  private batchSize = 10;
  
  /**
   * Batch interval for write-behind operations
   */
  private batchInterval = 1000;
}