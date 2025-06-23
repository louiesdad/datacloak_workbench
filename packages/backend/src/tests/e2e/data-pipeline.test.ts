import fs from 'fs';
import path from 'path';
import os from 'os';
import { RefactoredDataService } from '../../services/data-service-refactored';
import { RefactoredFileStreamService } from '../../services/file-stream-refactored';
import { DataValidationService, ValidationSchema } from '../../services/data-validation.service';
import { PapaParseAdapter } from '../../services/papaparse-adapter';
import { SQLiteConnectionPool } from '../../database/sqlite-pool';
import { MigrationSystem } from '../../database/migration-system';
import { EnhancedDuckDBService } from '../../database/duckdb-enhanced';

describe('Data Pipeline E2E Tests', () => {
  let tempDir: string;
  let dataService: RefactoredDataService;
  let fileStreamService: RefactoredFileStreamService;
  let validationService: DataValidationService;
  let sqlitePool: SQLiteConnectionPool;
  let migrationSystem: MigrationSystem;
  let duckdbService: EnhancedDuckDBService;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-pipeline-test-'));
    
    // Initialize services
    sqlitePool = new SQLiteConnectionPool({
      path: path.join(tempDir, 'test.db'),
      maxConnections: 5
    });

    // Initialize migration system with a connection
    const db = await sqlitePool.acquire();
    migrationSystem = new MigrationSystem(db, path.join(tempDir, 'migrations'));
    
    // Create migrations directory
    fs.mkdirSync(path.join(tempDir, 'migrations'), { recursive: true });
    
    // Run migrations if any exist
    await migrationSystem.migrate();
    sqlitePool.release(db);

    duckdbService = new EnhancedDuckDBService({
      path: ':memory:',
      maxConnections: 2
    });
    await duckdbService.initialize();

    dataService = new RefactoredDataService();
    fileStreamService = new RefactoredFileStreamService();
    validationService = new DataValidationService();
  });

  afterAll(async () => {
    await sqlitePool.close();
    await duckdbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Complete Data Ingestion Pipeline', () => {
    test('should ingest CSV file with validation and transformation', async () => {
      // Step 1: Create test CSV file
      const csvContent = `name,email,age,phone,join_date
John Doe,john@example.com,25,123-456-7890,2023-01-15
Jane Smith,JANE@EXAMPLE.COM,30,(555) 123-4567,2023-02-20
Bob Wilson,invalid-email,150,12345,invalid-date
Alice Brown,alice@example.com,,+1 888 999 0000,2023-03-10`;

      const filePath = path.join(tempDir, 'test-data.csv');
      fs.writeFileSync(filePath, csvContent);

      // Step 2: Define validation schema
      const schema: ValidationSchema = {
        name: 'user-import',
        rules: [
          { field: 'name', type: 'required' },
          { field: 'email', type: 'email' },
          { field: 'age', type: 'number', options: { min: 18, max: 120 } },
          { field: 'phone', type: 'phone' },
          { field: 'join_date', type: 'date' }
        ]
      };
      validationService.registerSchema(schema);

      // Step 3: Parse CSV file
      const parseResult = await PapaParseAdapter.parseFile(filePath);
      expect(parseResult.data).toHaveLength(4);
      expect(parseResult.headers).toEqual(['name', 'email', 'age', 'phone', 'join_date']);

      // Step 4: Validate and transform data
      const validationResult = await validationService.validateData(
        parseResult.data,
        'user-import',
        {
          transform: true,
          transformOptions: {
            trimStrings: true,
            normalizeEmail: true,
            parseNumbers: true,
            parseDates: true,
            toLowerCase: true,
            defaultValues: {
              status: 'pending',
              verified: false
            }
          }
        }
      );

      expect(validationResult.stats.totalRecords).toBe(4);
      expect(validationResult.stats.validRecords).toBe(2); // John and Alice
      expect(validationResult.stats.invalidRecords).toBe(2); // Jane (email not lowercased in validation) and Bob
      expect(validationResult.errors.length).toBeGreaterThan(0);

      // Step 5: Save valid records to database
      const validRecords = validationResult.transformedData!.filter((_, index) => {
        return !validationResult.errors.some(err => err.row === index);
      });

      expect(validRecords).toHaveLength(2);

      // Create table for users
      await sqlitePool.withConnection(async (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            age INTEGER,
            phone TEXT,
            join_date TEXT,
            status TEXT,
            verified INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
      });

      // Insert valid records
      for (const record of validRecords) {
        await sqlitePool.withConnection(async (db) => {
          const stmt = db.prepare(`
            INSERT INTO users (name, email, age, phone, join_date, status, verified)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            record.name,
            record.email,
            record.age,
            record.phone,
            record.join_date?.toISOString(),
            record.status,
            record.verified ? 1 : 0
          );
        });
      }

      // Step 6: Verify data in database
      const savedUsers = await sqlitePool.withConnection(async (db) => {
        return db.prepare('SELECT * FROM users').all();
      });

      expect(savedUsers).toHaveLength(2);
      expect(savedUsers[0].status).toBe('pending');
      expect(savedUsers[0].verified).toBe(0);

      // Step 7: Generate validation report
      const report = validationService.generateValidationReport(validationResult);
      expect(report).toContain('Total Records: 4');
      expect(report).toContain('Valid Records: 2');
      expect(report).toContain('Field: email');
    });

    test('should handle large file streaming with progress tracking', async () => {
      // Create large CSV file
      const filePath = path.join(tempDir, 'large-data.csv');
      const writeStream = fs.createWriteStream(filePath);
      
      writeStream.write('id,name,email,value,timestamp\n');
      
      const numRows = 10000;
      for (let i = 0; i < numRows; i++) {
        writeStream.write(`${i},User ${i},user${i}@example.com,${Math.random() * 100},${new Date().toISOString()}\n`);
      }
      
      await new Promise(resolve => writeStream.end(resolve));

      // Define schema
      const schema: ValidationSchema = {
        name: 'bulk-import',
        rules: [
          { field: 'id', type: 'number' },
          { field: 'name', type: 'required' },
          { field: 'email', type: 'email' },
          { field: 'value', type: 'number', options: { min: 0, max: 100 } },
          { field: 'timestamp', type: 'date' }
        ]
      };
      validationService.registerSchema(schema);

      // Track progress
      const progressUpdates: any[] = [];
      let chunksProcessed = 0;
      const processedRows: any[] = [];

      // Stream process file
      await fileStreamService.streamProcessFile(filePath, {
        chunkSize: 50 * 1024, // 50KB chunks
        onChunk: async (chunk) => {
          chunksProcessed++;
          
          // Validate chunk
          const validationResult = await validationService.validateData(
            chunk.data,
            'bulk-import'
          );
          
          // Collect valid rows
          const validRows = chunk.data.filter((_, index) => {
            return !validationResult.errors.some(err => err.row === index);
          });
          
          processedRows.push(...validRows);
        },
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });

      expect(chunksProcessed).toBeGreaterThan(1);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percentComplete).toBe(100);
      expect(processedRows.length).toBe(numRows);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from database errors during ingestion', async () => {
      // Create test data
      const csvContent = `id,name,value
1,Test User 1,100
2,Test User 2,200
3,Test User 3,300`;

      const filePath = path.join(tempDir, 'recovery-test.csv');
      fs.writeFileSync(filePath, csvContent);

      // Parse file
      const parseResult = await PapaParseAdapter.parseFile(filePath);

      // Create table
      await sqlitePool.withConnection(async (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS test_data (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            value INTEGER
          )
        `);
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      // Process with simulated errors
      for (const [index, record] of parseResult.data.entries()) {
        try {
          // Simulate error on second record
          if (index === 1) {
            throw new Error('Simulated database error');
          }

          await sqlitePool.withConnection(async (db) => {
            const stmt = db.prepare('INSERT INTO test_data (id, name, value) VALUES (?, ?, ?)');
            stmt.run(record.id, record.name, record.value);
          });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({ row: index, error: error.message });
        }
      }

      expect(successCount).toBe(2);
      expect(errorCount).toBe(1);
      expect(errors[0].row).toBe(1);

      // Verify partial data was saved
      const savedData = await sqlitePool.withConnection(async (db) => {
        return db.prepare('SELECT * FROM test_data').all();
      });

      expect(savedData).toHaveLength(2);
      expect(savedData.map(d => d.id)).toEqual([1, 3]);
    });

    test('should handle malformed data gracefully', async () => {
      // Create malformed CSV
      const csvContent = `name,email,age
"Good User",good@example.com,25
"Bad Quote,bad@example.com,30
"Another Good",another@example.com,35
Unclosed "Quote,unclosed@example.com,40`;

      const filePath = path.join(tempDir, 'malformed.csv');
      fs.writeFileSync(filePath, csvContent);

      // Parse with error handling
      const parseResult = await PapaParseAdapter.parseFile(filePath);
      
      expect(parseResult.errors.length).toBeGreaterThan(0);
      expect(parseResult.data.length).toBeGreaterThan(0); // Should still parse some data

      // Validate parsed data
      const schema: ValidationSchema = {
        name: 'malformed-test',
        rules: [
          { field: 'name', type: 'required' },
          { field: 'email', type: 'email' },
          { field: 'age', type: 'number' }
        ]
      };
      validationService.registerSchema(schema);

      const validationResult = await validationService.validateData(
        parseResult.data,
        'malformed-test'
      );

      // Should have some valid records despite malformed input
      expect(validationResult.stats.validRecords).toBeGreaterThan(0);
    });
  });

  describe('Data Transformation Pipeline', () => {
    test('should apply complex transformations during ingestion', async () => {
      // Create test data with various formats
      const csvContent = `first_name,last_name,email,phone,amount,date_joined,tags
  JOHN  ,  DOE  ,  JOHN.DOE@EXAMPLE.COM  ,(123) 456-7890,"1,234.56",01/15/2023,"premium, verified"
jane,smith,Jane.Smith@Example.com,555.123.4567,$2345.67,2023-02-20,"basic"
<script>alert('xss')</script>,wilson,bob@example.com,18881234567,1000,03/10/2023,"<b>new</b>"`;

      const filePath = path.join(tempDir, 'transform-test.csv');
      fs.writeFileSync(filePath, csvContent);

      // Register custom transformers
      validationService.registerTransformer('fullName', (value: any, options: any) => {
        const { firstName, lastName } = options;
        return `${firstName} ${lastName}`.trim();
      });

      validationService.registerTransformer('cleanAmount', (value: string) => {
        // Remove currency symbols and commas, parse as number
        const cleaned = value.replace(/[$,]/g, '');
        return parseFloat(cleaned);
      });

      // Define schema with transformations
      const schema: ValidationSchema = {
        name: 'transform-pipeline',
        rules: [
          { field: 'first_name', type: 'required' },
          { field: 'last_name', type: 'required' },
          { field: 'email', type: 'email' },
          { field: 'phone', type: 'phone' },
          { field: 'amount', type: 'number' },
          { field: 'date_joined', type: 'date' },
          { field: 'tags', type: 'required' }
        ]
      };
      validationService.registerSchema(schema);

      // Parse file
      const parseResult = await PapaParseAdapter.parseFile(filePath);

      // Apply transformations
      const validationResult = await validationService.validateData(
        parseResult.data,
        'transform-pipeline',
        {
          transform: true,
          transformOptions: {
            trimStrings: true,
            normalizeWhitespace: true,
            toLowerCase: true,
            removeHtml: true,
            normalizeEmail: true,
            normalizePhone: true,
            parseDates: true
          }
        }
      );

      const transformedData = validationResult.transformedData!;
      
      // Verify transformations
      expect(transformedData[0].first_name).toBe('john');
      expect(transformedData[0].last_name).toBe('doe');
      expect(transformedData[0].email).toBe('john.doe@example.com');
      expect(transformedData[0].tags).toBe('premium, verified');
      
      expect(transformedData[2].first_name).toBe('alert(\'xss\')'); // Script tags removed
      expect(transformedData[2].tags).toBe('new'); // HTML tags removed

      // Create full name field
      const enrichedData = transformedData.map(record => ({
        ...record,
        full_name: `${record.first_name} ${record.last_name}`.trim(),
        amount: typeof record.amount === 'string' ? 
          parseFloat(record.amount.replace(/[$,]/g, '')) : 
          record.amount
      }));

      expect(enrichedData[0].full_name).toBe('john doe');
      expect(enrichedData[1].amount).toBe(2345.67);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should measure ingestion performance for different file sizes', async () => {
      const fileSizes = [
        { rows: 100, name: 'small' },
        { rows: 1000, name: 'medium' },
        { rows: 10000, name: 'large' }
      ];

      const benchmarks: any[] = [];

      for (const size of fileSizes) {
        // Create test file
        const filePath = path.join(tempDir, `benchmark-${size.name}.csv`);
        const writeStream = fs.createWriteStream(filePath);
        
        writeStream.write('id,name,email,value\n');
        for (let i = 0; i < size.rows; i++) {
          writeStream.write(`${i},User ${i},user${i}@example.com,${Math.random() * 100}\n`);
        }
        await new Promise(resolve => writeStream.end(resolve));

        // Measure parsing time
        const parseStart = Date.now();
        const parseResult = await PapaParseAdapter.parseFile(filePath);
        const parseTime = Date.now() - parseStart;

        // Measure validation time
        const schema: ValidationSchema = {
          name: 'benchmark',
          rules: [
            { field: 'id', type: 'number' },
            { field: 'name', type: 'required' },
            { field: 'email', type: 'email' },
            { field: 'value', type: 'number' }
          ]
        };
        validationService.registerSchema(schema);

        const validationStart = Date.now();
        const validationResult = await validationService.validateData(
          parseResult.data,
          'benchmark'
        );
        const validationTime = Date.now() - validationStart;

        // Measure database insertion time
        await sqlitePool.withConnection(async (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS benchmark_${size.name} (
              id INTEGER PRIMARY KEY,
              name TEXT,
              email TEXT,
              value REAL
            )
          `);
        });

        const insertStart = Date.now();
        await sqlitePool.withConnection(async (db) => {
          const stmt = db.prepare(`
            INSERT INTO benchmark_${size.name} (id, name, email, value)
            VALUES (?, ?, ?, ?)
          `);

          const insertMany = db.transaction((records: any[]) => {
            for (const record of records) {
              stmt.run(record.id, record.name, record.email, record.value);
            }
          });

          insertMany(parseResult.data);
        });
        const insertTime = Date.now() - insertStart;

        const totalTime = parseTime + validationTime + insertTime;
        const rowsPerSecond = size.rows / (totalTime / 1000);

        benchmarks.push({
          size: size.name,
          rows: size.rows,
          parseTime,
          validationTime,
          insertTime,
          totalTime,
          rowsPerSecond: Math.round(rowsPerSecond)
        });
      }

      // Verify performance expectations
      expect(benchmarks[0].rowsPerSecond).toBeGreaterThan(1000); // Small files > 1k rows/sec
      expect(benchmarks[1].rowsPerSecond).toBeGreaterThan(500);  // Medium files > 500 rows/sec
      expect(benchmarks[2].rowsPerSecond).toBeGreaterThan(100);  // Large files > 100 rows/sec

      console.log('Performance Benchmarks:', benchmarks);
    });
  });

  describe('Integration with Analytics', () => {
    test('should integrate with DuckDB for analytics after ingestion', async () => {
      // Create and populate test data
      const csvContent = `date,product,quantity,price
2023-01-15,Widget A,10,19.99
2023-01-15,Widget B,5,29.99
2023-01-16,Widget A,15,19.99
2023-01-16,Widget C,8,39.99
2023-01-17,Widget B,12,29.99`;

      const filePath = path.join(tempDir, 'sales-data.csv');
      fs.writeFileSync(filePath, csvContent);

      // Parse and load into SQLite
      const parseResult = await PapaParseAdapter.parseFile(filePath);

      await sqlitePool.withConnection(async (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS sales (
            date TEXT,
            product TEXT,
            quantity INTEGER,
            price REAL
          )
        `);

        const stmt = db.prepare(`
          INSERT INTO sales (date, product, quantity, price)
          VALUES (?, ?, ?, ?)
        `);

        for (const record of parseResult.data) {
          stmt.run(record.date, record.product, record.quantity, record.price);
        }
      });

      // Export to DuckDB for analytics
      const sqliteData = await sqlitePool.withConnection(async (db) => {
        return db.prepare('SELECT * FROM sales').all();
      });

      await duckdbService.executeQuery(`
        CREATE TABLE sales AS
        SELECT * FROM (VALUES
          ${sqliteData.map(row => 
            `('${row.date}', '${row.product}', ${row.quantity}, ${row.price})`
          ).join(',\n')}
        ) AS t(date, product, quantity, price)
      `);

      // Run analytics queries
      const dailySales = await duckdbService.executeQuery(`
        SELECT 
          date,
          COUNT(DISTINCT product) as products_sold,
          SUM(quantity) as total_quantity,
          SUM(quantity * price) as total_revenue
        FROM sales
        GROUP BY date
        ORDER BY date
      `);

      expect(dailySales).toHaveLength(3);
      expect(dailySales[0].total_revenue).toBeCloseTo(349.75, 2);

      const productSales = await duckdbService.executeQuery(`
        SELECT 
          product,
          SUM(quantity) as total_sold,
          AVG(price) as avg_price,
          SUM(quantity * price) as total_revenue
        FROM sales
        GROUP BY product
        ORDER BY total_revenue DESC
      `);

      expect(productSales).toHaveLength(3);
      expect(productSales[0].product).toBe('Widget A'); // Highest revenue
    });
  });
});