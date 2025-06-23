import { enhancedDataCloak, ComplianceFramework } from '../../services/enhanced-datacloak.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Helper function to generate large test datasets
function generateLargeDataset(size: number): string[] {
  const sampleTexts = [
    'John Doe lives at 123 Main St, email: john.doe@example.com, SSN: 123-45-6789',
    'Jane Smith can be reached at jane.smith@company.com or 555-123-4567',
    'Patient record: DOB 01/15/1980, Insurance ID: INS-456789, Dr. Johnson',
    'Credit card 4532-1234-5678-9012 expires 12/25, CVV 123',
    'Employee ID: EMP001, Phone: (555) 987-6543, Address: 456 Oak Ave',
    'Regular text without any sensitive information for testing purposes',
    'Medical record: Patient has diabetes, prescribed insulin, visit date 2024-03-15',
    'Financial data: Account balance $15,432.50, routing number 021000021'
  ];
  
  const dataset: string[] = [];
  for (let i = 0; i < size; i++) {
    const baseText = sampleTexts[i % sampleTexts.length];
    dataset.push(`Record ${i + 1}: ${baseText}`);
  }
  return dataset;
}

describe('Large Dataset Risk Assessment Performance Tests', () => {
  let tempDir: string;
  
  beforeAll(async () => {
    // Initialize enhanced DataCloak service
    await enhancedDataCloak.initialize();
    
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'datacloak-perf-test-'));
  });

  afterAll(async () => {
    // Clean up temporary files
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  beforeEach(async () => {
    // Reset to a known state
    await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GENERAL);
    await enhancedDataCloak.updateConfidenceThreshold(0.8);
  });

  describe('Synthetic Data Generation for Testing', () => {
    const generateSyntheticRecord = (index: number): string => {
      const piiTypes = [
        `email${index}@company.com`,
        `555-${String(index).padStart(3, '0')}-${String(index % 10000).padStart(4, '0')}`,
        `${String(index).padStart(3, '0')}-${String(index % 100).padStart(2, '0')}-${String(index % 10000).padStart(4, '0')}`,
        `4532-${String(index).padStart(4, '0')}-${String(index % 10000).padStart(4, '0')}-${String(index % 10000).padStart(4, '0')}`,
        `MRN${String(index).padStart(6, '0')}`,
        `User ${index} with personal information`
      ];
      
      const randomPii = piiTypes[index % piiTypes.length];
      const randomText = [
        'Customer data includes',
        'Processing information for',
        'Record contains',
        'Analysis shows',
        'Data entry for'
      ];
      
      return `${randomText[index % randomText.length]} ${randomPii} and additional context text for record ${index}.`;
    };

    const generateLargeDataset = (size: number): string[] => {
      const dataset: string[] = [];
      for (let i = 0; i < size; i++) {
        dataset.push(generateSyntheticRecord(i));
      }
      return dataset;
    };

    describe('Small Dataset Performance (1K records)', () => {
      it('should process 1,000 records within 2 seconds', async () => {
        const dataset = generateLargeDataset(1000);
        
        const startTime = Date.now();
        const result = await enhancedDataCloak.assessDataRisk(dataset);
        const endTime = Date.now();
        
        const processingTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(result.overall_risk).toBeDefined();
        expect(processingTime).toBeLessThan(2000); // 2 seconds
        
        console.log(`1K records processed in ${processingTime}ms`);
        console.log(`Average: ${(processingTime / 1000).toFixed(2)}ms per record`);
      });

      it('should maintain memory usage under 100MB for 1K records', async () => {
        const dataset = generateLargeDataset(1000);
        
        const initialMemory = process.memoryUsage().heapUsed;
        await enhancedDataCloak.assessDataRisk(dataset);
        const finalMemory = process.memoryUsage().heapUsed;
        
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      });
    });

    describe('Medium Dataset Performance (10K records)', () => {
      it('should process 10,000 records within 15 seconds', async () => {
        const dataset = generateLargeDataset(10000);
        
        const startTime = Date.now();
        const result = await enhancedDataCloak.assessDataRisk(dataset);
        const endTime = Date.now();
        
        const processingTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(result.risk_score).toBeGreaterThan(0);
        expect(processingTime).toBeLessThan(15000); // 15 seconds
        
        console.log(`10K records processed in ${processingTime}ms`);
        console.log(`Average: ${(processingTime / 10000).toFixed(2)}ms per record`);
        console.log(`Throughput: ${(10000 / (processingTime / 1000)).toFixed(0)} records/second`);
      });

      it('should maintain reasonable memory usage for 10K records', async () => {
        const dataset = generateLargeDataset(10000);
        
        const initialMemory = process.memoryUsage().heapUsed;
        await enhancedDataCloak.assessDataRisk(dataset);
        const finalMemory = process.memoryUsage().heapUsed;
        
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      });
    });

    describe('Large Dataset Performance (100K records)', () => {
      it('should process 100,000 records within 2 minutes', async () => {
        const dataset = generateLargeDataset(100000);
        
        const startTime = Date.now();
        const result = await enhancedDataCloak.assessDataRisk(dataset);
        const endTime = Date.now();
        
        const processingTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(result.overall_risk).toBeDefined();
        expect(processingTime).toBeLessThan(120000); // 2 minutes
        
        console.log(`100K records processed in ${processingTime}ms`);
        console.log(`Average: ${(processingTime / 100000).toFixed(2)}ms per record`);
        console.log(`Throughput: ${(100000 / (processingTime / 1000)).toFixed(0)} records/second`);
      }, 150000); // 2.5 minute timeout

      it('should maintain memory usage under 2GB for 100K records', async () => {
        const dataset = generateLargeDataset(100000);
        
        const initialMemory = process.memoryUsage().heapUsed;
        await enhancedDataCloak.assessDataRisk(dataset);
        const finalMemory = process.memoryUsage().heapUsed;
        
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        expect(memoryIncrease).toBeLessThan(2048); // Less than 2GB increase
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      }, 150000); // 2.5 minute timeout
    });
  });

  describe('Framework-Specific Performance', () => {
    it('should show consistent performance across different compliance frameworks', async () => {
      const dataset = generateLargeDataset(5000);
      const frameworks = [
        ComplianceFramework.GENERAL,
        ComplianceFramework.HIPAA,
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.GDPR
      ];

      const performanceResults: { framework: string; time: number; memoryUsage: number }[] = [];

      for (const framework of frameworks) {
        await enhancedDataCloak.updateComplianceFramework(framework);
        
        const initialMemory = process.memoryUsage().heapUsed;
        const startTime = Date.now();
        
        await enhancedDataCloak.assessDataRisk(dataset);
        
        const endTime = Date.now();
        const finalMemory = process.memoryUsage().heapUsed;
        
        performanceResults.push({
          framework: framework.toString(),
          time: endTime - startTime,
          memoryUsage: (finalMemory - initialMemory) / 1024 / 1024
        });
      }

      // All frameworks should complete within reasonable time
      performanceResults.forEach(result => {
        expect(result.time).toBeLessThan(10000); // 10 seconds
        expect(result.memoryUsage).toBeLessThan(300); // 300MB
      });

      // Performance variance should be reasonable
      const times = performanceResults.map(r => r.time);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = ((maxTime - minTime) / minTime) * 100;

      expect(variance).toBeLessThan(50); // Less than 50% variance

      console.log('Framework Performance Results:');
      performanceResults.forEach(result => {
        console.log(`  ${result.framework}: ${result.time}ms, ${result.memoryUsage.toFixed(2)}MB`);
      });
    });
  });

  describe('Batched Processing Performance', () => {
    it('should efficiently process data in batches to optimize memory usage', async () => {
      const largeDataset = generateLargeDataset(50000);
      const batchSizes = [100, 500, 1000, 2000];
      
      const batchResults: { batchSize: number; totalTime: number; peakMemory: number }[] = [];

      for (const batchSize of batchSizes) {
        const startTime = Date.now();
        let peakMemory = 0;
        
        // Process in batches
        const results = [];
        for (let i = 0; i < largeDataset.length; i += batchSize) {
          const batch = largeDataset.slice(i, i + batchSize);
          const batchResult = await enhancedDataCloak.assessDataRisk(batch);
          results.push(batchResult);
          
          const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
          peakMemory = Math.max(peakMemory, currentMemory);
        }
        
        const totalTime = Date.now() - startTime;
        
        batchResults.push({
          batchSize,
          totalTime,
          peakMemory
        });
        
        console.log(`Batch size ${batchSize}: ${totalTime}ms, Peak memory: ${peakMemory.toFixed(2)}MB`);
      }

      // Larger batch sizes should generally be more efficient (up to a point)
      expect(batchResults).toHaveLength(batchSizes.length);
      
      // All batches should complete
      batchResults.forEach(result => {
        expect(result.totalTime).toBeGreaterThan(0);
        expect(result.peakMemory).toBeGreaterThan(0);
      });
    }, 180000); // 3 minute timeout
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent risk assessments efficiently', async () => {
      const numConcurrentRequests = 10;
      const recordsPerRequest = 1000;
      
      const datasets = Array.from({ length: numConcurrentRequests }, (_, i) => 
        generateLargeDataset(recordsPerRequest).map(record => `Request${i}: ${record}`)
      );

      const startTime = Date.now();
      
      // Process all datasets concurrently
      const results = await Promise.all(
        datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
      );
      
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(numConcurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.risk_score).toBeGreaterThanOrEqual(0);
      });

      // Concurrent processing should be reasonably efficient
      expect(totalTime).toBeLessThan(30000); // 30 seconds
      
      console.log(`${numConcurrentRequests} concurrent requests (${recordsPerRequest} records each) completed in ${totalTime}ms`);
      console.log(`Average per request: ${(totalTime / numConcurrentRequests).toFixed(0)}ms`);
    }, 45000); // 45 second timeout
  });

  describe('Memory Management and Garbage Collection', () => {
    it('should properly manage memory during large dataset processing', async () => {
      const iterations = 5;
      const recordsPerIteration = 10000;
      
      const memoryReadings: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const dataset = generateLargeDataset(recordsPerIteration);
        
        await enhancedDataCloak.assessDataRisk(dataset);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        memoryReadings.push(memoryUsage);
        
        console.log(`Iteration ${i + 1}: Memory usage ${memoryUsage.toFixed(2)}MB`);
      }

      // Memory should not continuously increase (indicating memory leaks)
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const memoryIncrease = lastReading - firstReading;
      
      // Allow some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB total increase
      
      console.log(`Total memory increase over ${iterations} iterations: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain baseline performance metrics', async () => {
      const baselineDataset = generateLargeDataset(10000);
      
      // Run multiple times to get consistent measurements
      const measurements: number[] = [];
      
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await enhancedDataCloak.assessDataRisk(baselineDataset);
        const endTime = Date.now();
        
        measurements.push(endTime - startTime);
      }
      
      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      
      // Performance should be consistent
      const variance = ((maxTime - minTime) / averageTime) * 100;
      expect(variance).toBeLessThan(30); // Less than 30% variance
      
      // Performance should meet baseline expectations
      expect(averageTime).toBeLessThan(15000); // 15 seconds for 10K records
      
      console.log(`Baseline performance: ${averageTime.toFixed(0)}ms avg, ${variance.toFixed(1)}% variance`);
      console.log(`Measurements: ${measurements.map(m => m + 'ms').join(', ')}`);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should gracefully handle malformed data in large datasets', async () => {
      const normalData = generateLargeDataset(1000);
      const malformedData = [
        null as any,
        undefined as any,
        '',
        'a'.repeat(100000), // Very long string
        JSON.stringify({ nested: { very: { deep: 'object' } } }),
        Array(1000).fill('repeated text').join(' ')
      ];
      
      const mixedDataset = [...normalData, ...malformedData];
      
      // Should not throw error even with malformed data
      let result;
      expect(async () => {
        result = await enhancedDataCloak.assessDataRisk(mixedDataset);
      }).not.toThrow();
      
      expect(result).toBeDefined();
      expect(result.risk_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle memory pressure gracefully', async () => {
      // Create a very large dataset that might cause memory pressure
      const extremelyLargeDataset = generateLargeDataset(200000);
      
      // Monitor memory during processing
      const initialMemory = process.memoryUsage().heapUsed;
      
      let result;
      expect(async () => {
        result = await enhancedDataCloak.assessDataRisk(extremelyLargeDataset);
      }).not.toThrow();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(result).toBeDefined();
      console.log(`Memory increase for 200K records: ${memoryIncrease.toFixed(2)}MB`);
      
      // Should complete without running out of memory
      expect(memoryIncrease).toBeLessThan(4096); // Less than 4GB
    }, 300000); // 5 minute timeout
  });
});