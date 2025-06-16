import { getSQLiteConnection } from '../database/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { SecurityService } from './security.service';
import { FileStreamService } from './file-stream.service';
import { DataCloakStreamService, DataCloakStreamOptions } from './datacloak-stream.service';

export interface Dataset {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  recordCount: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisBatch {
  id: string;
  datasetId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  completedRecords: number;
  createdAt: string;
  updatedAt: string;
}

export interface FieldStatistics {
  name: string;
  type: string;
  sampleValues: any[];
  nullCount: number;
  totalCount: number;
  uniqueCount: number;
  completeness: number; // percentage of non-null values
  uniqueness: number; // percentage of unique values
  mostCommonValue?: any;
  mostCommonValueCount?: number;
  minLength?: number;
  maxLength?: number;
  averageLength?: number;
  piiDetected?: boolean;
  piiType?: string;
  warnings?: string[];
}

export interface StreamingOptions {
  chunkSize?: number; // 8KB to 4MB
  maxMemoryUsage?: number; // Maximum memory to use (MB)
  batchSize?: number; // Records per batch
  enableProgressTracking?: boolean;
  onProgress?: (progress: StreamProgress) => void;
}

export interface StreamProgress {
  processedBytes: number;
  totalBytes: number;
  processedRecords: number;
  estimatedTotalRecords?: number;
  percentComplete: number;
  bytesPerSecond: number;
  estimatedTimeRemaining?: number;
}

export interface UploadResult {
  dataset: Dataset;
  previewData: any[];
  fieldInfo: FieldStatistics[];
  securityScan?: {
    piiItemsDetected: number;
    complianceScore: number;
    riskLevel: string;
    recommendations: string[];
  };
}

export class DataService {
  private securityService: SecurityService;
  private fileStreamService: FileStreamService;
  private dataCloakStreamService: DataCloakStreamService;
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

  constructor() {
    this.securityService = new SecurityService();
    this.fileStreamService = new FileStreamService();
    this.dataCloakStreamService = new DataCloakStreamService();
  }
  private getUploadDir(): string {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
  }

  async uploadDataset(file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new AppError('No file provided', 400, 'NO_FILE');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError('Unsupported file type. Only CSV and Excel files are allowed.', 400, 'INVALID_FILE_TYPE');
    }

    const datasetId = uuidv4();
    const uploadDir = this.getUploadDir();
    const fileExtension = path.extname(file.originalname);
    const filename = `${datasetId}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);

    try {
      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Parse file and get preview data
      const { previewData, fieldInfo, recordCount } = await this.parseFile(filePath, file.mimetype);

      // Perform security scan
      let securityScan;
      try {
        await this.securityService.initialize();
        const scanResult = await this.securityService.scanDataset(datasetId);
        
        securityScan = {
          piiItemsDetected: scanResult.piiItemsDetected,
          complianceScore: scanResult.complianceScore,
          riskLevel: this.getRiskLevel(scanResult.complianceScore),
          recommendations: scanResult.recommendations
        };

        // Enhance field info with PII detection
        const enhancedFieldInfo = await this.enhanceFieldInfoWithPII(fieldInfo, previewData);
        
        // Store dataset metadata in SQLite with security information
        const db = getSQLiteConnection();
        if (!db) {
          throw new AppError('Database connection not available', 500, 'DB_ERROR');
        }

        const stmt = db.prepare(`
          INSERT INTO datasets (id, filename, original_filename, size, record_count, mime_type, 
                               pii_detected, compliance_score, risk_level)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          datasetId,
          filename,
          file.originalname,
          file.size,
          recordCount,
          file.mimetype,
          scanResult.piiItemsDetected > 0 ? 1 : 0,
          scanResult.complianceScore,
          this.getRiskLevel(scanResult.complianceScore)
        );

        // Get the created dataset
        const dataset = this.getDatasetById(datasetId);

