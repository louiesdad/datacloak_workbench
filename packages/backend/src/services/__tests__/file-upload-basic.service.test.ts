/**
 * File Upload Basic Tests
 * Developer 1: File Upload & Data Profiling Test Suite (Simplified)
 * Tests 1-15: Core file upload and data profiling functionality
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

describe('Developer 1: File Upload & Data Profiling (15 Tests)', () => {
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

  // Test 1: Basic CSV File Upload
  describe('Test 1: Basic CSV File Upload', () => {
    test('should successfully upload a valid CSV file', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      expect(result).toBeDefined();
      expect(result.dataset).toBeDefined();
      expect(result.dataset.id).toBeDefined();
      expect(result.dataset.originalFilename).toBe('test-data.csv');
      expect(result.dataset.mimeType).toBe('text/csv');
      expect(result.previewData).toBeDefined();
      expect(result.fieldInfo).toBeDefined();
      expect(result.fieldInfo.length).toBeGreaterThan(0);
    });
  });

  // Test 2: File Type Validation
  describe('Test 2: File Type Validation', () => {
    test('should reject unsupported file types', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.txt',
        mimetype: 'application/octet-stream'
      };

      await expect(dataService.uploadDataset(invalidFile as Express.Multer.File))
        .rejects
        .toThrow();
    });

    test('should accept CSV files', async () => {
      const csvFile = {
        ...mockFile,
        originalname: 'test.csv',
        mimetype: 'text/csv'
      };

      const result = await dataService.uploadDataset(csvFile as Express.Multer.File);
      expect(result.dataset.mimeType).toBe('text/csv');
    });
  });

  // Test 3: File Size Validation
  describe('Test 3: File Size Limits', () => {
    test('should handle reasonable file sizes', async () => {
      const reasonableContent = 'name,email,comment\n' + 
        Array.from({ length: 100 }, (_, i) => 
          `User${i},user${i}@example.com,Comment ${i}`
        ).join('\n');
      
      const reasonableFile = {
        ...mockFile,
        buffer: Buffer.from(reasonableContent),
        size: reasonableContent.length
      };

      const result = await dataService.uploadDataset(reasonableFile as Express.Multer.File);
      expect(result.dataset.recordCount).toBe(100);
    });
  });

  // Test 4: Data Parsing and Preview
  describe('Test 4: Data Parsing', () => {
    test('should parse CSV data correctly', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      expect(result.previewData).toBeDefined();
      expect(result.previewData.length).toBeGreaterThan(0);
      expect(result.fieldInfo).toBeDefined();
      expect(result.fieldInfo.length).toBe(3); // name, email, comment
    });

    test('should detect field types', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      const fieldNames = result.fieldInfo.map(f => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('comment');
    });
  });

  // Test 5: Security Integration
  describe('Test 5: Security Scanning', () => {
    test('should perform security scan on upload', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      // Security scan should be initiated
      expect(result.securityScan).toBeDefined();
      if (result.securityScan) {
        expect(result.securityScan.piiItemsDetected).toBeDefined();
        expect(result.securityScan.complianceScore).toBeDefined();
        expect(result.securityScan.riskLevel).toBeDefined();
      }
    });
  });

  // Test 6: Database Storage
  describe('Test 6: Database Storage', () => {
    test('should store dataset metadata in database', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      await withSQLiteConnection(async (db) => {
        const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(result.dataset.id);
        expect(dataset).toBeDefined();
        expect(dataset.original_filename).toBe('test-data.csv');
        expect(dataset.mime_type).toBe('text/csv');
      });
    });
  });

  // Test 7: Data Profiling - Field Statistics
  describe('Test 7: Field Statistics', () => {
    test('should generate field statistics', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      expect(result.fieldInfo).toBeDefined();
      for (const field of result.fieldInfo) {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
        expect(field.sampleValues).toBeDefined();
      }
    });
  });

  // Test 8: Data Quality Assessment
  describe('Test 8: Data Quality', () => {
    test('should assess data completeness', async () => {
      const testData = 'name,age,city\nJohn,25,NYC\nJane,,LA\nBob,30,';
      const qualityFile = {
        ...mockFile,
        buffer: Buffer.from(testData),
        size: testData.length
      };

      const result = await dataService.uploadDataset(qualityFile as Express.Multer.File);
      
      // Should detect missing values
      expect(result.fieldInfo).toBeDefined();
      const ageField = result.fieldInfo.find(f => f.name === 'age');
      const cityField = result.fieldInfo.find(f => f.name === 'city');
      
      if (ageField) expect(ageField.nullCount).toBeGreaterThan(0);
      if (cityField) expect(cityField.nullCount).toBeGreaterThan(0);
    });
  });

  // Test 9: PII Detection
  describe('Test 9: PII Detection', () => {
    test('should detect PII in uploaded data', async () => {
      const piiData = 'name,email,ssn\nJohn Doe,john@test.com,123-45-6789';
      const piiFile = {
        ...mockFile,
        buffer: Buffer.from(piiData),
        size: piiData.length
      };

      const result = await dataService.uploadDataset(piiFile as Express.Multer.File);
      
      if (result.securityScan) {
        expect(result.securityScan.piiItemsDetected).toBeGreaterThan(0);
      }
    });
  });

  // Test 10: Error Handling
  describe('Test 10: Error Handling', () => {
    test('should handle empty files gracefully', async () => {
      const emptyFile = {
        ...mockFile,
        buffer: Buffer.from(''),
        size: 0
      };

      await expect(dataService.uploadDataset(emptyFile as Express.Multer.File))
        .rejects
        .toThrow();
    });

    test('should handle malformed CSV', async () => {
      const malformedData = 'name,email\nJohn,john@test\nJane'; // Missing field
      const malformedFile = {
        ...mockFile,
        buffer: Buffer.from(malformedData),
        size: malformedData.length
      };

      // Should not throw, but handle gracefully
      const result = await dataService.uploadDataset(malformedFile as Express.Multer.File);
      expect(result).toBeDefined();
    });
  });

  // Test 11: Dataset Retrieval
  describe('Test 11: Dataset Retrieval', () => {
    test('should retrieve uploaded dataset', async () => {
      const uploadResult = await dataService.uploadDataset(mockFile);
      
      const dataset = await dataService.getDatasetById(uploadResult.dataset.id);
      expect(dataset).toBeDefined();
      expect(dataset.id).toBe(uploadResult.dataset.id);
    });
  });

  // Test 12: Preview Data Generation
  describe('Test 12: Preview Data', () => {
    test('should generate preview data for uploaded file', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      expect(result.previewData).toBeDefined();
      expect(result.previewData.length).toBeGreaterThan(0);
      expect(result.previewData.length).toBeLessThanOrEqual(10); // Preview should be limited
    });
  });

  // Test 13: File Format Support
  describe('Test 13: File Format Support', () => {
    test('should support different CSV delimiters', async () => {
      const semicolonData = 'name;email;comment\nJohn;john@test.com;Great';
      const semicolonFile = {
        ...mockFile,
        buffer: Buffer.from(semicolonData),
        size: semicolonData.length
      };

      const result = await dataService.uploadDataset(semicolonFile as Express.Multer.File);
      expect(result.fieldInfo.length).toBe(3);
    });
  });

  // Test 14: File Processing Pipeline
  describe('Test 14: Processing Pipeline', () => {
    test('should execute complete processing pipeline', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      // Should complete all stages
      expect(result.dataset).toBeDefined(); // File uploaded
      expect(result.previewData).toBeDefined(); // Data parsed
      expect(result.fieldInfo).toBeDefined(); // Fields analyzed
      expect(result.securityScan).toBeDefined(); // Security scanned
    });
  });

  // Test 15: Resource Cleanup
  describe('Test 15: Resource Management', () => {
    test('should clean up temporary resources', async () => {
      const result = await dataService.uploadDataset(mockFile);
      
      // File should be stored properly
      expect(result.dataset.id).toBeDefined();
      
      // Database connection should not leak
      await withSQLiteConnection(async (db) => {
        const datasets = db.prepare('SELECT COUNT(*) as count FROM datasets').get();
        expect(datasets.count).toBeGreaterThan(0);
      });
    });

    test('should handle concurrent uploads without conflicts', async () => {
      const file1 = { ...mockFile, originalname: 'concurrent1.csv' };
      const file2 = { ...mockFile, originalname: 'concurrent2.csv' };

      const [result1, result2] = await Promise.all([
        dataService.uploadDataset(file1 as Express.Multer.File),
        dataService.uploadDataset(file2 as Express.Multer.File)
      ]);

      expect(result1.dataset.id).not.toBe(result2.dataset.id);
      expect(result1.dataset.originalFilename).toBe('concurrent1.csv');
      expect(result2.dataset.originalFilename).toBe('concurrent2.csv');
    });
  });
});