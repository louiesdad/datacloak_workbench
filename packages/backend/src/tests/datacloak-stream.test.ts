import { DataCloakStreamService, DataCloakChunkResult } from '../services/datacloak-stream.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('DataCloakStreamService', () => {
  let service: DataCloakStreamService;
  let testFilePath: string;

  beforeEach(() => {
    service = new DataCloakStreamService();
  });

  afterEach(() => {
    // Clean up test files
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  const createTestCSV = (rows: number, includePII: boolean = true): string => {
    const tmpDir = os.tmpdir();
    testFilePath = path.join(tmpDir, `test-${Date.now()}.csv`);
    
    let content = 'id,name,email,phone,review\n';
    
    for (let i = 1; i <= rows; i++) {
      const name = includePII ? `User ${i}` : `User_${i}`;
      const email = includePII ? `user${i}@example.com` : `user${i}_masked`;
      const phone = includePII ? `555-0${String(i).padStart(3, '0')}-1234` : `XXX-XXX-XXXX`;
      const review = `This is review number ${i}. The product is ${i % 2 === 0 ? 'great' : 'okay'}.`;
      
      content += `${i},"${name}","${email}","${phone}","${review}"\n`;
    }
    
    fs.writeFileSync(testFilePath, content);
    return testFilePath;
  };

  describe('streamProcessWithDataCloak', () => {
    it('should process small file with PII detection', async () => {
      const filePath = createTestCSV(100, true);
      let progressUpdates = 0;
      let chunksProcessed = 0;
      let piiDetected = 0;

      const result = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: 8 * 1024, // 8KB chunks
        onProgress: (progress) => {
          progressUpdates++;
          expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
          expect(progress.percentComplete).toBeLessThanOrEqual(100);
        },
        onChunk: async (chunk) => {
          chunksProcessed++;
          expect(chunk.processedRows).toBeGreaterThan(0);
          const dataCloakChunk = chunk as DataCloakChunkResult;
          if (dataCloakChunk.piiDetectionResults) {
            piiDetected += dataCloakChunk.piiDetectionResults.length;
          }
        }
      });

      expect(result.totalRows).toBe(100);
      expect(result.chunksProcessed).toBeGreaterThan(0);
      expect(result.piiSummary.totalPIIItems).toBeGreaterThan(0);
      expect(result.piiSummary.fieldsWithPII).toContain('email');
      expect(result.piiSummary.fieldsWithPII).toContain('phone');
      expect(progressUpdates).toBeGreaterThan(0);
      expect(chunksProcessed).toBe(result.chunksProcessed);
    });

    it('should handle large file with memory constraints', async () => {
      const filePath = createTestCSV(10000, true);
      const memoryMonitor = service.createMemoryMonitor();
      memoryMonitor.start();

      const result = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: 256 * 1024, // 256KB chunks
        preservePII: false,
        maskingOptions: {
          email: true,
          phone: true,
          name: true
        }
      });

      memoryMonitor.stop();
      const memStats = memoryMonitor.getStats();

      expect(result.totalRows).toBe(10000);
      expect(memStats.peak).toBeLessThan(500); // Should stay under 500MB
      expect(result.piiSummary.totalPIIItems).toBeGreaterThan(0);
    });

    it('should respect chunk size constraints', async () => {
      const filePath = createTestCSV(100, false);

      // Test minimum chunk size
      const tooSmall = 4 * 1024; // 4KB (below minimum)
      const result1 = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: tooSmall
      });
      expect(result1.totalRows).toBe(100);

      // Test maximum chunk size
      const tooLarge = 8 * 1024 * 1024; // 8MB (above maximum)
      const result2 = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: tooLarge
      });
      expect(result2.totalRows).toBe(100);
    });

    it('should calculate optimal chunk size', async () => {
      // Small file
      const smallFile = createTestCSV(100, false);
      const smallOptimal = await service.getOptimalChunkSize(smallFile);
      expect(smallOptimal).toBeGreaterThanOrEqual(8 * 1024);
      expect(smallOptimal).toBeLessThanOrEqual(4 * 1024 * 1024);

      // Large file simulation (we'll use file stats)
      const largeFile = createTestCSV(1000, false);
      const stats = fs.statSync(largeFile);
      // Mock a large file size
      stats.size = 1024 * 1024 * 1024; // 1GB
      const largeOptimal = await service.getOptimalChunkSize(largeFile);
      expect(largeOptimal).toBeGreaterThan(0);
      expect(largeOptimal).toBeLessThanOrEqual(4 * 1024 * 1024);
    });

    it('should handle PII masking correctly', async () => {
      const filePath = createTestCSV(50, true);
      const maskedRows: any[] = [];

      await service.streamProcessWithDataCloak(filePath, {
        preservePII: false,
        onChunk: async (chunk) => {
          const dataCloakChunk = chunk as DataCloakChunkResult;
          if (dataCloakChunk.maskedData) {
            maskedRows.push(...dataCloakChunk.maskedData);
          }
        }
      });

      expect(maskedRows.length).toBe(50);
      
      // Check that PII was masked
      const firstRow = maskedRows[0];
      expect(firstRow.email).not.toContain('@example.com');
      expect(firstRow.phone).not.toMatch(/555-0\d{3}-1234/);
    });

    it('should handle selective PII masking', async () => {
      const filePath = createTestCSV(20, true);
      const maskedRows: any[] = [];

      await service.streamProcessWithDataCloak(filePath, {
        preservePII: false,
        maskingOptions: {
          email: true,
          phone: false, // Don't mask phone numbers
          name: true
        },
        onChunk: async (chunk) => {
          const dataCloakChunk = chunk as DataCloakChunkResult;
          if (dataCloakChunk.maskedData) {
            maskedRows.push(...dataCloakChunk.maskedData);
          }
        }
      });

      expect(maskedRows.length).toBe(20);
      
      // Check selective masking
      const firstRow = maskedRows[0];
      expect(firstRow.email).not.toContain('@example.com'); // Should be masked
      expect(firstRow.phone).toMatch(/555-0\d{3}-1234/); // Should NOT be masked
    });

    it('should track PII types correctly', async () => {
      const filePath = createTestCSV(50, true);
      
      const result = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: 16 * 1024 // 16KB chunks
      });

      expect(result.piiSummary.piiTypes).toHaveProperty('EMAIL');
      expect(result.piiSummary.piiTypes).toHaveProperty('PHONE');
      expect(result.piiSummary.piiTypes.EMAIL).toBeGreaterThan(0);
      expect(result.piiSummary.piiTypes.PHONE).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const invalidPath = '/invalid/path/file.csv';
      
      await expect(
        service.streamProcessWithDataCloak(invalidPath)
      ).rejects.toThrow('File not found');
    });
  });

  describe('memory monitoring', () => {
    it('should track memory usage', async () => {
      const monitor = service.createMemoryMonitor();
      
      monitor.start();
      
      // Simulate some memory usage
      const arrays: number[][] = [];
      for (let i = 0; i < 10; i++) {
        arrays.push(new Array(1000000).fill(i));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      monitor.stop();
      const stats = monitor.getStats();
      
      expect(stats.peak).toBeGreaterThan(0);
      expect(stats.current).toBeGreaterThan(0);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });
});