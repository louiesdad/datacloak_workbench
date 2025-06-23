/**
 * Data Profiling Service Tests
 * Developer 1: File Upload & Data Profiling Test Suite (Part 2/3)
 * Tests 6-10: Data profiling and analysis functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DataService, FieldStatistics } from '../data.service';
import { factories } from '../../../tests/factories';
import { withSQLiteConnection } from '../../database/sqlite-refactored';

describe('Data Profiling Service', () => {
  let dataService: DataService;
  let testDataset: any;

  beforeEach(async () => {
    dataService = new DataService();
    
    // Create test dataset with known data patterns
    testDataset = factories.dataset.create({
      overrides: {
        recordCount: 1000,
        originalFilename: 'profiling-test.csv'
      }
    });

    // Insert test data into database for profiling
    await withSQLiteConnection(async (db) => {
      // Create dataset
      db.prepare(`
        INSERT INTO datasets (id, filename, original_filename, size, record_count, mime_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        testDataset.id,
        testDataset.filename,
        testDataset.originalFilename,
        testDataset.size,
        testDataset.recordCount,
        testDataset.mimeType,
        testDataset.createdAt,
        testDataset.updatedAt
      );

      // Insert sample data with various patterns for profiling
      const insertData = db.prepare(`
        INSERT INTO raw_data (dataset_id, row_index, data) VALUES (?, ?, ?)
      `);

      for (let i = 0; i < 100; i++) {
        const data = {
          name: i < 50 ? `User ${i}` : null, // 50% completeness
          email: `user${i}@example.com`,
          age: Math.floor(Math.random() * 80) + 18,
          city: ['New York', 'London', 'Tokyo', 'Sydney'][i % 4],
          score: Math.random() * 100,
          is_active: i % 2 === 0,
          notes: i < 20 ? `Note ${i}` : null, // 20% completeness
          ssn: `${String(i).padStart(3, '0')}-${String(i).padStart(2, '0')}-${String(i).padStart(4, '0')}` // PII pattern
        };
        insertData.run(testDataset.id, i, JSON.stringify(data));
      }
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await withSQLiteConnection(async (db) => {
      db.prepare('DELETE FROM raw_data WHERE dataset_id = ?').run(testDataset.id);
      db.prepare('DELETE FROM datasets WHERE id = ?').run(testDataset.id);
    });
  });

  describe('Test 6: Basic Data Profiling', () => {
    test('should generate comprehensive field statistics', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      expect(profile).toBeDefined();
      expect(profile.fields).toHaveLength(8); // 8 fields in test data
      
      // Check for expected field names
      const fieldNames = profile.fields.map((f: FieldStatistics) => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('age');
      expect(fieldNames).toContain('city');
    });

    test('should calculate field completeness correctly', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const nameField = profile.fields.find((f: FieldStatistics) => f.name === 'name');
      const emailField = profile.fields.find((f: FieldStatistics) => f.name === 'email');
      const notesField = profile.fields.find((f: FieldStatistics) => f.name === 'notes');
      
      expect(nameField?.completeness).toBe(50); // 50% non-null
      expect(emailField?.completeness).toBe(100); // 100% non-null
      expect(notesField?.completeness).toBe(20); // 20% non-null
    });

    test('should detect data types correctly', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const fieldTypes = profile.fields.reduce((acc: any, field: FieldStatistics) => {
        acc[field.name] = field.type;
        return acc;
      }, {});

      expect(fieldTypes.name).toBe('string');
      expect(fieldTypes.email).toBe('string');
      expect(fieldTypes.age).toBe('number');
      expect(fieldTypes.is_active).toBe('boolean');
      expect(fieldTypes.score).toBe('number');
    });
  });

  describe('Test 7: Statistical Analysis', () => {
    test('should calculate uniqueness statistics', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const emailField = profile.fields.find((f: FieldStatistics) => f.name === 'email');
      const cityField = profile.fields.find((f: FieldStatistics) => f.name === 'city');
      
      expect(emailField?.uniqueness).toBe(100); // All emails unique
      expect(cityField?.uniqueness).toBe(4); // 4 unique cities out of 100 records
      expect(cityField?.mostCommonValue).toBeDefined();
      expect(cityField?.mostCommonValueCount).toBeGreaterThan(20);
    });

    test('should identify string length patterns', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const emailField = profile.fields.find((f: FieldStatistics) => f.name === 'email');
      const ssnField = profile.fields.find((f: FieldStatistics) => f.name === 'ssn');
      
      expect(emailField?.minLength).toBeDefined();
      expect(emailField?.maxLength).toBeDefined();
      expect(emailField?.averageLength).toBeDefined();
      
      // SSN should have consistent length
      expect(ssnField?.minLength).toBe(ssnField?.maxLength);
      expect(ssnField?.minLength).toBe(11); // XXX-XX-XXXX format
    });

    test('should provide sample values for inspection', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      for (const field of profile.fields) {
        expect(field.sampleValues).toBeDefined();
        expect(field.sampleValues.length).toBeGreaterThan(0);
        expect(field.sampleValues.length).toBeLessThanOrEqual(10); // Max 10 samples
      }
    });
  });

  describe('Test 8: PII Detection in Profiling', () => {
    test('should detect PII patterns in fields', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const emailField = profile.fields.find((f: FieldStatistics) => f.name === 'email');
      const ssnField = profile.fields.find((f: FieldStatistics) => f.name === 'ssn');
      const nameField = profile.fields.find((f: FieldStatistics) => f.name === 'name');
      
      expect(emailField?.piiDetected).toBe(true);
      expect(emailField?.piiType).toBe('email');
      
      expect(ssnField?.piiDetected).toBe(true);
      expect(ssnField?.piiType).toBe('ssn');
      
      expect(nameField?.piiDetected).toBe(true);
      expect(nameField?.piiType).toBe('name');
    });

    test('should flag fields with potential data quality issues', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      const notesField = profile.fields.find((f: FieldStatistics) => f.name === 'notes');
      
      expect(notesField?.warnings).toBeDefined();
      expect(notesField?.warnings).toContain('High null percentage (80%)');
    });

    test('should provide security recommendations', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      expect(profile.securityRecommendations).toBeDefined();
      expect(profile.securityRecommendations.length).toBeGreaterThan(0);
      
      const recommendations = profile.securityRecommendations.join(' ');
      expect(recommendations).toContain('email');
      expect(recommendations).toContain('masking');
    });
  });

  describe('Test 9: Performance Profiling', () => {
    test('should handle large dataset profiling efficiently', async () => {
      // Create larger test dataset
      const largeDatasetId = 'large-test-dataset';
      
      await withSQLiteConnection(async (db) => {
        // Insert dataset
        db.prepare(`
          INSERT INTO datasets (id, filename, original_filename, size, record_count, mime_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          largeDatasetId,
          'large-test.csv',
          'large-test.csv',
          1000000,
          10000,
          'text/csv',
          new Date().toISOString(),
          new Date().toISOString()
        );

        // Insert large amount of data
        const insertData = db.prepare(`
          INSERT INTO raw_data (dataset_id, row_index, data) VALUES (?, ?, ?)
        `);

        for (let i = 0; i < 1000; i++) {
          const data = {
            id: i,
            value: Math.random() * 1000,
            category: `Category ${i % 10}`
          };
          insertData.run(largeDatasetId, i, JSON.stringify(data));
        }
      });

      const startTime = Date.now();
      const profile = await dataService.profileDataset(largeDatasetId);
      const endTime = Date.now();
      
      expect(profile).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Cleanup
      await withSQLiteConnection(async (db) => {
        db.prepare('DELETE FROM raw_data WHERE dataset_id = ?').run(largeDatasetId);
        db.prepare('DELETE FROM datasets WHERE id = ?').run(largeDatasetId);
      });
    });

    test('should support streaming profiling for memory efficiency', async () => {
      const options = {
        streamingMode: true,
        chunkSize: 100,
        maxMemoryUsage: 50 // 50MB limit
      };

      const profile = await dataService.profileDataset(testDataset.id, options);
      
      expect(profile).toBeDefined();
      expect(profile.processingMethod).toBe('streaming');
      expect(profile.chunksProcessed).toBeGreaterThan(0);
    });
  });

  describe('Test 10: Profile Export and Reporting', () => {
    test('should export profiling results in multiple formats', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      // Test JSON export
      const jsonExport = await dataService.exportProfile(testDataset.id, 'json');
      expect(jsonExport.format).toBe('json');
      expect(jsonExport.data).toContain('"fields"');
      
      // Test CSV export
      const csvExport = await dataService.exportProfile(testDataset.id, 'csv');
      expect(csvExport.format).toBe('csv');
      expect(csvExport.data).toContain('field_name,data_type,completeness');
      
      // Test HTML report
      const htmlExport = await dataService.exportProfile(testDataset.id, 'html');
      expect(htmlExport.format).toBe('html');
      expect(htmlExport.data).toContain('<html>');
      expect(htmlExport.data).toContain('Data Profiling Report');
    });

    test('should generate summary statistics', async () => {
      const profile = await dataService.profileDataset(testDataset.id);
      
      expect(profile.summary).toBeDefined();
      expect(profile.summary.totalFields).toBe(8);
      expect(profile.summary.totalRecords).toBe(100);
      expect(profile.summary.piiFieldsCount).toBeGreaterThan(0);
      expect(profile.summary.dataQualityScore).toBeDefined();
      expect(profile.summary.dataQualityScore).toBeGreaterThanOrEqual(0);
      expect(profile.summary.dataQualityScore).toBeLessThanOrEqual(100);
    });

    test('should support profile comparison between datasets', async () => {
      // Create second dataset for comparison
      const dataset2 = factories.dataset.create({
        overrides: {
          recordCount: 50,
          originalFilename: 'comparison-test.csv'
        }
      });

      await withSQLiteConnection(async (db) => {
        // Insert comparison dataset
        db.prepare(`
          INSERT INTO datasets (id, filename, original_filename, size, record_count, mime_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          dataset2.id,
          dataset2.filename,
          dataset2.originalFilename,
          dataset2.size,
          dataset2.recordCount,
          dataset2.mimeType,
          dataset2.createdAt,
          dataset2.updatedAt
        );

        // Insert different data pattern
        const insertData = db.prepare(`
          INSERT INTO raw_data (dataset_id, row_index, data) VALUES (?, ?, ?)
        `);

        for (let i = 0; i < 50; i++) {
          const data = {
            username: `user${i}`,
            score: Math.random() * 50, // Different score range
            region: ['North', 'South'][i % 2] // Different categories
          };
          insertData.run(dataset2.id, i, JSON.stringify(data));
        }
      });

      const comparison = await dataService.compareProfiles(testDataset.id, dataset2.id);
      
      expect(comparison).toBeDefined();
      expect(comparison.dataset1).toBe(testDataset.id);
      expect(comparison.dataset2).toBe(dataset2.id);
      expect(comparison.fieldComparison).toBeDefined();
      expect(comparison.schemaMatches).toBeDefined();
      expect(comparison.recommendations).toBeDefined();
      
      // Cleanup
      await withSQLiteConnection(async (db) => {
        db.prepare('DELETE FROM raw_data WHERE dataset_id = ?').run(dataset2.id);
        db.prepare('DELETE FROM datasets WHERE id = ?').run(dataset2.id);
      });
    });
  });
});