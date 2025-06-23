import { detectDelimiter, createFlexibleCsvParser } from '../csv-parser-fix';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

describe('CSVParserFix Performance Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-perf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('delimiter detection performance', () => {
    test('should detect delimiter quickly for large files', async () => {
      // Generate a large CSV file (100MB)
      const rows = 1000000;
      const csvPath = path.join(tempDir, 'large.csv');
      const writeStream = fs.createWriteStream(csvPath);

      // Write header
      writeStream.write('id,name,email,age,address,phone,created_at\n');

      // Write rows
      for (let i = 0; i < rows; i++) {
        writeStream.write(`${i},User${i},user${i}@example.com,${20 + (i % 50)},"123 Main St, City ${i}",555-${String(i).padStart(4, '0')},2023-01-${String((i % 28) + 1).padStart(2, '0')}\n`);
      }

      await new Promise(resolve => writeStream.end(resolve));

      // Measure detection time
      const startTime = Date.now();
      const delimiter = await detectDelimiter(csvPath);
      const endTime = Date.now();

      expect(delimiter).toBe(',');
      expect(endTime - startTime).toBeLessThan(100); // Should detect in under 100ms
    });

    test('should handle files with many columns efficiently', async () => {
      const numColumns = 1000;
      const headers = Array.from({ length: numColumns }, (_, i) => `col${i}`);
      const values = Array.from({ length: numColumns }, (_, i) => `value${i}`);
      
      const csvContent = `${headers.join(',')}\n${values.join(',')}\n`;
      const csvPath = path.join(tempDir, 'many-columns.csv');
      fs.writeFileSync(csvPath, csvContent);

      const startTime = Date.now();
      const delimiter = await detectDelimiter(csvPath);
      const endTime = Date.now();

      expect(delimiter).toBe(',');
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });

  describe('parsing performance', () => {
    test('should parse large CSV files efficiently', async () => {
      const numRows = 100000;
      const rows = [`name,email,age,score`];
      
      for (let i = 0; i < numRows; i++) {
        rows.push(`User${i},user${i}@example.com,${20 + (i % 50)},${(Math.random() * 100).toFixed(2)}`);
      }
      
      const csvContent = rows.join('\n');
      const startTime = Date.now();

      const parser = createFlexibleCsvParser();
      let recordCount = 0;

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', () => recordCount++)
          .on('end', resolve)
          .on('error', reject);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      const recordsPerSecond = (numRows / duration) * 1000;

      expect(recordCount).toBe(numRows);
      expect(recordsPerSecond).toBeGreaterThan(10000); // Should parse >10k records/second
    });

    test('should handle streaming large files with minimal memory usage', async () => {
      const csvPath = path.join(tempDir, 'stream-test.csv');
      const writeStream = fs.createWriteStream(csvPath);
      const numRows = 50000;

      // Write CSV
      writeStream.write('id,data,timestamp\n');
      for (let i = 0; i < numRows; i++) {
        writeStream.write(`${i},${Buffer.alloc(100).toString('base64')},${new Date().toISOString()}\n`);
      }
      await new Promise(resolve => writeStream.end(resolve));

      // Measure memory before parsing
      const memBefore = process.memoryUsage().heapUsed;

      const parser = createFlexibleCsvParser();
      let recordCount = 0;
      let peakMemUsage = memBefore;

      await new Promise((resolve, reject) => {
        fs.createReadStream(csvPath)
          .pipe(parser)
          .on('data', () => {
            recordCount++;
            if (recordCount % 1000 === 0) {
              const currentMem = process.memoryUsage().heapUsed;
              peakMemUsage = Math.max(peakMemUsage, currentMem);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      const memoryIncrease = (peakMemUsage - memBefore) / 1024 / 1024; // MB

      expect(recordCount).toBe(numRows);
      expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB additional memory
    });

    test('should parse different delimiters with similar performance', async () => {
      const testCases = [
        { delimiter: ',', name: 'comma' },
        { delimiter: '\t', name: 'tab' },
        { delimiter: ';', name: 'semicolon' },
        { delimiter: '|', name: 'pipe' }
      ];

      const numRows = 10000;
      const results: { [key: string]: number } = {};

      for (const testCase of testCases) {
        const rows = [`name${testCase.delimiter}email${testCase.delimiter}age`];
        
        for (let i = 0; i < numRows; i++) {
          rows.push(`User${i}${testCase.delimiter}user${i}@example.com${testCase.delimiter}${20 + (i % 50)}`);
        }
        
        const csvContent = rows.join('\n');
        const startTime = Date.now();

        const parser = createFlexibleCsvParser(testCase.delimiter);
        let recordCount = 0;

        await new Promise((resolve, reject) => {
          Readable.from(csvContent)
            .pipe(parser)
            .on('data', () => recordCount++)
            .on('end', resolve)
            .on('error', reject);
        });

        const duration = Date.now() - startTime;
        results[testCase.name] = duration;

        expect(recordCount).toBe(numRows);
      }

      // All delimiters should perform within 50% of each other (relaxed threshold)
      const times = Object.values(results);
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      for (const time of times) {
        expect(Math.abs(time - avgTime) / avgTime).toBeLessThan(0.5);
      }
    });
  });

  describe('edge case performance', () => {
    test('should handle files with very long lines efficiently', async () => {
      const numColumns = 500;
      const numRows = 1000;
      const rows = [];

      // Create header
      const header = Array.from({ length: numColumns }, (_, i) => `column_${i}`).join(',');
      rows.push(header);

      // Create rows with long data
      for (let i = 0; i < numRows; i++) {
        const row = Array.from({ length: numColumns }, (_, j) => 
          `This is a relatively long value for row ${i} column ${j} with some additional text`
        ).join(',');
        rows.push(row);
      }

      const csvContent = rows.join('\n');
      const startTime = Date.now();

      const parser = createFlexibleCsvParser();
      let recordCount = 0;

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', () => recordCount++)
          .on('end', resolve)
          .on('error', reject);
      });

      const duration = Date.now() - startTime;

      expect(recordCount).toBe(numRows);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('should handle files with quoted fields containing newlines efficiently', async () => {
      const numRows = 5000;
      const rows = ['id,description,notes'];

      for (let i = 0; i < numRows; i++) {
        rows.push(`${i},"This is a description with\nmultiple\nlines\nof text","Some notes for record ${i}"`);
      }

      const csvContent = rows.join('\n');
      const startTime = Date.now();

      const parser = createFlexibleCsvParser();
      let recordCount = 0;

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', () => recordCount++)
          .on('end', resolve)
          .on('error', reject);
      });

      const duration = Date.now() - startTime;

      expect(recordCount).toBe(numRows);
      expect(duration).toBeLessThan(2000); // Should handle quoted newlines efficiently
    });
  });

  describe('memory efficiency', () => {
    test('should not accumulate memory when processing many small batches', async () => {
      const batchSize = 1000;
      const numBatches = 50;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memStart = process.memoryUsage().heapUsed;
      
      for (let batch = 0; batch < numBatches; batch++) {
        const rows = ['name,value'];
        
        for (let i = 0; i < batchSize; i++) {
          rows.push(`Item${i},${Math.random()}`);
        }
        
        const csvContent = rows.join('\n');
        const parser = createFlexibleCsvParser();
        
        await new Promise((resolve, reject) => {
          Readable.from(csvContent)
            .pipe(parser)
            .on('data', () => {})
            .on('end', resolve)
            .on('error', reject);
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memEnd = process.memoryUsage().heapUsed;
      const memIncrease = (memEnd - memStart) / 1024 / 1024; // MB
      
      // Memory increase should be minimal after processing many batches
      expect(memIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
});