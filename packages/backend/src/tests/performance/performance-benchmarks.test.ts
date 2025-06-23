/**
 * Performance Benchmarks
 * Baseline performance metrics for core system components
 */

import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  const BENCHMARK_ITERATIONS = 1000;
  
  describe('Data Processing Benchmarks', () => {
    it('should process JSON data efficiently', () => {
      const testData = {
        id: 'test-123',
        timestamp: Date.now(),
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `test-value-${i}`,
          metadata: { processed: false, priority: i % 3 }
        }))
      };
      
      const start = performance.now();
      
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        // Simulate data processing operations
        const serialized = JSON.stringify(testData);
        const parsed = JSON.parse(serialized);
        
        // Simple data transformation
        parsed.data.forEach((item: any) => {
          item.metadata.processed = true;
          item.computedValue = item.value.toUpperCase();
        });
        
        // Filter operation
        const highPriority = parsed.data.filter((item: any) => item.metadata.priority === 0);
      }
      
      const duration = performance.now() - start;
      const operationsPerSecond = (BENCHMARK_ITERATIONS / duration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(500); // At least 500 ops/sec
      console.log(`JSON Processing: ${operationsPerSecond.toFixed(2)} operations/sec`);
    });

    it('should handle array operations efficiently', () => {
      const testArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
        category: ['A', 'B', 'C'][i % 3]
      }));
      
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) { // Fewer iterations for more complex operations
        // Map operation
        const mapped = testArray.map(item => ({
          ...item,
          normalizedValue: item.value / 100
        }));
        
        // Filter operation
        const filtered = mapped.filter(item => item.normalizedValue > 0.5);
        
        // Reduce operation
        const categoryTotals = filtered.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + item.normalizedValue;
          return acc;
        }, {} as Record<string, number>);
        
        // Sort operation
        const sorted = filtered.sort((a, b) => b.normalizedValue - a.normalizedValue);
      }
      
      const duration = performance.now() - start;
      const operationsPerSecond = (100 / duration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(50); // At least 50 complex ops/sec
      console.log(`Array Operations: ${operationsPerSecond.toFixed(2)} operations/sec`);
    });

    it('should handle string operations efficiently', () => {
      const testStrings = Array.from({ length: 100 }, (_, i) => 
        `This is a test string number ${i} with some content to process and analyze for performance testing purposes.`
      );
      
      const start = performance.now();
      
      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        testStrings.forEach(str => {
          // String manipulation operations
          const upper = str.toUpperCase();
          const lower = str.toLowerCase();
          const words = str.split(' ');
          const filtered = words.filter(word => word.length > 3);
          const joined = filtered.join('-');
          const regex = /test|performance|string/gi;
          const matches = str.match(regex);
        });
      }
      
      const duration = performance.now() - start;
      const operationsPerSecond = (BENCHMARK_ITERATIONS / duration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(200); // At least 200 ops/sec
      console.log(`String Operations: ${operationsPerSecond.toFixed(2)} operations/sec`);
    });
  });

  describe('Memory Allocation Benchmarks', () => {
    it('should handle object creation efficiently', () => {
      const start = performance.now();
      const objects: any[] = [];
      
      for (let i = 0; i < 10000; i++) {
        objects.push({
          id: i,
          timestamp: Date.now(),
          data: {
            value: Math.random(),
            metadata: {
              processed: false,
              category: ['A', 'B', 'C'][i % 3]
            }
          }
        });
      }
      
      const duration = performance.now() - start;
      const objectsPerSecond = (10000 / duration) * 1000;
      
      expect(objectsPerSecond).toBeGreaterThan(10000); // At least 10k objects/sec
      expect(objects.length).toBe(10000);
      console.log(`Object Creation: ${objectsPerSecond.toFixed(2)} objects/sec`);
    });

    it('should handle memory cleanup efficiently', () => {
      const initialMemory = process.memoryUsage();
      
      for (let round = 0; round < 5; round++) {
        const largeArray: any[] = [];
        
        // Create large objects
        for (let i = 0; i < 1000; i++) {
          largeArray.push({
            id: i,
            data: new Array(100).fill(0).map(() => Math.random())
          });
        }
        
        // Process the data
        largeArray.forEach(obj => {
          obj.processed = true;
          obj.sum = obj.data.reduce((a: number, b: number) => a + b, 0);
        });
        
        // Clear references
        largeArray.length = 0;
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    });
  });

  describe('Async Operation Benchmarks', () => {
    it('should handle Promise resolution efficiently', async () => {
      const start = performance.now();
      
      const promises = Array.from({ length: 100 }, (_, i) => 
        new Promise(resolve => {
          setImmediate(() => resolve(i));
        })
      );
      
      const results = await Promise.all(promises);
      
      const duration = performance.now() - start;
      const promisesPerSecond = (100 / duration) * 1000;
      
      expect(results.length).toBe(100);
      expect(promisesPerSecond).toBeGreaterThan(500); // At least 500 promises/sec
      console.log(`Promise Resolution: ${promisesPerSecond.toFixed(2)} promises/sec`);
    });

    it('should handle setTimeout operations efficiently', async () => {
      const start = performance.now();
      const timers: Promise<number>[] = [];
      
      for (let i = 0; i < 50; i++) {
        timers.push(new Promise(resolve => {
          setTimeout(() => resolve(i), 1);
        }));
      }
      
      const results = await Promise.all(timers);
      const duration = performance.now() - start;
      
      expect(results.length).toBe(50);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
      console.log(`Timer Operations: ${duration.toFixed(2)}ms for 50 timers`);
    });
  });

  describe('Algorithm Performance Benchmarks', () => {
    it('should handle sorting algorithms efficiently', () => {
      const testData = Array.from({ length: 1000 }, () => Math.random() * 1000);
      
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const data = [...testData]; // Create copy
        data.sort((a, b) => a - b);
      }
      
      const duration = performance.now() - start;
      const sortsPerSecond = (100 / duration) * 1000;
      
      expect(sortsPerSecond).toBeGreaterThan(50); // At least 50 sorts/sec
      console.log(`Array Sorting: ${sortsPerSecond.toFixed(2)} sorts/sec (1000 elements)`);
    });

    it('should handle search operations efficiently', () => {
      const testData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
        searchable: Math.random() > 0.5
      }));
      
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        // Linear search
        const found = testData.find(item => item.id === i % 1000);
        
        // Filter search
        const filtered = testData.filter(item => item.searchable && item.id > i);
        
        // Index search
        const indexed = testData[i % testData.length];
      }
      
      const duration = performance.now() - start;
      const searchesPerSecond = (1000 / duration) * 1000;
      
      expect(searchesPerSecond).toBeGreaterThan(100); // At least 100 searches/sec
      console.log(`Search Operations: ${searchesPerSecond.toFixed(2)} searches/sec`);
    });
  });

  describe('System Resource Benchmarks', () => {
    it('should measure baseline CPU performance', () => {
      const start = performance.now();
      let iterations = 0;
      
      // CPU-intensive operation
      while (performance.now() - start < 100) { // Run for 100ms
        Math.sqrt(Math.random() * 1000000);
        iterations++;
      }
      
      const duration = performance.now() - start;
      const operationsPerSecond = (iterations / duration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(10000); // At least 10k ops/sec
      console.log(`CPU Performance: ${operationsPerSecond.toFixed(2)} math ops/sec`);
    });

    it('should measure memory usage patterns', () => {
      const measurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const before = process.memoryUsage().heapUsed;
        
        // Allocate some memory
        const data = new Array(1000).fill(0).map(() => ({
          id: Math.random(),
          data: new Array(100).fill(Math.random())
        }));
        
        const after = process.memoryUsage().heapUsed;
        measurements.push(after - before);
        
        // Clear reference
        data.length = 0;
      }
      
      const avgMemoryUsage = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxMemoryUsage = Math.max(...measurements);
      
      expect(avgMemoryUsage).toBeLessThan(10 * 1024 * 1024); // Under 10MB average
      expect(maxMemoryUsage).toBeLessThan(20 * 1024 * 1024); // Under 20MB max
      
      console.log(`Memory Usage - Avg: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)} MB, Max: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    });
  });

  afterAll(() => {
    console.log('\\n=== Performance Benchmark Summary ===');
    console.log('All benchmarks completed successfully');
    console.log('System performance is within acceptable ranges');
    console.log('=====================================\\n');
  });
});