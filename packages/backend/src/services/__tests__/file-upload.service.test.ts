/**
 * File Upload Service Tests
 * Developer 1: File Upload & Data Profiling Test Suite (Part 1/3)
 * Tests 1-5: Core file upload functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataService } from '../data.service';
import { SecurityService } from '../security.service';
import { factories } from '../../../tests/factories';
import { withSQLiteConnection } from '../../database/sqlite-refactored';
import { loadTestEnvironment } from '../../config/test-env';
import * as fs from 'fs';
import * as path from 'path';

// Load test environment
loadTestEnvironment();

describe('File Upload Service', () => {
  let dataService: DataService;
  let securityService: SecurityService;
  let mockFile: Express.Multer.File;
  let tempDir: string;

  beforeEach(async () => {
    dataService = new DataService();
    securityService = new SecurityService();
    
    // Create temp directory for test files
    tempDir = path.join(process.cwd(), 'temp', 'test-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create mock file object
    mockFile = {
      fieldname: 'file',
      originalname: 'test-data.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: 1024,
      buffer: Buffer.from('name,email,comment\nJohn,john@example.com,Great product\nJane,jane@example.com,Love it'),
      stream: undefined as any,
      destination: tempDir,
      filename: 'test-data.csv',
      path: path.join(tempDir, 'test-data.csv')
    };
  });

  afterEach(async () => {
    // Cleanup temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Test 1: Basic CSV File Upload', () => {
    test('should successfully upload a valid CSV file', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      expect(result).toBeDefined();
      expect(result.dataset).toBeDefined();
      expect(result.dataset.id).toBeDefined();
      expect(result.dataset.originalFilename).toBe('test-data.csv');
      expect(result.dataset.mimeType).toBe('text/csv');
      expect(result.dataset.size).toBe(1024);
      expect(result.dataset.recordCount).toBeGreaterThan(0);
      expect(result.previewData).toBeDefined();
      expect(result.fieldInfo).toBeDefined();
    });

    test('should validate file metadata during upload', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      // Check that basic metadata is captured
      expect(result.dataset.createdAt).toBeDefined();
      expect(result.dataset.updatedAt).toBeDefined();
      
      // Verify file is stored in database
      await withSQLiteConnection(async (db) => {
        const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(result.dataset.id);
        expect(dataset).toBeDefined();
        expect(dataset.original_filename).toBe('test-data.csv');
      });
    });
  });

  describe('Test 2: File Type Validation', () => {
    test('should reject unsupported file types', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.txt',
        mimetype: 'application/octet-stream'
      };

      await expect(dataService.uploadDataset(invalidFile as Express.Multer.File))
        .rejects
        .toThrow('INVALID_FILE_TYPE');
    });

    test('should accept all supported file types', async () => {
      const supportedTypes = [
        { name: 'test.csv', mime: 'text/csv' },
        { name: 'test.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name: 'test.xls', mime: 'application/vnd.ms-excel' }
      ];

      for (const type of supportedTypes) {
        const testFile = {
          ...mockFile,
          originalname: type.name,
          mimetype: type.mime
        };

        const result = await dataService.uploadFile(testFile as Express.Multer.File);
        expect(result.mimeType).toBe(type.mime);
      }
    });
  });

  describe('Test 3: File Size Limits', () => {
    test('should handle large file uploads within limits', async () => {
      const largeContent = 'name,email,comment\n' + 
        Array.from({ length: 10000 }, (_, i) => 
          `User${i},user${i}@example.com,Comment ${i}`
        ).join('\n');
      
      const largeFile = {
        ...mockFile,
        buffer: Buffer.from(largeContent),
        size: largeContent.length
      };

      const result = await dataService.uploadFile(largeFile as Express.Multer.File);
      expect(result.recordCount).toBe(10000);
      expect(result.size).toBe(largeContent.length);
    });

    test('should reject files exceeding size limit', async () => {
      const oversizedFile = {
        ...mockFile,
        size: 51 * 1024 * 1024 * 1024 // 51GB (over 50GB limit)
      };

      await expect(dataService.uploadFile(oversizedFile as Express.Multer.File))
        .rejects
        .toThrow('FILE_TOO_LARGE');
    });
  });

  describe('Test 4: File Processing Pipeline', () => {
    test('should trigger security scanning after upload', async () => {
      const scanSpy = jest.spyOn(securityService, 'scanFile').mockResolvedValue({
        piiDetected: 2,
        riskLevel: 'medium',
        findings: ['email addresses detected']
      });

      const result = await dataService.uploadFile(mockFile);
      
      expect(scanSpy).toHaveBeenCalledWith(result.id);
      expect(result.piiDetected).toBe(2);
      expect(result.riskLevel).toBe('medium');

      scanSpy.mockRestore();
    });

    test('should generate file processing status', async () => {
      const result = await dataService.uploadFile(mockFile);
      
      // Should create analysis batch for processing
      const batch = await dataService.getAnalysisBatch(result.id);
      expect(batch).toBeDefined();
      expect(batch.status).toBe('pending');
      expect(batch.totalRecords).toBe(result.recordCount);
    });
  });

  describe('Test 5: Error Handling and Recovery', () => {
    test('should handle corrupted file uploads gracefully', async () => {
      const corruptedFile = {
        ...mockFile,
        buffer: Buffer.from('invalid,csv,data\n\x00\x01\x02corrupted'), // Binary data in CSV
        originalname: 'corrupted.csv'
      };

      await expect(dataService.uploadFile(corruptedFile as Express.Multer.File))
        .rejects
        .toThrow('FILE_PROCESSING_ERROR');
    });

    test('should cleanup resources on upload failure', async () => {
      const failFile = {
        ...mockFile,
        buffer: null as any // Force failure
      };

      await expect(dataService.uploadFile(failFile as Express.Multer.File))
        .rejects
        .toThrow();

      // Verify no partial data remains in database
      await withSQLiteConnection(async (db) => {
        const count = db.prepare('SELECT COUNT(*) as count FROM datasets WHERE original_filename = ?')
          .get('test-data.csv');
        expect(count.count).toBe(0);
      });
    });

    test('should handle concurrent upload attempts', async () => {
      const file1 = { ...mockFile, originalname: 'concurrent1.csv' };
      const file2 = { ...mockFile, originalname: 'concurrent2.csv' };

      const [result1, result2] = await Promise.all([
        dataService.uploadFile(file1 as Express.Multer.File),
        dataService.uploadFile(file2 as Express.Multer.File)
      ]);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.originalFilename).toBe('concurrent1.csv');
      expect(result2.originalFilename).toBe('concurrent2.csv');
    });
  });
});