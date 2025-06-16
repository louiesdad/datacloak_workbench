import { createCacheService, ICacheService } from '../../services/cache.service';
import { ConfigService } from '../../services/config.service';

describe('Cache Performance Load Testing', () => {
  let cacheService: ICacheService;
  let configService: ConfigService;

  beforeAll(() => {
    configService = ConfigService.getInstance();
    cacheService = createCacheService({
      enabled: true,
      type: 'memory',
      defaultTTL: 3600,
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB for load testing
    });
  });

  afterAll(async () => {
    await cacheService.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.clear();
  });

  describe('High Volume Load Testing', () => {
    it('should handle 10,000 concurrent cache operations efficiently', async () => {
      const operationCount = 10000;
      const concurrentBatchSize = 100;
      
      console.time('High Volume Cache Load Test');

      // Generate test data
      const testData = Array.from({ length: operationCount }, (_, i) => ({
        key: `load:test:${i}`,
        value: {
          id: i,
          data: `Test data ${i}`,
          timestamp: Date.now(),
          metadata: {
            category: `category-${i % 10}`,
            priority: i % 3,
            active: i % 2 === 0
          }
        }
      }));

      // Phase 1: Concurrent SET operations
      console.time('Cache SET Operations');
      const setPromises = [];
      
      for (let batch = 0; batch < operationCount; batch += concurrentBatchSize) {
        const batchPromises = testData
          .slice(batch, batch + concurrentBatchSize)
          .map(({ key, value }) => cacheService.set(key, value));
        
        setPromises.push(Promise.all(batchPromises));
      }

      const setResults = await Promise.all(setPromises);
      console.timeEnd('Cache SET Operations');

      // Verify all sets succeeded
      const totalSets = setResults.flat().filter(result => result === true).length;
      expect(totalSets).toBe(operationCount);

      // Phase 2: Concurrent GET operations
      console.time('Cache GET Operations');
      const getPromises = [];
      
      for (let batch = 0; batch < operationCount; batch += concurrentBatchSize) {
        const batchPromises = testData
          .slice(batch, batch + concurrentBatchSize)
          .map(({ key }) => cacheService.get(key));
        
        getPromises.push(Promise.all(batchPromises));
      }

      const getResults = await Promise.all(getPromises);
      console.timeEnd('Cache GET Operations');

      // Verify all gets succeeded
      const retrievedValues = getResults.flat().filter(result => result !== null);
      expect(retrievedValues.length).toBe(operationCount);

      console.timeEnd('High Volume Cache Load Test');

      // Analyze performance
      const stats = cacheService.getStats();
      console.log('High Volume Load Test Results:', {
        totalOperations: operationCount * 2, // sets + gets
        cacheHits: stats.hits,
        cacheMisses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        setsPerformed: totalSets,
        getsPerformed: retrievedValues.length,
        successRate: `${((totalSets + retrievedValues.length) / (operationCount * 2) * 100).toFixed(2)}%`
      });

      // Performance assertions
      expect(stats.hitRate).toBeGreaterThan(0.95); // 95%+ hit rate expected
      expect(totalSets).toBe(operationCount);
      expect(retrievedValues.length).toBe(operationCount);
    }, 30000);

    it('should maintain performance under sustained concurrent load', async () => {
      const duration = 10000; // 10 seconds
      const concurrentClients = 20;
      const operationsPerClient = 50;
      
      console.time('Sustained Load Test');

      let totalOperations = 0;
      let successfulOperations = 0;
      const startTime = Date.now();

      // Create concurrent clients
      const clientPromises = Array.from({ length: concurrentClients }, async (_, clientId) => {
        const clientStats = { operations: 0, successes: 0 };
        
        while (Date.now() - startTime < duration) {
          const batchPromises = [];
          
          for (let i = 0; i < operationsPerClient; i++) {
            const key = `sustained:client${clientId}:op${clientStats.operations + i}`;
            const value = { clientId, operation: clientStats.operations + i, timestamp: Date.now() };
            
            // Mix of operations: 50% set, 30% get, 20% delete
            const rand = Math.random();
            if (rand < 0.5) {
              batchPromises.push(cacheService.set(key, value));
            } else if (rand < 0.8) {
              batchPromises.push(cacheService.get(key));
            } else {
              batchPromises.push(cacheService.del(key));
            }
          }
          
          try {
            const results = await Promise.all(batchPromises);
            const successes = results.filter(r => r !== null && r !== false).length;
            
            clientStats.operations += operationsPerClient;
            clientStats.successes += successes;
          } catch (error) {
            console.warn(`Client ${clientId} error:`, error.message);
          }
          
          // Brief pause to simulate realistic usage
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return clientStats;
      });

      const clientResults = await Promise.all(clientPromises);
      console.timeEnd('Sustained Load Test');

      // Aggregate results
      totalOperations = clientResults.reduce((sum, client) => sum + client.operations, 0);
      successfulOperations = clientResults.reduce((sum, client) => sum + client.successes, 0);

      const stats = cacheService.getStats();
      const actualDuration = Date.now() - startTime;
      
      console.log('Sustained Load Test Results:', {
        duration: `${actualDuration}ms`,
        concurrentClients,
        totalOperations,
        successfulOperations,
        operationsPerSecond: Math.round(totalOperations / (actualDuration / 1000)),
        successRate: `${(successfulOperations / totalOperations * 100).toFixed(2)}%`,
        cacheStats: {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
          totalCacheOps: stats.totalOperations
        }
      });

      // Performance assertions
      expect(successfulOperations / totalOperations).toBeGreaterThan(0.9); // 90%+ success rate
      expect(totalOperations / (actualDuration / 1000)).toBeGreaterThan(100); // 100+ ops/sec
      expect(stats.totalOperations).toBeGreaterThan(0);
    }, 15000);

    it('should handle memory pressure gracefully', async () => {
      const largeValueSize = 1024; // 1KB per value
      const targetMemoryMB = 80; // Target 80MB of cache data
      const itemCount = (targetMemoryMB * 1024 * 1024) / largeValueSize;

      console.time('Memory Pressure Test');

      // Fill cache with large values
      const largeValue = 'x'.repeat(largeValueSize);
      const promises = [];

      for (let i = 0; i < itemCount; i++) {
        promises.push(
          cacheService.set(`memory:pressure:${i}`, {
            id: i,
            data: largeValue,
            metadata: { size: largeValueSize }
          })
        );

        // Process in batches to avoid overwhelming the system
        if (promises.length >= 1000) {
          await Promise.all(promises);
          promises.length = 0;

          // Check if we're hitting memory limits
          const config = cacheService.getConfig();
          if (config.maxMemoryUsage && process.memoryUsage().heapUsed > config.maxMemoryUsage) {
            console.log('Memory limit reached, stopping at', i + 1, 'items');
            break;
          }
        }
      }

      // Process remaining promises
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      console.timeEnd('Memory Pressure Test');

      // Test cache performance under memory pressure
      console.time('Performance Under Memory Pressure');
      
      const testKeys = Array.from({ length: 1000 }, (_, i) => `memory:pressure:${i}`);
      const retrievalPromises = testKeys.map(key => cacheService.get(key));
      const retrievedValues = await Promise.all(retrievalPromises);
      
      console.timeEnd('Performance Under Memory Pressure');

      const stats = cacheService.getStats();
      const memoryUsage = process.memoryUsage();

      console.log('Memory Pressure Test Results:', {
        itemsStored: Math.min(itemCount, promises.length),
        targetMemoryMB,
        actualMemoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        retrievalSuccessRate: `${(retrievedValues.filter(v => v !== null).length / testKeys.length * 100).toFixed(2)}%`,
        cacheHitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        totalCacheOperations: stats.totalOperations
      });

      // Verify system handles memory pressure gracefully
      expect(retrievedValues.filter(v => v !== null).length).toBeGreaterThan(testKeys.length * 0.8); // 80%+ retrieval success
      expect(stats.totalOperations).toBeGreaterThan(1000);
    }, 20000);
  });

  describe('Cache Performance Improvement Verification', () => {
    it('should demonstrate 50%+ performance improvement with caching', async () => {
      // Simulate expensive operation
      const expensiveOperation = async (id: number): Promise<any> => {
        // Simulate processing time (10-50ms)
        const processingTime = 10 + Math.random() * 40;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        return {
          id,
          result: `Processed result for ${id}`,
          timestamp: Date.now(),
          processingTime
        };
      };

      const testIds = Array.from({ length: 100 }, (_, i) => i);
      const iterations = 5; // Run the same operations multiple times

      // Measure without caching
      console.time('Operations Without Cache');
      const withoutCacheStart = Date.now();
      
      const withoutCacheResults = [];
      for (let iteration = 0; iteration < iterations; iteration++) {
        const iterationResults = await Promise.all(
          testIds.map(id => expensiveOperation(id))
        );
        withoutCacheResults.push(...iterationResults);
      }
      
      const withoutCacheTime = Date.now() - withoutCacheStart;
      console.timeEnd('Operations Without Cache');

      // Clear cache and measure with caching
      await cacheService.clear();
      
      const cachedOperation = async (id: number): Promise<any> => {
        const cacheKey = `expensive:op:${id}`;
        
        // Try to get from cache first
        let result = await cacheService.get(cacheKey);
        
        if (result === null) {
          // Cache miss - perform expensive operation
          result = await expensiveOperation(id);
          await cacheService.set(cacheKey, result);
        }
        
        return result;
      };

      console.time('Operations With Cache');
      const withCacheStart = Date.now();
      
      const withCacheResults = [];
      for (let iteration = 0; iteration < iterations; iteration++) {
        const iterationResults = await Promise.all(
          testIds.map(id => cachedOperation(id))
        );
        withCacheResults.push(...iterationResults);
      }
      
      const withCacheTime = Date.now() - withCacheStart;
      console.timeEnd('Operations With Cache');

      const stats = cacheService.getStats();
      const performanceImprovement = (withoutCacheTime - withCacheTime) / withoutCacheTime * 100;

      console.log('Cache Performance Improvement Results:', {
        withoutCacheTimeMs: withoutCacheTime,
        withCacheTimeMs: withCacheTime,
        improvementPercent: `${performanceImprovement.toFixed(1)}%`,
        speedupFactor: `${(withoutCacheTime / withCacheTime).toFixed(1)}x`,
        cacheStats: {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
          totalOperations: stats.totalOperations
        },
        operationsPerformed: withCacheResults.length,
        expectedCacheHits: testIds.length * (iterations - 1) // First iteration misses, rest hit
      });

      // Verify performance improvement
      expect(performanceImprovement).toBeGreaterThan(50); // 50%+ improvement required
      expect(withCacheTime).toBeLessThan(withoutCacheTime);
      expect(stats.hitRate).toBeGreaterThan(0.7); // 70%+ hit rate expected
      expect(stats.hits).toBeGreaterThan(testIds.length * (iterations - 1) * 0.9); // 90% of expected hits

      console.log(`✅ Cache Performance Improvement: ${performanceImprovement.toFixed(1)}% (Target: 50%+)`);
    }, 30000);
  });

  describe('Cache Scalability Testing', () => {
    it('should maintain consistent performance as cache size grows', async () => {
      const scales = [1000, 5000, 10000, 20000];
      const performanceResults = [];

      for (const scale of scales) {
        // Clear cache for clean test
        await cacheService.clear();

        // Fill cache with test data
        const fillStart = Date.now();
        const fillPromises = Array.from({ length: scale }, (_, i) =>
          cacheService.set(`scale:${i}`, { id: i, data: `scale test ${i}` })
        );
        await Promise.all(fillPromises);
        const fillTime = Date.now() - fillStart;

        // Measure random access performance
        const accessCount = 1000;
        const accessStart = Date.now();
        const accessPromises = Array.from({ length: accessCount }, () => {
          const randomId = Math.floor(Math.random() * scale);
          return cacheService.get(`scale:${randomId}`);
        });
        const accessResults = await Promise.all(accessPromises);
        const accessTime = Date.now() - accessStart;

        const hitCount = accessResults.filter(r => r !== null).length;
        const avgAccessTime = accessTime / accessCount;

        performanceResults.push({
          scale,
          fillTimeMs: fillTime,
          accessTimeMs: accessTime,
          avgAccessTimeMs: avgAccessTime,
          hitRate: hitCount / accessCount,
          fillRate: scale / fillTime * 1000, // items per second
          accessRate: accessCount / accessTime * 1000 // accesses per second
        });

        console.log(`Scale ${scale} results:`, {
          fillTimeMs: fillTime,
          avgAccessTimeMs: avgAccessTime.toFixed(2),
          hitRate: `${(hitCount / accessCount * 100).toFixed(1)}%`,
          accessesPerSecond: Math.round(accessCount / accessTime * 1000)
        });
      }

      console.log('Cache Scalability Test Results:', performanceResults);

      // Verify performance remains consistent across scales
      const accessTimes = performanceResults.map(r => r.avgAccessTimeMs);
      const maxAccessTime = Math.max(...accessTimes);
      const minAccessTime = Math.min(...accessTimes);
      const accessTimeVariation = (maxAccessTime - minAccessTime) / minAccessTime;

      console.log('Scalability Analysis:', {
        minAccessTimeMs: minAccessTime.toFixed(2),
        maxAccessTimeMs: maxAccessTime.toFixed(2),
        variationPercent: `${(accessTimeVariation * 100).toFixed(1)}%`
      });

      // Performance should not degrade significantly with scale
      expect(accessTimeVariation).toBeLessThan(2.0); // Less than 200% variation
      expect(maxAccessTime).toBeLessThan(10); // Access time under 10ms
      
      // All scales should maintain good hit rates
      performanceResults.forEach(result => {
        expect(result.hitRate).toBeGreaterThan(0.95); // 95%+ hit rate
      });

      console.log('✅ Cache Scalability: Consistent performance across all scales');
    }, 45000);
  });
});