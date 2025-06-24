/**
 * Cache Factory
 * 
 * Generates test cache data for testing caching strategies, cache invalidation,
 * and cache performance scenarios.
 */

import { AbstractFactory, testRandom } from './base.factory';

export interface TestCacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  metadata: {
    namespace: string;
    tags: string[];
    size: number;
    type: 'string' | 'object' | 'array' | 'number' | 'boolean';
    compressed: boolean;
  };
}

export interface TestCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  expiredCount: number;
  memoryUsage: {
    used: number;
    available: number;
    peak: number;
  };
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    clears: number;
  };
}

export interface TestCacheOperation {
  id: string;
  operation: 'get' | 'set' | 'delete' | 'clear' | 'exists' | 'expire';
  key?: string;
  value?: any;
  ttl?: number;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
  result?: any;
}

export class CacheFactory extends AbstractFactory<TestCacheEntry> {
  build(overrides?: Partial<TestCacheEntry>): TestCacheEntry {
    const key = this.generateCacheKey();
    const value = this.generateCacheValue();
    const ttl = testRandom.integer(60, 3600); // 1 minute to 1 hour
    const createdAt = this.generateTimestamp(testRandom.integer(0, 30));
    const expiresAt = new Date(createdAt.getTime() + (ttl * 1000));

    const base: TestCacheEntry = {
      key,
      value,
      ttl,
      createdAt,
      expiresAt,
      accessCount: testRandom.integer(0, 100),
      lastAccessed: this.generateTimestamp(testRandom.integer(0, 7)),
      metadata: {
        namespace: testRandom.choice(['user', 'sentiment', 'config', 'session', 'analytics']),
        tags: this.generateTags(),
        size: this.calculateSize(value),
        type: this.getValueType(value),
        compressed: testRandom.boolean(0.3) // 30% chance of compression
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Generate realistic cache key
   */
  private generateCacheKey(): string {
    const patterns = [
      `user:${testRandom.integer(1000, 9999)}:profile`,
      `sentiment:${this.generateUuid()}:analysis`,
      `session:${testRandom.string(32)}`,
      `config:${testRandom.choice(['database', 'cache', 'api', 'logging'])}`,
      `analytics:daily:${new Date().toISOString().split('T')[0]}`,
      `export:${this.generateUuid()}:status`,
      `rate_limit:${testRandom.integer(100, 999)}:${testRandom.integer(1000, 9999)}`,
      `lock:${testRandom.choice(['process', 'export', 'cleanup'])}:${testRandom.string(8)}`
    ];

    return testRandom.choice(patterns);
  }

  /**
   * Generate realistic cache value
   */
  private generateCacheValue(): any {
    const valueTypes = ['string', 'object', 'array', 'number', 'boolean'];
    const type = testRandom.choice(valueTypes);

    switch (type) {
      case 'string':
        return testRandom.choice([
          `cached_result_${testRandom.string(16)}`,
          JSON.stringify({ status: 'completed', result: 'success' }),
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
        ]);

      case 'object':
        return {
          id: this.generateUuid(),
          status: testRandom.choice(['active', 'pending', 'completed', 'failed']),
          data: {
            count: testRandom.integer(1, 1000),
            processed: testRandom.boolean(),
            timestamp: new Date().toISOString()
          },
          metadata: {
            source: 'cache_test',
            version: '1.0.0'
          }
        };

      case 'array':
        return Array.from({ length: testRandom.integer(1, 10) }, (_, i) => ({
          id: i,
          value: `item_${i}`,
          active: testRandom.boolean()
        }));

      case 'number':
        return testRandom.integer(1, 1000000);

      case 'boolean':
        return testRandom.boolean();

      default:
        return `default_value_${testRandom.string(8)}`;
    }
  }

  /**
   * Generate cache tags
   */
  private generateTags(): string[] {
    const allTags = ['user', 'system', 'analytics', 'export', 'temp', 'critical', 'public', 'private'];
    const tagCount = testRandom.integer(1, 3);
    const tags: string[] = [];

    for (let i = 0; i < tagCount; i++) {
      const tag = testRandom.choice(allTags);
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Calculate approximate size of value in bytes
   */
  private calculateSize(value: any): number {
    const jsonStr = JSON.stringify(value);
    return Buffer.byteLength(jsonStr, 'utf8');
  }

  /**
   * Get the type of the cached value
   */
  private getValueType(value: any): TestCacheEntry['metadata']['type'] {
    if (Array.isArray(value)) return 'array';
    return typeof value as TestCacheEntry['metadata']['type'];
  }

  /**
   * Create expired cache entry
   */
  createExpired(overrides?: Partial<TestCacheEntry>): TestCacheEntry {
    const ttl = testRandom.integer(60, 300); // Short TTL
    const createdAt = this.generateTimestamp(testRandom.integer(1, 30)); // Created in the past
    const expiresAt = new Date(createdAt.getTime() + (ttl * 1000)); // Already expired

    return this.create({
      ttl,
      createdAt,
      expiresAt,
      lastAccessed: createdAt,
      ...overrides
    });
  }

  /**
   * Create frequently accessed cache entry
   */
  createHotEntry(overrides?: Partial<TestCacheEntry>): TestCacheEntry {
    return this.create({
      accessCount: testRandom.integer(100, 1000),
      lastAccessed: this.generateTimestamp(0), // Recently accessed
      ttl: testRandom.integer(3600, 7200), // Longer TTL
      metadata: {
        ...this.create().metadata,
        tags: ['hot', 'critical']
      },
      ...overrides
    });
  }

  /**
   * Create large cache entry
   */
  createLargeEntry(overrides?: Partial<TestCacheEntry>): TestCacheEntry {
    const largeValue = {
      data: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        content: testRandom.string(100),
        metadata: {
          created: new Date().toISOString(),
          processed: testRandom.boolean()
        }
      }))
    };

    return this.create({
      value: largeValue,
      metadata: {
        ...this.create().metadata,
        size: this.calculateSize(largeValue),
        compressed: true,
        tags: ['large', 'bulk']
      },
      ...overrides
    });
  }

  /**
   * Create cache operation
   */
  createOperation(overrides?: Partial<TestCacheOperation>): TestCacheOperation {
    const operation = testRandom.choice(['get', 'set', 'delete', 'clear', 'exists', 'expire'] as const);
    const success = testRandom.boolean(0.9); // 90% success rate

    const base: TestCacheOperation = {
      id: this.generateUuid(),
      operation,
      timestamp: this.generateTimestamp(),
      duration: testRandom.integer(1, 50), // 1-50ms
      success
    };

    // Add operation-specific fields
    if (operation === 'get' || operation === 'delete' || operation === 'exists' || operation === 'expire') {
      base.key = this.generateCacheKey();
      if (operation === 'get' && success) {
        base.result = this.generateCacheValue();
      }
    } else if (operation === 'set') {
      base.key = this.generateCacheKey();
      base.value = this.generateCacheValue();
      base.ttl = testRandom.integer(60, 3600);
    }

    if (!success) {
      base.error = testRandom.choice([
        'Cache miss',
        'Key not found',
        'Connection timeout',
        'Memory limit exceeded',
        'Invalid key format'
      ]);
    }

    return this.merge(base, overrides);
  }

  /**
   * Create cache statistics
   */
  createStats(overrides?: Partial<TestCacheStats>): TestCacheStats {
    const totalEntries = testRandom.integer(100, 10000);
    const hitRate = testRandom.float(0.6, 0.95);
    const missRate = 1 - hitRate;

    const base: TestCacheStats = {
      totalEntries,
      totalSize: testRandom.integer(1024 * 100, 1024 * 1024 * 10), // 100KB to 10MB
      hitRate,
      missRate,
      evictionCount: testRandom.integer(0, Math.floor(totalEntries * 0.1)),
      expiredCount: testRandom.integer(0, Math.floor(totalEntries * 0.2)),
      memoryUsage: {
        used: testRandom.integer(1024 * 1024, 1024 * 1024 * 100), // 1MB to 100MB
        available: testRandom.integer(1024 * 1024 * 100, 1024 * 1024 * 500), // 100MB to 500MB
        peak: testRandom.integer(1024 * 1024 * 50, 1024 * 1024 * 200) // 50MB to 200MB
      },
      operations: {
        gets: testRandom.integer(1000, 100000),
        sets: testRandom.integer(100, 10000),
        deletes: testRandom.integer(10, 1000),
        clears: testRandom.integer(0, 10)
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Create cache namespace with multiple entries
   */
  createNamespace(namespace: string, entryCount: number = 10): TestCacheEntry[] {
    return this.createMany(entryCount, {
      metadata: {
        ...this.create().metadata,
        namespace
      }
    });
  }

  /**
   * Create cache performance test dataset
   */
  createPerformanceDataset(entryCount: number = 1000): TestCacheEntry[] {
    const entries: TestCacheEntry[] = [];

    // Mix of different entry types
    const hotEntries = Math.floor(entryCount * 0.1); // 10% hot entries
    const largeEntries = Math.floor(entryCount * 0.05); // 5% large entries
    const expiredEntries = Math.floor(entryCount * 0.1); // 10% expired entries
    const regularEntries = entryCount - hotEntries - largeEntries - expiredEntries;

    entries.push(...this.createMany(hotEntries).map(entry => this.createHotEntry()));
    entries.push(...this.createMany(largeEntries).map(entry => this.createLargeEntry()));
    entries.push(...this.createMany(expiredEntries).map(entry => this.createExpired()));
    entries.push(...this.createMany(regularEntries));

    return entries;
  }
}

// Export factory instance
export const cacheFactory = new CacheFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('cache', cacheFactory);