import { PapaParseAdapter } from '../papaparse-adapter';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Writable, Transform } from 'stream';

describe('PapaParseAdapter Streaming Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papaparse-stream-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('large file streaming', () => {
    test('should handle very large files without memory issues', (done) => {
      // Create a 50MB CSV file
      const filePath = path.join(tempDir, 'large.csv');
      const writeStream = fs.createWriteStream(filePath);
      
      // Write header
      writeStream.write('id,name,email,description,timestamp,value\n');
      
      // Write approximately 50MB of data
      const targetSize = 50 * 1024 * 1024;
      let currentSize = 0;
      let rowId = 0;
      
      const writeRows = () => {
        while (currentSize < targetSize) {
          const row = `${rowId},User${rowId},user${rowId}@example.com,"This is a description for row ${rowId} with some additional text to make it longer",${new Date().toISOString()},${Math.random() * 1000}\n`;
          const written = writeStream.write(row);
          currentSize += row.length;
          rowId++;
          
          if (!written) {
            writeStream.once('drain', writeRows);
            return;
          }
        }
        writeStream.end();
      };
      
      writeStream.on('finish', () => {
        const memBefore = process.memoryUsage().heapUsed;
        let chunkCount = 0;
        let totalProcessed = 0;
        let peakMemory = memBefore;
        
        PapaParseAdapter.streamParseFile(
          filePath,
          (chunk, rowCount) => {
            chunkCount++;
            totalProcessed = rowCount;
            
            // Monitor memory usage
            const currentMem = process.memoryUsage().heapUsed;
            peakMemory = Math.max(peakMemory, currentMem);
            
            // Verify chunk data
            expect(chunk.length).toBeGreaterThan(0);
            expect(chunk[0]).toHaveProperty('id');
            expect(chunk[0]).toHaveProperty('email');
          },
          (totalRows) => {
            const memoryIncrease = (peakMemory - memBefore) / 1024 / 1024;
            
            expect(totalRows).toBe(totalProcessed);
            expect(totalRows).toBeGreaterThan(100000); // Should have many rows
            expect(chunkCount).toBeGreaterThan(100); // Should process in many chunks
            expect(memoryIncrease).toBeLessThan(200); // Memory increase should be limited
            
            done();
          }
        );
      });
      
      writeRows();
    }, 30000); // 30 second timeout for large file test

    test('should handle concurrent streaming operations', (done) => {
      const files = ['file1.csv', 'file2.csv', 'file3.csv'];
      const promises: Promise<void>[] = [];
      
      // Create test files
      files.forEach((filename, index) => {
        const filePath = path.join(tempDir, filename);
        const content = ['name,value'];
        
        for (let i = 0; i < 1000; i++) {
          content.push(`Item${i}_File${index},${i * (index + 1)}`);
        }
        
        fs.writeFileSync(filePath, content.join('\n'));
      });
      
      // Stream parse all files concurrently
      files.forEach((filename, fileIndex) => {
        const filePath = path.join(tempDir, filename);
        const promise = new Promise<void>((resolve) => {
          let fileRowCount = 0;
          
          PapaParseAdapter.streamParseFile(
            filePath,
            (chunk) => {
              fileRowCount += chunk.length;
              
              // Verify data is from correct file
              if (chunk.length > 0) {
                expect(chunk[0].name).toContain(`File${fileIndex}`);
              }
            },
            (totalRows) => {
              expect(totalRows).toBe(1000);
              expect(fileRowCount).toBe(1000);
              resolve();
            }
          );
        });
        
        promises.push(promise);
      });
      
      Promise.all(promises).then(() => done());
    });

    test('should handle streaming with backpressure', (done) => {
      const filePath = path.join(tempDir, 'backpressure.csv');
      const rows = ['id,data'];
      
      for (let i = 0; i < 10000; i++) {
        rows.push(`${i},${Buffer.alloc(100).toString('base64')}`);
      }
      
      fs.writeFileSync(filePath, rows.join('\n'));
      
      let processedCount = 0;
      const slowProcessor = new Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          // Simulate slow processing
          setTimeout(() => {
            processedCount += chunk.length;
            callback();
          }, 10);
        }
      });
      
      const chunks: any[] = [];
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          chunks.push(chunk);
          slowProcessor.write(chunk);
        },
        (totalRows) => {
          slowProcessor.end(() => {
            expect(processedCount).toBe(10000);
            expect(totalRows).toBe(10000);
            done();
          });
        }
      );
    });
  });

  describe('streaming error scenarios', () => {
    test('should handle file deletion during streaming', (done) => {
      const filePath = path.join(tempDir, 'delete-during-stream.csv');
      const rows = ['name,value'];
      
      for (let i = 0; i < 5000; i++) {
        rows.push(`Item${i},${i}`);
      }
      
      fs.writeFileSync(filePath, rows.join('\n'));
      
      let chunksReceived = 0;
      let errorOccurred = false;
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          chunksReceived++;
          
          // Delete file after first chunk
          if (chunksReceived === 1) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              // File might already be locked
            }
          }
        },
        () => {
          console.error = originalConsoleError;
          expect(chunksReceived).toBeGreaterThan(0);
          done();
        }
      );
    });

    test('should handle malformed data during streaming', (done) => {
      const filePath = path.join(tempDir, 'malformed-stream.csv');
      const content = `name,value
"Good Row",100
"Unclosed quote,200
"Another Good Row",300
Bad"Quote"Placement,400
"Final Good Row",500`;
      
      fs.writeFileSync(filePath, content);
      
      const receivedData: any[] = [];
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          receivedData.push(...chunk);
        },
        (totalRows) => {
          // Should still process some rows despite errors
          expect(receivedData.length).toBeGreaterThan(0);
          expect(totalRows).toBeGreaterThan(0);
          done();
        }
      );
    });
  });

  describe('streaming performance optimizations', () => {
    test('should efficiently stream files with many columns', (done) => {
      const numColumns = 100;
      const numRows = 5000;
      const filePath = path.join(tempDir, 'many-columns.csv');
      
      // Create header
      const headers = Array.from({ length: numColumns }, (_, i) => `col${i}`);
      const rows = [headers.join(',')];
      
      // Create rows
      for (let i = 0; i < numRows; i++) {
        const row = Array.from({ length: numColumns }, (_, j) => `r${i}c${j}`);
        rows.push(row.join(','));
      }
      
      fs.writeFileSync(filePath, rows.join('\n'));
      
      const startTime = Date.now();
      let totalProcessed = 0;
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          totalProcessed += chunk.length;
          
          // Verify data structure
          if (chunk.length > 0) {
            expect(Object.keys(chunk[0])).toHaveLength(numColumns);
          }
        },
        (totalRows) => {
          const duration = Date.now() - startTime;
          
          expect(totalRows).toBe(numRows);
          expect(totalProcessed).toBe(numRows);
          expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
          
          done();
        }
      );
    });

    test('should handle different chunk sizes efficiently', (done) => {
      const filePath = path.join(tempDir, 'chunk-test.csv');
      const totalRows = 7777; // Odd number to test partial chunks
      const rows = ['id,value'];
      
      for (let i = 0; i < totalRows; i++) {
        rows.push(`${i},${Math.random()}`);
      }
      
      fs.writeFileSync(filePath, rows.join('\n'));
      
      const chunkSizes: number[] = [];
      let processedTotal = 0;
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk, rowCount) => {
          chunkSizes.push(chunk.length);
          processedTotal = rowCount;
        },
        (finalTotal) => {
          // Verify all chunks except possibly the last are of expected size (1000)
          const fullChunks = chunkSizes.slice(0, -1);
          const lastChunk = chunkSizes[chunkSizes.length - 1];
          
          fullChunks.forEach(size => {
            expect(size).toBe(1000);
          });
          
          expect(lastChunk).toBe(777); // Remainder
          expect(processedTotal).toBe(totalRows);
          expect(finalTotal).toBe(totalRows);
          
          done();
        }
      );
    });
  });

  describe('memory management during streaming', () => {
    test('should release memory after processing chunks', (done) => {
      const filePath = path.join(tempDir, 'memory-test.csv');
      const rows = ['id,largeData'];
      
      // Create rows with large data
      for (let i = 0; i < 2000; i++) {
        rows.push(`${i},"${Buffer.alloc(1000).toString('base64')}"`);
      }
      
      fs.writeFileSync(filePath, rows.join('\n'));
      
      const memorySnapshots: number[] = [];
      let chunkCount = 0;
      
      // Force GC if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          chunkCount++;
          
          // Take memory snapshot every few chunks
          if (chunkCount % 2 === 0) {
            if (global.gc) {
              global.gc();
            }
            memorySnapshots.push(process.memoryUsage().heapUsed);
          }
          
          // Simulate processing that doesn't retain references
          chunk.forEach(row => {
            const temp = row.id + row.largeData.length;
          });
        },
        () => {
          if (global.gc) {
            global.gc();
          }
          
          const finalMemory = process.memoryUsage().heapUsed;
          const totalIncrease = (finalMemory - initialMemory) / 1024 / 1024;
          
          // Memory should not continuously increase
          expect(totalIncrease).toBeLessThan(50); // Less than 50MB increase
          
          // Check that memory didn't continuously grow
          if (memorySnapshots.length > 2) {
            const firstHalf = memorySnapshots.slice(0, memorySnapshots.length / 2);
            const secondHalf = memorySnapshots.slice(memorySnapshots.length / 2);
            
            const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            
            // Second half shouldn't be significantly higher than first half
            const increase = (avgSecondHalf - avgFirstHalf) / 1024 / 1024;
            expect(increase).toBeLessThan(20); // Less than 20MB increase
          }
          
          done();
        }
      );
    });
  });
});