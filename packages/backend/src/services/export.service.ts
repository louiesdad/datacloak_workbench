import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middleware/error.middleware';
import { getSQLiteConnection } from '../database/sqlite';
import { runDuckDB } from '../database/duckdb';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

export interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  columns?: string[];
  filters?: Record<string, any>;
  chunkSize?: number;
  maxRows?: number;
  includeHeaders?: boolean;
}

export interface ExportProgress {
  exportId: string;
  totalRows: number;
  processedRows: number;
  percentComplete: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  outputPath?: string;
  startTime: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface ChunkedExportResult {
  exportId: string;
  chunks: ExportChunk[];
  totalRows: number;
  totalSize: number;
  format: string;
  completed: boolean;
}

export interface ExportChunk {
  chunkIndex: number;
  startRow: number;
  endRow: number;
  rowCount: number;
  size: number;
  path: string;
  created: Date;
}

export class ExportService {
  private static readonly DEFAULT_CHUNK_SIZE = 10000; // 10k rows per chunk
  private static readonly EXPORT_DIR = 'exports';
  private activeExports: Map<string, ExportProgress> = new Map();

  constructor() {
    // Ensure export directory exists
    const exportPath = path.join(process.cwd(), ExportService.EXPORT_DIR);
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
  }

  /**
   * Export large dataset with chunking support
   */
  async exportLargeDataset(
    tableName: string,
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ChunkedExportResult> {
    const exportId = uuidv4();
    const startTime = new Date();
    
    // Initialize export progress
    const progress: ExportProgress = {
      exportId,
      totalRows: 0,
      processedRows: 0,
      percentComplete: 0,
      status: 'pending',
      startTime
    };
    
    this.activeExports.set(exportId, progress);

    try {
      // Get total row count
      const totalRows = await this.getRowCount(tableName, options.filters);
      progress.totalRows = totalRows;
      progress.status = 'processing';
      
      if (onProgress) onProgress(progress);

      const chunkSize = options.chunkSize || ExportService.DEFAULT_CHUNK_SIZE;
      const chunks: ExportChunk[] = [];
      let offset = 0;
      let totalSize = 0;
      
      // Apply max rows limit if specified
      const maxRows = options.maxRows || totalRows;
      const actualRowsToExport = Math.min(totalRows, maxRows);

      while (offset < actualRowsToExport) {
        const limit = Math.min(chunkSize, actualRowsToExport - offset);
        
        // Export chunk
        const chunk = await this.exportChunk(
          tableName,
          options,
          offset,
          limit,
          chunks.length
        );
        
        chunks.push(chunk);
        totalSize += chunk.size;
        offset += limit;
        
        // Update progress
        progress.processedRows = offset;
        progress.percentComplete = Math.round((offset / actualRowsToExport) * 100);
        
        // Estimate time remaining
        const elapsed = Date.now() - startTime.getTime();
        const rowsPerMs = offset / elapsed;
        const remainingRows = actualRowsToExport - offset;
        progress.estimatedTimeRemaining = remainingRows / rowsPerMs;
        
        if (onProgress) onProgress(progress);
        
        // Allow other operations to process
        await new Promise(resolve => setImmediate(resolve));
      }

      // Finalize export
      progress.status = 'completed';
      progress.endTime = new Date();
      progress.percentComplete = 100;
      
      if (onProgress) onProgress(progress);

      // If single chunk and not too large, merge into single file
      let finalResult: ChunkedExportResult;
      
      if (chunks.length === 1) {
        finalResult = {
          exportId,
          chunks,
          totalRows: actualRowsToExport,
          totalSize,
          format: options.format,
          completed: true
        };
      } else if (options.format !== 'excel' && totalSize < 100 * 1024 * 1024) { // 100MB
        // Merge chunks for CSV/JSON if under size limit
        const mergedPath = await this.mergeChunks(exportId, chunks, options.format);
        finalResult = {
          exportId,
          chunks: [{
            chunkIndex: 0,
            startRow: 0,
            endRow: actualRowsToExport - 1,
            rowCount: actualRowsToExport,
            size: totalSize,
            path: mergedPath,
            created: new Date()
          }],
          totalRows: actualRowsToExport,
          totalSize,
          format: options.format,
          completed: true
        };
        
        // Clean up individual chunks
        for (const chunk of chunks) {
          fs.unlinkSync(chunk.path);
        }
      } else {
        finalResult = {
          exportId,
          chunks,
          totalRows: actualRowsToExport,
          totalSize,
          format: options.format,
          completed: true
        };
      }

      return finalResult;

    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : 'Export failed';
      progress.endTime = new Date();
      
      if (onProgress) onProgress(progress);
      
      throw new AppError(
        `Export failed: ${progress.error}`,
        500,
        'EXPORT_FAILED'
      );
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.activeExports.delete(exportId);
      }, 3600000); // 1 hour
    }
  }

