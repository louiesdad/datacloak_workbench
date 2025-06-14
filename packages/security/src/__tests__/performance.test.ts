import { DataCloakMock } from '../mock/datacloak-mock';
import { NativeDataCloakBridge } from '../datacloak/native-bridge';
import { SecurityAuditor } from '../audit/security-auditor';
import { AdversarialCorpus } from '../testing/adversarial-corpus';
import { CryptoUtils } from '../encryption/crypto-utils';

describe('Security Performance Tests', () => {
  let dataCloakMock: DataCloakMock;
  let nativeDataCloak: NativeDataCloakBridge;
  let auditor: SecurityAuditor;
  let corpus: AdversarialCorpus;

  beforeAll(async () => {
    dataCloakMock = new DataCloakMock();
    await dataCloakMock.initialize({});
    
    nativeDataCloak = new NativeDataCloakBridge({ fallbackToMock: true });
    await nativeDataCloak.initialize({});
    
    auditor = new SecurityAuditor(dataCloakMock);
    corpus = new AdversarialCorpus();
  });

  describe('Large Text Processing Performance', () => {
    const generateLargeText = (sizeKB: number): string => {
      const chunkSize = 1024;
      const chunks = [];
      const baseText = 'Contact John Smith at john.smith@company.com or call 555-123-4567. SSN: 123-45-6789. ';
      
      for (let i = 0; i < sizeKB; i++) {
        chunks.push(baseText.repeat(Math.floor(chunkSize / baseText.length)));
      }
      
      return chunks.join('\n');
    };

    it('should process 1MB text within performance limits', async () => {
      const largeText = generateLargeText(1024); // 1MB
      const startTime = performance.now();
      
      const result = await dataCloakMock.maskText(largeText);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(result.maskedText).toBeDefined();
      expect(result.detectedPII.length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      
      console.log(`1MB text processed in ${processingTime.toFixed(2)}ms`);
    }, 10000);

    it('should process 5MB text with reasonable performance', async () => {
      const largeText = generateLargeText(5120); // 5MB
      const startTime = performance.now();
      
      const result = await dataCloakMock.maskText(largeText);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(result.maskedText).toBeDefined();
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      console.log(`5MB text processed in ${processingTime.toFixed(2)}ms`);
    }, 20000);

    it('should handle memory efficiently for large inputs', async () => {
      const initialMemory = process.memoryUsage();
      const largeText = generateLargeText(2048); // 2MB
      
      await dataCloakMock.maskText(largeText);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (less than 10x input size)
      expect(memoryGrowth).toBeLessThan(largeText.length * 10);
      
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Encryption Performance', () => {
    it('should encrypt large data within performance limits', () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const key = CryptoUtils.generateKey();
      
      const startTime = performance.now();
      const encrypted = CryptoUtils.encrypt(largeData, key);
      const endTime = performance.now();
      
      const encryptionTime = endTime - startTime;
      expect(encryptionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(encrypted.data).toBeDefined();
      
      console.log(`1MB encryption completed in ${encryptionTime.toFixed(2)}ms`);
    });

    it('should decrypt large data within performance limits', () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const key = CryptoUtils.generateKey();
      const encrypted = CryptoUtils.encrypt(largeData, key);
      
      const startTime = performance.now();
      const decrypted = CryptoUtils.decrypt(encrypted, key);
      const endTime = performance.now();
      
      const decryptionTime = endTime - startTime;
      expect(decryptionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(decrypted).toBe(largeData);
      
      console.log(`1MB decryption completed in ${decryptionTime.toFixed(2)}ms`);
    });
  });

  describe('Adversarial Corpus Performance', () => {
    it('should process adversarial examples efficiently', async () => {
      const examples = corpus.getExamplesByDifficulty('easy').slice(0, 1000); // Test 1000 examples
      
      const startTime = performance.now();
      let totalDetected = 0;
      let totalAccuracy = 0;
      
      for (const example of examples) {
        const result = await dataCloakMock.detectPII(example.text);
        totalDetected += result.length;
        
        // Calculate basic accuracy (detected vs expected)
        const accuracy = result.length >= example.expectedPII.length ? 1 : 0;
        totalAccuracy += accuracy;
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const avgTimePerExample = processingTime / examples.length;
      const overallAccuracy = totalAccuracy / examples.length;
      
      expect(avgTimePerExample).toBeLessThan(10); // Should process each example in under 10ms
      expect(overallAccuracy).toBeGreaterThan(0.8); // Should achieve >80% accuracy on easy examples
      
      console.log(`Processed ${examples.length} examples in ${processingTime.toFixed(2)}ms`);
      console.log(`Average time per example: ${avgTimePerExample.toFixed(2)}ms`);
      console.log(`Overall accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    }, 30000);

    it('should handle extreme difficulty examples', async () => {
      const extremeExamples = corpus.getExamplesByDifficulty('extreme').slice(0, 100);
      
      const startTime = performance.now();
      let successfulDetections = 0;
      
      for (const example of extremeExamples) {
        const result = await dataCloakMock.detectPII(example.text);
        if (result.length > 0) {
          successfulDetections++;
        }
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const detectionRate = successfulDetections / extremeExamples.length;
      
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(detectionRate).toBeGreaterThan(0.3); // Should detect at least 30% of extreme cases
      
      console.log(`Extreme examples detection rate: ${(detectionRate * 100).toFixed(1)}%`);
    }, 10000);
  });

  describe('Security Auditor Performance', () => {
    it('should audit multiple files efficiently', async () => {
      const filePaths = Array.from({ length: 50 }, (_, i) => `/test/file_${i}.csv`);
      
      const startTime = performance.now();
      const report = await auditor.auditMultipleFiles(filePaths);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      const avgTimePerFile = processingTime / filePaths.length;
      
      expect(report.filesAudited).toBe(filePaths.length);
      expect(avgTimePerFile).toBeLessThan(100); // Should process each file in under 100ms
      expect(report.complianceScore).toBeGreaterThanOrEqual(0);
      
      console.log(`Audited ${filePaths.length} files in ${processingTime.toFixed(2)}ms`);
      console.log(`Average time per file: ${avgTimePerFile.toFixed(2)}ms`);
    }, 15000);

    it('should validate PII masking performance', async () => {
      const testCases = Array.from({ length: 100 }, (_, i) => ({
        original: `Contact user${i}@example.com or call 555-123-${String(i).padStart(4, '0')}`,
        masked: `Contact [EMAIL] or call [PHONE]`
      }));
      
      const startTime = performance.now();
      let validationsPassed = 0;
      
      for (const testCase of testCases) {
        const isValid = await auditor.validatePIIMasking(testCase.original, testCase.masked);
        if (isValid) {
          validationsPassed++;
        }
      }
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const validationRate = validationsPassed / testCases.length;
      
      expect(processingTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(validationRate).toBeGreaterThan(0.9); // Should validate >90% correctly
      
      console.log(`Validation rate: ${(validationRate * 100).toFixed(1)}%`);
    }, 5000);
  });

  describe('Native DataCloak Bridge Performance', () => {
    it('should gracefully handle binary unavailability', async () => {
      const startTime = performance.now();
      
      // This will fallback to mock since binary is not available
      const result = await nativeDataCloak.detectPII('Contact john@example.com');
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(1000); // Fallback should be fast
      
      console.log(`Native bridge fallback completed in ${processingTime.toFixed(2)}ms`);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const testText = 'User john.doe@company.com has phone 555-123-4567';
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, () =>
        nativeDataCloak.detectPII(testText)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.length).toBeGreaterThan(0);
      });
      
      expect(processingTime).toBeLessThan(5000); // All requests should complete within 5 seconds
      
      console.log(`${concurrentRequests} concurrent requests completed in ${processingTime.toFixed(2)}ms`);
    }, 10000);
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 100;
      const testText = 'Contact john@example.com or call 555-123-4567';
      
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < iterations; i++) {
        await dataCloakMock.maskText(testText);
        
        // Periodically check memory growth
        if (i % 20 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory growth should be reasonable (less than 50MB)
          expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
        }
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const totalMemoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Final memory growth should be minimal
      expect(totalMemoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      
      console.log(`Memory growth after ${iterations} iterations: ${(totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    }, 30000);
  });
});