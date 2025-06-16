import { DataCloakStreamService } from '../../src/services/datacloak-stream.service';
import { initializeDatabases } from '../../src/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('DataCloakStreamService', () => {
  let service: DataCloakStreamService;
  let testFiles: string[] = [];

  beforeAll(async () => {
    await initializeDatabases();
    service = new DataCloakStreamService();
  });

  afterEach(() => {
    // Clean up test files
    testFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    testFiles = [];
  });

  const createTestCSV = (rows: number): string => {
    const tmpDir = os.tmpdir();
    const testFilePath = path.join(tmpDir, `test-${Date.now()}.csv`);
    
    let content = 'id,name,email,phone,review\n';
    
    for (let i = 1; i <= rows; i++) {
      const name = `User ${i}`;
      const email = `user${i}@example.com`;
      const phone = `555-0${String(i).padStart(3, '0')}-1234`;
      const review = `This is review number ${i}. The product is ${i % 2 === 0 ? 'great' : 'okay'}.`;
      
      content += `${i},"${name}","${email}","${phone}","${review}"\n`;
    }
    
    fs.writeFileSync(testFilePath, content);
    testFiles.push(testFilePath);
    return testFilePath;
  };

  describe('streamProcessWithDataCloak', () => {
    it('should process a small CSV file', async () => {
      const filePath = createTestCSV(10);
      let progressCalled = false;

      const result = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: 8 * 1024, // 8KB
        onProgress: (progress) => {
          progressCalled = true;
          expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
          expect(progress.percentComplete).toBeLessThanOrEqual(100);
        }
      });

      expect(result.totalRows).toBe(10);
      expect(result.totalBytes).toBeGreaterThan(0);
      expect(result.chunksProcessed).toBeGreaterThan(0);
      expect(progressCalled).toBe(true);
    });

    it('should detect PII in CSV data', async () => {
      const filePath = createTestCSV(5);
      
      const result = await service.streamProcessWithDataCloak(filePath, {
        chunkSize: 16 * 1024
      });

      expect(result.piiSummary.totalPIIItems).toBeGreaterThan(0);
      expect(result.piiSummary.fieldsWithPII).toContain('email');
      expect(result.piiSummary.fieldsWithPII).toContain('phone');
    });

    it('should calculate optimal chunk size', async () => {
      const filePath = createTestCSV(100);
      
      const optimalSize = await service.getOptimalChunkSize(filePath);
      
      expect(optimalSize).toBeGreaterThanOrEqual(8 * 1024); // Min 8KB
      expect(optimalSize).toBeLessThanOrEqual(4 * 1024 * 1024); // Max 4MB
    });

    it('should create and use memory monitor', () => {
      const monitor = service.createMemoryMonitor();
      
      monitor.start();
      
      // Let it run for a moment
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Busy wait
      }
      
      monitor.stop();
      const stats = monitor.getStats();
      
      expect(stats.peak).toBeGreaterThanOrEqual(0);
      expect(stats.current).toBeGreaterThanOrEqual(0);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });
});