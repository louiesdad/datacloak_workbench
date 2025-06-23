import { SentimentService } from '../../src/services/sentiment.service';
import { DataService } from '../../src/services/data.service';
import { getSQLiteConnection } from '../../src/database/sqlite-refactored';
import { initializeDatabases } from '../../src/database';

// Mock the database
jest.mock('../../src/database/sqlite-refactored');

describe('Service Edge Cases', () => {
  describe('SentimentService Edge Cases', () => {
    let sentimentService: SentimentService;

    beforeEach(() => {
      sentimentService = new SentimentService();
    });

    it('should handle database connection failure in analyzeSentiment', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(
        sentimentService.analyzeSentiment('Test text')
      ).rejects.toThrow('Database connection not available');
    });

    it('should handle database connection failure in batchAnalyzeSentiment', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(
        sentimentService.batchAnalyzeSentiment(['Test text'])
      ).rejects.toThrow('Database connection not available');
    });

    it('should handle database connection failure in getAnalysisHistory', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(
        sentimentService.getAnalysisHistory(1, 10)
      ).rejects.toThrow('Database connection not available');
    });

    it('should handle database connection failure in getStatistics', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(
        sentimentService.getStatistics()
      ).rejects.toThrow('Database connection not available');
    });

    it('should analyze text with mixed positive and negative words', () => {
      const service = new (sentimentService.constructor as any)();
      const performAnalysis = service.performSentimentAnalysis.bind(service);
      
      const result = performAnalysis('This is good but also bad and terrible');
      
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
    });

    it('should handle empty texts in batch analysis', async () => {
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockReturnValue({ lastInsertRowid: 1 })
        }),
        transaction: jest.fn().mockImplementation((fn) => fn)
      };
      (getSQLiteConnection as jest.Mock).mockReturnValue(mockDb);

      const result = await sentimentService.batchAnalyzeSentiment(['Valid text', '', '   ', 'Another valid text']);
      
      expect(result).toHaveLength(2); // Only valid texts should be processed
      expect(result[0].text).toBe('Valid text');
      expect(result[1].text).toBe('Another valid text');
    });
  });

  describe('DataService Edge Cases', () => {
    let dataService: DataService;

    beforeAll(async () => {
      await initializeDatabases();
      dataService = new DataService();
    });

    it('should handle database connection failure in uploadDataset', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      const mockFile = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        size: 100,
        buffer: Buffer.from('name,age\nJohn,30')
      } as Express.Multer.File;

      await expect(
        dataService.uploadDataset(mockFile)
      ).rejects.toThrow('Database connection not available');
    });

    it('should analyze fields with various data types', () => {
      const testData = [
        { 
          stringField: 'hello',
          intField: '123',
          floatField: '45.67',
          dateField: '2023-12-25',
          boolField: 'true',
          nullField: null,
          emptyField: '',
          mixedField: '123abc'
        }
      ];

      // Access private method for testing
      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      expect(fieldInfo).toHaveLength(8);
      
      const stringField = fieldInfo.find((f: any) => f.name === 'stringField');
      expect(stringField.type).toBe('string');
      
      const intField = fieldInfo.find((f: any) => f.name === 'intField');
      expect(intField.type).toBe('integer');
      
      const floatField = fieldInfo.find((f: any) => f.name === 'floatField');
      expect(floatField.type).toBe('number');
      
      const dateField = fieldInfo.find((f: any) => f.name === 'dateField');
      expect(dateField.type).toBe('date');
      
      const boolField = fieldInfo.find((f: any) => f.name === 'boolField');
      expect(boolField.type).toBe('boolean');
      
      const nullField = fieldInfo.find((f: any) => f.name === 'nullField');
      expect(nullField.nullCount).toBe(1);
      
      const emptyField = fieldInfo.find((f: any) => f.name === 'emptyField');
      expect(emptyField.nullCount).toBe(1);
      
      const mixedField = fieldInfo.find((f: any) => f.name === 'mixedField');
      expect(mixedField.type).toBe('string');
    });

    it('should handle file analysis with boolean variations', () => {
      const testData = [
        { boolField: 'true' },
        { boolField: 'false' },
        { boolField: 'True' },
        { boolField: 'False' },
        { boolField: 'TRUE' },
        { boolField: 'FALSE' },
        { boolField: '1' },
        { boolField: '0' },
        { boolField: 'yes' },
        { boolField: 'no' }
      ];

      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      const boolField = fieldInfo.find((f: any) => f.name === 'boolField');
      expect(boolField.type).toBe('boolean');
    });

    it('should handle large numbers correctly', () => {
      const testData = [
        { bigInt: '999999999999', bigFloat: '999999.999999' },
        { bigInt: '1000000000000', bigFloat: '1000000.000000' }
      ];

      const analyzeFields = (dataService as any).analyzeFields.bind(dataService);
      const fieldInfo = analyzeFields(testData);

      const bigIntField = fieldInfo.find((f: any) => f.name === 'bigInt');
      expect(['integer', 'number']).toContain(bigIntField.type);
      
      const bigFloatField = fieldInfo.find((f: any) => f.name === 'bigFloat');
      expect(bigFloatField.type).toBe('number');
    });
  });
});