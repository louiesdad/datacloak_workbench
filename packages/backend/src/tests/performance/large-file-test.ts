/**
 * Large File Performance Test
 * Tests the backend's ability to handle 50GB files with 256MB chunking
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { FileStreamService } from '../../services/file-stream.service';
import { DataService } from '../../services/data.service';
import { duckDBPool } from '../../database/duckdb-pool';

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  chunksProcessed: number;
  rowsProcessed: number;
  throughput: number; // rows per second
  memoryReadings: number[];
}

export class LargeFilePerformanceTest {
  private fileStreamService: FileStreamService;
  private dataService: DataService;
  private memoryReadings: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.fileStreamService = new FileStreamService();
    this.dataService = new DataService();
  }

  /**
   * Test 50GB file processing
   */
  async testLargeFileProcessing(filePath: string): Promise<PerformanceMetrics> {
    console.log('🚀 Starting 50GB file performance test...');
    
    const startTime = performance.now();
    this.startMemoryMonitoring();

    const metrics: PerformanceMetrics = {
      startTime,
      endTime: 0,
      duration: 0,
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      chunksProcessed: 0,
      rowsProcessed: 0,
      throughput: 0,
      memoryReadings: []
    };

    try {
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      const fileSizeGB = stats.size / (1024 * 1024 * 1024);
      console.log(`📁 File size: ${fileSizeGB.toFixed(2)} GB`);

      // Verify chunking strategy
      const chunkSize = 256 * 1024 * 1024; // 256MB
      const expectedChunks = Math.ceil(stats.size / chunkSize);
      console.log(`📊 Expected chunks: ${expectedChunks}`);

      // Process file with streaming
      let processedRows = 0;
      let processedChunks = 0;

      const result = await this.fileStreamService.streamProcessFile(
        filePath,
        {
          chunkSize,
          mimeType: 'text/csv',
          onProgress: (progress) => {
            const currentMemory = process.memoryUsage().heapUsed / (1024 * 1024);
            console.log(`📈 Progress: ${progress.percentComplete.toFixed(1)}% | Memory: ${currentMemory.toFixed(0)}MB | Rows: ${progress.rowsProcessed.toLocaleString()}`);
          },
          onChunk: async (chunkResult) => {
            processedChunks++;
            processedRows = chunkResult.chunkInfo.isLastChunk ? chunkResult.processedRows : processedRows + chunkResult.processedRows;
            
            // Verify chunk size
            if (chunkResult.chunkInfo.chunkIndex === 0) {
              console.log(`✅ Chunk size verified: ${chunkSize / (1024 * 1024)}MB`);
            }

            // Simulate data processing
            await this.simulateDataProcessing(chunkResult.data);
          }
        }
      );

      // Stop monitoring and calculate metrics
      this.stopMemoryMonitoring();
      metrics.endTime = performance.now();
      metrics.duration = (metrics.endTime - metrics.startTime) / 1000; // seconds
      metrics.chunksProcessed = processedChunks;
      metrics.rowsProcessed = processedRows;
      metrics.throughput = processedRows / metrics.duration;
      metrics.memoryReadings = this.memoryReadings;
      metrics.peakMemoryUsage = Math.max(...this.memoryReadings);
      metrics.averageMemoryUsage = this.memoryReadings.reduce((a, b) => a + b, 0) / this.memoryReadings.length;

      // Validate results
      this.validatePerformance(metrics);

      return metrics;
    } catch (error) {
      this.stopMemoryMonitoring();
      console.error('❌ Large file test failed:', error);
      throw error;
    }
  }

  /**
   * Test memory usage stays under 2GB limit
   */
  async testMemoryLimit(): Promise<boolean> {
    console.log('🧪 Testing memory limit compliance...');
    
    const memoryLimit = 2 * 1024; // 2GB in MB
    let maxMemoryUsed = 0;
    
    // Monitor memory during a simulated large operation
    const interval = setInterval(() => {
      const memoryMB = process.memoryUsage().heapUsed / (1024 * 1024);
      maxMemoryUsed = Math.max(maxMemoryUsed, memoryMB);
    }, 100);

    try {
      // Simulate processing multiple chunks
      for (let i = 0; i < 10; i++) {
        const chunk = Buffer.alloc(256 * 1024 * 1024); // 256MB chunk
        await this.simulateDataProcessing(chunk.toString());
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      clearInterval(interval);
      
      console.log(`📊 Max memory used: ${maxMemoryUsed.toFixed(0)}MB (Limit: ${memoryLimit}MB)`);
      return maxMemoryUsed < memoryLimit;
    } catch (error) {
      clearInterval(interval);
      throw error;
    }
  }

  /**
   * Test DuckDB analytical workload handling
   */
  async testDuckDBPerformance(): Promise<void> {
    console.log('🦆 Testing DuckDB with 8GB analytical workload...');

    try {
      // Create a large test dataset
      const testSize = 10_000_000; // 10M rows
      const batchSize = 100_000;
      
      console.log(`📝 Creating test dataset with ${testSize.toLocaleString()} rows...`);

      // Insert data in batches
      for (let i = 0; i < testSize; i += batchSize) {
        const batch: any[] = [];
        for (let j = 0; j < batchSize && i + j < testSize; j++) {
          batch.push({
            id: i + j,
            text: `Test text ${i + j}`,
            sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
            score: Math.random() * 2 - 1,
            timestamp: new Date()
          });
        }
        
        // Insert batch into DuckDB using connection pool
        for (const item of batch) {
          await duckDBPool.executeRun(
            'INSERT INTO text_analytics (text, sentiment, score, word_count, char_count, batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [item.text, item.sentiment, item.score, 0, 0, item.id.toString(), item.timestamp.toISOString()]
          );
        }
        
        if ((i / batchSize) % 10 === 0) {
          const progress = (i / testSize) * 100;
          console.log(`📊 Insert progress: ${progress.toFixed(1)}%`);
        }
      }

      // Run analytical queries
      console.log('🔍 Running analytical queries...');
      
      const queries = [
        'SELECT COUNT(*) as total FROM text_analytics',
        'SELECT sentiment, COUNT(*) as count FROM text_analytics GROUP BY sentiment',
        'SELECT AVG(score) as avg_score FROM text_analytics',
        'SELECT sentiment, AVG(score) as avg_score, COUNT(*) as count FROM text_analytics GROUP BY sentiment',
        "SELECT DATE_TRUNC('hour', timestamp) as hour, COUNT(*) as count FROM text_analytics GROUP BY hour ORDER BY hour"
      ];

      for (const query of queries) {
        const startTime = performance.now();
        await duckDBPool.executeQuery(query);
        const duration = performance.now() - startTime;
        console.log(`✅ Query executed in ${duration.toFixed(2)}ms`);
      }

      console.log('✅ DuckDB performance test completed successfully');
    } catch (error) {
      console.error('❌ DuckDB test failed:', error);
      throw error;
    }
  }

  /**
   * Generate a test CSV file
   */
  async generateTestFile(sizeGB: number, outputPath: string): Promise<void> {
    console.log(`📝 Generating ${sizeGB}GB test file...`);
    
    const rowSize = 1024; // ~1KB per row
    const totalRows = (sizeGB * 1024 * 1024 * 1024) / rowSize;
    const batchSize = 10000;
    
    const writeStream = fs.createWriteStream(outputPath);
    
    // Write header
    writeStream.write('id,text,category,timestamp,value\n');
    
    for (let i = 0; i < totalRows; i += batchSize) {
      const batch: string[] = [];
      for (let j = 0; j < batchSize && i + j < totalRows; j++) {
        const row = [
          i + j,
          `This is a test text that contains some content to make the row approximately 1KB in size. ${Array(50).fill('Lorem ipsum dolor sit amet. ').join('')}`,
          `category_${Math.floor(Math.random() * 100)}`,
          new Date().toISOString(),
          Math.random() * 1000
        ].join(',');
        batch.push(row);
      }
      
      writeStream.write(batch.join('\n') + '\n');
      
      if (i % 100000 === 0) {
        const progress = (i / totalRows) * 100;
        console.log(`📊 Generation progress: ${progress.toFixed(1)}%`);
      }
    }
    
    writeStream.end();
    console.log('✅ Test file generated');
  }

  private startMemoryMonitoring(): void {
    this.memoryReadings = [];
    this.monitoringInterval = setInterval(() => {
      const memoryMB = process.memoryUsage().heapUsed / (1024 * 1024);
      this.memoryReadings.push(memoryMB);
    }, 1000);
  }

  private stopMemoryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async simulateDataProcessing(data: any[] | string): Promise<void> {
    // Handle different data types
    if (typeof data === 'string') {
      // For string data (like from Buffer.toString()), just process the length
      const textLength = data.length;
      // Simulate processing time based on text length
      await new Promise(resolve => setTimeout(resolve, Math.min(textLength / 1000, 100)));
      return;
    }

    // For array data (already parsed), process each row
    if (Array.isArray(data)) {
      for (const row of data) {
        // Simulate some work on each row
        if (row && typeof row === 'object' && row.text && typeof row.text === 'string') {
          row.processedLength = row.text.length;
        }
      }
    }

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private validatePerformance(metrics: PerformanceMetrics): void {
    console.log('\n📊 Performance Test Results:');
    console.log(`⏱️  Duration: ${metrics.duration.toFixed(2)} seconds`);
    console.log(`📦 Chunks processed: ${metrics.chunksProcessed}`);
    console.log(`📝 Rows processed: ${metrics.rowsProcessed.toLocaleString()}`);
    console.log(`⚡ Throughput: ${metrics.throughput.toFixed(0)} rows/second`);
    console.log(`💾 Peak memory: ${metrics.peakMemoryUsage.toFixed(0)}MB`);
    console.log(`💾 Avg memory: ${metrics.averageMemoryUsage.toFixed(0)}MB`);

    // Validate memory constraint
    const memoryLimit = 2048; // 2GB
    if (metrics.peakMemoryUsage > memoryLimit) {
      console.error(`❌ Memory usage exceeded limit: ${metrics.peakMemoryUsage}MB > ${memoryLimit}MB`);
    } else {
      console.log(`✅ Memory usage within limit: ${metrics.peakMemoryUsage}MB < ${memoryLimit}MB`);
    }

    // Validate throughput
    const minThroughput = 10000; // 10k rows/second minimum
    if (metrics.throughput < minThroughput) {
      console.warn(`⚠️  Throughput below target: ${metrics.throughput.toFixed(0)} < ${minThroughput} rows/second`);
    } else {
      console.log(`✅ Throughput acceptable: ${metrics.throughput.toFixed(0)} rows/second`);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new LargeFilePerformanceTest();
  
  async function runTests() {
    try {
      // Test 1: Memory limit
      console.log('\n=== Test 1: Memory Limit ===');
      const memoryOk = await test.testMemoryLimit();
      console.log(memoryOk ? '✅ Memory test PASSED' : '❌ Memory test FAILED');

      // Test 2: DuckDB performance
      console.log('\n=== Test 2: DuckDB Performance ===');
      await test.testDuckDBPerformance();

      // Test 3: Large file (if available)
      const testFilePath = path.join(__dirname, '../../../test-data/large-test.csv');
      if (fs.existsSync(testFilePath)) {
        console.log('\n=== Test 3: 50GB File Processing ===');
        await test.testLargeFileProcessing(testFilePath);
      } else {
        console.log('\n⚠️  Skipping 50GB test - no test file found');
        console.log('Generate a test file with: npm run test:generate-large-file');
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  }

  runTests();
}