        return {
          dataset,
          previewData,
          fieldInfo: enhancedFieldInfo,
          securityScan,
        };

      } catch (securityError) {
        console.warn('Security scan failed, proceeding without security information:', securityError);
        
        // Store dataset metadata in SQLite without security information
        const db = getSQLiteConnection();
        if (!db) {
          throw new AppError('Database connection not available', 500, 'DB_ERROR');
        }

        const stmt = db.prepare(`
          INSERT INTO datasets (id, filename, original_filename, size, record_count, mime_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          datasetId,
          filename,
          file.originalname,
          file.size,
          recordCount,
          file.mimetype
        );

        // Get the created dataset
        const dataset = this.getDatasetById(datasetId);

        return {
          dataset,
          previewData,
          fieldInfo,
        };
      }

    } catch (error) {
      // Clean up file if upload failed
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to process uploaded file', 500, 'UPLOAD_PROCESSING_ERROR');
    }
  }

  private async parseFile(filePath: string, mimeType: string): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    const previewSize = 100; // Number of rows to preview
    const fileStats = fs.statSync(filePath);
    const isLargeFile = fileStats.size > DataService.LARGE_FILE_THRESHOLD;

    if (isLargeFile) {
      console.log(`Processing large file (${Math.round(fileStats.size / 1024 / 1024)}MB) using chunked streaming`);
      return this.parseFileWithStreaming(filePath, mimeType, previewSize);
    }

    // Use original parsing for smaller files
    if (mimeType === 'text/csv' || mimeType === 'text/plain') {
      return this.parseCsvFile(filePath, previewSize);
    } else {
      return this.parseExcelFile(filePath, previewSize);
    }
  }

  private async parseFileWithStreaming(filePath: string, mimeType: string, previewSize: number): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    let previewData: any[] = [];
    let allData: any[] = [];
    let recordCount = 0;
    let previewComplete = false;
    let piiDetectionInfo: Record<string, any> = {};

    // Get optimal chunk size for this file
    const optimalChunkSize = await this.dataCloakStreamService.getOptimalChunkSize(filePath);
    console.log(`Using optimal chunk size: ${Math.round(optimalChunkSize / 1024 / 1024)}MB for file processing`);

    const progressCallback = (progress: any) => {
      console.log(`Processing: ${progress.percentComplete.toFixed(1)}% complete, ${progress.processedRecords || progress.rowsProcessed || 0} rows processed`);
      if (progress.averageRowsPerSecond || progress.bytesPerSecond) {
        const speed = progress.averageRowsPerSecond || Math.round(progress.bytesPerSecond / 100); // Estimate rows from bytes
        console.log(`Speed: ${Math.round(speed)} rows/second`);
      }
      if (progress.estimatedTimeRemaining) {
        const remainingMinutes = Math.round(progress.estimatedTimeRemaining / 1000 / 60);
        console.log(`Estimated time remaining: ${remainingMinutes} minutes`);
      }
    };

    const chunkCallback = async (chunkResult: any) => {
      recordCount += chunkResult.processedRows;
      
      // Use masked data if available (from DataCloak processing)
      const dataToProcess = chunkResult.maskedData || chunkResult.data;
      
      // Collect preview data from first chunk
      if (!previewComplete && dataToProcess.length > 0) {
        const remainingPreviewNeeded = previewSize - previewData.length;
        if (remainingPreviewNeeded > 0) {
          previewData.push(...dataToProcess.slice(0, remainingPreviewNeeded));
          if (previewData.length >= previewSize) {
            previewComplete = true;
          }
        }
      }

      // For field analysis, we need a sample of data from across the file
      // Take a sample from each chunk to get representative field info
      if (dataToProcess.length > 0) {
        const sampleSize = Math.min(50, dataToProcess.length);
        allData.push(...dataToProcess.slice(0, sampleSize));
        
        // Limit total sample size to prevent memory issues
        if (allData.length > 10000) {
          allData = allData.slice(0, 10000);
        }
      }

      // Collect PII detection info from DataCloak
      if (chunkResult.piiDetectionResults) {
        chunkResult.piiDetectionResults.forEach((pii: any) => {
          if (!piiDetectionInfo[pii.fieldName]) {
            piiDetectionInfo[pii.fieldName] = {
              piiDetected: true,
              piiTypes: new Set(),
              confidence: 0
            };
          }
          piiDetectionInfo[pii.fieldName].piiTypes.add(pii.piiType);
          piiDetectionInfo[pii.fieldName].confidence = Math.max(
            piiDetectionInfo[pii.fieldName].confidence,
            pii.confidence
          );
        });
      }
    };

    const piiDetectedCallback = (piiResults: any[]) => {
      console.log(`PII detected in chunk: ${piiResults.length} items found`);
    };

    // Create memory monitor for large file processing
    const memoryMonitor = this.dataCloakStreamService.createMemoryMonitor();
    memoryMonitor.start();

    try {
      const streamResult = await this.dataCloakStreamService.streamProcessWithDataCloak(filePath, {
        mimeType,
        onProgress: progressCallback,
        onChunk: chunkCallback,
        onPIIDetected: piiDetectedCallback,
        chunkSize: optimalChunkSize,
        preservePII: false, // Mask PII by default for security
        maskingOptions: {
          email: true,
          phone: true,
          ssn: true,
          creditCard: true,
          address: true,
          name: true
        }
      });

      memoryMonitor.stop();
      const memoryStats = memoryMonitor.getStats();
      
      console.log(`Streaming complete: ${streamResult.totalRows} rows processed in ${streamResult.processingTime}ms`);
      console.log(`Memory usage - Peak: ${memoryStats.peak.toFixed(2)}MB, Final: ${memoryStats.current.toFixed(2)}MB`);
      console.log(`PII Summary: ${streamResult.piiSummary.totalPIIItems} items found across ${streamResult.piiSummary.fieldsWithPII.length} fields`);

      // Analyze fields with PII information
      const fieldInfo = this.analyzeFields(allData);
      
      // Enhance field info with DataCloak PII detection results
      const enhancedFieldInfo = fieldInfo.map(field => {
        const piiInfo = piiDetectionInfo[field.name];
        if (piiInfo) {
          return {
            ...field,
            piiDetected: true,
            piiType: Array.from(piiInfo.piiTypes).join(', '),
            warnings: [
              ...(field.warnings || []),
              `Contains PII: ${Array.from(piiInfo.piiTypes).join(', ')} (confidence: ${Math.round(piiInfo.confidence * 100)}%)`
            ]
          };
        }
        return field;
      });

      return {
        previewData,
        fieldInfo: enhancedFieldInfo,
        recordCount: streamResult.totalRows,
      };
    } catch (error) {
      memoryMonitor.stop();
      console.error('DataCloak streaming failed, falling back to regular streaming:', error);
      
      // Fallback to regular file stream service if DataCloak fails
      try {
        const streamResult = await this.fileStreamService.streamProcessFile(filePath, {
          mimeType,
          onProgress: progressCallback,
          onChunk: chunkCallback,
          chunkSize: optimalChunkSize
        });

        console.log(`Fallback streaming complete: ${streamResult.totalRows} rows processed`);
        const fieldInfo = this.analyzeFields(allData);

        return {
          previewData,
          fieldInfo,
          recordCount: streamResult.totalRows,
        };
      } catch (fallbackError) {
        console.error('Streaming file processing failed, falling back to regular parsing:', fallbackError);
        // Final fallback to regular parsing for smaller files
        if (mimeType === 'text/csv' || mimeType === 'text/plain') {
          return this.parseCsvFile(filePath, previewSize);
        } else {
          return this.parseExcelFile(filePath, previewSize);
        }
      }
    }
  }

  private async parseCsvFile(filePath: string, previewSize: number): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    return new Promise(async (resolve, reject) => {
      const results: any[] = [];
      let lineCount = 0;
      let headerCount = 0;
      
      // First, validate the CSV structure
      try {
        await this.validateCsvStructure(filePath);
      } catch (error) {
        reject(error);
        return;
      }
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers: string[]) => {
          headerCount = headers.length;
          
          // Validate headers
          if (headers.length === 0) {
            reject(new AppError('CSV file has no headers', 400, 'MALFORMED_CSV'));
            return;
          }
          
          // Check for empty header names
          const emptyHeaders = headers.filter(h => !h || h.trim() === '');
          if (emptyHeaders.length > 0) {
            reject(new AppError('CSV file contains empty column names', 400, 'MALFORMED_CSV'));
            return;
          }
          
          // Check for duplicate headers
          const duplicateHeaders = headers.filter((h, i) => headers.indexOf(h) !== i);
          if (duplicateHeaders.length > 0) {
            reject(new AppError(`CSV file contains duplicate column names: ${duplicateHeaders.join(', ')}`, 400, 'MALFORMED_CSV'));
            return;
          }
        })
        .on('data', (data: any) => {
          lineCount++;
          
          // Validate row structure
          const columns = Object.keys(data);
          if (columns.length !== headerCount) {
            reject(new AppError(`Row ${lineCount} has incorrect number of columns. Expected ${headerCount}, got ${columns.length}`, 400, 'MALFORMED_CSV'));
            return;
          }
          
          results.push(data);
        })
        .on('end', () => {
          // Validate we have data
          if (results.length === 0) {
            reject(new AppError('CSV file contains no data rows', 400, 'MALFORMED_CSV'));
            return;
          }
          
          const previewData = results.slice(0, previewSize);
          const fieldInfo = this.analyzeFields(results);
          resolve({
            previewData,
            fieldInfo,
            recordCount: results.length,
          });
        })
        .on('error', (error) => {
          // Transform CSV parsing errors into user-friendly messages
          if (error.message.includes('Invalid Record Length')) {
            reject(new AppError('CSV file has inconsistent column counts between rows', 400, 'MALFORMED_CSV'));
          } else if (error.message.includes('Unexpected Error')) {
            reject(new AppError('CSV file is corrupted or has invalid format', 400, 'MALFORMED_CSV'));
          } else {
            reject(new AppError(`Invalid CSV format: ${error.message}`, 400, 'MALFORMED_CSV'));
          }
        });
    });
  }

  private parseExcelFile(filePath: string, previewSize: number): {
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  } {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = XLSX.utils.sheet_to_json(worksheet);

    const previewData = allData.slice(0, previewSize);
    const fieldInfo = this.analyzeFields(allData);

    return {
      previewData,
      fieldInfo,
      recordCount: allData.length,
    };
  }

  /**
   * Stream process large files with configurable chunk sizes (8KB-4MB)
   */
  async processLargeFileStream(
    filePath: string, 
    options: StreamingOptions = {}
  ): Promise<{ fieldInfo: FieldStatistics[]; recordCount: number; sampleData: any[] }> {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Route to appropriate streaming processor
    if (fileExtension === '.csv' || fileExtension === '.tsv') {
      return this.processCSVStream(filePath, options);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      return this.processExcelStream(filePath, options);
    } else {
      throw new AppError(`Unsupported file format: ${fileExtension}`, 400, 'UNSUPPORTED_FORMAT');
    }
  }

  /**
   * Stream process CSV files with configurable chunk sizes
   */
  private async processCSVStream(
    filePath: string, 
    options: StreamingOptions = {}
  ): Promise<{ fieldInfo: FieldStatistics[]; recordCount: number; sampleData: any[] }> {
    // Validate chunk size (8KB to 4MB)
    const chunkSize = Math.max(8 * 1024, Math.min(options.chunkSize || 64 * 1024, 4 * 1024 * 1024));
    const batchSize = options.batchSize || 1000;
    const maxMemoryUsage = (options.maxMemoryUsage || 500) * 1024 * 1024; // Convert MB to bytes
    
    const stats = fs.statSync(filePath);
    const totalBytes = stats.size;
    const startTime = Date.now();
    
    let processedBytes = 0;
    let processedRecords = 0;
    let allData: any[] = [];
    let sampleData: any[] = [];
    const maxSampleSize = 1000;
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { 
        encoding: 'utf8', 
        highWaterMark: chunkSize 
      });
      
      stream
        .pipe(csv())
        .on('data', (record: any) => {
          processedRecords++;
          
          // Keep sample data for analysis
          if (sampleData.length < maxSampleSize) {
            sampleData.push(record);
          }
          
          // Store all data for smaller files, or sample for large files
          if (processedBytes < maxMemoryUsage || allData.length < 10000) {
            allData.push(record);
          }
          
          // Track progress
          if (options.enableProgressTracking && options.onProgress && processedRecords % 100 === 0) {
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000;
            const bytesPerSecond = processedBytes / elapsedTime;
            const percentComplete = Math.min((processedBytes / totalBytes) * 100, 100);
            
            options.onProgress({
              processedBytes,
              totalBytes,
              processedRecords,
              percentComplete,
              bytesPerSecond,
              estimatedTimeRemaining: elapsedTime > 0 ? ((totalBytes - processedBytes) / bytesPerSecond) : undefined
            });
          }
        })
        .on('end', () => {
          try {
            const fieldInfo = this.analyzeFields(sampleData);
            resolve({
              fieldInfo,
              recordCount: processedRecords,
              sampleData: sampleData.slice(0, 100) // Return first 100 for preview
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(new AppError(`Failed to process CSV file: ${error.message}`, 500, 'FILE_PROCESSING_ERROR'));
        });
      
      // Track bytes processed
      stream.on('data', (chunk: string | Buffer) => {
        processedBytes += Buffer.byteLength(chunk.toString(), 'utf8');
      });
    });
  }

  /**
   * Stream process Excel files with configurable chunk sizes and memory management
   */
  private async processExcelStream(
    filePath: string, 
    options: StreamingOptions = {}
  ): Promise<{ fieldInfo: FieldStatistics[]; recordCount: number; sampleData: any[] }> {
    const batchSize = options.batchSize || 1000;
    const maxMemoryUsage = (options.maxMemoryUsage || 500) * 1024 * 1024; // Convert MB to bytes
    
    const stats = fs.statSync(filePath);
    const totalBytes = stats.size;
    const startTime = Date.now();
    
    let processedBytes = 0;
    let processedRecords = 0;
    let sampleData: any[] = [];
    const maxSampleSize = 1000;
    
    try {
      // Read Excel file with streaming options
      const workbook = XLSX.readFile(filePath, {
        dense: false, // Use object mode for memory efficiency
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new AppError('Excel file contains no worksheets', 400, 'INVALID_EXCEL');
      }
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to stream-like processing
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const totalRows = range.e.r - range.s.r + 1;
      
      // Process Excel data in batches to manage memory
      const headers: string[] = [];
      let currentRow = range.s.r;
      
      // Get headers from first row
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellAddress];
        headers.push(cell ? String(cell.v) : `Column_${col + 1}`);
      }
      
      currentRow++; // Skip header row
      
      // Process data in batches
      while (currentRow <= range.e.r) {
        const batchEnd = Math.min(currentRow + batchSize - 1, range.e.r);
        const batchData: any[] = [];
        
        // Process batch of rows
        for (let row = currentRow; row <= batchEnd; row++) {
          const record: any = {};
          
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            const header = headers[col - range.s.c];
            
            if (cell) {
              record[header] = cell.v;
            } else {
              record[header] = null;
            }
          }
          
          batchData.push(record);
          processedRecords++;
        }
        
        // Add to sample data if we haven't reached limit
        for (const record of batchData) {
          if (sampleData.length < maxSampleSize) {
            sampleData.push(record);
          } else {
            break;
          }
        }
        
        // Track progress
        if (options.enableProgressTracking && options.onProgress) {
          processedBytes = Math.round((processedRecords / totalRows) * totalBytes);
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000;
          const bytesPerSecond = processedBytes / elapsedTime;
          const percentComplete = Math.min((processedRecords / totalRows) * 100, 100);
          
          options.onProgress({
            processedBytes,
            totalBytes,
            processedRecords,
            estimatedTotalRecords: totalRows,
            percentComplete,
            bytesPerSecond,
            estimatedTimeRemaining: elapsedTime > 0 ? ((totalRows - processedRecords) / (processedRecords / elapsedTime)) : undefined
          });
        }
        
        // Memory management: clear batch data if memory usage is high
        if (process.memoryUsage().heapUsed > maxMemoryUsage) {
          // Force garbage collection if available
          if ((global as any).gc) {
            (global as any).gc();
          }
        }
        
        currentRow = batchEnd + 1;
        
        // Allow other operations to proceed
        await new Promise(resolve => setImmediate(resolve));
      }
      
      const fieldInfo = this.analyzeFields(sampleData);
      
      return {
        fieldInfo,
        recordCount: processedRecords,
        sampleData: sampleData.slice(0, 100) // Return first 100 for preview
      };
      
    } catch (error) {
      throw new AppError(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`, 500, 'EXCEL_PROCESSING_ERROR');
    }
  }

  private async validateCsvStructure(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 16 * 1024 }); // 16KB chunks
      let firstChunk = '';
      let hasReadFirstChunk = false;
      
      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = chunk.toString();
        if (!hasReadFirstChunk) {
          firstChunk += chunkStr;
          hasReadFirstChunk = true;
          
          // Only read enough to validate structure (first few lines)
          if (firstChunk.length > 1024) { // 1KB should be enough for validation
            stream.destroy(); // Stop reading more data
            this.validateCsvChunk(firstChunk);
            resolve();
          }
        }
      });
      
      stream.on('end', () => {
        if (firstChunk.length === 0) {
          reject(new AppError('CSV file is empty', 400, 'MALFORMED_CSV'));
        } else {
          this.validateCsvChunk(firstChunk);
          resolve();
        }
      });
      
      stream.on('error', (error) => {
        reject(new AppError(`Failed to read CSV file: ${error.message}`, 400, 'FILE_READ_ERROR'));
      });
    });
  }

  private validateCsvChunk(chunk: string): void {
    // Check if chunk is empty
    if (!chunk || chunk.trim().length === 0) {
      throw new AppError('CSV file is empty', 400, 'MALFORMED_CSV');
    }
    
    // Check for common CSV issues
    const lines = chunk.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      throw new AppError('CSV file contains no valid lines', 400, 'MALFORMED_CSV');
    }
    
    // Check first line (header) for basic structure
    const firstLine = lines[0];
    
    // Very basic CSV format check - ensure we have some commas or structure
    if (!firstLine.includes(',') && !firstLine.includes('\t') && !firstLine.includes(';')) {
      throw new AppError('File does not appear to be a valid CSV format', 400, 'MALFORMED_CSV');
    }
    
    // Check for binary content (indicates this might not be a text CSV)
    const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/;
    if (binaryPattern.test(chunk.substring(0, 1000))) {
      throw new AppError('File contains binary data and is not a valid CSV format', 400, 'MALFORMED_CSV');
    }
  }

  private analyzeFields(data: any[]): FieldStatistics[] {
    if (data.length === 0) return [];

    const fields = Object.keys(data[0]);
    return fields.map(fieldName => {
      const allValues = data.map(row => row[fieldName]);
      const nonNullValues = allValues.filter(val => val !== null && val !== undefined && val !== '');
      const nullCount = data.length - nonNullValues.length;
      const totalCount = data.length;
      
      // Calculate uniqueness
      const uniqueValues = [...new Set(nonNullValues)];
      const uniqueCount = uniqueValues.length;
      
      // Calculate completeness and uniqueness percentages
      const completeness = totalCount > 0 ? Math.round((nonNullValues.length / totalCount) * 100) : 0;
      const uniqueness = nonNullValues.length > 0 ? Math.round((uniqueCount / nonNullValues.length) * 100) : 0;
      
      // Find most common value
      const valueCounts = nonNullValues.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      let mostCommonValue;
      let mostCommonValueCount = 0;
      for (const [value, count] of Object.entries(valueCounts)) {
        if ((count as number) > mostCommonValueCount) {
          mostCommonValue = value;
          mostCommonValueCount = count as number;
        }
      }
      
      // Calculate string length statistics
      let minLength, maxLength, averageLength;
      if (nonNullValues.length > 0) {
        const stringValues = nonNullValues.map(val => String(val));
        const lengths = stringValues.map(str => str.length);
        minLength = Math.min(...lengths);
        maxLength = Math.max(...lengths);
        averageLength = Math.round(lengths.reduce((sum, len) => sum + len, 0) / lengths.length);
      }

      // Enhanced type inference
      let type = 'string';
      if (nonNullValues.length > 0) {
        const sample = nonNullValues.slice(0, Math.min(100, nonNullValues.length));
        const numericCount = sample.filter(val => !isNaN(Number(val)) && !isNaN(parseFloat(String(val)))).length;
        const dateCount = sample.filter(val => {
          const dateVal = Date.parse(String(val));
          return !isNaN(dateVal) && isNaN(Number(val));
        }).length;
        const booleanCount = sample.filter(val => 
          String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'false'
        ).length;
        const emailCount = sample.filter(val => 
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))
        ).length;
        
        // Determine type based on majority
        const sampleSize = sample.length;
        if (emailCount / sampleSize > 0.8) {
          type = 'email';
        } else if (numericCount / sampleSize > 0.8) {
          // Check if all numeric values are integers
          const isInteger = sample.every(val => Number.isInteger(Number(val)));
          type = isInteger ? 'integer' : 'number';
        } else if (dateCount / sampleSize > 0.8) {
          type = 'date';
        } else if (booleanCount / sampleSize > 0.8) {
          type = 'boolean';
        }
      }

      // Generate warnings for data quality issues
      const warnings: string[] = [];
      if (completeness < 50) {
        warnings.push(`Low data completeness: ${completeness}% of values are missing`);
      }
      if (uniqueness < 10 && totalCount > 10) {
        warnings.push(`Low data uniqueness: only ${uniqueness}% of values are unique`);
      }
      if (fieldName.trim() === '') {
        warnings.push('Column has empty name');
      }
      if (totalCount === nullCount) {
        warnings.push('Column contains only null values');
      }

      const sampleValues = nonNullValues.slice(0, 5);

      return {
        name: fieldName,
        type,
        sampleValues,
        nullCount,
        totalCount,
        uniqueCount,
        completeness,
        uniqueness,
        mostCommonValue,
        mostCommonValueCount,
        minLength,
        maxLength,
        averageLength,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    });
  }

  getDatasetById(id: string): Dataset {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      SELECT id, filename, original_filename as originalFilename, size, record_count as recordCount,
             mime_type as mimeType, created_at as createdAt, updated_at as updatedAt
      FROM datasets
      WHERE id = ?
    `);

    const dataset = stmt.get(id) as Dataset;
    
    if (!dataset) {
      throw new AppError('Dataset not found', 404, 'DATASET_NOT_FOUND');
    }

    return dataset;
  }

  async getDatasets(page: number = 1, pageSize: number = 10): Promise<{
    data: Dataset[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM datasets');
    const { total } = countStmt.get() as { total: number };
    
    // Get paginated results
    const dataStmt = db.prepare(`
      SELECT id, filename, original_filename as originalFilename, size, record_count as recordCount,
             mime_type as mimeType, created_at as createdAt, updated_at as updatedAt
      FROM datasets
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const data = dataStmt.all(pageSize, offset) as Dataset[];
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async deleteDataset(id: string): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Get dataset info first
    const dataset = this.getDatasetById(id);
    
    // Delete file from disk
    const uploadDir = this.getUploadDir();
    const filePath = path.join(uploadDir, dataset.filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    const stmt = db.prepare('DELETE FROM datasets WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new AppError('Dataset not found', 404, 'DATASET_NOT_FOUND');
    }
  }

  async createAnalysisBatch(datasetId: string): Promise<AnalysisBatch> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Verify dataset exists
    const dataset = this.getDatasetById(datasetId);
    
    const batchId = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO analysis_batches (id, dataset_id, status, progress, total_records, completed_records)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(batchId, datasetId, 'pending', 0, dataset.recordCount, 0);

    return this.getAnalysisBatchById(batchId);
  }

  private getAnalysisBatchById(id: string): AnalysisBatch {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      SELECT id, dataset_id as datasetId, status, progress, total_records as totalRecords,
             completed_records as completedRecords, created_at as createdAt, updated_at as updatedAt
      FROM analysis_batches
      WHERE id = ?
    `);

    const batch = stmt.get(id) as AnalysisBatch;
    
    if (!batch) {
      throw new AppError('Analysis batch not found', 404, 'BATCH_NOT_FOUND');
    }

    return batch;
  }

  async updateAnalysisBatchProgress(batchId: string, completedRecords: number, status?: string): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const batch = this.getAnalysisBatchById(batchId);
    const progress = Math.floor((completedRecords / batch.totalRecords) * 100);
    
    const stmt = db.prepare(`
      UPDATE analysis_batches 
      SET progress = ?, completed_records = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(progress, completedRecords, status || batch.status, batchId);
  }

  async exportData(format: 'csv' | 'json' | 'xlsx', _filters?: any): Promise<{ downloadUrl: string; expiresAt: string }> {
    // This is a mock implementation - in a real app you would:
    // 1. Query data based on filters
    // 2. Generate file in requested format
    // 3. Store temporarily with expiration
    // 4. Return download URL

    const exportId = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    return {
      downloadUrl: `/api/v1/downloads/export-${exportId}.${format}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async enhanceFieldInfoWithPII(
    fieldInfo: FieldStatistics[], 
    _previewData: any[]
  ): Promise<FieldStatistics[]> {
    if (!fieldInfo || fieldInfo.length === 0) return fieldInfo;

    try {
      const enhancedFieldInfo: FieldStatistics[] = [];
      
      for (const field of fieldInfo) {
        // Create sample text from field values for PII detection
        const sampleText = field.sampleValues
          .filter((val: any) => val != null && val !== '')
          .slice(0, 20) // Take more samples for better detection
          .join(' ');

        let piiDetected = false;
        let piiType: string | undefined = undefined;
        let piiConfidence = 0;

        if (sampleText.length > 0) {
          try {
            const piiResults = await this.securityService.detectPII(sampleText);
            if (piiResults.length > 0) {
              piiDetected = true;
              // Find the highest confidence PII type
              const highestConfidencePII = piiResults.reduce((prev, current) => 
                (prev.confidence > current.confidence) ? prev : current
              );
              piiType = highestConfidencePII.piiType;
              piiConfidence = highestConfidencePII.confidence;
            }
          } catch (error) {
            console.warn(`PII detection failed for field ${field.name}:`, error);
          }
        }

        // Enhanced PII detection based on field name and type
        if (!piiDetected) {
          const fieldNameLower = field.name.toLowerCase();
          if (fieldNameLower.includes('email') || field.type === 'email') {
            piiDetected = true;
            piiType = 'EMAIL';
            piiConfidence = 0.8;
          } else if (fieldNameLower.includes('phone') || fieldNameLower.includes('tel')) {
            piiDetected = true;
            piiType = 'PHONE';
            piiConfidence = 0.7;
          } else if (fieldNameLower.includes('ssn') || fieldNameLower.includes('social')) {
            piiDetected = true;
            piiType = 'SSN';
            piiConfidence = 0.9;
          } else if (fieldNameLower.includes('name') && fieldNameLower !== 'filename') {
            piiDetected = true;
            piiType = 'NAME';
            piiConfidence = 0.6;
          } else if (fieldNameLower.includes('address') || fieldNameLower.includes('street')) {
            piiDetected = true;
            piiType = 'ADDRESS';
            piiConfidence = 0.7;
          } else if (fieldNameLower.includes('birth') || fieldNameLower.includes('dob')) {
            piiDetected = true;
            piiType = 'DATE_OF_BIRTH';
            piiConfidence = 0.8;
          }
        }

        // Add PII warnings to existing warnings
        const warnings = [...(field.warnings || [])];
        if (piiDetected) {
          warnings.push(`Contains PII: ${piiType} (confidence: ${Math.round(piiConfidence * 100)}%)`);
          if (piiConfidence > 0.8) {
            warnings.push('High-risk PII detected - consider masking or encryption');
          }
        }

        enhancedFieldInfo.push({
          ...field,
          piiDetected,
          piiType,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      }

      return enhancedFieldInfo;
    } catch (error) {
      console.warn('Failed to enhance field info with PII detection:', error);
      return fieldInfo;
    }
  }

  /**
   * Get risk level based on compliance score
   */
  private getRiskLevel(complianceScore: number): string {
    if (complianceScore >= 0.9) return 'low';
    if (complianceScore >= 0.7) return 'medium';
    if (complianceScore >= 0.5) return 'high';
    return 'critical';
  }
}