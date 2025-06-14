import { DataService } from '../../src/services/data.service';
import { initializeDatabases } from '../../src/database';

describe('DataService', () => {
  let dataService: DataService;

  beforeAll(async () => {
    await initializeDatabases();
    dataService = new DataService();
  });

  describe('File Analysis', () => {
    it('should analyze CSV field types correctly', () => {
      const testData = [
        { id: '1', name: 'John', age: '30', email: 'john@test.com', active: 'true' },
        { id: '2', name: 'Jane', age: '25', email: 'jane@test.com', active: 'false' },
        { id: '3', name: 'Bob', age: '35', email: 'bob@test.com', active: 'true' }
      ];

      // Access private method for testing
      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      expect(fieldInfo).toHaveLength(5);
      expect(fieldInfo[0]).toMatchObject({
        name: 'id',
        type: 'integer',
        sampleValues: ['1', '2', '3'],
        nullCount: 0
      });
      expect(fieldInfo[1]).toMatchObject({
        name: 'name',
        type: 'string',
        nullCount: 0
      });
      expect(fieldInfo[2]).toMatchObject({
        name: 'age',
        type: 'integer',
        nullCount: 0
      });
      expect(fieldInfo[3]).toMatchObject({
        name: 'email',
        type: 'string',
        nullCount: 0
      });
      expect(fieldInfo[4]).toMatchObject({
        name: 'active',
        type: 'boolean',
        nullCount: 0
      });
    });

    it('should handle null values in field analysis', () => {
      const testData = [
        { name: 'John', score: '85', notes: null },
        { name: 'Jane', score: null, notes: 'Good work' },
        { name: '', score: '92', notes: 'Excellent' }
      ];

      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      expect(fieldInfo[0]).toMatchObject({
        name: 'name',
        nullCount: 1 // Empty string counts as null
      });
      expect(fieldInfo[1]).toMatchObject({
        name: 'score',
        nullCount: 1
      });
      expect(fieldInfo[2]).toMatchObject({
        name: 'notes',
        nullCount: 1
      });
    });

    it('should detect number types correctly', () => {
      const testData = [
        { intCol: '123', floatCol: '45.67', stringCol: 'abc123' },
        { intCol: '456', floatCol: '89.12', stringCol: 'def456' }
      ];

      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      expect(fieldInfo[0].type).toBe('integer');
      expect(fieldInfo[1].type).toBe('number');
      expect(fieldInfo[2].type).toBe('string');
    });

    it('should detect date types', () => {
      const testData = [
        { dateCol: '2023-12-25', timeCol: '2023-12-25T10:30:00Z' },
        { dateCol: '2024-01-01', timeCol: '2024-01-01T15:45:30Z' }
      ];

      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      expect(fieldInfo[0].type).toBe('date');
      expect(fieldInfo[1].type).toBe('date');
    });
  });

  describe('Dataset Management', () => {
    let testDatasetId: string;

    it('should upload and process CSV file', async () => {
      const csvContent = 'name,age,email\nJohn,30,john@test.com\nJane,25,jane@test.com';
      const mockFile = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent)
      } as Express.Multer.File;

      const result = await dataService.uploadDataset(mockFile);

      expect(result).toHaveProperty('dataset');
      expect(result).toHaveProperty('previewData');
      expect(result).toHaveProperty('fieldInfo');

      expect(result.dataset).toMatchObject({
        originalFilename: 'test.csv',
        size: csvContent.length,
        recordCount: 2
      });

      expect(result.previewData).toHaveLength(2);
      expect(result.fieldInfo).toHaveLength(3);

      testDatasetId = result.dataset.id;
    });

    it('should retrieve dataset by ID', () => {
      if (!testDatasetId) {
        throw new Error('Test dataset ID not available');
      }

      const dataset = dataService.getDatasetById(testDatasetId);

      expect(dataset).toMatchObject({
        id: testDatasetId,
        originalFilename: 'test.csv',
        recordCount: 2
      });
    });

    it('should list datasets with pagination', async () => {
      const result = await dataService.getDatasets(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should delete dataset', async () => {
      if (!testDatasetId) {
        throw new Error('Test dataset ID not available');
      }

      await expect(dataService.deleteDataset(testDatasetId)).resolves.not.toThrow();

      // Verify dataset is deleted
      expect(() => dataService.getDatasetById(testDatasetId)).toThrow('Dataset not found');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for missing file', async () => {
      await expect(dataService.uploadDataset(null as any)).rejects.toThrow('No file provided');
    });

    it('should throw error for unsupported file type', async () => {
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('some text')
      } as Express.Multer.File;

      // Note: Our service actually supports text/plain, so let's use a truly unsupported type
      mockFile.mimetype = 'image/png';

      await expect(dataService.uploadDataset(mockFile)).rejects.toThrow('Unsupported file type');
    });

    it('should throw error for non-existent dataset', () => {
      expect(() => dataService.getDatasetById('non-existent-id')).toThrow('Dataset not found');
    });

    it('should throw error when deleting non-existent dataset', async () => {
      await expect(dataService.deleteDataset('non-existent-id')).rejects.toThrow('Dataset not found');
    });
  });

  describe('Export Functionality', () => {
    it('should create export request', async () => {
      const result = await dataService.exportData('csv');

      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result.downloadUrl).toContain('export-');
      expect(result.downloadUrl).toContain('.csv');
    });

    it('should support different export formats', async () => {
      const csvExport = await dataService.exportData('csv');
      const jsonExport = await dataService.exportData('json');
      const xlsxExport = await dataService.exportData('xlsx');

      expect(csvExport.downloadUrl).toContain('.csv');
      expect(jsonExport.downloadUrl).toContain('.json');
      expect(xlsxExport.downloadUrl).toContain('.xlsx');
    });
  });

  describe('Analysis Batch Management', () => {
    let testDatasetId: string;
    let testBatchId: string;

    beforeAll(async () => {
      // Create a test dataset first
      const csvContent = 'text,category\nHello world,greeting\nGoodbye,farewell';
      const mockFile = {
        originalname: 'batch-test.csv',
        mimetype: 'text/csv',
        size: csvContent.length,
        buffer: Buffer.from(csvContent)
      } as Express.Multer.File;

      const result = await dataService.uploadDataset(mockFile);
      testDatasetId = result.dataset.id;
    });

    it('should create analysis batch', async () => {
      const batch = await dataService.createAnalysisBatch(testDatasetId);

      expect(batch).toMatchObject({
        datasetId: testDatasetId,
        status: 'pending',
        progress: 0,
        totalRecords: 2,
        completedRecords: 0
      });

      testBatchId = batch.id;
    });

    it('should update batch progress', async () => {
      await expect(
        dataService.updateAnalysisBatchProgress(testBatchId, 1, 'processing')
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent dataset in batch creation', async () => {
      await expect(
        dataService.createAnalysisBatch('non-existent-dataset')
      ).rejects.toThrow('Dataset not found');
    });

    afterAll(async () => {
      // Cleanup
      if (testDatasetId) {
        await dataService.deleteDataset(testDatasetId);
      }
    });
  });
});