import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { Readable } from 'stream';

describe('E2E: File Processing Edge Cases', () => {
  let app: Express;
  const testFilesDir = path.join(__dirname, '../test-files');

  beforeAll(async () => {
    app = await createTestApp();
    
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('File Encoding Issues', () => {
    it('should handle UTF-8 with BOM', async () => {
      // Create file with BOM
      const bomContent = '\ufefftext,sentiment\n"Hello world",positive\n"Test data",neutral';
      
      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(bomContent), 'utf8-bom.csv')
        .expect(200);

      expect(response.body.data.recordCount).toBe(2);
      expect(response.body.data.encoding).toBe('utf-8-bom');
    });

    it('should handle various character encodings', async () => {
      const encodings = [
        { name: 'utf-16le', content: Buffer.from('text,sentiment\n"Hello",positive', 'utf16le') },
        { name: 'utf-16be', content: Buffer.from('text,sentiment\n"Hello",positive', 'utf16le').swap16() },
        { name: 'latin1', content: Buffer.from('text,sentiment\n"Héllo wörld",positive', 'latin1') },
        { name: 'windows-1252', content: Buffer.from('text,sentiment\n"Test – data",neutral', 'latin1') }
      ];

      for (const encoding of encodings) {
        const response = await request(app)
          .post('/api/v1/data/upload')
          .attach('file', encoding.content, `test-${encoding.name}.csv`)
          .field('encoding', encoding.name)
          .expect(200);

        expect(response.body.data.encoding).toBe(encoding.name);
      }
    });

    it('should detect and handle mixed encodings', async () => {
      // File with mixed encoding (common issue)
      const mixedContent = Buffer.concat([
        Buffer.from('text,sentiment\n', 'utf8'),
        Buffer.from('"Test data",positive\n', 'utf8'),
        Buffer.from('"Tëst dátá",negative\n', 'latin1')
      ]);

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', mixedContent, 'mixed-encoding.csv')
        .expect(200);

      expect(response.body.warnings).toContain('Mixed encoding detected');
    });
  });

  describe('Malformed CSV Handling', () => {
    it('should handle missing quotes and escapes', async () => {
      const malformedCSV = `text,sentiment
"Unmatched quote,positive
Text with, comma,negative
"Proper quote",neutral
Text with "internal" quotes,positive`;

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(malformedCSV), 'malformed.csv')
        .field('strict', 'false')
        .expect(200);

      expect(response.body.data.recordCount).toBeGreaterThan(0);
      expect(response.body.warnings).toBeDefined();
    });

    it('should handle inconsistent column counts', async () => {
      const inconsistentCSV = `text,sentiment,confidence
"Text 1",positive,0.9
"Text 2",negative
"Text 3",neutral,0.8,extra_column
"Text 4"`;

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(inconsistentCSV), 'inconsistent.csv')
        .expect(200);

      expect(response.body.data.recordCount).toBe(4);
      expect(response.body.warnings).toContain('Inconsistent column count');
    });

    it('should handle various line endings', async () => {
      const lineEndings = [
        { name: 'unix', content: 'text,sentiment\n"Test 1",positive\n"Test 2",negative' },
        { name: 'windows', content: 'text,sentiment\r\n"Test 1",positive\r\n"Test 2",negative' },
        { name: 'mac', content: 'text,sentiment\r"Test 1",positive\r"Test 2",negative' },
        { name: 'mixed', content: 'text,sentiment\n"Test 1",positive\r\n"Test 2",negative\r"Test 3",neutral' }
      ];

      for (const ending of lineEndings) {
        const response = await request(app)
          .post('/api/v1/data/upload')
          .attach('file', Buffer.from(ending.content), `${ending.name}-endings.csv`)
          .expect(200);

        expect(response.body.data.recordCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Large File Handling', () => {
    it('should stream process files larger than memory', async () => {
      // Create a large CSV file (100MB)
      const largeFilePath = path.join(testFilesDir, 'large.csv');
      const writeStream = fs.createWriteStream(largeFilePath);
      
      writeStream.write('text,sentiment\n');
      for (let i = 0; i < 1000000; i++) {
        writeStream.write(`"This is test text number ${i} with some padding to make it larger",positive\n`);
      }
      writeStream.end();

      await new Promise(resolve => writeStream.on('finish', resolve));

      const fileStats = fs.statSync(largeFilePath);
      expect(fileStats.size).toBeGreaterThan(100 * 1024 * 1024); // > 100MB

      // Upload with streaming
      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', fs.createReadStream(largeFilePath))
        .field('streaming', 'true')
        .expect(200);

      expect(response.body.data.streaming).toBe(true);
      expect(response.body.data.recordCount).toBe(1000000);
    });

    it('should handle memory efficiently with concurrent large uploads', async () => {
      // Create multiple large files
      const uploads = [];
      
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(testFilesDir, `concurrent-${i}.csv`);
        const content = 'text,sentiment\n' + 
          Array(10000).fill(`"Concurrent test ${i}",positive`).join('\n');
        
        fs.writeFileSync(filePath, content);
        
        uploads.push(
          request(app)
            .post('/api/v1/data/upload')
            .attach('file', fs.createReadStream(filePath))
            .field('streaming', 'true')
        );
      }

      const responses = await Promise.all(uploads);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.recordCount).toBe(10000);
      });
    });
  });

  describe('Compressed File Handling', () => {
    it('should handle gzipped CSV files', async () => {
      const csvContent = 'text,sentiment\n"Compressed test",positive\n"Another test",negative';
      const gzipped = zlib.gzipSync(Buffer.from(csvContent));

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', gzipped, 'compressed.csv.gz')
        .expect(200);

      expect(response.body.data.compressed).toBe(true);
      expect(response.body.data.recordCount).toBe(2);
    });

    it('should handle zip archives with multiple CSV files', async () => {
      // Note: This would require a zip library like 'archiver'
      // For now, we'll test the endpoint behavior
      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from('PK...'), 'multiple.zip')
        .expect(200);

      expect(response.body.data.type).toBe('archive');
    });

    it('should reject zip bombs', async () => {
      // Create a file that expands to huge size
      const smallData = Buffer.alloc(1024, 'x');
      const compressed = zlib.gzipSync(smallData);
      
      // Manipulate headers to claim huge uncompressed size
      compressed[4] = 0xFF; // Fake huge size
      compressed[5] = 0xFF;
      compressed[6] = 0xFF;
      compressed[7] = 0xFF;

      await request(app)
        .post('/api/v1/data/upload')
        .attach('file', compressed, 'bomb.csv.gz')
        .expect(400);
    });
  });

  describe('Special Characters and Edge Cases', () => {
    it('should handle null bytes in files', async () => {
      const contentWithNull = Buffer.from('text,sentiment\n"Test\0data",positive\n"Normal",negative');

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', contentWithNull, 'null-bytes.csv')
        .expect(200);

      expect(response.body.warnings).toContain('Null bytes removed');
    });

    it('should handle extremely long lines', async () => {
      const longLine = 'text,sentiment\n"' + 'x'.repeat(100000) + '",positive\n"Normal",negative';

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(longLine), 'long-lines.csv')
        .expect(200);

      expect(response.body.data.recordCount).toBe(2);
      expect(response.body.warnings).toContain('Long lines detected');
    });

    it('should handle special unicode characters', async () => {
      const unicodeContent = `text,sentiment
"Test with emoji 😀 🎉",positive
"Chinese text 你好世界",neutral
"Arabic text مرحبا بالعالم",positive
"Right-to-left ‏טקסט בעברית",neutral
"Zero-width chars ​​​",negative`;

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(unicodeContent), 'unicode.csv')
        .expect(200);

      expect(response.body.data.recordCount).toBe(5);
    });
  });

  describe('Error Recovery and Partial Processing', () => {
    it('should continue processing after encountering errors', async () => {
      const partiallyCorrupt = `text,sentiment
"Valid row 1",positive
CORRUPT_DATA_HERE
"Valid row 2",negative
MORE_CORRUPT_DATA
"Valid row 3",neutral`;

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(partiallyCorrupt), 'partial.csv')
        .field('continueOnError', 'true')
        .expect(200);

      expect(response.body.data.processedCount).toBe(3);
      expect(response.body.data.errorCount).toBe(2);
    });

    it('should handle interrupted uploads', async () => {
      // Simulate interrupted upload by closing stream early
      const stream = new Readable({
        read() {
          this.push('text,sentiment\n');
          this.push('"Test 1",positive\n');
          this.push('"Test 2",neg'); // Incomplete
          this.destroy(new Error('Connection interrupted'));
        }
      });

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', stream, 'interrupted.csv')
        .expect(400);

      expect(response.body.error).toContain('Upload interrupted');
    });
  });

  describe('File Type Detection', () => {
    it('should reject non-CSV files disguised with .csv extension', async () => {
      const fileTypes = [
        { content: Buffer.from([0x89, 0x50, 0x4E, 0x47]), name: 'image.csv' }, // PNG
        { content: Buffer.from('<!DOCTYPE html>'), name: 'webpage.csv' }, // HTML
        { content: Buffer.from('{"json": true}'), name: 'data.csv' }, // JSON
        { content: Buffer.from([0xFF, 0xD8, 0xFF]), name: 'photo.csv' } // JPEG
      ];

      for (const file of fileTypes) {
        await request(app)
          .post('/api/v1/data/upload')
          .attach('file', file.content, file.name)
          .expect(400);
      }
    });

    it('should handle TSV and other delimited formats', async () => {
      const formats = [
        { delimiter: '\t', ext: 'tsv', content: 'text\tsentiment\n"Test 1"\tpositive' },
        { delimiter: '|', ext: 'psv', content: 'text|sentiment\n"Test 1"|positive' },
        { delimiter: ';', ext: 'csv', content: 'text;sentiment\n"Test 1";positive' }
      ];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/v1/data/upload')
          .attach('file', Buffer.from(format.content), `test.${format.ext}`)
          .field('delimiter', format.delimiter)
          .expect(200);

        expect(response.body.data.delimiter).toBe(format.delimiter);
      }
    });
  });

  describe('Memory and Resource Protection', () => {
    it('should prevent memory exhaustion from malicious CSV', async () => {
      // CSV that tries to consume excessive memory
      let maliciousCSV = 'text,sentiment\n';
      
      // Create rows with exponentially growing content
      for (let i = 0; i < 20; i++) {
        maliciousCSV += `"${'A'.repeat(Math.pow(2, i))}",positive\n`;
      }

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(maliciousCSV), 'malicious.csv')
        .expect(413);

      expect(response.body.error).toContain('exceeds limits');
    });

    it('should handle circular references in CSV data', async () => {
      const circularCSV = `id,parent_id,text,sentiment
1,,Root,positive
2,1,Child,negative
3,2,Grandchild,neutral
4,3,Circular,positive
3,4,Creates loop,negative`;

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(circularCSV), 'circular.csv')
        .field('detectCircular', 'true')
        .expect(200);

      expect(response.body.warnings).toContain('Circular reference detected');
    });
  });
});