  /**
   * Export a single chunk of data
   */
  private async exportChunk(
    tableName: string,
    options: ExportOptions,
    offset: number,
    limit: number,
    chunkIndex: number
  ): Promise<ExportChunk> {
    const data = await this.getDataChunk(tableName, options, offset, limit);
    const exportPath = path.join(
      process.cwd(),
      ExportService.EXPORT_DIR,
      `export_${tableName}_${chunkIndex}_${Date.now()}.${options.format}`
    );

    let size = 0;

    switch (options.format) {
      case 'csv':
        size = await this.exportToCsv(data, exportPath, options.includeHeaders && chunkIndex === 0);
        break;
      case 'json':
        size = await this.exportToJson(data, exportPath);
        break;
      case 'excel':
        size = await this.exportToExcel(data, exportPath, options.includeHeaders !== false);
        break;
      default:
        throw new AppError('Unsupported export format', 400, 'UNSUPPORTED_FORMAT');
    }

    return {
      chunkIndex,
      startRow: offset,
      endRow: offset + data.length - 1,
      rowCount: data.length,
      size,
      path: exportPath,
      created: new Date()
    };
  }

  /**
   * Get data chunk from database
   */
  private async getDataChunk(
    tableName: string,
    options: ExportOptions,
    offset: number,
    limit: number
  ): Promise<any[]> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Build query with filters and column selection
    let query = `SELECT `;
    
    if (options.columns && options.columns.length > 0) {
      query += options.columns.map(col => `"${col}"`).join(', ');
    } else {
      query += '*';
    }
    
    query += ` FROM ${tableName}`;
    
