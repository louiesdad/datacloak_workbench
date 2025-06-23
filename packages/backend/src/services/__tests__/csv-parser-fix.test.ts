import { detectDelimiter, createFlexibleCsvParser } from '../csv-parser-fix';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

describe('CSVParserFix Service', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-parser-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectDelimiter', () => {
    test('should detect comma delimiter', async () => {
      const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25`;

      const filePath = path.join(tempDir, 'comma.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });

    test('should detect tab delimiter', async () => {
      const csvContent = `name\temail\tage
John Doe\tjohn@example.com\t30
Jane Smith\tjane@example.com\t25`;

      const filePath = path.join(tempDir, 'tab.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe('\t');
    });

    test('should detect semicolon delimiter', async () => {
      const csvContent = `name;email;age
John Doe;john@example.com;30
Jane Smith;jane@example.com;25`;

      const filePath = path.join(tempDir, 'semicolon.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(';');
    });

    test('should detect pipe delimiter', async () => {
      const csvContent = `name|email|age
John Doe|john@example.com|30
Jane Smith|jane@example.com|25`;

      const filePath = path.join(tempDir, 'pipe.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe('|');
    });

    test('should default to comma for empty file', async () => {
      const filePath = path.join(tempDir, 'empty.csv');
      fs.writeFileSync(filePath, '');

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });

    test('should default to comma for file with only whitespace', async () => {
      const filePath = path.join(tempDir, 'whitespace.csv');
      fs.writeFileSync(filePath, '   \n   \n   ');

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });

    test('should handle files with multiple delimiters', async () => {
      const csvContent = `name,email;age|phone
John,Doe;30|555-1234`;

      const filePath = path.join(tempDir, 'mixed.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      // Should detect comma as it appears most frequently (2 times)
      expect(delimiter).toBe(',');
    });

    test('should handle files with quoted fields containing delimiters', async () => {
      const csvContent = `name,address,age
"John, Jr.","123 Main St, Apt 4",30
"Jane Smith","456 Oak Rd",25`;

      const filePath = path.join(tempDir, 'quoted.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });

    test('should handle non-existent file gracefully', async () => {
      const filePath = path.join(tempDir, 'nonexistent.csv');
      
      await expect(detectDelimiter(filePath)).rejects.toThrow();
    });

    test('should handle very long first lines', async () => {
      const longLine = Array(1000).fill('field').join(',');
      const csvContent = `${longLine}
value1,value2,value3`;

      const filePath = path.join(tempDir, 'long-line.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });

    test('should handle files with BOM', async () => {
      const csvContent = '\ufeffname,email,age\nJohn,john@example.com,30';
      
      const filePath = path.join(tempDir, 'bom.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      expect(delimiter).toBe(',');
    });
  });

  describe('createFlexibleCsvParser', () => {
    test('should create parser with default comma delimiter', () => {
      const parser = createFlexibleCsvParser();
      expect(parser).toBeDefined();
      // csv-parser doesn't expose options directly, so we'll test functionality instead
    });

    test('should create parser with custom delimiter', () => {
      const parser = createFlexibleCsvParser(';');
      expect(parser).toBeDefined();
      // Test will verify functionality in parsing tests
    });

    test('should have flexible parsing options enabled', () => {
      const parser = createFlexibleCsvParser();
      expect(parser).toBeDefined();
      // Options are internal to csv-parser, test through functionality
    });

    test('should parse CSV with variable column counts', async () => {
      const csvContent = `name,email,age
John,john@example.com,30
Jane,jane@example.com
Bob,bob@example.com,35,extra_field`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ name: 'John', email: 'john@example.com', age: '30' });
      expect(results[1]).toEqual({ name: 'Jane', email: 'jane@example.com' }); // Missing fields may not appear
      expect(results[2].name).toBe('Bob');
    });

    test('should handle empty fields correctly', async () => {
      const csvContent = `name,email,age
John,,30
,jane@example.com,
Bob,bob@example.com,35`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ name: 'John', email: '', age: '30' });
      expect(results[1]).toEqual({ name: '', email: 'jane@example.com', age: '' });
    });

    test('should parse different delimiters correctly', async () => {
      const testCases = [
        { delimiter: '\t', content: `name\temail\nJohn\tjohn@example.com` },
        { delimiter: ';', content: `name;email\nJohn;john@example.com` },
        { delimiter: '|', content: `name|email\nJohn|john@example.com` }
      ];

      for (const testCase of testCases) {
        const parser = createFlexibleCsvParser(testCase.delimiter);
        const results: any[] = [];

        await new Promise((resolve, reject) => {
          Readable.from(testCase.content)
            .pipe(parser)
            .on('data', (data) => results.push(data))
            .on('end', resolve)
            .on('error', reject);
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ name: 'John', email: 'john@example.com' });
      }
    });
  });

  describe('edge cases and performance', () => {
    test('should handle very large number of columns', async () => {
      const numColumns = 1000;
      const headers = Array.from({ length: numColumns }, (_, i) => `col${i}`);
      const values = Array.from({ length: numColumns }, (_, i) => `value${i}`);
      
      const csvContent = `${headers.join(',')}\n${values.join(',')}`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      expect(results).toHaveLength(1);
      expect(Object.keys(results[0])).toHaveLength(numColumns);
      expect(results[0].col0).toBe('value0');
      expect(results[0].col999).toBe('value999');
    });

    test('should handle special characters in fields', async () => {
      const csvContent = `name,description
"John ""JD"" Doe","Contains, comma and ""quotes"""
"Jane\nSmith","Contains\nnewline"`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('John "JD" Doe');
      expect(results[0].description).toBe('Contains, comma and "quotes"');
      expect(results[1].name).toBe('Jane\nSmith');
    });

    test('should handle Unicode characters', async () => {
      const csvContent = `name,city,emoji
José,São Paulo,😊
李明,北京,🏮
Müller,München,🍺`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('José');
      expect(results[1].city).toBe('北京');
      expect(results[2].emoji).toBe('🍺');
    });

    test('should perform well with large files (simulated)', async () => {
      const numRows = 10000;
      const rows = ['name,email,age,score'];
      
      for (let i = 0; i < numRows; i++) {
        rows.push(`User${i},user${i}@example.com,${20 + (i % 50)},${Math.random() * 100}`);
      }
      
      const csvContent = rows.join('\n');
      const startTime = Date.now();

      const parser = createFlexibleCsvParser();
      const results: any[] = [];

      await new Promise((resolve, reject) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(numRows);
      expect(duration).toBeLessThan(5000); // Should parse 10k rows in less than 5 seconds
      
      // Verify a sample of results
      expect(results[0].name).toBe('User0');
      expect(results[numRows - 1].name).toBe(`User${numRows - 1}`);
    });

    test('should handle malformed CSV gracefully', async () => {
      const csvContent = `name,email,age
"John,john@example.com,30
Jane,jane@example.com,25
Bob,"bob@example.com,35`;

      const parser = createFlexibleCsvParser();
      const results: any[] = [];
      const errors: any[] = [];

      await new Promise((resolve) => {
        Readable.from(csvContent)
          .pipe(parser)
          .on('data', (data) => results.push(data))
          .on('error', (error) => errors.push(error))
          .on('end', resolve);
      });

      // Parser should handle malformed quotes gracefully
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('delimiter detection accuracy', () => {
    test('should correctly identify delimiter in real-world datasets', async () => {
      const testCases = [
        {
          name: 'European CSV (semicolon)',
          content: `Name;Amount;Date;Description
"Smith, John";1.234,56;01/02/2023;"Payment for services"
"Doe, Jane";2.345,67;02/03/2023;"Monthly subscription"`,
          expected: ';'
        },
        {
          name: 'TSV file',
          content: `ID\tProduct\tPrice\tStock
1001\tWidget A\t19.99\t100
1002\tWidget B\t29.99\t50`,
          expected: '\t'
        },
        {
          name: 'Pipe-delimited',
          content: `USER_ID|USERNAME|EMAIL|REGISTRATION_DATE
12345|johndoe|john@example.com|2023-01-15
67890|janedoe|jane@example.com|2023-02-20`,
          expected: '|'
        }
      ];

      for (const testCase of testCases) {
        const filePath = path.join(tempDir, `${testCase.name}.csv`);
        fs.writeFileSync(filePath, testCase.content);
        
        const delimiter = await detectDelimiter(filePath);
        expect(delimiter).toBe(testCase.expected);
      }
    });

    test('should handle ambiguous cases reasonably', async () => {
      // File where comma appears in data but semicolon is the delimiter
      const csvContent = `Name;Address;Notes
"Smith, John";"123 Main St, Apt 4";"Customer since 2020"
"Doe, Jane";"456 Oak Rd";"VIP customer"`;

      const filePath = path.join(tempDir, 'ambiguous.csv');
      fs.writeFileSync(filePath, csvContent);

      const delimiter = await detectDelimiter(filePath);
      // Should detect semicolon despite commas in quoted fields
      expect(delimiter).toBe(';');
    });
  });
});