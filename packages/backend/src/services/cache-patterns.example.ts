/**
 * Example usage of cache patterns in the application
 */

import { getCacheService } from './cache.service';
import { CachePatternsService } from './cache-patterns.service';
import { getSQLiteConnection } from '../database';

// Initialize cache patterns service
const cache = getCacheService();
const cachePatterns = new CachePatternsService(cache);
let db: any;

async function initDb() {
  if (!db) {
    db = await getSQLiteConnection();
  }
  return db;
}

/**
 * Example 1: Cache-Aside Pattern for user data
 */
export async function getUser(userId: string) {
  const database = await initDb();
  return cachePatterns.cacheAside(
    userId,
    async (id) => {
      // Load from database
      const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      return user[0];
    },
    {
      namespace: 'users',
      ttl: 3600 // 1 hour
    }
  );
}

/**
 * Example 2: Write-Through Pattern for updating user profile
 */
export async function updateUserProfile(userId: string, profile: any) {
  await cachePatterns.writeThrough(
    userId,
    profile,
    async (id, data) => {
      // Write to database
      await db.query(
        'UPDATE users SET profile = ? WHERE id = ?',
        [JSON.stringify(data), id]
      );
    },
    {
      namespace: 'users',
      ttl: 3600,
      invalidateOnWrite: true // Invalidate all user cache entries
    }
  );
}

/**
 * Example 3: Write-Behind Pattern for analytics events
 */
export async function trackEvent(eventId: string, eventData: any) {
  await cachePatterns.writeBehind(
    eventId,
    eventData,
    async (id, data) => {
      // Write to analytics database (can be slow)
      await db.query(
        'INSERT INTO analytics_events (id, data, timestamp) VALUES (?, ?, ?)',
        [id, JSON.stringify(data), new Date()]
      );
    },
    {
      namespace: 'events',
      ttl: 300, // 5 minutes
      delay: 5000 // Write to DB after 5 seconds
    }
  );
}

/**
 * Example 4: Refresh-Ahead Pattern for frequently accessed data
 */
export async function getPopularProducts() {
  return cachePatterns.refreshAhead(
    'popular-products',
    async () => {
      // Expensive query
      const products = await db.query(
        'SELECT * FROM products WHERE sales > 1000 ORDER BY sales DESC LIMIT 20'
      );
      return products;
    },
    {
      namespace: 'products',
      ttl: 600, // 10 minutes
      refreshThreshold: 0.7 // Refresh when 70% of TTL elapsed
    }
  );
}

/**
 * Example 5: Batch operations for sentiment analysis results
 */
export async function getSentimentResults(textIds: string[]) {
  return cachePatterns.batchCacheAside(
    textIds,
    async (ids) => {
      // Batch load from database
      const results = await db.query(
        'SELECT id, sentiment_score, analysis FROM sentiment_results WHERE id IN (?)',
        [ids]
      );
      
      // Convert to Map
      const map = new Map();
      for (const result of results) {
        map.set(result.id, result);
      }
      return map;
    },
    {
      namespace: 'sentiment',
      ttl: 7200 // 2 hours
    }
  );
}

/**
 * Example 6: Cache warming for startup
 */
export async function warmCriticalCaches() {
  // Warm user preferences
  const userIds = await db.query('SELECT id FROM users WHERE active = true LIMIT 100');
  await cachePatterns.warmCache(
    userIds.map(u => u.id),
    async (ids) => {
      const users = await db.query('SELECT * FROM users WHERE id IN (?)', [ids]);
      const map = new Map();
      for (const user of users) {
        map.set(user.id, user);
      }
      return map;
    },
    {
      namespace: 'users',
      ttl: 3600
    }
  );

  // Warm configuration
  await cachePatterns.warmCache(
    ['app-config', 'feature-flags', 'rate-limits'],
    async (keys) => {
      const configs = await db.query('SELECT key, value FROM config WHERE key IN (?)', [keys]);
      const map = new Map();
      for (const config of configs) {
        map.set(config.key, JSON.parse(config.value));
      }
      return map;
    },
    {
      namespace: 'config',
      ttl: 86400 // 24 hours
    }
  );
}

/**
 * Example 7: Cache invalidation strategies
 */
export async function invalidateUserCaches(userId: string) {
  // Invalidate specific user
  await cache.del(`users:${userId}`);
  
  // Invalidate related data
  await cachePatterns.invalidatePattern(`users:${userId}:*`);
  await cachePatterns.invalidatePattern(`sessions:${userId}:*`);
}

export async function invalidateProductCaches(category?: string) {
  if (category) {
    // Invalidate specific category
    await cachePatterns.invalidatePattern(`products:category:${category}:*`);
  } else {
    // Invalidate all products
    await cachePatterns.invalidatePattern('products:*');
  }
}

/**
 * Example 8: Monitoring cache performance
 */
export function setupCacheMonitoring() {
  cachePatterns.on('cache:hit', ({ key, pattern, latency }) => {
    console.log(`Cache HIT: ${key} (${pattern}) - ${latency}ms`);
  });

  cachePatterns.on('cache:miss', ({ key, pattern }) => {
    console.log(`Cache MISS: ${key} (${pattern})`);
  });

  cachePatterns.on('cache:error', ({ key, pattern, error }) => {
    console.error(`Cache ERROR: ${key} (${pattern})`, error);
  });

  cachePatterns.on('cache:warmed', ({ requested, loaded, failed, latency }) => {
    console.log(`Cache warmed: ${loaded}/${requested} succeeded, ${failed} failed - ${latency}ms`);
  });

  // Track metrics
  let hits = 0;
  let misses = 0;
  
  cachePatterns.on('cache:hit', () => hits++);
  cachePatterns.on('cache:miss', () => misses++);
  
  setInterval(() => {
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;
    console.log(`Cache stats - Hits: ${hits}, Misses: ${misses}, Hit rate: ${hitRate}%`);
  }, 60000); // Every minute
}