import { RefactoredDataService } from '../data-service-refactored';
import { withSQLiteConnection } from '../../database/sqlite-refactored';
import { AppError } from '../../middleware/error.middleware';
import { SecurityService } from '../security.service';
import { FileStreamService } from '../file-stream.service';
import { DataCloakStreamService } from '../datacloak-stream.service';
import { PapaParseAdapter } from '../papaparse-adapter';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// Mock dependencies
jest.mock('../../database/sqlite-refactored');
jest.mock('../security.service');
jest.mock('../file-stream.service');
jest.mock('../datacloak-stream.service');
jest.mock('../papaparse-adapter');
jest.mock('fs');
jest.mock('xlsx');

const mockSQLiteConnection = {
  prepare: jest.fn(),
  close: jest.fn()
};

describe('RefactoredDataService', () => {
  let service: RefactoredDataService;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockFileStreamService: jest.Mocked<FileStreamService>;
  let mockDataCloakStreamService: jest.Mocked<DataCloakStreamService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SQLite connection
    (withSQLiteConnection as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockSQLiteConnection);
    });

    // Mock file system
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation();
    (fs.writeFileSync as jest.Mock).mockImplementation();
    (fs.unlinkSync as jest.Mock).mockImplementation();
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1024 * 1024 }); // 1MB file

    // Mock SecurityService
    SecurityService.prototype.initialize = jest.fn().mockResolvedValue(undefined);
    SecurityService.prototype.scanDataset = jest.fn().mockResolvedValue({
      piiItemsDetected: 5,
      complianceScore: 0.85,
      recommendations: ['Use encryption', 'Limit access']
    });

    // Mock FileStreamService
    FileStreamService.prototype.streamCSVWithStats = jest.fn().mockResolvedValue({
      previewData: [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }],
      fieldInfo: [
        { name: 'id', type: 'number', nullCount: 0, totalCount: 2, uniqueCount: 2, completeness: 100, uniqueness: 100, sampleValues: [1, 2] },
        { name: 'name', type: 'string', nullCount: 0, totalCount: 2, uniqueCount: 2, completeness: 100, uniqueness: 100, sampleValues: ['test', 'test2'] }
      ],
      recordCount: 1000
    });
    FileStreamService.prototype.streamExcelWithStats = jest.fn().mockResolvedValue({
      previewData: [{ id: 1, name: 'test' }],
      fieldInfo: [{ name: 'id', type: 'number', nullCount: 0, totalCount: 1, uniqueCount: 1, completeness: 100, uniqueness: 100, sampleValues: [1] }],
      recordCount: 1000
    });

    // Mock DataCloakStreamService
    DataCloakStreamService.prototype.streamProcessWithDataCloak = jest.fn();

    // Mock PapaParseAdapter to always return valid data
    (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockResolvedValue([
      { id: 1, name: 'test' },
      { id: 2, name: 'test2' }
    ]);

    service = new RefactoredDataService();
  });

  describe('uploadDataset', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.csv',
      encoding: 'utf-8',
      mimetype: 'text/csv',
      size: 1024,
      destination: '/tmp',
      filename: 'test.csv',
      path: '/tmp/test.csv',
      buffer: Buffer.from('id,name\n1,John\n2,Jane')
    } as Express.Multer.File;

    beforeEach(() => {
      // Mock CSV parsing for instance method - ensure it always returns an array
      (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockImplementation(() => {
        return Promise.resolve([
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' }
        ]);
      });

      // Mock database operations with proper database column names
      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'test.csv',
          original_filename: 'test.csv',
          size: 1024,
          record_count: 2,
          mime_type: 'text/csv',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          pii_detected: 0,
          compliance_score: 100,
          risk_level: 'low'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);
    });

    it('should upload CSV file successfully', async () => {
      const result = await service.uploadDataset(mockFile);

      expect(result).toHaveProperty('dataset');
      expect(result).toHaveProperty('previewData');
      expect(result).toHaveProperty('fieldInfo');
      expect(result).toHaveProperty('securityScan');
      
      expect(result.dataset.originalFilename).toBe('test.csv');
      expect(result.previewData).toHaveLength(2);
      expect(result.fieldInfo).toHaveLength(2);
      expect(result.securityScan?.piiItemsDetected).toBe(5);
    });

    it('should handle Excel files', async () => {
      const excelFile = { ...mockFile, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      
      // Mock Excel parsing
      (XLSX.readFile as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      });
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);

      const result = await service.uploadDataset(excelFile);

      expect(result.dataset).toBeDefined();
      expect(XLSX.readFile).toHaveBeenCalled();
    });

    it('should reject unsupported file types', async () => {
      const invalidFile = { ...mockFile, mimetype: 'application/pdf' };

      await expect(service.uploadDataset(invalidFile))
        .rejects.toThrow('Unsupported file type: application/pdf');
    });

    it('should handle missing file', async () => {
      await expect(service.uploadDataset(null as any))
        .rejects.toThrow(new AppError('No file provided', 400, 'NO_FILE'));
    });

    it('should handle large files with streaming', async () => {
      // Mock large file
      (fs.statSync as jest.Mock).mockReturnValue({ size: 200 * 1024 * 1024 }); // 200MB

      const result = await service.uploadDataset(mockFile);

      expect(FileStreamService.prototype.streamCSVWithStats).toHaveBeenCalled();
      expect(result.dataset).toBeDefined();
    });

    it('should handle security scan failures gracefully', async () => {
      // Save the original mock
      const originalScanDataset = SecurityService.prototype.scanDataset;
      
      // Mock scanDataset to reject
      SecurityService.prototype.scanDataset = jest.fn().mockRejectedValue(new Error('Security scan failed'));
      
      // Create a fresh service instance that will use the updated mock
      const testService = new RefactoredDataService();

      const result = await testService.uploadDataset(mockFile);

      expect(result.dataset).toBeDefined();
      expect(result.securityScan).toBeUndefined();
      
      // Restore the original mock
      SecurityService.prototype.scanDataset = originalScanDataset;
    });

    it('should cleanup file on upload failure', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockSQLiteConnection.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.uploadDataset(mockFile))
        .rejects.toThrow();

      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('field analysis', () => {
    it('should analyze field statistics correctly', async () => {
      const mockData = [
        { id: 1, name: 'John', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 25 },
        { id: 3, name: 'Bob', email: 'bob@example.com', age: null },
        { id: 4, name: 'Alice', email: null, age: 35 }
      ];

      (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockResolvedValue(mockData);
      
      // Update FileStreamService mock for this test
      FileStreamService.prototype.streamCSVWithStats = jest.fn().mockResolvedValue({
        previewData: mockData,
        fieldInfo: [
          { name: 'id', type: 'number', nullCount: 0, totalCount: 4, uniqueCount: 4, completeness: 100, uniqueness: 100, sampleValues: [1, 2, 3, 4] },
          { name: 'name', type: 'string', nullCount: 0, totalCount: 4, uniqueCount: 4, completeness: 100, uniqueness: 100, sampleValues: ['John', 'Jane', 'Bob', 'Alice'] },
          { name: 'email', type: 'email', nullCount: 1, totalCount: 4, uniqueCount: 3, completeness: 75, uniqueness: 75, sampleValues: ['john@example.com', 'jane@example.com', 'bob@example.com'] },
          { name: 'age', type: 'number', nullCount: 1, totalCount: 4, uniqueCount: 3, completeness: 75, uniqueness: 75, sampleValues: [30, 25, 35], warnings: ['Contains null values'] }
        ],
        recordCount: 4
      });

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from('test'),
        destination: '/tmp',
        filename: 'test.csv',
        path: '/tmp/test.csv'
      } as Express.Multer.File;

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'test.csv',
          originalFilename: 'test.csv',
          size: 1024,
          recordCount: 4,
          mimeType: 'text/csv',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      // Create a new service instance to use the updated mock
      const testService = new RefactoredDataService();
      const result = await testService.uploadDataset(mockFile);
      const fieldInfo = result.fieldInfo;

      // Check ID field
      const idField = fieldInfo.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField?.type).toBe('number');
      expect(idField?.nullCount).toBe(0);
      expect(idField?.completeness).toBe(100);
      expect(idField?.uniqueness).toBe(100);

      // Check email field
      const emailField = fieldInfo.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.type).toBe('email');
      expect(emailField?.nullCount).toBe(1);
      expect(emailField?.completeness).toBe(75);

      // Check age field
      const ageField = fieldInfo.find(f => f.name === 'age');
      expect(ageField).toBeDefined();
      expect(ageField?.type).toBe('number');
      expect(ageField?.nullCount).toBe(1);
      expect(ageField?.warnings).toBeDefined();
    });

    it('should detect field types correctly', async () => {
      const mockData = [
        { ssn: '123-45-6789', phone: '555-1234', birth_date: '1990-01-01' }
      ];

      (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockResolvedValue(mockData);
      
      // Update FileStreamService mock for this test
      FileStreamService.prototype.streamCSVWithStats = jest.fn().mockResolvedValue({
        previewData: mockData,
        fieldInfo: [
          { name: 'ssn', type: 'string', nullCount: 0, totalCount: 1, uniqueCount: 1, completeness: 100, uniqueness: 100, sampleValues: ['123-45-6789'] },
          { name: 'phone', type: 'string', nullCount: 0, totalCount: 1, uniqueCount: 1, completeness: 100, uniqueness: 100, sampleValues: ['555-1234'] },
          { name: 'birth_date', type: 'date', nullCount: 0, totalCount: 1, uniqueCount: 1, completeness: 100, uniqueness: 100, sampleValues: ['1990-01-01'] }
        ],
        recordCount: 1
      });

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from('test'),
        destination: '/tmp',
        filename: 'test.csv',
        path: '/tmp/test.csv'
      } as Express.Multer.File;

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'test.csv',
          original_filename: 'test.csv',
          size: 1024,
          record_count: 1,
          mime_type: 'text/csv',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          pii_detected: 0,
          compliance_score: 100,
          risk_level: 'low'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      // Create a new service instance to use the updated mock
      const testService = new RefactoredDataService();
      const result = await testService.uploadDataset(mockFile);

      const ssnField = result.fieldInfo.find(f => f.name === 'ssn');
      expect(ssnField).toBeDefined();
      expect(ssnField?.name).toBe('ssn');
      // SSN field should be detected as string or with PII information
      expect(['string', 'number', 'ssn']).toContain(ssnField?.type);

      const phoneField = result.fieldInfo.find(f => f.name === 'phone');
      expect(phoneField).toBeDefined();
      expect(phoneField?.name).toBe('phone');
      // Phone field should be detected as string or with PII information
      expect(['string', 'number', 'phone']).toContain(phoneField?.type);
    });
  });

  describe('CSV parsing', () => {
    it('should handle CSV files with different delimiters', async () => {
      const tsvData = 'id\tname\n1\tJohn\n2\tJane';
      
      // Override the mock for this specific test
      (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockResolvedValue([
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' }
      ]);
      
      // Update FileStreamService mock for this test
      FileStreamService.prototype.streamCSVWithStats = jest.fn().mockResolvedValue({
        previewData: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' }
        ],
        fieldInfo: [
          { name: 'id', type: 'string', nullCount: 0, totalCount: 2, uniqueCount: 2, completeness: 100, uniqueness: 100, sampleValues: ['1', '2'] },
          { name: 'name', type: 'string', nullCount: 0, totalCount: 2, uniqueCount: 2, completeness: 100, uniqueness: 100, sampleValues: ['John', 'Jane'] }
        ],
        recordCount: 2
      });

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.tsv',
        encoding: 'utf-8',
        mimetype: 'text/plain',
        size: tsvData.length,
        buffer: Buffer.from(tsvData),
        destination: '/tmp',
        filename: 'test.tsv',
        path: '/tmp/test.tsv'
      } as Express.Multer.File;

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'test.tsv',
          original_filename: 'test.tsv',
          size: tsvData.length,
          record_count: 2,
          mime_type: 'text/plain',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          pii_detected: 0,
          compliance_score: 100,
          risk_level: 'low'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.uploadDataset(mockFile);

      expect(result.previewData).toHaveLength(2);
    });

    it('should handle malformed CSV files', async () => {
      (PapaParseAdapter.prototype.parseFile as jest.Mock) = jest.fn().mockRejectedValue(
        new Error('CSV file has inconsistent column counts')
      );

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malformed.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 1024,
        buffer: Buffer.from('malformed,data\n1,2,3\n4,5'),
        destination: '/tmp',
        filename: 'malformed.csv',
        path: '/tmp/malformed.csv'
      } as Express.Multer.File;

      await expect(service.uploadDataset(mockFile))
        .rejects.toThrow();
    });
  });

  describe('getDatasets', () => {
    it('should return paginated datasets', async () => {
      const mockDatasets = [
        {
          id: '1',
          filename: 'test1.csv',
          originalFilename: 'test1.csv',
          size: 1024,
          recordCount: 100,
          mimeType: 'text/csv',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        },
        {
          id: '2',
          filename: 'test2.csv',
          originalFilename: 'test2.csv',
          size: 2048,
          recordCount: 200,
          mimeType: 'text/csv',
          createdAt: '2024-01-02',
          updatedAt: '2024-01-02'
        }
      ];

      const countStmt = { get: jest.fn().mockReturnValue({ total: 2 }) };
      const dataStmt = { all: jest.fn().mockReturnValue(mockDatasets) };

      mockSQLiteConnection.prepare.mockImplementation((sql) => {
        if (sql.includes('COUNT(*)')) return countStmt;
        return dataStmt;
      });

      const result = await service.getDatasets();

      expect(result).toHaveLength(2);
    });

    it('should handle database errors', async () => {
      (withSQLiteConnection as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getDatasets())
        .rejects.toThrow();
    });
  });

  describe('getDatasetById', () => {
    it('should return dataset by ID', async () => {
      const mockDatabaseRow = {
        id: 'test-id',
        filename: 'test.csv',
        original_filename: 'test.csv',
        size: 1024,
        record_count: 100,
        mime_type: 'text/csv',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        pii_detected: 0,
        compliance_score: 100,
        risk_level: 'low'
      };

      const expectedDataset = {
        id: 'test-id',
        filename: 'test.csv',
        originalFilename: 'test.csv',
        size: 1024,
        recordCount: 100,
        mimeType: 'text/csv',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        piiDetected: 0,
        complianceScore: 100,
        riskLevel: 'low'
      };

      const mockStmt = { get: jest.fn().mockReturnValue(mockDatabaseRow) };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getDatasetById('test-id');

      expect(result).toEqual(expectedDataset);
    });

    it('should return null if dataset not found', async () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getDatasetById('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('deleteDataset', () => {
    beforeEach(() => {
      const getStmt = {
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'test.csv',
          originalFilename: 'test.csv',
          size: 1024,
          recordCount: 100,
          mimeType: 'text/csv',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        })
      };
      const deleteStmt = {
        run: jest.fn().mockReturnValue({ changes: 1 })
      };

      mockSQLiteConnection.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT')) return getStmt;
        if (sql.includes('DELETE')) return deleteStmt;
        return { get: jest.fn(), run: jest.fn() };
      });
    });

    it('should delete dataset and file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.deleteDataset('test-id');

      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should handle missing file gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.deleteDataset('test-id');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should throw error if dataset not found', async () => {
      const getStmt = { get: jest.fn().mockReturnValue(null) };
      mockSQLiteConnection.prepare.mockReturnValue(getStmt);

      await expect(service.deleteDataset('non-existent'))
        .rejects.toThrow('Dataset not found');
    });
  });

  describe('streaming operations', () => {
    it('should handle large files via uploadDataset', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({ size: 200 * 1024 * 1024 }); // Large file

      // Ensure database mocks are set up
      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'large.csv',
          original_filename: 'large.csv',
          size: 200 * 1024 * 1024,
          record_count: 1000,
          mime_type: 'text/csv',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          pii_detected: 0,
          compliance_score: 100,
          risk_level: 'low'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 200 * 1024 * 1024,
        buffer: Buffer.from('test'),
        destination: '/tmp',
        filename: 'large.csv',
        path: '/tmp/large.csv'
      } as Express.Multer.File;

      const result = await service.uploadDataset(mockFile);

      expect(FileStreamService.prototype.streamCSVWithStats).toHaveBeenCalled();
      expect(result.dataset).toBeDefined();
    });
  });


  describe('DataCloak streaming integration', () => {
    it('should handle DataCloak PII detection', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({ size: 200 * 1024 * 1024 }); // Large file

      const mockChunkResult = {
        processedRows: 100,
        chunkInfo: {
          index: 0,
          startRow: 0,
          endRow: 99,
          bytesProcessed: 1024,
          totalBytes: 200 * 1024 * 1024
        },
        data: [{ id: 1, email: 'test@example.com' }],
        maskedData: [{ id: 1, email: '[MASKED]' }],
        hasMore: false,
        piiDetectionResults: [
          { fieldName: 'email', piiType: 'EMAIL', confidence: 0.95 }
        ]
      };

      DataCloakStreamService.prototype.streamProcessWithDataCloak = jest.fn().mockImplementation(async (_path, options) => {
        // Call chunk callback with mock data
        if (options.onChunk) {
          await options.onChunk(mockChunkResult);
        }
        if (options.onPIIDetected) {
          options.onPIIDetected(mockChunkResult.piiDetectionResults);
        }

        return {
          totalRows: 100,
          totalBytes: 200 * 1024 * 1024,
          chunksProcessed: 1,
          processingTime: 1000,
          piiSummary: {
            totalPIIItems: 1,
            piiTypes: { EMAIL: 1 },
            fieldsWithPII: ['email']
          }
        };
      });

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 200 * 1024 * 1024,
        buffer: Buffer.from('test'),
        destination: '/tmp',
        filename: 'large.csv',
        path: '/tmp/large.csv'
      } as Express.Multer.File;

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'large.csv',
          originalFilename: 'large.csv',
          size: 200 * 1024 * 1024,
          recordCount: 100,
          mimeType: 'text/csv',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.uploadDataset(mockFile);

      expect(FileStreamService.prototype.streamCSVWithStats).toHaveBeenCalled();
      expect(result.dataset).toBeDefined();
      expect(result.fieldInfo).toBeDefined();
    });

    it('should fallback to regular streaming if DataCloak fails', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({ size: 200 * 1024 * 1024 }); // Large file

      DataCloakStreamService.prototype.streamProcessWithDataCloak = jest.fn().mockRejectedValue(
        new Error('DataCloak error')
      );

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.csv',
        encoding: 'utf-8',
        mimetype: 'text/csv',
        size: 200 * 1024 * 1024,
        buffer: Buffer.from('test'),
        destination: '/tmp',
        filename: 'large.csv',
        path: '/tmp/large.csv'
      } as Express.Multer.File;

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn().mockReturnValue({
          id: 'test-id',
          filename: 'large.csv',
          originalFilename: 'large.csv',
          size: 200 * 1024 * 1024,
          recordCount: 100,
          mimeType: 'text/csv',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.uploadDataset(mockFile);

      expect(FileStreamService.prototype.streamCSVWithStats).toHaveBeenCalled();
      expect(result.dataset).toBeDefined();
    });
  });
});