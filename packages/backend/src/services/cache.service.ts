import { EventEmitter } from 'events';
import Redis, { Redis as RedisClient } from 'ioredis';
import { ConfigService } from './config.service';

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
      const ttl = options.ttl || this.config.defaultTTL;
      const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined;
      
      let processedValue = value;
      
      // Serialize if needed
      if (options.serialize !== false && typeof value === 'object') {
        processedValue = JSON.parse(JSON.stringify(value)) as T;
      }
      
      // Estimate size
      const estimatedSize = this.estimateSize(processedValue);
      
      // Check memory limits
      if (this.getCurrentMemoryUsage() + estimatedSize > this.config.maxMemoryUsage) {
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
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());
    
    const targetSize = this.config.maxMemoryUsage * 0.8; // Evict to 80% capacity
    let currentSize = this.getCurrentMemoryUsage();
    
    for (const [key, entry] of entries) {
      if (currentSize <= targetSize) break;
      this.cache.delete(key);
      currentSize -= entry.size;
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
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
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
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value as unknown as T;
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
      const ttl = options.ttl || this.config.defaultTTL;
      
      let serializedValue: string;
      if (typeof value === 'string') {
        serializedValue = value;
      } else {
        serializedValue = JSON.stringify(value);
      }

      // Compress if needed
      if (options.compress && serializedValue.length > this.config.compressionThreshold) {
        // In a real implementation, you might use compression here
        // For now, we'll just set a flag
        serializedValue = `compressed:${serializedValue}`;
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
    await this.redis.quit();
  }

  private updateStats(): void {
    this.stats.totalOperations = this.stats.hits + this.stats.misses;
    this.stats.hitRate = this.stats.totalOperations > 0 
      ? this.stats.hits / this.stats.totalOperations 
      : 0;
  }

  // Redis-specific methods
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
  const configService = ConfigService.getInstance();
  
  const cacheConfig: CacheConfig = {
    enabled: config?.enabled ?? configService.get('REDIS_ENABLED') ?? false,
    type: config?.type ?? (configService.get('REDIS_ENABLED') ? 'redis' : 'memory'),
    defaultTTL: config?.defaultTTL ?? 3600, // 1 hour
    maxMemoryUsage: config?.maxMemoryUsage ?? 100 * 1024 * 1024, // 100MB
    compressionThreshold: config?.compressionThreshold ?? 1024, // 1KB
    redis: config?.redis ?? {
      host: configService.get('REDIS_HOST') ?? 'localhost',
      port: configService.get('REDIS_PORT') ?? 6379,
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB') ?? 1, // Use different DB than job queue
      keyPrefix: `${configService.get('REDIS_KEY_PREFIX') ?? 'dsw:'}cache:`
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