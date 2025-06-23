/**
 * Upload Integration Service Tests
 * Developer 1: File Upload & Data Profiling Test Suite (Part 3/3)
 * Tests 11-15: Integration scenarios and advanced workflows
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataService } from '../data.service';
import { SecurityService } from '../security.service';
import { EventService } from '../event.service';
import { factories } from '../../../tests/factories';
import { withSQLiteConnection } from '../../database/sqlite-refactored';
import * as fs from 'fs';
import * as path from 'path';

describe('Upload Integration Service', () => {
  let dataService: DataService;
  let securityService: SecurityService;
  let eventService: EventService;
  let tempDir: string;

  beforeEach(async () => {
    dataService = new DataService();
    securityService = new SecurityService();
    eventService = EventService.getInstance();
    
    // Create temp directory for test files
    tempDir = path.join(process.cwd(), 'temp', 'integration-tests');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Cleanup temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Test 11: End-to-End Upload Workflow', () => {
    test('should complete full upload-to-analysis pipeline', async () => {
      const testFile = createTestCSVFile('e2e-test.csv', [
        ['name', 'email', 'phone', 'comment'],
        ['John Doe', 'john@example.com', '555-0123', 'Great service'],
        ['Jane Smith', 'jane@example.com', '555-0124', 'Love the product'],
        ['Bob Johnson', 'bob@example.com', '555-0125', 'Excellent support']
      ]);

      // Step 1: Upload file
      const uploadResult = await dataService.uploadFile(testFile);
      expect(uploadResult.id).toBeDefined();
      expect(uploadResult.recordCount).toBe(3);

      // Step 2: Verify security scan triggered
      const securityScan = await securityService.getLatestScan(uploadResult.id);
      expect(securityScan).toBeDefined();
      expect(securityScan.piiDetected).toBeGreaterThan(0);

      // Step 3: Verify profiling initiated
      const profile = await dataService.getDatasetProfile(uploadResult.id);
      expect(profile).toBeDefined();
      expect(profile.fields.length).toBe(4);

      // Step 4: Verify analysis batch created
      const batch = await dataService.getAnalysisBatch(uploadResult.id);
      expect(batch).toBeDefined();
      expect(batch.status).toMatch(/pending|processing|completed/);

      // Step 5: Complete analysis
      await dataService.processAnalysisBatch(batch.id);
      const completedBatch = await dataService.getAnalysisBatch(uploadResult.id);
      expect(completedBatch.status).toBe('completed');
    });

    test('should handle upload failure scenarios gracefully', async () => {
      const malformedFile = createTestFile('malformed.csv', 'invalid,csv\ndata\x00\x01');

      await expect(dataService.uploadFile(malformedFile))
        .rejects
        .toThrow();

      // Verify cleanup occurred
      await withSQLiteConnection(async (db) => {
        const orphanedRecords = db.prepare(`
          SELECT COUNT(*) as count FROM datasets WHERE original_filename = ?
        `).get('malformed.csv');
        expect(orphanedRecords.count).toBe(0);
      });
    });

    test('should emit events throughout upload lifecycle', async () => {
      const events: any[] = [];
      
      // Setup event listeners
      eventService.on('file.uploaded', (data) => events.push({ type: 'uploaded', data }));
      eventService.on('security.scan.complete', (data) => events.push({ type: 'security', data }));
      eventService.on('profiling.complete', (data) => events.push({ type: 'profiling', data }));

      const testFile = createTestCSVFile('events-test.csv', [
        ['id', 'value'],
        ['1', 'test'],
        ['2', 'data']
      ]);

      await dataService.uploadFile(testFile);

      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'uploaded')).toBe(true);
    });
  });

  describe('Test 12: Multi-File Upload Scenarios', () => {
    test('should handle concurrent file uploads', async () => {
      const files = [
        createTestCSVFile('concurrent1.csv', [['id', 'name'], ['1', 'test1']]),
        createTestCSVFile('concurrent2.csv', [['id', 'name'], ['2', 'test2']]),
        createTestCSVFile('concurrent3.csv', [['id', 'name'], ['3', 'test3']])
      ];

      const uploadPromises = files.map(file => dataService.uploadFile(file));
      const results = await Promise.all(uploadPromises);

      expect(results.length).toBe(3);
      results.forEach((result, index) => {
        expect(result.originalFilename).toBe(`concurrent${index + 1}.csv`);
        expect(result.recordCount).toBe(1);
      });

      // Verify all files in database
      await withSQLiteConnection(async (db) => {
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM datasets 
          WHERE original_filename LIKE 'concurrent%.csv'
        `).get();
        expect(count.count).toBe(3);
      });
    });

    test('should handle batch upload with validation', async () => {
      const batchFiles = [
        createTestCSVFile('batch1.csv', [['name', 'email'], ['User1', 'user1@test.com']]),
        createTestCSVFile('batch2.csv', [['name', 'email'], ['User2', 'user2@test.com']]),
        createTestFile('invalid.txt', 'not a csv file') // Should be rejected
      ];

      const batchResult = await dataService.uploadBatch(batchFiles);

      expect(batchResult.successful).toBe(2);
      expect(batchResult.failed).toBe(1);
      expect(batchResult.results.length).toBe(3);
      
      const successfulUploads = batchResult.results.filter(r => r.success);
      const failedUploads = batchResult.results.filter(r => !r.success);
      
      expect(successfulUploads.length).toBe(2);
      expect(failedUploads.length).toBe(1);
      expect(failedUploads[0].error).toContain('INVALID_FILE_TYPE');
    });
  });

  describe('Test 13: Data Format Compatibility', () => {
    test('should handle various CSV delimiters and formats', async () => {
      const formats = [
        { name: 'comma.csv', content: 'name,age,city\nJohn,25,NYC\nJane,30,LA', delimiter: ',' },
        { name: 'semicolon.csv', content: 'name;age;city\nJohn;25;NYC\nJane;30;LA', delimiter: ';' },
        { name: 'tab.csv', content: 'name\tage\tcity\nJohn\t25\tNYC\nJane\t30\tLA', delimiter: '\t' },
        { name: 'pipe.csv', content: 'name|age|city\nJohn|25|NYC\nJane|30|LA', delimiter: '|' }
      ];

      for (const format of formats) {
        const file = createTestFile(format.name, format.content);
        const result = await dataService.uploadFile(file);
        
        expect(result.recordCount).toBe(2);
        
        const profile = await dataService.getDatasetProfile(result.id);
        expect(profile.fields.map((f: any) => f.name)).toEqual(['name', 'age', 'city']);
        expect(profile.detectedDelimiter).toBe(format.delimiter);
      }
    });

    test('should handle files with various encodings', async () => {
      const encodings = [
        { name: 'utf8.csv', encoding: 'utf8', content: 'name,city\nJohn,New York\nJané,São Paulo' },
        { name: 'latin1.csv', encoding: 'latin1', content: 'name,city\nJohn,New York\nJane,Paris' }
      ];

      for (const enc of encodings) {
        const file = createTestFile(enc.name, enc.content, enc.encoding);
        const result = await dataService.uploadFile(file);
        
        expect(result.recordCount).toBe(2);
        expect(result.encoding).toBe(enc.encoding);
      }
    });

    test('should handle Excel files with multiple sheets', async () => {
      // Mock Excel file processing
      const mockExcelFile = createTestFile('multisheet.xlsx', 'mock-excel-data');
      mockExcelFile.mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // Mock Excel processing to return multiple sheets
      jest.spyOn(dataService, 'processExcelFile').mockResolvedValue({
        sheets: [
          { name: 'Sheet1', rowCount: 100, columns: ['A', 'B', 'C'] },
          { name: 'Sheet2', rowCount: 50, columns: ['X', 'Y', 'Z'] }
        ],
        selectedSheet: 'Sheet1'
      });

      const result = await dataService.uploadFile(mockExcelFile);
      
      expect(result.recordCount).toBe(100);
      expect(result.metadata?.availableSheets).toEqual(['Sheet1', 'Sheet2']);
      expect(result.metadata?.selectedSheet).toBe('Sheet1');
    });
  });

  describe('Test 14: Storage and Retrieval Integration', () => {
    test('should store uploaded files securely', async () => {
      const sensitiveFile = createTestCSVFile('sensitive.csv', [
        ['name', 'ssn', 'email'],
        ['John Doe', '123-45-6789', 'john@example.com'],
        ['Jane Smith', '987-65-4321', 'jane@example.com']
      ]);

      const result = await dataService.uploadFile(sensitiveFile);
      
      // Verify file storage
      expect(result.storagePath).toBeDefined();
      expect(fs.existsSync(result.storagePath)).toBe(true);
      
      // Verify encryption if PII detected
      const securityScan = await securityService.getLatestScan(result.id);
      if (securityScan.piiDetected > 0) {
        expect(result.encrypted).toBe(true);
        expect(result.encryptionKey).toBeDefined();
      }
    });

    test('should support file retrieval and download', async () => {
      const originalFile = createTestCSVFile('download-test.csv', [
        ['product', 'rating'],
        ['Product A', '5'],
        ['Product B', '4']
      ]);

      const uploadResult = await dataService.uploadFile(originalFile);
      
      // Test file download
      const downloadedFile = await dataService.downloadFile(uploadResult.id);
      expect(downloadedFile.buffer).toBeDefined();
      expect(downloadedFile.filename).toBe('download-test.csv');
      expect(downloadedFile.mimeType).toBe('text/csv');
      
      // Verify content integrity
      const originalContent = originalFile.buffer.toString();
      const downloadedContent = downloadedFile.buffer.toString();
      expect(downloadedContent).toBe(originalContent);
    });

    test('should manage file versioning and history', async () => {
      const file1 = createTestCSVFile('versioned.csv', [['id'], ['1']]);
      const file2 = createTestCSVFile('versioned.csv', [['id'], ['1'], ['2']]);
      
      // Upload version 1
      const result1 = await dataService.uploadFile(file1);
      expect(result1.version).toBe(1);
      
      // Upload version 2 (same filename)
      const result2 = await dataService.uploadFile(file2, { replaceExisting: true });
      expect(result2.version).toBe(2);
      expect(result2.previousVersionId).toBe(result1.id);
      
      // Verify version history
      const history = await dataService.getFileHistory(result2.id);
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });
  });

  describe('Test 15: Performance and Scalability', () => {
    test('should handle large file uploads efficiently', async () => {
      // Create large CSV data (10,000 rows)
      const largeContent = 'id,name,email,score\n' + 
        Array.from({ length: 10000 }, (_, i) => 
          `${i},User ${i},user${i}@example.com,${Math.random() * 100}`
        ).join('\n');
      
      const largeFile = createTestFile('large-dataset.csv', largeContent);
      
      const startTime = Date.now();
      const result = await dataService.uploadFile(largeFile);
      const endTime = Date.now();
      
      expect(result.recordCount).toBe(10000);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Verify memory usage stayed reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    });

    test('should implement streaming upload for very large files', async () => {
      const streamingOptions = {
        streamingMode: true,
        chunkSize: 1024 * 1024, // 1MB chunks
        maxMemoryUsage: 100 * 1024 * 1024 // 100MB limit
      };

      const largeContent = 'data,value\n' + 
        Array.from({ length: 50000 }, (_, i) => `${i},${Math.random()}`).join('\n');
      
      const streamFile = createTestFile('streaming-test.csv', largeContent);
      
      const result = await dataService.uploadFileStreaming(streamFile, streamingOptions);
      
      expect(result.recordCount).toBe(50000);
      expect(result.processingMethod).toBe('streaming');
      expect(result.chunksProcessed).toBeGreaterThan(1);
    });

    test('should provide upload progress tracking', async () => {
      const progressUpdates: any[] = [];
      
      const onProgress = (progress: any) => {
        progressUpdates.push(progress);
      };

      const testFile = createTestCSVFile('progress-test.csv', 
        Array.from({ length: 1000 }, (_, i) => [`${i}`, `data${i}`])
      );

      await dataService.uploadFile(testFile, { onProgress });
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('validation');
      expect(progressUpdates.some((p: any) => p.stage === 'parsing')).toBe(true);
      expect(progressUpdates.some((p: any) => p.stage === 'storage')).toBe(true);
      
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.percentage).toBe(100);
      expect(lastUpdate.stage).toBe('complete');
    });
  });

  // Helper functions
  function createTestFile(filename: string, content: string, encoding: BufferEncoding = 'utf8'): Express.Multer.File {
    const buffer = Buffer.from(content, encoding);
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
      stream: undefined as any,
      destination: tempDir,
      filename,
      path: path.join(tempDir, filename)
    };
  }

  function createTestCSVFile(filename: string, rows: string[][]): Express.Multer.File {
    const content = rows.map(row => row.join(',')).join('\n');
    return createTestFile(filename, content);
  }
});