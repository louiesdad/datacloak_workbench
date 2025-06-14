import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { AppError } from '../middleware/error.middleware';

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

export class FileStreamService {
  private static readonly DEFAULT_CHUNK_SIZE = 256 * 1024 * 1024; // 256MB
  private static readonly CSV_BUFFER_SIZE = 64 * 1024; // 64KB for CSV parsing
  
  /**
   * Stream process a large file in chunks
   */
  async streamProcessFile(
    filePath: string,
    options: {
      chunkSize?: number;
      mimeType?: string;
      onProgress?: (progress: StreamProgress) => void;
      onChunk?: (chunk: FileChunkResult) => Promise<void>;
      maxRows?: number;
    } = {}
  ): Promise<{
    totalRows: number;
    totalBytes: number;
    chunksProcessed: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const chunkSize = options.chunkSize || FileStreamService.DEFAULT_CHUNK_SIZE;
    
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;

    const mimeType = options.mimeType || this.getMimeTypeFromExtension(filePath);
    
    // Progress tracking
    const progressTracker = {
      startTime,
      rowsPerSecond: 0,
      lastProgressTime: startTime
    };

    try {
      if (this.isCsvFile(mimeType)) {
        const result = await this.streamProcessCsv(filePath, {
          chunkSize,
          totalSize,
          onProgress: (progress) => {
            this.updateProgressTracking(progress, progressTracker);
            options.onProgress?.(progress);
          },
          onChunk: options.onChunk,
          maxRows: options.maxRows
        });
        
        return {
          totalRows: result.totalRows,
          totalBytes: totalSize,
          chunksProcessed: result.chunksProcessed,
          processingTime: Date.now() - startTime
        };
      } else if (this.isExcelFile(mimeType)) {
        const result = await this.streamProcessExcel(filePath, {
          chunkSize,
          totalSize,
          onProgress: (progress) => {
            this.updateProgressTracking(progress, progressTracker);
            options.onProgress?.(progress);
          },
          onChunk: options.onChunk,
          maxRows: options.maxRows
        });
        
        return {
          totalRows: result.totalRows,
          totalBytes: totalSize,
          chunksProcessed: result.chunksProcessed,
          processingTime: Date.now() - startTime
        };
      } else {
        throw new AppError('Unsupported file type for streaming', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to stream process file', 500, 'STREAM_PROCESSING_ERROR');
    }
  }

  /**
   * Get file chunks for manual processing
   */
  async getFileChunks(
    filePath: string,
    chunkSize: number = FileStreamService.DEFAULT_CHUNK_SIZE
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
   * Read a specific chunk of a file
   */
  async readFileChunk(filePath: string, chunkInfo: ChunkInfo): Promise<Buffer> {
    const stream = createReadStream(filePath, {
      start: chunkInfo.startByte,
      end: chunkInfo.endByte
    });

    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Stream process CSV files with chunking
   */
  private async streamProcessCsv(
    filePath: string,
    options: {
      chunkSize: number;
      totalSize: number;
      onProgress?: (progress: StreamProgress) => void;
      onChunk?: (chunk: FileChunkResult) => Promise<void>;
      maxRows?: number;
    }
  ): Promise<{ totalRows: number; chunksProcessed: number }> {
    let totalRows = 0;
    let chunksProcessed = 0;
    let bytesProcessed = 0;
    const totalChunks = Math.ceil(options.totalSize / options.chunkSize);

    return new Promise((resolve, reject) => {
      const csvStream = createReadStream(filePath, { 
        highWaterMark: FileStreamService.CSV_BUFFER_SIZE 
      });
      
      let currentChunkData: any[] = [];
      let currentChunkRows = 0;
      let currentChunkBytes = 0;
      
      const csvParser = csv();

      csvParser.on('data', async (row) => {
        currentChunkData.push(row);
        currentChunkRows++;
        totalRows++;
        
        // Estimate bytes for progress tracking
        const rowBytes = JSON.stringify(row).length;
        currentChunkBytes += rowBytes;
        bytesProcessed += rowBytes;

        // Check if we've reached chunk size or max rows
        if (currentChunkBytes >= options.chunkSize || 
            (options.maxRows && totalRows >= options.maxRows)) {
          
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
              hasMore: true
            };

            try {
              await options.onChunk(chunkResult);
            } catch (error) {
              csvParser.destroy();
              reject(error);
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
            csvParser.destroy();
            return;
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
            hasMore: false
          };

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

      csvParser.on('error', reject);
      csvStream.pipe(csvParser);
    });
  }

  /**
   * Stream process Excel files with chunking
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
    // For Excel files, we need to load the entire file first due to binary format
    // Then we can process it in row chunks
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = XLSX.utils.sheet_to_json(worksheet);
    
    let totalRows = allData.length;
    let chunksProcessed = 0;
    
    // Calculate rows per chunk based on estimated memory usage
    const averageRowSize = options.totalSize / totalRows;
    const rowsPerChunk = Math.floor(options.chunkSize / averageRowSize);
    const totalChunks = Math.ceil(totalRows / rowsPerChunk);

    // Apply max rows limit if specified
    if (options.maxRows && totalRows > options.maxRows) {
      totalRows = options.maxRows;
    }

    for (let i = 0; i < totalRows; i += rowsPerChunk) {
      const endIndex = Math.min(i + rowsPerChunk, totalRows);
      const chunkData = allData.slice(i, endIndex);
      
      if (options.onChunk) {
        const chunkResult: FileChunkResult = {
          chunkInfo: {
            chunkIndex: chunksProcessed,
            startByte: (i / totalRows) * options.totalSize,
            endByte: (endIndex / totalRows) * options.totalSize,
            totalSize: options.totalSize,
            totalChunks,
            isLastChunk: endIndex >= totalRows
          },
          data: chunkData,
          processedRows: chunkData.length,
          hasMore: endIndex < totalRows
        };

        await options.onChunk(chunkResult);
      }

      // Report progress
      if (options.onProgress) {
        const progress: StreamProgress = {
          bytesProcessed: (endIndex / allData.length) * options.totalSize,
          totalBytes: options.totalSize,
          rowsProcessed: endIndex,
          chunksProcessed: chunksProcessed + 1,
          totalChunks,
          percentComplete: (endIndex / totalRows) * 100
        };
        options.onProgress(progress);
      }

      chunksProcessed++;
    }

    return { totalRows, chunksProcessed };
  }

  private updateProgressTracking(progress: StreamProgress, tracker: any): void {
    const now = Date.now();
    const elapsed = (now - tracker.startTime) / 1000; // seconds
    
    if (elapsed > 0) {
      progress.averageRowsPerSecond = progress.rowsProcessed / elapsed;
      
      if (progress.percentComplete > 0) {
        const estimatedTotalTime = elapsed / (progress.percentComplete / 100);
        progress.estimatedTimeRemaining = (estimatedTotalTime - elapsed) * 1000; // milliseconds
      }
    }
  }

  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.csv':
        return 'text/csv';
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
    return mimeType === 'text/csv' || mimeType === 'text/plain';
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
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Conservative estimate: 3x file size for memory usage during processing
    const estimatedMemoryUsage = fileSize * 3;
    
    // Recommend chunk size based on available memory (assume 25% of 1GB available)
    const availableMemory = 256 * 1024 * 1024; // 256MB
    const recommendedChunkSize = Math.min(availableMemory, FileStreamService.DEFAULT_CHUNK_SIZE);
    
    // Estimate processing time based on file size (rough estimate: 100MB/second)
    const estimatedProcessingTime = (fileSize / (100 * 1024 * 1024)) * 1000; // milliseconds
    
    return {
      fileSize,
      estimatedMemoryUsage,
      recommendedChunkSize,
      estimatedProcessingTime
    };
  }
}