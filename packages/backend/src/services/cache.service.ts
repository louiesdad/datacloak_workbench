import { EventEmitter } from 'events';
import Redis, { Redis as RedisClient } from 'ioredis';
import { ConfigService } from './config.service';

// Mock Redis implementation for fallback
class MockRedis {
  private data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<string> {
    this.data.set(key, { value });
    return 'OK';
  }

  async setex(key: string, ttl: number, value: string): Promise<string> {
    this.data.set(key, { value, expiresAt: Date.now() + (ttl * 1000) });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }

  async flushall(): Promise<string> {
    this.data.clear();
    return 'OK';
  }

  async flushdb(): Promise<string> {
    this.data.clear();
    return 'OK';
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, ttl: number): Promise<number> {
    const entry = this.data.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + (ttl * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.data.get(key);
    if (!entry || !entry.expiresAt) return -1;
    const remaining = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    return remaining;
  }

  async quit(): Promise<string> {
    this.data.clear();
    return 'OK';
  }

  disconnect(): void {
    this.data.clear();
  }

  on(event: string, handler: (...args: any[]) => void): void {
    // Mock event listener - immediately trigger 'ready' event
    if (event === 'ready') {
      setTimeout(() => handler(), 10);
    }
  }
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large values
  serialize?: boolean; // Whether to serialize objects
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  totalOperations: number;
}

export interface CacheEntry<T = any> {
  value: T;
  createdAt: Date;
  expiresAt?: Date;
  hits: number;
  size: number; // Estimated size in bytes
}

export interface CacheConfig {
  enabled: boolean;
  type: 'memory' | 'redis';
  defaultTTL: number;
  maxMemoryUsage: number; // In bytes
  compressionThreshold: number; // Size in bytes to trigger compression
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
}

/**
 * Base cache interface
 */
export interface ICacheService {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
  del(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  getStats(): CacheStats;
  getConfig(): CacheConfig;
  close(): Promise<void>;
}

/**
 * In-memory cache implementation
 */
export class MemoryCacheService extends EventEmitter implements ICacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    totalOperations: 0
  };
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    
    // Start cleanup interval for expired items
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    this.updateStats();
    this.emit('cache:hit', { key, value: entry.value });
    
    return entry.value as T;
  }

  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      // Use provided TTL, fallback to default only if not specified (undefined)
      const ttl = options.ttl !== undefined ? options.ttl : this.config.defaultTTL;
      const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined;
      
      let processedValue = value;
      
      // Serialize if needed
      if (options.serialize !== false && typeof value === 'object') {
        processedValue = JSON.parse(JSON.stringify(value)) as T;
      }
      
      // Estimate size
      const estimatedSize = this.estimateSize(processedValue);
      
      // Check memory limits before adding new entry
      const currentSize = this.getCurrentMemoryUsage();
      if (currentSize + estimatedSize > this.config.maxMemoryUsage) {
        this.evictOldest();
      }
      
      const entry: CacheEntry<T> = {
        value: processedValue,
        createdAt: new Date(),
        expiresAt,
        hits: 0,
        size: estimatedSize
      };

      this.cache.set(key, entry);
      this.stats.sets++;
      this.updateStats();
      this.emit('cache:set', { key, value: processedValue, ttl });
      
      return true;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'set', key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateStats();
      this.emit('cache:delete', { key });
    }
    return deleted;
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.emit('cache:clear');
    return true;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    
    if (!pattern) return allKeys;
    
    // Simple glob pattern matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return allKeys.filter(key => regex.test(key));
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.expiresAt = new Date(Date.now() + seconds * 1000);
    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2; // Key doesn't exist
    if (!entry.expiresAt) return -1; // Key exists but has no expiration
    
    const remaining = Math.max(0, Math.floor((entry.expiresAt.getTime() - Date.now()) / 1000));
    return remaining > 0 ? remaining : -2; // -2 means expired
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }

  private cleanupExpired(): void {
    const now = new Date();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.emit('cache:cleanup', { removedCount });
    }
  }

  private evictOldest(): void {
    // Simple LRU eviction - remove oldest entries until we're under the limit
    const targetSize = this.config.maxMemoryUsage * 0.8; // Evict to 80% capacity
    let currentSize = this.getCurrentMemoryUsage();
    
    // If we're not over the limit, no need to evict
    if (currentSize <= targetSize) return;
    
    // Sort entries by creation time (oldest first)
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const [key, entry] of entries) {
      if (currentSize <= targetSize) break;
      this.cache.delete(key);
      currentSize -= entry.size;
      this.emit('cache:evicted', { key, size: entry.size });
    }
  }

  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private estimateSize(value: any): number {
    if (value === null || value === undefined) return 8;
    if (typeof value === 'string') return value.length * 2; // Unicode characters
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    return 64; // Default estimate
  }

  private updateStats(): void {
    this.stats.totalOperations = this.stats.hits + this.stats.misses;
    this.stats.hitRate = this.stats.totalOperations > 0 
      ? this.stats.hits / this.stats.totalOperations 
      : 0;
  }
}

/**
 * Redis cache implementation
 */
