import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { EnhancedExportService, EnhancedExportOptions } from '../enhanced-export.service';
import { AppError } from '../../middleware/error.middleware';

describe('EnhancedExportService', () => {
  let service: EnhancedExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnhancedExportService();
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(EnhancedExportService);
    });

    it('should extend ExportService', () => {
      expect(service).toHaveProperty('exportLargeDataset');
      expect(service).toHaveProperty('createExportStream');
    });
  });

  describe('createFormatTransformStream', () => {
    it('should create transform stream', () => {
      const stream = service.createFormatTransformStream('csv', 'json');
      expect(stream).toBeDefined();
      expect(typeof stream._transform).toBe('function');
    });
  });

  describe('parseCSVChunk', () => {
    it('should parse CSV data correctly', () => {
      const csvData = '"id","name","value"\n"1","Test 1","100"\n"2","Test 2","200"';
      const parsed = (service as any).parseCSVChunk(csvData);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({
        id: '1',
        name: 'Test 1',
        value: '100'
      });
    });

    it('should handle empty CSV data', () => {
      const parsed = (service as any).parseCSVChunk('');
      expect(parsed).toHaveLength(0);
    });

    it('should handle simple CSV parsing', () => {
      const csvData = 'name,description\nTest Name,Simple description';
      const parsed = (service as any).parseCSVChunk(csvData);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        name: 'Test Name',
        description: 'Simple description'
      });
    });
  });

  describe('content type mapping', () => {
    it('should return correct content types', () => {
      expect((service as any).getContentType('csv')).toBe('text/csv');
      expect((service as any).getContentType('json')).toBe('application/json');
      expect((service as any).getContentType('excel')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect((service as any).getContentType('parquet')).toBe('application/octet-stream');
      expect((service as any).getContentType('unknown')).toBe('application/octet-stream');
    });
  });

  describe('expiration calculation', () => {
    it('should calculate expiration date', () => {
      const expiration = (service as any).calculateExpiration();
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });

    it('should use environment variable for expiration hours', () => {
      const originalEnv = process.env.EXPORT_EXPIRATION_HOURS;
      process.env.EXPORT_EXPIRATION_HOURS = '48';
      
      const expiration = (service as any).calculateExpiration();
      const now = new Date();
      const expected = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      expect(expiration.getTime()).toBeCloseTo(expected.getTime(), -5); // Within 10 seconds
      
      // Restore original environment
      if (originalEnv) {
        process.env.EXPORT_EXPIRATION_HOURS = originalEnv;
      } else {
        delete process.env.EXPORT_EXPIRATION_HOURS;
      }
    });
  });

  describe('configuration', () => {
    it('should initialize without cloud clients by default', () => {
      const newService = new EnhancedExportService();
      expect((newService as any).s3Client).toBeUndefined();
      expect((newService as any).azureClient).toBeUndefined();
    });
  });

  describe('error handling for missing dependencies', () => {
    it('should handle missing parquet library', async () => {
      const options: EnhancedExportOptions = {
        format: 'parquet'
      };

      // This should fail because parquetjs-lite is not installed
      await expect(service.exportEnhanced('test_table', options))
        .rejects.toThrow('Parquet export requires parquetjs-lite package to be installed');
    });
  });

  describe('cloud storage validation', () => {
    it('should validate cloud storage provider', async () => {
      expect(() => (service as any).uploadToCloud({}, { provider: 'invalid' }))
        .rejects.toThrow('Unsupported cloud provider');
    });
  });

  describe('resumable exports', () => {
    it('should initialize resumable exports map', () => {
      expect((service as any).resumableExports).toBeInstanceOf(Map);
      expect((service as any).resumableExports.size).toBe(0);
    });

    it('should save resumable state', () => {
      const exportId = 'test-export-id';
      const tableName = 'test_table';
      const options: EnhancedExportOptions = { format: 'csv', resumable: true };

      (service as any).saveResumableState(exportId, tableName, options);

      expect((service as any).resumableExports.has(exportId)).toBe(true);
      const state = (service as any).resumableExports.get(exportId);
      expect(state.exportId).toBe(exportId);
      expect(state.tableName).toBe(tableName);
      expect(state.options).toBe(options);
    });
  });

  describe('checksum calculation', () => {
    it('should calculate SHA256 checksum', async () => {
      // Mock fs module
      const fs = require('fs');
      jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('test data'));

      const result = {
        exportId: 'test',
        chunks: [{ path: '/tmp/test.csv' }],
        totalRows: 1,
        totalSize: 1024,
        format: 'csv',
        completed: true
      };

      const checksum = await (service as any).calculateChecksum(result);
      expect(typeof checksum).toBe('string');
      expect(checksum).toHaveLength(64); // SHA256 produces 64 character hex string
      
      // Verify the checksum is consistent
      expect(checksum).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
    });
  });
});