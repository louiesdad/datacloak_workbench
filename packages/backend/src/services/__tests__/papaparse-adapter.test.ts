import { PapaParseAdapter, ParseResult } from '../papaparse-adapter';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('PapaParseAdapter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papaparse-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseFile', () => {
    test('should parse basic CSV file', async () => {
      const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35`;

      const filePath = path.join(tempDir, 'basic.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.data).toHaveLength(3);
      expect(result.headers).toEqual(['name', 'email', 'age']);
      expect(result.delimiter).toBe(',');
      expect(result.lineCount).toBe(3);
      expect(result.errors).toHaveLength(0);

      expect(result.data[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      });
    });

    test('should auto-detect tab delimiter', async () => {
      const tsvContent = `name\temail\tage
John Doe\tjohn@example.com\t30
Jane Smith\tjane@example.com\t25`;

      const filePath = path.join(tempDir, 'data.tsv');
      fs.writeFileSync(filePath, tsvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.delimiter).toBe('\t');
      expect(result.data).toHaveLength(2);
      expect(result.headers).toEqual(['name', 'email', 'age']);
    });

    test('should trim headers and values', async () => {
      const csvContent = ` name , email , age 
  John Doe  ,  john@example.com  ,  30  
  Jane Smith  ,  jane@example.com  ,  25  `;

      const filePath = path.join(tempDir, 'whitespace.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.headers).toEqual(['name', 'email', 'age']);
      expect(result.data[0].name).toBe('John Doe');
      expect(result.data[0].email).toBe('john@example.com');
    });

    test('should convert empty strings to null', async () => {
      const csvContent = `name,email,age
John Doe,,30
,jane@example.com,
Bob Johnson,bob@example.com,35`;

      const filePath = path.join(tempDir, 'empty.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.data[0].email).toBeNull();
      expect(result.data[1].name).toBeNull();
      expect(result.data[1].age).toBeNull();
    });

    test('should skip empty lines', async () => {
      const csvContent = `name,email,age
John Doe,john@example.com,30

Jane Smith,jane@example.com,25

Bob Johnson,bob@example.com,35`;

      const filePath = path.join(tempDir, 'empty-lines.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.data).toHaveLength(3);
      expect(result.lineCount).toBe(3);
    });

    test('should apply dynamic typing', async () => {
      const csvContent = `name,age,score,active
John,30,95.5,true
Jane,25,87.3,false
Bob,35,92.0,TRUE`;

      const filePath = path.join(tempDir, 'typed.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(typeof result.data[0].age).toBe('number');
      expect(typeof result.data[0].score).toBe('number');
      expect(typeof result.data[0].active).toBe('boolean');
      expect(result.data[0].age).toBe(30);
      expect(result.data[0].score).toBe(95.5);
      expect(result.data[0].active).toBe(true);
    });

    test('should respect preview size option', async () => {
      const rows = ['name,value'];
      for (let i = 0; i < 200; i++) {
        rows.push(`Item${i},${i}`);
      }

      const filePath = path.join(tempDir, 'large.csv');
      fs.writeFileSync(filePath, rows.join('\n'));

      const result = await PapaParseAdapter.parseFile(filePath, { previewSize: 50 });

      expect(result.data).toHaveLength(50);
      expect(result.lineCount).toBe(200);
    });

    test('should handle parsing errors gracefully', async () => {
      const csvContent = `name,email,age
"John Doe,john@example.com,30
Jane Smith,jane@example.com,25
"Bob Johnson",bob@example.com,35`;

      const filePath = path.join(tempDir, 'errors.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0); // Should still parse what it can
    });

    test('should handle special characters in values', async () => {
      const csvContent = `name,description
"John ""JD"" Doe","Says ""Hello, World!"""
"Jane\nSmith","Multi-line\ndescription"`;

      const filePath = path.join(tempDir, 'special.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.data[0].name).toBe('John "JD" Doe');
      expect(result.data[0].description).toBe('Says "Hello, World!"');
      expect(result.data[1].name).toBe('Jane\nSmith');
    });

    test('should handle Unicode correctly', async () => {
      const csvContent = `name,location,emoji
José García,São Paulo,🌟
李明,北京,🏮
Müller,München,🍺`;

      const filePath = path.join(tempDir, 'unicode.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);

      expect(result.data[0].name).toBe('José García');
      expect(result.data[1].location).toBe('北京');
      expect(result.data[2].emoji).toBe('🍺');
    });
  });

  describe('streamParseFile', () => {
    test('should stream parse large files in chunks', (done) => {
      const rows = ['name,value'];
      for (let i = 0; i < 5500; i++) {
        rows.push(`Item${i},${i}`);
      }

      const filePath = path.join(tempDir, 'stream.csv');
      fs.writeFileSync(filePath, rows.join('\n'));

      const chunks: any[] = [];
      let totalRowsReported = 0;

      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk, rowCount) => {
          chunks.push(chunk);
          expect(chunk.length).toBeLessThanOrEqual(1000);
          expect(rowCount).toBeGreaterThan(0);
        },
        (totalRows) => {
          totalRowsReported = totalRows;
          
          expect(chunks.length).toBe(6); // 5500 rows / 1000 chunk size = 6 chunks
          expect(totalRowsReported).toBe(5500);
          
          // Verify all data was received
          const allData = chunks.flat();
          expect(allData).toHaveLength(5500);
          expect(allData[0].name).toBe('Item0');
          expect(allData[5499].name).toBe('Item5499');
          
          done();
        }
      );
    });

    test('should handle streaming errors', (done) => {
      const filePath = path.join(tempDir, 'nonexistent.csv');
      
      // Mock console.error to avoid test output noise
      const originalConsoleError = console.error;
      const mockConsoleError = jest.fn();
      console.error = mockConsoleError;

      let errorOccurred = false;

      try {
        PapaParseAdapter.streamParseFile(
          filePath,
          () => {
            // This may not be called if file doesn't exist
          },
          () => {
            // This may not be called if file doesn't exist
            errorOccurred = true;
          }
        );
        
        // Give it a moment to try reading the file
        setTimeout(() => {
          console.error = originalConsoleError;
          // Either console.error was called or the complete callback was invoked
          expect(mockConsoleError).toHaveBeenCalled();
          done();
        }, 100);
      } catch (error) {
        console.error = originalConsoleError;
        expect(error).toBeDefined();
        done();
      }
    });

    test('should skip empty rows during streaming', (done) => {
      const csvContent = `name,value
Item1,1

Item2,2

Item3,3`;

      const filePath = path.join(tempDir, 'stream-empty.csv');
      fs.writeFileSync(filePath, csvContent);

      let totalRows = 0;

      PapaParseAdapter.streamParseFile(
        filePath,
        (chunk) => {
          totalRows += chunk.length;
        },
        (finalTotal) => {
          expect(finalTotal).toBe(3);
          expect(totalRows).toBe(3);
          done();
        }
      );
    });
  });

  describe('analyzeFields', () => {
    test('should analyze field statistics correctly', () => {
      const data = [
        { name: 'John', age: 30, email: 'john@example.com' },
        { name: 'Jane', age: 25, email: 'jane@example.com' },
        { name: 'Bob', age: null, email: 'bob@example.com' },
        { name: 'Alice', age: 35, email: null }
      ];

      const headers = ['name', 'age', 'email'];
      const analysis = PapaParseAdapter.analyzeFields(data, headers);

      expect(analysis).toHaveLength(3);

      const nameAnalysis = analysis.find(f => f.name === 'name');
      expect(nameAnalysis).toEqual({
        name: 'name',
        type: 'string',
        totalCount: 4,
        nullCount: 0,
        uniqueCount: 4,
        completeness: 100,
        sampleValues: ['John', 'Jane', 'Bob', 'Alice']
      });

      const ageAnalysis = analysis.find(f => f.name === 'age');
      expect(ageAnalysis).toEqual({
        name: 'age',
        type: 'number',
        totalCount: 4,
        nullCount: 1,
        uniqueCount: 3,
        completeness: 75,
        sampleValues: [30, 25, 35]
      });

      const emailAnalysis = analysis.find(f => f.name === 'email');
      expect(emailAnalysis!.nullCount).toBe(1);
      expect(emailAnalysis!.completeness).toBe(75);
    });

    test('should detect field types correctly', () => {
      const data = [
        { 
          id: '123', 
          score: '95.5', 
          date: '2023/01/15',
          active: 'true',
          mixed: 'abc123'
        },
        { 
          id: '456', 
          score: '87.3', 
          date: '2023/02/20',
          active: 'false',
          mixed: '456'
        }
      ];

      const headers = ['id', 'score', 'date', 'active', 'mixed'];
      const analysis = PapaParseAdapter.analyzeFields(data, headers);

      const idAnalysis = analysis.find(f => f.name === 'id');
      expect(idAnalysis!.type).toBe('number');

      const scoreAnalysis = analysis.find(f => f.name === 'score');
      expect(scoreAnalysis!.type).toBe('number');

      const dateAnalysis = analysis.find(f => f.name === 'date');
      expect(dateAnalysis!.type).toBe('date');

      const mixedAnalysis = analysis.find(f => f.name === 'mixed');
      expect(mixedAnalysis!.type).toBe('string');
    });

    test('should handle empty data gracefully', () => {
      const data: any[] = [];
      const headers = ['field1', 'field2'];
      
      const analysis = PapaParseAdapter.analyzeFields(data, headers);
      
      expect(analysis).toHaveLength(2);
      expect(analysis[0].totalCount).toBe(0);
      expect(analysis[0].completeness).toBe(NaN);
    });
  });

  describe('error handling', () => {
    test('should reject on file read errors', async () => {
      const filePath = path.join(tempDir, 'nonexistent.csv');
      
      await expect(PapaParseAdapter.parseFile(filePath)).rejects.toThrow();
    });

    test('should handle malformed CSV gracefully', async () => {
      const csvContent = `name,email,age
"Unclosed quote,john@example.com,30
Normal Row,jane@example.com,25`;

      const filePath = path.join(tempDir, 'malformed.csv');
      fs.writeFileSync(filePath, csvContent);

      const result = await PapaParseAdapter.parseFile(filePath);
      
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    test('should parse large files efficiently', async () => {
      const numRows = 10000;
      const rows = ['id,name,email,age,score'];
      
      for (let i = 0; i < numRows; i++) {
        rows.push(`${i},User${i},user${i}@example.com,${20 + (i % 50)},${(Math.random() * 100).toFixed(2)}`);
      }

      const filePath = path.join(tempDir, 'performance.csv');
      fs.writeFileSync(filePath, rows.join('\n'));

      const startTime = Date.now();
      const result = await PapaParseAdapter.parseFile(filePath, { previewSize: numRows });
      const duration = Date.now() - startTime;

      expect(result.data).toHaveLength(numRows);
      expect(result.lineCount).toBe(numRows);
      expect(duration).toBeLessThan(5000); // Should parse 10k rows in under 5 seconds
    });
  });
});