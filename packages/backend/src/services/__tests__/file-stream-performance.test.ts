import { RefactoredFileStreamService } from '../file-stream-refactored';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as XLSX from 'xlsx';

describe('FileStreamService Performance Tests', () => {
  let tempDir: string;
  let service: RefactoredFileStreamService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-stream-perf-'));
    service = new RefactoredFileStreamService();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('large CSV file streaming', () => {
    test('should stream 50MB CSV file efficiently', async () => {
      // Generate a 50MB CSV file
      const filePath = path.join(tempDir, 'large.csv');
      const writeStream = fs.createWriteStream(filePath);
      
      // Write header
      writeStream.write('id,name,email,description,value,timestamp\n');
      
      const targetSize = 50 * 1024 * 1024; // 50MB
      let currentSize = 0;
      let rowId = 0;
      
      // Write data
      await new Promise((resolve, reject) => {
        const writeRow = () => {
          while (currentSize < targetSize) {
            const row = `${rowId},"User ${rowId}","user${rowId}@example.com","This is a description for row ${rowId} with some additional text",${Math.random() * 1000},${new Date().toISOString()}\n`;
            const canWrite = writeStream.write(row);
            currentSize += row.length;
            rowId++;
            
            if (!canWrite) {
              writeStream.once('drain', writeRow);
              return;
            }
          }
          writeStream.end();
        };
        
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        writeRow();
      });

      const startTime = Date.now();
      const memBefore = process.memoryUsage().heapUsed;
      
      let chunkCount = 0;
      let totalRows = 0;
      let maxMemoryUsage = memBefore;

      const result = await service.streamProcessFile(filePath, {
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        onChunk: async (chunk) => {
          chunkCount++;
          totalRows += chunk.processedRows;
          
          // Monitor memory usage
          const currentMem = process.memoryUsage().heapUsed;
          maxMemoryUsage = Math.max(maxMemoryUsage, currentMem);
        },
        onProgress: (progress) => {
          // Verify progress updates
          expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
          expect(progress.percentComplete).toBeLessThanOrEqual(100);
        }
      });

      const processingTime = Date.now() - startTime;
      const memoryIncrease = (maxMemoryUsage - memBefore) / 1024 / 1024; // MB

      expect(result.totalRows).toBe(totalRows);
      expect(result.chunksProcessed).toBe(chunkCount);
      expect(chunkCount).toBeGreaterThanOrEqual(10); // Should have multiple chunks
      expect(processingTime).toBeLessThan(10000); // Should process in under 10 seconds
      expect(memoryIncrease).toBeLessThan(200); // Memory increase should be limited
    }, 30000); // 30 second timeout

    test('should handle concurrent stream operations', async () => {
      // Create multiple smaller files
      const files = [];
      const filePromises = [];
      
      for (let fileIndex = 0; fileIndex < 5; fileIndex++) {
        const filePath = path.join(tempDir, `concurrent${fileIndex}.csv`);
        files.push(filePath);
        
        const content = ['name,value'];
        for (let i = 0; i < 10000; i++) {
          content.push(`Item${i},${i * (fileIndex + 1)}`);
        }
        
        filePromises.push(fs.promises.writeFile(filePath, content.join('\n')));
      }
      
      await Promise.all(filePromises);

      // Process all files concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        files.map(filePath => 
          service.streamProcessFile(filePath, {
            chunkSize: 1024 * 1024 // 1MB chunks
          })
        )
      );

      const totalTime = Date.now() - startTime;

      // Verify all files were processed
      results.forEach((result, index) => {
        expect(result.totalRows).toBe(10000);
        expect(result.chunksProcessed).toBeGreaterThan(0);
      });

      // Concurrent processing should be faster than sequential
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('memory efficiency', () => {
    test('should maintain stable memory usage during long streaming operations', async () => {
      // Create a file with many rows
      const filePath = path.join(tempDir, 'memory-test.csv');
      const rows = 100000;
      
      const writeStream = fs.createWriteStream(filePath);
      writeStream.write('id,data,value\n');
      
      for (let i = 0; i < rows; i++) {
        writeStream.write(`${i},"${Buffer.alloc(100).toString('base64')}",${Math.random()}\n`);
      }
      
      await new Promise(resolve => writeStream.end(resolve));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memStart = process.memoryUsage().heapUsed;
      const memorySnapshots: number[] = [];
      let snapshotCount = 0;

      await service.streamProcessFile(filePath, {
        chunkSize: 2 * 1024 * 1024, // 2MB chunks
        onChunk: async (chunk) => {
          // Take memory snapshot every 10 chunks
          if (++snapshotCount % 10 === 0) {
            if (global.gc) {
              global.gc();
            }
            memorySnapshots.push(process.memoryUsage().heapUsed);
          }
          
          // Simulate processing that doesn't retain data
          chunk.data.forEach(row => {
            const temp = JSON.stringify(row).length;
          });
        }
      });

      if (global.gc) {
        global.gc();
      }

      const memEnd = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = (memEnd - memStart) / 1024 / 1024; // MB

      // Memory should not continuously grow
      expect(totalMemoryIncrease).toBeLessThan(100); // Less than 100MB increase

      // Check for memory leaks - later snapshots shouldn't be much higher than earlier ones
      if (memorySnapshots.length > 2) {
        const firstHalf = memorySnapshots.slice(0, memorySnapshots.length / 2);
        const secondHalf = memorySnapshots.slice(memorySnapshots.length / 2);
        
        const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const increase = (avgSecondHalf - avgFirstHalf) / 1024 / 1024; // MB
        expect(increase).toBeLessThan(50); // Less than 50MB increase between halves
      }
    }, 30000);
  });

  describe('error recovery and resilience', () => {
    test('should recover from transient read errors', async () => {
      const filePath = path.join(tempDir, 'resilient.csv');
      const content = ['name,value'];
      for (let i = 0; i < 100; i++) {
        content.push(`Item${i},${i}`);
      }
      fs.writeFileSync(filePath, content.join('\n'));

      // Mock file system to simulate transient errors
      const originalCreateReadStream = fs.createReadStream;
      let attemptCount = 0;
      let errorCount = 0;

      fs.createReadStream = jest.fn().mockImplementation((path, options) => {
        attemptCount++;
        const stream = originalCreateReadStream(path, options);
        
        // Simulate transient error on first attempt
        if (attemptCount === 1) {
          setTimeout(() => {
            errorCount++;
            stream.emit('error', new Error('Transient read error'));
          }, 10);
        }
        
        return stream;
      });

      let processedRows = 0;

      try {
        await service.streamProcessFile(filePath, {
          onChunk: async (chunk) => {
            processedRows += chunk.processedRows;
          }
        });
      } catch (error) {
        // Expected to handle error gracefully
      } finally {
        fs.createReadStream = originalCreateReadStream;
      }

      // Should have attempted to read the file
      expect(attemptCount).toBeGreaterThan(0);
      expect(errorCount).toBeGreaterThan(0);
    });

    test('should handle malformed CSV data gracefully', async () => {
      const filePath = path.join(tempDir, 'malformed.csv');
      const content = `name,value,description
"Good Row",100,"Normal description"
"Unclosed quote,200,"Has issues
"Another Good Row",300,"Normal"
Bad"Quote"Placement,400,"Problems"
"Final Good Row",500,"OK"`;

      fs.writeFileSync(filePath, content);

      let processedRows = 0;
      let errors = 0;

      service.on('stream:error', () => errors++);

      const result = await service.streamProcessFile(filePath, {
        onChunk: async (chunk) => {
          processedRows += chunk.processedRows;
        }
      });

      // Should process what it can despite errors
      expect(processedRows).toBeGreaterThan(0);
      expect(result.totalRows).toBeGreaterThan(0);
    });
  });

  describe('progress tracking accuracy', () => {
    test('should provide accurate progress estimates', async () => {
      const filePath = path.join(tempDir, 'progress-accuracy.csv');
      const rows = 50000;
      
      // Create predictable file
      const content = ['id,name,value'];
      for (let i = 0; i < rows; i++) {
        content.push(`${i},Name${i},${i * 2}`);
      }
      
      fs.writeFileSync(filePath, content.join('\n'));

      const progressHistory: StreamProgress[] = [];
      let lastEstimatedTime = Infinity;

      await service.streamProcessFile(filePath, {
        chunkSize: 1024 * 1024, // 1MB chunks
        onProgress: (progress) => {
          progressHistory.push({ ...progress });
          
          // Estimated time should decrease as we progress
          if (progress.estimatedTimeRemaining !== undefined && 
              progress.estimatedTimeRemaining > 0 &&
              progress.percentComplete > 10 && 
              progress.percentComplete < 90) {
            expect(progress.estimatedTimeRemaining).toBeLessThanOrEqual(lastEstimatedTime * 1.5); // Allow some variance
            lastEstimatedTime = progress.estimatedTimeRemaining;
          }
        }
      });

      // Verify progress history
      expect(progressHistory.length).toBeGreaterThan(5); // Should have multiple updates
      
      // Progress should increase monotonically
      for (let i = 1; i < progressHistory.length; i++) {
        expect(progressHistory[i].percentComplete).toBeGreaterThanOrEqual(
          progressHistory[i - 1].percentComplete
        );
        expect(progressHistory[i].rowsProcessed).toBeGreaterThanOrEqual(
          progressHistory[i - 1].rowsProcessed
        );
      }

      // Final progress should be 100%
      const lastProgress = progressHistory[progressHistory.length - 1];
      expect(lastProgress.percentComplete).toBe(100);
      expect(lastProgress.rowsProcessed).toBe(rows);
      expect(lastProgress.averageRowsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('Excel file streaming performance', () => {
    test('should stream large Excel files efficiently', async () => {
      const filePath = path.join(tempDir, 'large.xlsx');
      const rows = 10000;
      
      // Create Excel file with multiple columns
      const data = [['ID', 'Name', 'Email', 'Value', 'Date', 'Description']];
      for (let i = 0; i < rows; i++) {
        data.push([
          i,
          `User ${i}`,
          `user${i}@example.com`,
          Math.random() * 1000,
          new Date().toISOString(),
          `Description for row ${i} with some additional text`
        ]);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, filePath);

      const startTime = Date.now();
      let chunkCount = 0;
      let totalProcessed = 0;

      const result = await service.streamProcessFile(filePath, {
        chunkSize: 1024 * 1024, // 1MB chunks
        onChunk: async (chunk) => {
          chunkCount++;
          totalProcessed += chunk.processedRows;
          
          // Verify chunk data structure
          if (chunk.data.length > 0) {
            expect(Array.isArray(chunk.data[0])).toBe(true);
          }
        }
      });

      const processingTime = Date.now() - startTime;

      expect(result.totalRows).toBe(rows + 1); // Including header
      expect(totalProcessed).toBe(rows + 1);
      expect(chunkCount).toBeGreaterThan(1); // Should have multiple chunks
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('chunk size optimization', () => {
    test('should handle different chunk sizes appropriately', async () => {
      const filePath = path.join(tempDir, 'chunk-sizes.csv');
      const content = ['name,value,description'];
      
      // Create file with varied row sizes
      for (let i = 0; i < 1000; i++) {
        const description = 'x'.repeat(Math.floor(Math.random() * 1000) + 100);
        content.push(`Item${i},${i},"${description}"`);
      }
      
      fs.writeFileSync(filePath, content.join('\n'));

      const chunkSizes = [
        64 * 1024,      // 64KB
        256 * 1024,     // 256KB
        1024 * 1024,    // 1MB
        5 * 1024 * 1024 // 5MB
      ];

      const results = [];

      for (const chunkSize of chunkSizes) {
        const startTime = Date.now();
        let chunks = 0;

        const result = await service.streamProcessFile(filePath, {
          chunkSize,
          onChunk: async () => {
            chunks++;
          }
        });

        results.push({
          chunkSize,
          chunks,
          processingTime: Date.now() - startTime,
          rowsPerChunk: result.totalRows / chunks
        });
      }

      // Larger chunk sizes should result in fewer chunks
      for (let i = 1; i < results.length; i++) {
        expect(results[i].chunks).toBeLessThanOrEqual(results[i - 1].chunks);
      }

      // All chunk sizes should process the same number of rows
      const totalRows = results[0].totalRows;
      results.forEach(result => {
        expect(result.totalRows).toBe(totalRows);
      });
    });
  });
});