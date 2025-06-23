import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, ReadStream } from 'fs';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { EventEmitter } from 'events';
import { AppError } from '../middleware/error.middleware';
import { createFlexibleCsvParser } from './csv-parser-fix';
import { analysisAuditService, FieldDetectionDecision } from './analysis-audit.service';
import { openaiService } from './openai.service';

const pipelineAsync = promisify(pipeline);

export interface ChunkInfo {
  chunkIndex: number;
  startByte: number;
  endByte: number;
  totalSize: number;
  totalChunks: number;
  isLastChunk: boolean;
}

export interface FileChunkResult {
  chunkInfo: ChunkInfo;
  data: any[];
  processedRows: number;
  hasMore: boolean;
}

export interface StreamProgress {
  bytesProcessed: number;
  totalBytes: number;
  rowsProcessed: number;
  chunksProcessed: number;
  totalChunks: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  averageRowsPerSecond?: number;
}

export interface StreamOptions {
  chunkSize?: number;
  mimeType?: string;
  onProgress?: (progress: StreamProgress) => void;
  onChunk?: (chunk: FileChunkResult) => Promise<void>;
  maxRows?: number;
  delimiter?: string;
  encoding?: BufferEncoding;
}

export class RefactoredFileStreamService extends EventEmitter {
  private static readonly DEFAULT_CHUNK_SIZE = 256 * 1024 * 1024; // 256MB
  private static readonly CSV_BUFFER_SIZE = 64 * 1024; // 64KB for CSV parsing
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  
  /**
   * Stream process a large file in chunks with improved error handling and progress tracking
   */
  async streamProcessFile(
    filePath: string,
    options: StreamOptions = {}
  ): Promise<{
    totalRows: number;
    totalBytes: number;
    chunksProcessed: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const chunkSize = options.chunkSize || RefactoredFileStreamService.DEFAULT_CHUNK_SIZE;
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;

    // Emit start event
    this.emit('stream:start', { filePath, totalSize, options });

    const mimeType = options.mimeType || this.getMimeTypeFromExtension(filePath);
    
    // Progress tracking with better accuracy
    const progressTracker = {
      startTime,
      rowsPerSecond: 0,
      lastProgressTime: startTime,
      lastRowCount: 0,
      bytesBuffer: []
    };

    try {
      let result;
      
      if (this.isCsvFile(mimeType)) {
        result = await this.streamProcessCsv(filePath, {
          ...options,
          chunkSize,
          totalSize,
          onProgress: (progress) => {
            this.updateProgressTracking(progress, progressTracker);
            options.onProgress?.(progress);
            this.emit('stream:progress', progress);
          },
          onChunk: async (chunk) => {
            this.emit('stream:chunk', chunk);
            await options.onChunk?.(chunk);
          }
        });
      } else if (this.isExcelFile(mimeType)) {
        result = await this.streamProcessExcel(filePath, {
          ...options,
          chunkSize,
          totalSize,
          onProgress: (progress) => {
            this.updateProgressTracking(progress, progressTracker);
            options.onProgress?.(progress);
            this.emit('stream:progress', progress);
          },
          onChunk: async (chunk) => {
            this.emit('stream:chunk', chunk);
            await options.onChunk?.(chunk);
          }
        });
      } else {
        throw new AppError('Unsupported file type for streaming', 400, 'UNSUPPORTED_FILE_TYPE');
      }
      
      const processingTime = Date.now() - startTime;
      
      // Emit completion event
      this.emit('stream:complete', {
        totalRows: result.totalRows,
        totalBytes: totalSize,
        chunksProcessed: result.chunksProcessed,
        processingTime
      });
      
      return {
        totalRows: result.totalRows,
        totalBytes: totalSize,
        chunksProcessed: result.chunksProcessed,
        processingTime
      };
    } catch (error) {
      // Emit error event
      this.emit('stream:error', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to stream process file: ${error.message}`, 
        500, 
        'STREAM_PROCESSING_ERROR'
      );
    }
  }

  /**
   * Get file chunks for manual processing
   */
  async getFileChunks(
    filePath: string,
    chunkSize: number = RefactoredFileStreamService.DEFAULT_CHUNK_SIZE
  ): Promise<ChunkInfo[]> {
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    
    const chunks: ChunkInfo[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const startByte = i * chunkSize;
      const endByte = Math.min(startByte + chunkSize - 1, totalSize - 1);
      
      chunks.push({
        chunkIndex: i,
        startByte,
        endByte,
        totalSize,
        totalChunks,
        isLastChunk: i === totalChunks - 1
      });
    }
    
    return chunks;
  }

  /**
   * Read a specific chunk of a file with error handling and retry
   */
  async readFileChunk(
    filePath: string, 
    chunkInfo: ChunkInfo,
    retryAttempt: number = 0
  ): Promise<Buffer> {
    try {
      const stream = createReadStream(filePath, {
        start: chunkInfo.startByte,
        end: chunkInfo.endByte,
        highWaterMark: RefactoredFileStreamService.CSV_BUFFER_SIZE
      });

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        let hasError = false;
        
        stream.on('data', (chunk: string | Buffer) => {
          if (!hasError) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
        });
        
        stream.on('end', () => {
          if (!hasError) {
            resolve(Buffer.concat(chunks));
          }
        });
        
        stream.on('error', (error) => {
          hasError = true;
          stream.destroy();
          
          if (retryAttempt < RefactoredFileStreamService.MAX_RETRY_ATTEMPTS) {
            // Retry with exponential backoff
            setTimeout(() => {
              this.readFileChunk(filePath, chunkInfo, retryAttempt + 1)
                .then(resolve)
                .catch(reject);
            }, Math.pow(2, retryAttempt) * 1000);
          } else {
            reject(new AppError(
              `Failed to read file chunk after ${RefactoredFileStreamService.MAX_RETRY_ATTEMPTS} attempts: ${error.message}`,
              500,
              'CHUNK_READ_ERROR'
            ));
          }
        });
      });
    } catch (error) {
      throw new AppError(
        `Failed to read file chunk: ${error.message}`,
        500,
        'CHUNK_READ_ERROR'
      );
    }
  }

  /**
   * Stream process CSV files with improved chunking and error handling
   */
  private async streamProcessCsv(
    filePath: string,
    options: {
      chunkSize: number;
      totalSize: number;
      onProgress?: (progress: StreamProgress) => void;
      onChunk?: (chunk: FileChunkResult) => Promise<void>;
      maxRows?: number;
      delimiter?: string;
      encoding?: BufferEncoding;
    }
  ): Promise<{ totalRows: number; chunksProcessed: number }> {
    let totalRows = 0;
    let chunksProcessed = 0;
    let bytesProcessed = 0;
    const totalChunks = Math.ceil(options.totalSize / options.chunkSize);

    return new Promise((resolve, reject) => {
      const csvStream = createReadStream(filePath, { 
        highWaterMark: RefactoredFileStreamService.CSV_BUFFER_SIZE,
        encoding: options.encoding || 'utf8'
      });
      
      let currentChunkData: any[] = [];
      let currentChunkRows = 0;
      let currentChunkBytes = 0;
      let isPaused = false;
      
      // Use our flexible CSV parser
      const csvParser = createFlexibleCsvParser(options.delimiter);

      // Transform stream to track bytes
      const byteCounter = new Transform({
        transform(chunk, encoding, callback) {
          bytesProcessed += chunk.length;
          callback(null, chunk);
        }
      });

      let headers: string[] | null = null;

      csvParser.on('data', async (row) => {
        // Check max rows limit at the beginning
        if (options.maxRows && totalRows >= options.maxRows) {
          return;
        }
        
        // Extract headers from first row
        if (!headers && currentChunkData.length === 0) {
          headers = Object.keys(row);
        }
        
        currentChunkData.push(row);
        currentChunkRows++;
        totalRows++;
        
        // Estimate bytes for progress tracking
        const rowBytes = JSON.stringify(row).length;
        currentChunkBytes += rowBytes;

        // Check if we've reached chunk size or max rows
        if (currentChunkBytes >= options.chunkSize || 
            (options.maxRows && totalRows >= options.maxRows)) {
          
          // Pause stream to handle backpressure
          if (!isPaused) {
            isPaused = true;
            csvStream.pause();
          }
          
          // Process chunk
          if (options.onChunk) {
            const chunkResult: FileChunkResult = {
              chunkInfo: {
                chunkIndex: chunksProcessed,
                startByte: bytesProcessed - currentChunkBytes,
                endByte: bytesProcessed,
                totalSize: options.totalSize,
                totalChunks,
                isLastChunk: false
              },
              data: [...currentChunkData],
              processedRows: currentChunkRows,
              hasMore: true,
              headers: headers || []
            } as FileChunkResult & { headers?: string[] };

            try {
              await options.onChunk(chunkResult);
            } catch (error) {
              csvParser.destroy(error);
              return;
            }
          }

          // Report progress
          if (options.onProgress) {
            const progress: StreamProgress = {
              bytesProcessed,
              totalBytes: options.totalSize,
              rowsProcessed: totalRows,
              chunksProcessed: chunksProcessed + 1,
              totalChunks,
              percentComplete: Math.min((bytesProcessed / options.totalSize) * 100, 100)
            };
            options.onProgress(progress);
          }

          // Reset for next chunk
          currentChunkData = [];
          currentChunkRows = 0;
          currentChunkBytes = 0;
          chunksProcessed++;

          // Check if we've hit max rows limit
          if (options.maxRows && totalRows >= options.maxRows) {
            csvStream.destroy();
            csvParser.destroy();
            resolve({ totalRows, chunksProcessed });
            return;
          }
          
          // Resume stream
          if (isPaused) {
            isPaused = false;
            csvStream.resume();
          }
        }
      });

      csvParser.on('end', async () => {
        // Process final chunk if there's remaining data
        if (currentChunkData.length > 0 && options.onChunk) {
          const chunkResult: FileChunkResult = {
            chunkInfo: {
              chunkIndex: chunksProcessed,
              startByte: bytesProcessed - currentChunkBytes,
              endByte: bytesProcessed,
              totalSize: options.totalSize,
              totalChunks,
              isLastChunk: true
            },
            data: currentChunkData,
            processedRows: currentChunkRows,
            hasMore: false,
            headers: headers || []
          } as FileChunkResult & { headers?: string[] };

          try {
            await options.onChunk(chunkResult);
            chunksProcessed++;
          } catch (error) {
            reject(error);
            return;
          }
        }

        // Final progress report
        if (options.onProgress) {
          const progress: StreamProgress = {
            bytesProcessed: options.totalSize,
            totalBytes: options.totalSize,
            rowsProcessed: totalRows,
            chunksProcessed,
            totalChunks,
            percentComplete: 100
          };
          options.onProgress(progress);
        }

        resolve({ totalRows, chunksProcessed });
      });

      csvParser.on('error', (error) => {
        csvStream.destroy();
        reject(new AppError(
          `CSV parsing error: ${error.message}`,
          500,
          'CSV_PARSE_ERROR'
        ));
      });

      // Handle stream errors
      csvStream.on('error', (error) => {
        csvParser.destroy();
        reject(new AppError(
          `File read error: ${error.message}`,
          500,
          'FILE_READ_ERROR'
        ));
      });

      // Create pipeline with error handling
      csvStream
        .pipe(byteCounter)
        .pipe(csvParser);
    });
  }

  /**
   * Stream process Excel files with improved chunking
   */
  private async streamProcessExcel(
    filePath: string,
    options: {
      chunkSize: number;
      totalSize: number;
      onProgress?: (progress: StreamProgress) => void;
      onChunk?: (chunk: FileChunkResult) => Promise<void>;
      maxRows?: number;
    }
  ): Promise<{ totalRows: number; chunksProcessed: number }> {
    try {
      // For Excel files, we need to load the entire file first due to binary format
      // Use stream mode for large files
      const workbook = XLSX.readFile(filePath, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get row range
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      let totalRows = range.e.r + 1;
      
      // Apply max rows limit if specified
      if (options.maxRows && totalRows > options.maxRows) {
        totalRows = options.maxRows;
      }
      
      let chunksProcessed = 0;
      let rowsProcessed = 0;
      
      // Calculate rows per chunk based on estimated memory usage
      const averageRowSize = options.totalSize / totalRows;
      const rowsPerChunk = Math.max(1, Math.floor(options.chunkSize / averageRowSize));
      const totalChunks = Math.ceil(totalRows / rowsPerChunk);

      // Process in chunks
      for (let startRow = 0; startRow < totalRows; startRow += rowsPerChunk) {
        const endRow = Math.min(startRow + rowsPerChunk - 1, totalRows - 1);
        
        // Extract chunk data
        const chunkRange = {
          s: { r: startRow, c: range.s.c },
          e: { r: endRow, c: range.e.c }
        };
        
        const chunkData = XLSX.utils.sheet_to_json(worksheet, {
          range: chunkRange,
          header: 1,
          defval: null
        });
        
        rowsProcessed += chunkData.length;
        
        if (options.onChunk) {
          const chunkResult: FileChunkResult = {
            chunkInfo: {
              chunkIndex: chunksProcessed,
              startByte: (startRow / totalRows) * options.totalSize,
              endByte: ((endRow + 1) / totalRows) * options.totalSize,
              totalSize: options.totalSize,
              totalChunks,
              isLastChunk: endRow >= totalRows - 1
            },
            data: chunkData,
            processedRows: chunkData.length,
            hasMore: endRow < totalRows - 1
          };

          await options.onChunk(chunkResult);
        }

        // Report progress
        if (options.onProgress) {
          const progress: StreamProgress = {
            bytesProcessed: ((endRow + 1) / totalRows) * options.totalSize,
            totalBytes: options.totalSize,
            rowsProcessed,
            chunksProcessed: chunksProcessed + 1,
            totalChunks,
            percentComplete: ((endRow + 1) / totalRows) * 100
          };
          options.onProgress(progress);
        }

        chunksProcessed++;
      }

      return { totalRows: rowsProcessed, chunksProcessed };
    } catch (error) {
      throw new AppError(
        `Failed to process Excel file: ${error.message}`,
        500,
        'EXCEL_PROCESS_ERROR'
      );
    }
  }

  /**
   * Update progress tracking with improved accuracy
   */
  private updateProgressTracking(progress: StreamProgress, tracker: any): void {
    const now = Date.now();
    const elapsed = (now - tracker.startTime) / 1000; // seconds
    const timeSinceLastUpdate = (now - tracker.lastProgressTime) / 1000;
    
    if (elapsed > 0) {
      // Calculate instantaneous rows per second
      const instantRowsPerSecond = timeSinceLastUpdate > 0 
        ? (progress.rowsProcessed - tracker.lastRowCount) / timeSinceLastUpdate
        : 0;
      
      // Update tracker
      tracker.lastRowCount = progress.rowsProcessed;
      tracker.lastProgressTime = now;
      
      // Use weighted average for smoother estimates
      if (tracker.rowsPerSecond === 0) {
        tracker.rowsPerSecond = instantRowsPerSecond;
      } else {
        tracker.rowsPerSecond = tracker.rowsPerSecond * 0.7 + instantRowsPerSecond * 0.3;
      }
      
      progress.averageRowsPerSecond = Math.round(tracker.rowsPerSecond);
      
      if (progress.percentComplete > 0 && progress.percentComplete < 100) {
        const remainingRows = (progress.rowsProcessed / progress.percentComplete * 100) - progress.rowsProcessed;
        const estimatedTimeRemaining = tracker.rowsPerSecond > 0 
          ? (remainingRows / tracker.rowsPerSecond) * 1000 
          : 0;
        progress.estimatedTimeRemaining = Math.round(estimatedTimeRemaining);
      } else {
        progress.estimatedTimeRemaining = 0;
      }
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.csv':
        return 'text/csv';
      case '.tsv':
        return 'text/tab-separated-values';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  private isCsvFile(mimeType: string): boolean {
    return mimeType === 'text/csv' || 
           mimeType === 'text/plain' || 
           mimeType === 'text/tab-separated-values';
  }

  private isExcelFile(mimeType: string): boolean {
    return mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
           mimeType === 'application/vnd.ms-excel';
  }

  /**
   * Estimate memory usage for file processing
   */
  async estimateMemoryUsage(filePath: string): Promise<{
    fileSize: number;
    estimatedMemoryUsage: number;
    recommendedChunkSize: number;
    estimatedProcessingTime: number;
  }> {
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const mimeType = this.getMimeTypeFromExtension(filePath);
    
    // Different estimates based on file type
    let memoryMultiplier = 3; // Default for CSV
    let processingSpeed = 100 * 1024 * 1024; // 100MB/s default
    
    if (this.isExcelFile(mimeType)) {
      memoryMultiplier = 5; // Excel needs more memory
      processingSpeed = 50 * 1024 * 1024; // 50MB/s for Excel
    }
    
    const estimatedMemoryUsage = fileSize * memoryMultiplier;
    
    // Get available memory (conservative estimate)
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const availableMemory = Math.min(freeMemory * 0.5, totalMemory * 0.25); // Use 50% of free or 25% of total
    
    const recommendedChunkSize = Math.min(
      availableMemory / memoryMultiplier,
      RefactoredFileStreamService.DEFAULT_CHUNK_SIZE
    );
    
    const estimatedProcessingTime = (fileSize / processingSpeed) * 1000; // milliseconds
    
    return {
      fileSize,
      estimatedMemoryUsage,
      recommendedChunkSize,
      estimatedProcessingTime
    };
  }

  /**
   * Validate file before processing
   */
  async validateFile(filePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file exists
    if (!fs.existsSync(filePath)) {
      errors.push('File not found');
      return { isValid: false, errors, warnings };
    }

    const stats = fs.statSync(filePath);
    
    // Check if it's a directory
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }
    
    // Check file size
    if (stats.size === 0) {
      errors.push('File is empty');
      return { isValid: false, errors, warnings };
    }

    if (stats.size > 5 * 1024 * 1024 * 1024) { // 5GB
      warnings.push('File is very large (>5GB), processing may take a long time');
    }

    // Check file extension
    const mimeType = this.getMimeTypeFromExtension(filePath);
    if (!this.isCsvFile(mimeType) && !this.isExcelFile(mimeType)) {
      warnings.push('File type may not be fully supported');
    }

    // Check read permissions
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (error) {
      errors.push('File is not readable');
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
  }

  /**
   * Stream CSV file with statistics
   */
  async streamCSVWithStats(filePath: string): Promise<{
    previewData: any[];
    fieldInfo: Array<{
      name: string;
      type: string;
      nullCount: number;
      uniqueValues?: number;
    }>;
    recordCount: number;
  }> {
    const previewData: any[] = [];
    const fieldStats = new Map<string, {
      types: Map<string, number>;
      nullCount: number;
      values: Set<any>;
    }>();
    let recordCount = 0;
    let headers: string[] = [];

    await this.streamProcessFile(filePath, {
      onChunk: async (chunk) => {
        if (headers.length === 0 && chunk.data.length > 0) {
          headers = Object.keys(chunk.data[0]);
          headers.forEach(header => {
            fieldStats.set(header, {
              types: new Map(),
              nullCount: 0,
              values: new Set()
            });
          });
        }

        chunk.data.forEach((row: any) => {
          recordCount++;
          
          // Collect preview data (first 100 rows)
          if (previewData.length < 100) {
            previewData.push(row);
          }

          // Analyze field types and values
          headers.forEach(header => {
            const value = row[header];
            const stats = fieldStats.get(header)!;
            
            if (value === null || value === undefined || value === '') {
              stats.nullCount++;
            } else {
              // Track unique values (limit to 1000 for memory)
              if (stats.values.size < 1000) {
                stats.values.add(value);
              }

              // Detect type
              const type = this.detectFieldType(value);
              stats.types.set(type, (stats.types.get(type) || 0) + 1);
            }
          });
        });
      }
    });

    // Convert field stats to field info
    const fieldInfo = headers.map(header => {
      const stats = fieldStats.get(header)!;
      const mostCommonType = Array.from(stats.types.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'string';
      
      return {
        name: header,
        type: mostCommonType,
        nullCount: stats.nullCount,
        uniqueValues: stats.values.size
      };
    });

    return {
      previewData,
      fieldInfo,
      recordCount
    };
  }

  /**
   * Stream Excel file with statistics
   */
  async streamExcelWithStats(filePath: string): Promise<{
    previewData: any[];
    fieldInfo: Array<{
      name: string;
      type: string;
      nullCount: number;
      uniqueValues?: number;
    }>;
    recordCount: number;
  }> {
    const previewData: any[] = [];
    const fieldStats = new Map<string, {
      types: Map<string, number>;
      nullCount: number;
      values: Set<any>;
    }>();
    let recordCount = 0;
    let headers: string[] = [];

    await this.streamProcessFile(filePath, {
      onChunk: async (chunk) => {
        // Excel chunks come as arrays, first row is typically headers
        if (headers.length === 0 && chunk.data.length > 0) {
          if (Array.isArray(chunk.data[0])) {
            headers = chunk.data[0] as string[];
            // Don't remove header row here, it will mess up counting
          } else {
            headers = Object.keys(chunk.data[0]);
          }
          
          headers.forEach(header => {
            fieldStats.set(header, {
              types: new Map(),
              nullCount: 0,
              values: new Set()
            });
          });
        }

        chunk.data.forEach((row: any, index: number) => {
          // Skip header row if it's the first row
          if (headers.length > 0 && index === 0 && Array.isArray(row) && 
              row.every((val, i) => String(val) === String(headers[i]))) {
            return;
          }
          
          recordCount++;
          
          // Convert array row to object if needed
          let rowObj: any = row;
          if (Array.isArray(row)) {
            rowObj = {};
            headers.forEach((header, index) => {
              rowObj[header] = row[index];
            });
          }
          
          // Collect preview data (first 100 rows)
          if (previewData.length < 100) {
            previewData.push(rowObj);
          }

          // Analyze field types and values
          headers.forEach((header, index) => {
            const value = Array.isArray(row) ? row[index] : rowObj[header];
            const stats = fieldStats.get(header)!;
            
            if (value === null || value === undefined || value === '') {
              stats.nullCount++;
            } else {
              // Track unique values (limit to 1000 for memory)
              if (stats.values.size < 1000) {
                stats.values.add(value);
              }

              // Detect type
              const type = this.detectFieldType(value);
              stats.types.set(type, (stats.types.get(type) || 0) + 1);
            }
          });
        });
      }
    });

    // Convert field stats to field info
    const fieldInfo = headers.map(header => {
      const stats = fieldStats.get(header)!;
      const mostCommonType = Array.from(stats.types.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'string';
      
      return {
        name: header,
        type: mostCommonType,
        nullCount: stats.nullCount,
        uniqueValues: stats.values.size
      };
    });

    return {
      previewData,
      fieldInfo,
      recordCount
    };
  }

  /**
   * Detect field type from value with enhanced heuristic scoring
   */
  private detectFieldType(value: any): string {
    if (typeof value === 'number') {
      return 'number';
    }
    
    const strValue = String(value).trim();
    
    // Check if string is a number
    if (/^-?\d+(\.\d+)?$/.test(strValue)) {
      return 'number';
    }
    
    // Check for email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
      return 'email';
    }
    
    // Check for URL
    if (/^https?:\/\/.+/.test(strValue)) {
      return 'url';
    }
    
    // Check for date
    const dateValue = new Date(strValue);
    if (!isNaN(dateValue.getTime()) && strValue.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
      return 'date';
    }
    
    // Check for boolean
    if (strValue.toLowerCase() === 'true' || strValue.toLowerCase() === 'false' || 
        strValue.toLowerCase() === 'yes' || strValue.toLowerCase() === 'no') {
      return 'boolean';
    }
    
    return 'string';
  }

  /**
   * Enhanced field type detection with heuristic scoring and audit logging
   */
  private async detectFieldTypeWithAudit(
    fieldName: string, 
    values: any[], 
    enableGPTEnhancement: boolean = false
  ): Promise<{
    detectedType: string;
    confidence: number;
    heuristicScores: any;
    gptUsed: boolean;
  }> {
    // Calculate heuristic scores
    const heuristicScores = this.calculateHeuristicScores(values);
    
    // Determine initial type based on heuristics
    let detectedType = this.determineTypeFromHeuristics(heuristicScores);
    let confidence = this.calculateTypeConfidence(heuristicScores, detectedType);
    let gptUsed = false;
    let gptEnhancement: any = {
      used: false,
      prompt: '',
      response: '',
      tokens_used: 0,
      reasoning: ''
    };

    // Use GPT enhancement if confidence is low and enabled
    if (enableGPTEnhancement && confidence < 0.7) {
      try {
        const gptResult = await this.enhanceWithGPT(fieldName, values.slice(0, 10));
        if (gptResult.confidence > confidence) {
          detectedType = gptResult.type;
          confidence = gptResult.confidence;
          gptUsed = true;
          gptEnhancement = {
            used: true,
            prompt: gptResult.prompt,
            response: gptResult.response,
            tokens_used: gptResult.tokens_used,
            reasoning: gptResult.reasoning
          };
        }
      } catch (error) {
        console.warn('GPT enhancement failed for field', fieldName, error);
      }
    }

    // Prepare sample tokens for logging
    const sampleTokens = {
      analyzed_samples: values.slice(0, 5).map(v => String(v)),
      safe_samples: values.slice(0, 5).map(v => analysisAuditService.anonymizeText(String(v))),
      pattern_matches: this.extractPatternMatches(values.slice(0, 10), detectedType)
    };

    // Create field detection decision object
    const decision: FieldDetectionDecision = {
      fieldName,
      detectedType,
      heuristicScores: {
        pattern_match: heuristicScores.pattern_match,
        sample_analysis: heuristicScores.sample_analysis,
        statistical_features: heuristicScores.statistical_features,
        gpt_enhancement: gptUsed ? confidence : 0
      },
      gptEnhancement,
      sampleTokens,
      finalConfidence: confidence,
      decision_factors: this.getDecisionFactors(heuristicScores, gptUsed, detectedType)
    };

    // Log the decision for audit trail
    try {
      await analysisAuditService.logFieldDetectionDecision(decision);
    } catch (error) {
      console.warn('Failed to log field detection decision:', error);
    }

    return {
      detectedType,
      confidence,
      heuristicScores: decision.heuristicScores,
      gptUsed
    };
  }

  /**
   * Calculate heuristic scores for field type detection
   */
  private calculateHeuristicScores(values: any[]): any {
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    const total = nonNullValues.length;
    
    if (total === 0) {
      return { pattern_match: 0, sample_analysis: 0, statistical_features: 0 };
    }

    // Pattern matching scores
    const patterns = {
      number: /^-?\d+(\.\d+)?$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/,
      date: /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/,
      boolean: /^(true|false|yes|no)$/i
    };

    const patternScores: any = {};
    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = nonNullValues.filter(v => pattern.test(String(v).trim())).length;
      patternScores[type] = matches / total;
    });

    // Sample analysis scores
    const uniqueValues = new Set(nonNullValues.map(v => String(v).toLowerCase()));
    const uniqueness = uniqueValues.size / total;
    
    // Statistical features
    const avgLength = nonNullValues.reduce((sum, v) => sum + String(v).length, 0) / total;
    const lengthVariation = this.calculateLengthVariation(nonNullValues);

    return {
      pattern_match: Math.max(...Object.values(patternScores)),
      sample_analysis: uniqueness,
      statistical_features: this.normalizeStatisticalScore(avgLength, lengthVariation),
      pattern_scores: patternScores
    };
  }

  /**
   * Determine type from heuristic scores
   */
  private determineTypeFromHeuristics(scores: any): string {
    const { pattern_scores } = scores;
    
    // Find type with highest pattern score
    const sortedTypes = Object.entries(pattern_scores)
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    
    if (sortedTypes.length > 0 && sortedTypes[0][1] > 0.8) {
      return sortedTypes[0][0];
    }
    
    return 'string';
  }

  /**
   * Calculate confidence for detected type
   */
  private calculateTypeConfidence(scores: any, detectedType: string): number {
    const { pattern_match, sample_analysis, statistical_features } = scores;
    
    // Weighted confidence calculation
    const weights = { pattern_match: 0.5, sample_analysis: 0.3, statistical_features: 0.2 };
    
    return Math.min(1.0, 
      pattern_match * weights.pattern_match +
      sample_analysis * weights.sample_analysis +
      statistical_features * weights.statistical_features
    );
  }

  /**
   * Enhance field detection with GPT
   */
  private async enhanceWithGPT(fieldName: string, sampleValues: any[]): Promise<any> {
    const safeSamples = sampleValues.map(v => analysisAuditService.anonymizeText(String(v)));
    
    const prompt = `Analyze the following field and sample values to determine the most likely data type.
Field name: "${fieldName}"
Sample values: ${safeSamples.slice(0, 5).join(', ')}

Consider these types: string, number, email, url, date, boolean

Respond with JSON format:
{
  "type": "detected_type",
  "confidence": 0.95,
  "reasoning": "explanation of decision"
}`;

    try {
      const response = await openaiService.analyzeSentiment(prompt, 'gpt-3.5-turbo');
      const parsed = JSON.parse(response.analysis);
      
      return {
        type: parsed.type,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        prompt,
        response: response.analysis,
        tokens_used: response.usage?.total_tokens || 0
      };
    } catch (error) {
      throw new Error(`GPT enhancement failed: ${error.message}`);
    }
  }

  /**
   * Extract pattern matches from values
   */
  private extractPatternMatches(values: any[], detectedType: string): string[] {
    const patterns: any = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/.+/,
      date: /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/,
      number: /^-?\d+(\.\d+)?$/,
      boolean: /^(true|false|yes|no)$/i
    };

    const pattern = patterns[detectedType];
    if (!pattern) return [];

    return values
      .filter(v => pattern.test(String(v).trim()))
      .slice(0, 3)
      .map(v => analysisAuditService.anonymizeText(String(v)));
  }

  /**
   * Get decision factors for audit logging
   */
  private getDecisionFactors(heuristicScores: any, gptUsed: boolean, detectedType: string): string[] {
    const factors = [];
    
    if (heuristicScores.pattern_match > 0.8) {
      factors.push(`Strong pattern match for ${detectedType}`);
    }
    
    if (heuristicScores.sample_analysis > 0.7) {
      factors.push('High sample uniqueness indicates structured data');
    }
    
    if (gptUsed) {
      factors.push('GPT enhancement provided additional confidence');
    }
    
    if (heuristicScores.statistical_features > 0.6) {
      factors.push('Statistical features support type detection');
    }
    
    return factors.length > 0 ? factors : ['Default heuristic analysis'];
  }

  /**
   * Calculate length variation in values
   */
  private calculateLengthVariation(values: any[]): number {
    const lengths = values.map(v => String(v).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    return Math.sqrt(variance);
  }

  /**
   * Normalize statistical score
   */
  private normalizeStatisticalScore(avgLength: number, lengthVariation: number): number {
    // Higher scores for more structured data (consistent lengths)
    const consistencyScore = Math.max(0, 1 - (lengthVariation / avgLength));
    return Math.min(1.0, consistencyScore);
  }

  /**
   * Enhanced field analysis with audit logging for transparency
   */
  async enhancedFieldAnalysis(
    headers: string[], 
    allRows: any[], 
    enableGPTEnhancement: boolean = false
  ): Promise<Array<{
    name: string;
    type: string;
    confidence: number;
    heuristicScores: any;
    gptUsed: boolean;
    auditId?: string;
  }>> {
    const results = [];

    for (const header of headers) {
      // Collect all values for this field
      const fieldValues = allRows
        .map(row => Array.isArray(row) ? row[headers.indexOf(header)] : row[header])
        .filter(v => v !== null && v !== undefined && v !== '');

      if (fieldValues.length > 0) {
        // Use enhanced detection with audit logging
        const result = await this.detectFieldTypeWithAudit(
          header, 
          fieldValues, 
          enableGPTEnhancement
        );

        results.push({
          name: header,
          type: result.detectedType,
          confidence: result.confidence,
          heuristicScores: result.heuristicScores,
          gptUsed: result.gptUsed
        });
      } else {
        // Fallback for empty fields
        results.push({
          name: header,
          type: 'string',
          confidence: 0.1,
          heuristicScores: { pattern_match: 0, sample_analysis: 0, statistical_features: 0 },
          gptUsed: false
        });
      }
    }

    return results;
  }

  /**
   * Stream CSV file with enhanced field analysis and audit logging
   */
  async streamCSVWithEnhancedStats(
    filePath: string, 
    enableGPTEnhancement: boolean = false
  ): Promise<{
    previewData: any[];
    fieldInfo: Array<{
      name: string;
      type: string;
      confidence?: number;
      heuristicScores?: any;
      gptUsed?: boolean;
      nullCount: number;
      uniqueValues?: number;
    }>;
    recordCount: number;
  }> {
    // First, collect all data for comprehensive analysis
    const allRows: any[] = [];
    let headers: string[] = [];
    let recordCount = 0;
    
    await this.streamProcessFile(filePath, {
      onChunk: async (chunk) => {
        if (headers.length === 0 && chunk.data.length > 0) {
          headers = Object.keys(chunk.data[0]);
        }
        
        chunk.data.forEach((row: any) => {
          allRows.push(row);
          recordCount++;
        });
      }
    });

    // Perform enhanced field analysis
    const enhancedResults = await this.enhancedFieldAnalysis(headers, allRows, enableGPTEnhancement);
    
    // Calculate statistics
    const fieldStats = new Map<string, { nullCount: number; values: Set<any> }>();
    headers.forEach(header => {
      fieldStats.set(header, { nullCount: 0, values: new Set() });
    });
    
    allRows.forEach(row => {
      headers.forEach(header => {
        const value = row[header];
        const stats = fieldStats.get(header)!;
        
        if (value === null || value === undefined || value === '') {
          stats.nullCount++;
        } else {
          if (stats.values.size < 1000) {
            stats.values.add(value);
          }
        }
      });
    });

    // Combine enhanced results with statistics
    const fieldInfo = enhancedResults.map(result => {
      const stats = fieldStats.get(result.name)!;
      return {
        name: result.name,
        type: result.type,
        confidence: result.confidence,
        heuristicScores: result.heuristicScores,
        gptUsed: result.gptUsed,
        nullCount: stats.nullCount,
        uniqueValues: stats.values.size
      };
    });

    return {
      previewData: allRows.slice(0, 100),
      fieldInfo,
      recordCount
    };
  }
}