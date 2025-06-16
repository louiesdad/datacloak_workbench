import { createCacheService, ICacheService } from '../services/cache.service';
import { SentimentService } from '../services/sentiment.service';
import { SecurityService } from '../services/security.service';

describe('Cache Performance Tests', () => {
  let cacheService: ICacheService;
  let sentimentService: SentimentService;
  let securityService: SecurityService;

  beforeAll(async () => {
    cacheService = createCacheService({
      enabled: true,
      type: 'memory',
      defaultTTL: 3600,
      maxMemoryUsage: 50 * 1024 * 1024 // 50MB for testing
    });

    sentimentService = new SentimentService();
    securityService = new SecurityService();
    await securityService.initialize();
  });

  afterAll(async () => {
    await cacheService.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.clear();
  });

  describe('Cache Performance Benchmarks', () => {
    it('should demonstrate cache performance improvement for sentiment analysis', async () => {
      const testText = 'This is an excellent product that I highly recommend to everyone. The quality is outstanding and the service was fantastic.';
      const iterations = 100;

      console.time('Sentiment Analysis - Cold Cache');
      
      // First run - populate cache
      const firstResult = await sentimentService.analyzeSentiment(testText, false, 'basic');
      
      console.timeEnd('Sentiment Analysis - Cold Cache');
      console.time('Sentiment Analysis - Warm Cache');

      // Subsequent runs - should hit cache
      const results: any[] = [];
      for (let i = 0; i < iterations; i++) {
        const result = await sentimentService.analyzeSentiment(testText, false, 'basic');
        results.push(result);
      }

      console.timeEnd('Sentiment Analysis - Warm Cache');

      // Verify all results are consistent
      results.forEach(result => {
        expect(result.sentiment).toBe(firstResult.sentiment);
        expect(result.score).toBe(firstResult.score);
        expect(result.confidence).toBe(firstResult.confidence);
      });

      // Check cache stats
      const stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0.5);

      console.log('Cache Performance Stats:', {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        totalOperations: stats.totalOperations
      });
    });

    it('should demonstrate cache performance for PII detection', async () => {
      const testTexts = [
        'Contact John Doe at john.doe@email.com or call 555-123-4567',
        'My SSN is 123-45-6789 and my credit card is 4532-1234-5678-9012',
        'Send the package to 123 Main St, New York, NY 10001',
        'The patient ID is 987654321 and DOB is 01/15/1980'
      ];

      console.time('PII Detection - Cold Cache');

      // First run - populate cache
      const firstResults: any[] = [];
      for (const text of testTexts) {
        const result = await securityService.detectPII(text);
        firstResults.push(result);
      }

      console.timeEnd('PII Detection - Cold Cache');
      console.time('PII Detection - Warm Cache');

      // Second run - should hit cache
      const secondResults: any[] = [];
      for (const text of testTexts) {
        const result = await securityService.detectPII(text);
        secondResults.push(result);
      }

      console.timeEnd('PII Detection - Warm Cache');

      // Verify cache effectiveness
      const stats = cacheService.getStats();
      console.log('PII Detection Cache Stats:', {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`
      });

      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should handle high-volume concurrent requests efficiently', async () => {
      const testTexts = Array.from({ length: 50 }, (_, i) => 
        `Test message ${i} with varying sentiment levels and different content to ensure diversity.`
      );

      console.time('Concurrent Cache Operations');

      // Fire off many concurrent requests
      const promises = testTexts.map(async (text, index) => {
        // Mix of cache hits and misses
        const cacheKey = `test:concurrent:${Math.floor(index / 5)}`; // Group every 5 requests
        
        if (index % 5 === 0) {
          // First in group - will be a miss
          return await cacheService.set(cacheKey, { text, sentiment: 'positive', index });
        } else {
          // Others in group - should be hits
          return await cacheService.get(cacheKey);
        }
      });

      const results = await Promise.all(promises);
      
      console.timeEnd('Concurrent Cache Operations');

      // Verify no errors occurred
      expect(results.filter(r => r !== null && r !== false)).toHaveLength(testTexts.length);

      const stats = cacheService.getStats();
      console.log('Concurrent Operations Stats:', {
        operations: stats.totalOperations,
        sets: stats.sets,
        gets: stats.hits + stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`
      });
    });

    it('should efficiently handle cache expiration and cleanup', async () => {
      const shortTTL = 1; // 1 second
      const testData = Array.from({ length: 100 }, (_, i) => ({
        key: `expiry:test:${i}`,
        value: { id: i, data: `test data ${i}` }
      }));

      console.time('Cache Expiration Test');

      // Set data with short TTL
      for (const { key, value } of testData) {
        await cacheService.set(key, value, { ttl: shortTTL });
      }

      // Immediately verify all data exists
      let existingCount = 0;
      for (const { key } of testData) {
        const exists = await cacheService.has(key);
        if (exists) existingCount++;
      }
      expect(existingCount).toBe(testData.length);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify data has expired
      let expiredCount = 0;
      for (const { key } of testData) {
        const value = await cacheService.get(key);
        if (value === null) expiredCount++;
      }

      console.timeEnd('Cache Expiration Test');
      console.log(`Expired ${expiredCount} out of ${testData.length} cache entries`);

      expect(expiredCount).toBeGreaterThan(testData.length * 0.8); // At least 80% should be expired
    });

    it('should demonstrate memory efficiency', async () => {
      const largeDataSize = 1000; // Number of cache entries
      const entrySize = 1024; // ~1KB per entry

      console.time('Memory Efficiency Test');

      // Generate test data
      const testData = Array.from({ length: largeDataSize }, (_, i) => ({
        key: `memory:test:${i}`,
        value: {
          id: i,
          data: 'x'.repeat(entrySize),
          metadata: {
            created: new Date(),
            type: 'test',
            category: `category-${i % 10}`
          }
        }
      }));

      // Fill cache with test data
      for (const { key, value } of testData) {
        await cacheService.set(key, value);
      }

      // Verify all data was stored
      const allKeys = await cacheService.keys('memory:test:*');
      expect(allKeys.length).toBe(largeDataSize);

      // Test retrieval performance
      const sampleSize = 100;
      const sampleKeys = testData.slice(0, sampleSize).map(d => d.key);
      
      console.time('Sample Retrieval');
      for (const key of sampleKeys) {
        const value = await cacheService.get(key);
        expect(value).toBeTruthy();
      }
      console.timeEnd('Sample Retrieval');

      console.timeEnd('Memory Efficiency Test');

      const stats = cacheService.getStats();
      const config = cacheService.getConfig();
      
      console.log('Memory Usage Stats:', {
        totalKeys: allKeys.length,
        estimatedMemoryUsage: `${Math.round(allKeys.length * entrySize / 1024)}KB`,
        maxMemoryLimit: `${Math.round(config.maxMemoryUsage / 1024 / 1024)}MB`,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`
      });
    });

    it('should demonstrate cache invalidation performance', async () => {
      const prefixes = ['user:', 'post:', 'comment:', 'tag:', 'category:'];
      const entriesPerPrefix = 200;

      // Populate cache with structured data
      for (const prefix of prefixes) {
        for (let i = 0; i < entriesPerPrefix; i++) {
          await cacheService.set(`${prefix}${i}`, {
            id: i,
            type: prefix.slice(0, -1),
            data: `Data for ${prefix}${i}`
          });
        }
      }

      const totalEntries = prefixes.length * entriesPerPrefix;
      const allKeys = await cacheService.keys('*');
      expect(allKeys.length).toBe(totalEntries);

      console.time('Selective Cache Invalidation');

      // Invalidate specific patterns
      const userKeys = await cacheService.keys('user:*');
      const postKeys = await cacheService.keys('post:*');

      for (const key of [...userKeys, ...postKeys]) {
        await cacheService.del(key);
      }

      console.timeEnd('Selective Cache Invalidation');

      // Verify selective invalidation
      const remainingKeys = await cacheService.keys('*');
      const expectedRemaining = totalEntries - userKeys.length - postKeys.length;
      
      expect(remainingKeys.length).toBe(expectedRemaining);
      
      // Verify specific patterns are gone
      const remainingUserKeys = await cacheService.keys('user:*');
      const remainingPostKeys = await cacheService.keys('post:*');
      
      expect(remainingUserKeys.length).toBe(0);
      expect(remainingPostKeys.length).toBe(0);

      console.log('Invalidation Results:', {
        totalInvalidated: userKeys.length + postKeys.length,
        remainingEntries: remainingKeys.length,
        efficiency: `${((1 - remainingKeys.length / totalEntries) * 100).toFixed(1)}% reduction`
      });
    });
  });

  describe('Cache Efficiency Analysis', () => {
    it('should measure cache hit rates under realistic workloads', async () => {
      // Simulate realistic access patterns with skewed distribution (80/20 rule)
      const totalTexts = 100;
      const popularTexts = Array.from({ length: 20 }, (_, i) => 
        `Popular text ${i} that gets accessed frequently`
      );
      const rarTexts = Array.from({ length: 80 }, (_, i) => 
        `Rare text ${i} that is accessed occasionally`
      );

      // Simulate access pattern: 80% of requests go to 20% of content
      const accessPattern: string[] = [];
      
      // Add popular texts multiple times (80% of requests)
      for (let i = 0; i < 800; i++) {
        const text = popularTexts[Math.floor(Math.random() * popularTexts.length)];
        accessPattern.push(text);
      }
      
      // Add rare texts fewer times (20% of requests)
      for (let i = 0; i < 200; i++) {
        const text = rarTexts[Math.floor(Math.random() * rarTexts.length)];
        accessPattern.push(text);
      }

      // Shuffle the access pattern
      for (let i = accessPattern.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [accessPattern[i], accessPattern[j]] = [accessPattern[j], accessPattern[i]];
      }

      console.time('Realistic Workload Simulation');

      // Execute the access pattern
      const results: any[] = [];
      for (const text of accessPattern) {
        const result = await sentimentService.analyzeSentiment(text, false, 'basic');
        results.push(result);
      }

      console.timeEnd('Realistic Workload Simulation');

      const stats = cacheService.getStats();
      console.log('Realistic Workload Cache Performance:', {
        totalRequests: accessPattern.length,
        cacheHits: stats.hits,
        cacheMisses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        efficiency: stats.hitRate > 0.7 ? 'Excellent' : stats.hitRate > 0.5 ? 'Good' : 'Needs Improvement'
      });

      // With this access pattern, we should see a good hit rate
      expect(stats.hitRate).toBeGreaterThan(0.6);
      expect(results.length).toBe(accessPattern.length);
    });
  });
});