    // Add filters
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`"${key}" = ?`);
          params.push(value);
        }
      }
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const stmt = db.prepare(query);
      return stmt.all(...params) as any[];
    } catch (error) {
      throw new AppError(
        `Failed to fetch data chunk: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'DATA_FETCH_ERROR'
      );
    }
  }

  /**
   * Get total row count for export
   */
  private async getRowCount(tableName: string, filters?: Record<string, any>): Promise<number> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];
    
    if (filters) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          conditions.push(`"${key}" = ?`);
          params.push(value);
        }
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    try {
      const stmt = db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      throw new AppError(
        `Failed to get row count: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'COUNT_ERROR'
      );
    }
  }

  /**
   * Export data to CSV format
   */
  private async exportToCsv(data: any[], filePath: string, includeHeaders: boolean): Promise<number> {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '');
      return 0;
    }

    const headers = Object.keys(data[0]);
    const rows: string[] = [];
    
    if (includeHeaders) {
      rows.push(headers.map(h => `"${h}"`).join(','));
    }
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value.toString();
      });
      rows.push(values.join(','));
    }
    
    const content = rows.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    
    return Buffer.byteLength(content, 'utf-8');
  }

  /**
   * Export data to JSON format
   */
  private async exportToJson(data: any[], filePath: string): Promise<number> {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    return Buffer.byteLength(content, 'utf-8');
  }

  /**
   * Export data to Excel format
   */
  private async exportToExcel(data: any[], filePath: string, includeHeaders: boolean): Promise<number> {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { header: includeHeaders ? undefined : 1 });
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, filePath);
    
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Merge multiple chunks into a single file
   */
  private async mergeChunks(exportId: string, chunks: ExportChunk[], format: string): Promise<string> {
    const mergedPath = path.join(
      process.cwd(),
      ExportService.EXPORT_DIR,
      `export_merged_${exportId}.${format}`
    );

    if (format === 'csv') {
      const writeStream = fs.createWriteStream(mergedPath);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const content = fs.readFileSync(chunk.path, 'utf-8');
        
        if (i === 0) {
          // Include headers from first chunk
          writeStream.write(content);
        } else {
          // Skip headers in subsequent chunks
          const lines = content.split('\n');
          writeStream.write('\n' + lines.slice(1).join('\n'));
        }
      }
      
      writeStream.end();
      
      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(mergedPath));
        writeStream.on('error', reject);
      });
      
    } else if (format === 'json') {
      const allData: any[] = [];
      
      for (const chunk of chunks) {
        const content = fs.readFileSync(chunk.path, 'utf-8');
        const data = JSON.parse(content);
        allData.push(...data);
      }
      
      fs.writeFileSync(mergedPath, JSON.stringify(allData, null, 2));
      return mergedPath;
      
    } else {
      throw new AppError('Cannot merge Excel files', 400, 'MERGE_NOT_SUPPORTED');
    }
  }

  /**
   * Get export progress
   */
  getExportProgress(exportId: string): ExportProgress | undefined {
    return this.activeExports.get(exportId);
  }

  /**
   * Cancel an active export
   */
  cancelExport(exportId: string): boolean {
    const progress = this.activeExports.get(exportId);
    if (progress && progress.status === 'processing') {
      progress.status = 'failed';
      progress.error = 'Export cancelled by user';
      progress.endTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * Clean up old export files
   */
  async cleanupOldExports(maxAgeHours: number = 24): Promise<number> {
    const exportPath = path.join(process.cwd(), ExportService.EXPORT_DIR);
    const files = fs.readdirSync(exportPath);
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(exportPath, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Create a streaming export for very large datasets
   */
  createExportStream(
    tableName: string,
    options: ExportOptions
  ): Readable {
    const chunkSize = options.chunkSize || ExportService.DEFAULT_CHUNK_SIZE;
    let offset = 0;
    let isFirstChunk = true;
    let isDone = false;

    const stream = new Readable({
      async read() {
        if (isDone) {
          this.push(null);
          return;
        }

        try {
          const data = await this.getDataChunk(tableName, options, offset, chunkSize);
          
          if (data.length === 0) {
            isDone = true;
            this.push(null);
            return;
          }

          let chunk: string;
          
          switch (options.format) {
            case 'csv':
              chunk = this.dataToCSVString(data, isFirstChunk && options.includeHeaders !== false);
              break;
            case 'json':
              if (isFirstChunk) {
                chunk = '[\n' + data.map(row => JSON.stringify(row)).join(',\n');
              } else {
                chunk = ',\n' + data.map(row => JSON.stringify(row)).join(',\n');
              }
              if (data.length < chunkSize) {
                chunk += '\n]';
              }
              break;
            default:
              throw new Error('Streaming not supported for Excel format');
          }

          this.push(chunk);
          offset += data.length;
          isFirstChunk = false;
          
          if (data.length < chunkSize) {
            isDone = true;
          }
        } catch (error) {
          this.destroy(error as Error);
        }
      }
    });

    return stream;
  }

  private dataToCSVString(data: any[], includeHeaders: boolean): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows: string[] = [];
    
    if (includeHeaders) {
      rows.push(headers.map(h => `"${h}"`).join(','));
    }
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value.toString();
      });
      rows.push(values.join(','));
    }
    
    return rows.join('\n') + '\n';
  }
}