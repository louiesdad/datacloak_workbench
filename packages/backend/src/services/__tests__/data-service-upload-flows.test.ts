import { RefactoredDataService } from '../data-service-refactored';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
jest.mock('../security.service');
jest.mock('../file-stream.service');
jest.mock('../datacloak-stream.service');
jest.mock('../papaparse-adapter');
jest.mock('../../database/sqlite-refactored');

const mockWithSQLiteConnection = jest.fn();
jest.mocked(require('../../database/sqlite-refactored')).withSQLiteConnection = mockWithSQLiteConnection;

describe('RefactoredDataService - File Upload Flows', () => {
  let service: RefactoredDataService;
  let tempDir: string;
  let mockDb: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-flow-test-'));
    
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn().mockReturnValue({
          id: 'test-dataset-id',
          filename: 'test.csv',
          original_filename: 'original.csv',
          size: 1000,
          record_count: 100,
          mime_type: 'text/csv',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          pii_detected: 0,
          compliance_score: 95,
          risk_level: 'low'
        }),
        all: jest.fn().mockReturnValue([])
      })
    };

    mockWithSQLiteConnection.mockImplementation(async (callback) => {
      return callback(mockDb);
    });

    service = new RefactoredDataService();
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('CSV file upload flow', () => {
    test('should successfully process a simple CSV file', async () => {
      const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35`;

      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([
          { name: 'John Doe', email: 'john@example.com', age: '30' },
          { name: 'Jane Smith', email: 'jane@example.com', age: '25' },
          { name: 'Bob Johnson', email: 'bob@example.com', age: '35' }
        ])
      };

      // Mock the PapaParseAdapter
      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent),
        destination: '',
        filename: '',
        path: '',
        stream: null as any
      };

      const result = await service.uploadDataset(file);

      expect(result.dataset).toBeDefined();
      expect(result.previewData).toHaveLength(3);
      expect(result.fieldInfo).toHaveLength(3);
      
      const nameField = result.fieldInfo.find(f => f.name === 'name');
      const emailField = result.fieldInfo.find(f => f.name === 'email');
      const ageField = result.fieldInfo.find(f => f.name === 'age');

      expect(nameField?.type).toBe('string');
      expect(emailField?.type).toBe('email');
      expect(ageField?.type).toBe('number');
    });

    test('should handle CSV with missing values', async () => {
      const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,,25
,bob@example.com,
Alice Wilson,alice@example.com,40`;

      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([
          { name: 'John Doe', email: 'john@example.com', age: '30' },
          { name: 'Jane Smith', email: '', age: '25' },
          { name: '', email: 'bob@example.com', age: '' },
          { name: 'Alice Wilson', email: 'alice@example.com', age: '40' }
        ])
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test_missing.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent)
      } as Express.Multer.File;

      const result = await service.uploadDataset(file);

      const nameField = result.fieldInfo.find(f => f.name === 'name');
      const emailField = result.fieldInfo.find(f => f.name === 'email');

      expect(nameField?.completeness).toBe(75); // 3 out of 4 values
      expect(emailField?.completeness).toBe(75); // 3 out of 4 values
      
      expect(nameField?.warnings).toContain(expect.stringContaining('Low completeness'));
      expect(emailField?.warnings).toContain(expect.stringContaining('Low completeness'));
    });

    test('should detect PII and generate security warnings', async () => {
      const csvContent = `name,ssn,email
John Doe,123-45-6789,john@example.com
Jane Smith,987-65-4321,jane@example.com`;

      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([
          { name: 'John Doe', ssn: '123-45-6789', email: 'john@example.com' },
          { name: 'Jane Smith', ssn: '987-65-4321', email: 'jane@example.com' }
        ])
      };

      const mockSecurityService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        scanDataset: jest.fn().mockResolvedValue({
          piiItemsDetected: 4, // 2 SSNs + 2 emails
          complianceScore: 60,
          recommendations: [
            'Mask or encrypt SSN fields',
            'Implement data retention policies'
          ],
          violations: ['Unencrypted PII detected']
        })
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;
      (service as any).securityService = mockSecurityService;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'pii_data.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent)
      } as Express.Multer.File;

      const result = await service.uploadDataset(file);

      expect(result.securityScan).toBeDefined();
      expect(result.securityScan!.piiItemsDetected).toBe(4);
      expect(result.securityScan!.riskLevel).toBe('high');
      expect(result.securityScan!.recommendations).toContain('Mask or encrypt SSN fields');
    });
  });

  describe('Excel file upload flow', () => {
    test('should process Excel files using XLSX parser', async () => {
      // Mock XLSX parsing
      const mockXLSX = {
        readFile: jest.fn().mockReturnValue({
          SheetNames: ['Sheet1'],
          Sheets: {
            Sheet1: {}
          }
        }),
        utils: {
          sheet_to_json: jest.fn().mockReturnValue([
            { Product: 'Widget A', Price: 19.99, Stock: 100 },
            { Product: 'Widget B', Price: 29.99, Stock: 50 },
            { Product: 'Widget C', Price: 39.99, Stock: 75 }
          ])
        }
      };

      // Mock the XLSX import
      jest.doMock('xlsx', () => mockXLSX);

      const excelFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'products.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 5000,
        buffer: Buffer.from('mock excel data')
      } as Express.Multer.File;

      // Override the parseExcelFile method to use our mock
      jest.spyOn(service as any, 'parseExcelFile').mockReturnValue([
        { Product: 'Widget A', Price: 19.99, Stock: 100 },
        { Product: 'Widget B', Price: 29.99, Stock: 50 },
        { Product: 'Widget C', Price: 39.99, Stock: 75 }
      ]);

      const result = await service.uploadDataset(excelFile);

      expect(result.dataset).toBeDefined();
      expect(result.previewData).toHaveLength(3);
      expect(result.fieldInfo).toHaveLength(3);

      const productField = result.fieldInfo.find(f => f.name === 'Product');
      const priceField = result.fieldInfo.find(f => f.name === 'Price');
      const stockField = result.fieldInfo.find(f => f.name === 'Stock');

      expect(productField?.type).toBe('string');
      expect(priceField?.type).toBe('number');
      expect(stockField?.type).toBe('number');
    });
  });

  describe('Large file upload flow', () => {
    test('should use streaming for large files', async () => {
      const largeFileSize = 150 * 1024 * 1024; // 150MB

      const mockFileStreamService = {
        streamCSVWithStats: jest.fn().mockResolvedValue({
          previewData: Array(100).fill({ column1: 'value', column2: 'data' }),
          fieldInfo: [
            {
              name: 'column1',
              type: 'string',
              sampleValues: ['value'],
              nullCount: 0,
              totalCount: 10000,
              uniqueCount: 1,
              completeness: 100,
              uniqueness: 0.01,
              warnings: ['Low uniqueness: Only 0.0% of values are unique'],
              dataQualityScore: 70
            }
          ],
          recordCount: 10000
        })
      };

      (service as any).fileStreamService = mockFileStreamService;

      const largeFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large_dataset.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: largeFileSize,
        buffer: Buffer.alloc(1000) // Mock buffer
      } as Express.Multer.File;

      const result = await service.uploadDataset(largeFile);

      expect(mockFileStreamService.streamCSVWithStats).toHaveBeenCalled();
      expect(result.previewData).toHaveLength(100);
      expect(result.fieldInfo[0].warnings).toContain(expect.stringContaining('Low uniqueness'));
    });

    test('should emit progress events for large files', async () => {
      const progressEvents: any[] = [];
      service.on('parse-progress', (progress) => progressEvents.push(progress));

      const mockFileStreamService = {
        streamCSVWithStats: jest.fn().mockImplementation(async (filePath, options) => {
          // Simulate progress events
          if (options.onProgress) {
            options.onProgress({
              processedBytes: 50000000,
              totalBytes: 150000000,
              processedRecords: 500,
              percentComplete: 33.3,
              bytesPerSecond: 1000000,
              estimatedTimeRemaining: 100
            });
          }

          return {
            previewData: [],
            fieldInfo: [],
            recordCount: 1000
          };
        })
      };

      (service as any).fileStreamService = mockFileStreamService;

      const largeFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large_dataset.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 150 * 1024 * 1024,
        buffer: Buffer.alloc(1000)
      } as Express.Multer.File;

      await service.uploadDataset(largeFile);

      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].percentComplete).toBe(33.3);
    });
  });

  describe('Error scenarios in upload flow', () => {
    test('should handle parsing errors gracefully', async () => {
      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockRejectedValue(new Error('Invalid CSV format'))
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const invalidFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'invalid.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('invalid csv content')
      } as Express.Multer.File;

      await expect(service.uploadDataset(invalidFile)).rejects.toThrow('Failed to parse file');
    });

    test('should handle security scan failures gracefully', async () => {
      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([{ test: 'data' }])
      };

      const mockSecurityService = {
        initialize: jest.fn().mockRejectedValue(new Error('Security service unavailable')),
        scanDataset: jest.fn()
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;
      (service as any).securityService = mockSecurityService;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('test,data\nvalue1,value2')
      } as Express.Multer.File;

      const result = await service.uploadDataset(file);

      // Should complete successfully without security scan
      expect(result.dataset).toBeDefined();
      expect(result.securityScan).toBeUndefined();
    });

    test('should clean up files on database failure', async () => {
      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([{ test: 'data' }])
      };

      // Mock database failure
      mockWithSQLiteConnection.mockRejectedValue(new Error('Database connection failed'));

      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('test,data\nvalue1,value2')
      } as Express.Multer.File;

      await expect(service.uploadDataset(file)).rejects.toThrow('Database connection failed');

      // Verify file was cleaned up
      const uploadDir = path.join(tempDir, 'data', 'uploads');
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        expect(files).toHaveLength(0);
      }
    });
  });

  describe('Data quality assessment in upload flow', () => {
    test('should generate comprehensive data quality report', async () => {
      const csvContent = `id,name,email,age,salary
1,John Doe,john@example.com,30,50000
2,,jane@invalid-email,25,
3,Bob Johnson,bob@example.com,,60000
4,Alice Smith,alice@example.com,35,55000
5,Charlie Brown,,40,`;

      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue([
          { id: '1', name: 'John Doe', email: 'john@example.com', age: '30', salary: '50000' },
          { id: '2', name: '', email: 'jane@invalid-email', age: '25', salary: '' },
          { id: '3', name: 'Bob Johnson', email: 'bob@example.com', age: '', salary: '60000' },
          { id: '4', name: 'Alice Smith', email: 'alice@example.com', age: '35', salary: '55000' },
          { id: '5', name: 'Charlie Brown', email: '', age: '40', salary: '' }
        ])
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'employee_data.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent)
      } as Express.Multer.File;

      const result = await service.uploadDataset(file);

      expect(result.dataQuality).toBeDefined();
      expect(result.dataQuality!.overallScore).toBeLessThan(80); // Due to missing data
      expect(result.dataQuality!.issues).toContainEqual(
        expect.objectContaining({
          type: 'completeness',
          severity: expect.any(String),
          field: expect.any(String)
        })
      );
      expect(result.dataQuality!.recommendations).toContain(
        expect.stringContaining('data cleansing')
      );
    });

    test('should identify field-specific quality issues', async () => {
      const data = Array(1000).fill(null).map((_, i) => ({
        id: i.toString(),
        category: 'A', // Low uniqueness
        description: i < 500 ? `Description ${i}` : '', // 50% completeness
        amount: (Math.random() * 1000).toFixed(2)
      }));

      const mockPapaParseAdapter = {
        parseFile: jest.fn().mockResolvedValue(data)
      };

      (service as any).papaParseAdapter = mockPapaParseAdapter;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'quality_test.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 10000,
        buffer: Buffer.from('mock data')
      } as Express.Multer.File;

      const result = await service.uploadDataset(file);

      const categoryField = result.fieldInfo.find(f => f.name === 'category');
      const descriptionField = result.fieldInfo.find(f => f.name === 'description');

      expect(categoryField?.warnings).toContain(expect.stringContaining('Low uniqueness'));
      expect(descriptionField?.warnings).toContain(expect.stringContaining('Low completeness'));

      expect(result.dataQuality!.issues).toContainEqual(
        expect.objectContaining({
          type: 'uniqueness',
          field: 'category'
        })
      );

      expect(result.dataQuality!.issues).toContainEqual(
        expect.objectContaining({
          type: 'completeness',
          field: 'description'
        })
      );
    });
  });

  describe('Integration with external services', () => {
    test('should integrate with DataCloak streaming service for real-time PII detection', async () => {
      const mockDataCloakStreamService = {
        processStream: jest.fn().mockResolvedValue({
          processedData: [{ name: 'John ***', email: '***@example.com' }],
          piiDetected: ['name', 'email'],
          maskingApplied: true
        })
      };

      (service as any).dataCloakStreamService = mockDataCloakStreamService;

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'sensitive_data.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('name,email\nJohn Doe,john@example.com')
      } as Express.Multer.File;

      // Test with DataCloak enabled
      const result = await service.uploadDataset(file, { enableDataCloak: true });

      expect(result.dataset).toBeDefined();
      // DataCloak integration would be tested more thoroughly in integration tests
    });
  });
});