export class RedisCacheService extends EventEmitter implements ICacheService {
  private redis: RedisClient;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    totalOperations: 0
  };
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    
    if (!config.redis) {
      throw new Error('Redis configuration required for RedisCacheService');
    }

    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      maxRetriesPerRequest: 3,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Check if redis instance has event emitter methods (for mock compatibility)
    if (typeof this.redis.on === 'function') {
      this.redis.on('error', (error) => {
        this.stats.errors++;
        this.emit('cache:error', { operation: 'connection', error });
      });

      this.redis.on('connect', () => {
        this.emit('cache:connected');
      });

      this.redis.on('ready', () => {
        this.emit('cache:ready');
      });
    } else {
      // For mocks that don't implement EventEmitter, simulate events
      setImmediate(() => {
        this.emit('cache:connected');
        this.emit('cache:ready');
      });
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        this.updateStats();
        return null;
      }

      this.stats.hits++;
      this.updateStats();
      
      let parsedValue: T;
      try {
        // Handle compressed values
        let processedValue = value;
        if (value.startsWith('compressed:')) {
          processedValue = value.substring(11); // Remove 'compressed:' prefix
          // In a real implementation, you would decompress here
        }
        
        parsedValue = JSON.parse(processedValue);
      } catch {
        // If JSON parsing fails, return as string
        let processedValue = value;
        if (value.startsWith('compressed:')) {
          processedValue = value.substring(11);
        }
        parsedValue = processedValue as unknown as T;
      }
      
      this.emit('cache:hit', { key, value: parsedValue });
      return parsedValue;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'get', key, error });
      return null;
    }
  }

  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      // Use provided TTL, fallback to default only if not specified (undefined)
      const ttl = options.ttl !== undefined ? options.ttl : this.config.defaultTTL;
      
      let serializedValue: string;
      if (typeof value === 'string') {
        serializedValue = value;
      } else {
        serializedValue = JSON.stringify(value);
      }

      // Compress if needed
      if (options.compress && serializedValue.length > this.config.compressionThreshold) {
        // In a real implementation, you would use actual compression (gzip, lz4, etc.)
        // For now, we'll just set a flag to indicate compression would happen
        serializedValue = `compressed:${serializedValue}`;
        this.emit('cache:compressed', { key, originalSize: serializedValue.length - 11, compressedSize: serializedValue.length });
      }

      let result: string;
      if (ttl > 0) {
        result = await this.redis.setex(key, ttl, serializedValue);
      } else {
        result = await this.redis.set(key, serializedValue);
      }

      const success = result === 'OK';
      if (success) {
        this.stats.sets++;
        this.updateStats();
        this.emit('cache:set', { key, value, ttl });
      }
      
      return success;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'set', key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      const deleted = result > 0;
      
      if (deleted) {
        this.stats.deletes++;
        this.updateStats();
        this.emit('cache:delete', { key });
      }
      
      return deleted;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'del', key, error });
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      this.emit('cache:clear');
      return true;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'clear', error });
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'has', key, error });
      return false;
    }
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'keys', pattern, error });
      return [];
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  async close(): Promise<void> {
    if (typeof this.redis.quit === 'function') {
      await this.redis.quit();
    }
  }

  private updateStats(): void {
    this.stats.totalOperations = this.stats.hits + this.stats.misses;
    this.stats.hitRate = this.stats.totalOperations > 0 
      ? this.stats.hits / this.stats.totalOperations 
      : 0;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'expire', key, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.stats.errors++;
      this.updateStats();
      this.emit('cache:error', { operation: 'ttl', key, error });
      return -1;
    }
  }
}

/**
 * Cache factory function
 */
export function createCacheService(config?: Partial<CacheConfig>): ICacheService {
  let configService;
  try {
    configService = ConfigService.getInstance();
  } catch {
    configService = null;
  }
  
  // Provide fallback values if configService is not available (e.g., in tests)
  const getConfigValue = (key: string, fallback?: any) => {
    try {
      return configService?.get?.(key) ?? fallback;
    } catch {
      return fallback;
    }
  };
  
  const cacheConfig: CacheConfig = {
    enabled: config?.enabled ?? getConfigValue('REDIS_ENABLED', false),
    type: config?.type ?? (getConfigValue('REDIS_ENABLED', false) ? 'redis' : 'memory'),
    defaultTTL: config?.defaultTTL ?? 3600, // 1 hour
    maxMemoryUsage: config?.maxMemoryUsage ?? 100 * 1024 * 1024, // 100MB
    compressionThreshold: config?.compressionThreshold ?? 1024, // 1KB
    redis: config?.redis ?? {
      host: getConfigValue('REDIS_HOST', 'localhost'),
      port: getConfigValue('REDIS_PORT', 6379),
      password: getConfigValue('REDIS_PASSWORD', undefined),
      db: getConfigValue('REDIS_DB', 1), // Use different DB than job queue
      keyPrefix: `${getConfigValue('REDIS_KEY_PREFIX', 'dsw:')}cache:`
    }
  };

  if (cacheConfig.type === 'redis' && cacheConfig.enabled) {
    return new RedisCacheService(cacheConfig);
  } else {
    return new MemoryCacheService(cacheConfig);
  }
}

// Singleton cache service
let cacheInstance: ICacheService | null = null;

export function getCacheService(): ICacheService {
  if (!cacheInstance) {
    cacheInstance = createCacheService();
  }
  return cacheInstance;
}

export function resetCacheService(): void {
  if (cacheInstance) {
    cacheInstance.close();
    cacheInstance = null;
  }
}