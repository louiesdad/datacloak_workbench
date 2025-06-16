import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { AppError } from '../middleware/error.middleware';
import { FileStreamService, ChunkInfo, FileChunkResult, StreamProgress } from './file-stream.service';
import { DataCloakIntegrationService } from './datacloak-integration.service';
import { SecurityService } from './security.service';

export interface PIIDetectionResult {
  fieldName: string;
  piiType: string;
  confidence: number;
  maskedValue?: string;
}

export interface DataCloakStreamOptions {
  chunkSize?: number; // 8KB to 4MB configurable
  mimeType?: string;
  onProgress?: (progress: StreamProgress) => void;
  onChunk?: (chunk: FileChunkResult) => Promise<void>;
  onPIIDetected?: (piiResults: PIIDetectionResult[]) => void;
  maxRows?: number;
  preservePII?: boolean;
  maskingOptions?: {
    email?: boolean;
    phone?: boolean;
    ssn?: boolean;
    creditCard?: boolean;
    address?: boolean;
    name?: boolean;
  };
}

export interface DataCloakChunkResult extends FileChunkResult {
  piiDetectionResults?: PIIDetectionResult[];
  maskedData?: any[];
  securityMetrics?: {
    piiItemsFound: number;
    fieldsWithPII: string[];
    maskingApplied: boolean;
  };
}

export class DataCloakStreamService {
  private fileStreamService: FileStreamService;
  private securityService: SecurityService;
  private dataCloakService: DataCloakIntegrationService;
  
  // Configurable chunk sizes from 8KB to 4MB
  private static readonly MIN_CHUNK_SIZE = 8 * 1024; // 8KB
  private static readonly MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
  private static readonly DEFAULT_CHUNK_SIZE = 256 * 1024; // 256KB
  
  constructor() {
    this.fileStreamService = new FileStreamService();
    this.securityService = new SecurityService();
    this.dataCloakService = new DataCloakIntegrationService();
  }

  /**
   * Stream process a file with DataCloak PII detection and masking
   */
  async streamProcessWithDataCloak(
    filePath: string,
    options: DataCloakStreamOptions = {}
  ): Promise<{
    totalRows: number;
    totalBytes: number;
    chunksProcessed: number;
    processingTime: number;
    piiSummary: {
      totalPIIItems: number;
      piiTypes: Record<string, number>;
      fieldsWithPII: string[];
    };
  }> {
    const startTime = Date.now();
    
    // Validate and set chunk size
    const chunkSize = this.validateChunkSize(options.chunkSize);
    
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    await this.securityService.initialize();

    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    
    // PII tracking across all chunks
    const piiSummary = {
      totalPIIItems: 0,
      piiTypes: {} as Record<string, number>,
      fieldsWithPII: new Set<string>()
    };

    // Memory usage tracking
    let memoryUsageTracker = {
      peakMemory: 0,
      currentMemory: 0,
      startMemory: process.memoryUsage().heapUsed
    };

    // Progress tracking
    const progressTracker = {
      startTime,
      rowsPerSecond: 0,
      lastProgressTime: startTime,
      chunksProcessed: 0,
      totalRows: 0
    };

    try {
      // Custom chunk handler that integrates DataCloak processing
      const onChunkWithDataCloak = async (chunk: FileChunkResult): Promise<void> => {
        // Update memory tracking
        memoryUsageTracker.currentMemory = process.memoryUsage().heapUsed;
        memoryUsageTracker.peakMemory = Math.max(memoryUsageTracker.peakMemory, memoryUsageTracker.currentMemory);
        
        // Check memory usage constraint (500MB max)
        const memoryUsageMB = (memoryUsageTracker.currentMemory - memoryUsageTracker.startMemory) / 1024 / 1024;
        if (memoryUsageMB > 500) {
          console.warn(`Memory usage exceeding limit: ${memoryUsageMB.toFixed(2)}MB`);
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        // Process chunk data for PII detection
        const chunkPIIResults: PIIDetectionResult[] = [];
        let maskedData: any[] = [];
        
        if (chunk.data && chunk.data.length > 0) {
          // Process each row in the chunk
          for (const row of chunk.data) {
            const rowPIIResults: PIIDetectionResult[] = [];
            const maskedRow: any = { ...row };
            
            // Check each field for PII
            for (const [fieldName, fieldValue] of Object.entries(row)) {
              if (fieldValue && typeof fieldValue === 'string') {
                try {
                  // Detect PII in the field
                  const piiResults = await this.securityService.detectPII(fieldValue);
                  
                  if (piiResults.length > 0) {
                    // Track PII findings
                    piiResults.forEach(pii => {
                      piiSummary.fieldsWithPII.add(fieldName);
                      piiSummary.piiTypes[pii.piiType] = (piiSummary.piiTypes[pii.piiType] || 0) + 1;
                      piiSummary.totalPIIItems++;
                      
                      const piiResult: PIIDetectionResult = {
                        fieldName: fieldName,
                        piiType: pii.piiType,
                        confidence: pii.confidence
                      };
                      rowPIIResults.push(piiResult);
                    });
                    
                    // Apply masking if not preserving PII
                    if (!options.preservePII && piiResults.length > 0) {
                      // Mask all PII types found in this field
                      const shouldMask = piiResults.some(p => this.shouldMaskPIIType(p.piiType, options.maskingOptions));
                      if (shouldMask) {
                        const maskResult = await this.securityService.maskText(fieldValue);
                        maskedRow[fieldName] = maskResult.maskedText;
                      }
                    }
                  }
                } catch (error) {
                  console.warn(`PII detection failed for field ${fieldName}:`, error);
                }
              }
            }
            
            chunkPIIResults.push(...rowPIIResults);
            maskedData.push(maskedRow);
          }
        }

        // Create enhanced chunk result with DataCloak processing
        const enhancedChunk: DataCloakChunkResult = {
          ...chunk,
          piiDetectionResults: chunkPIIResults,
          maskedData: options.preservePII ? chunk.data : maskedData,
          securityMetrics: {
            piiItemsFound: chunkPIIResults.length,
            fieldsWithPII: Array.from(new Set(chunkPIIResults.map(r => r.fieldName))),
            maskingApplied: !options.preservePII
          }
        };

        // Call user's chunk handler if provided
        if (options.onChunk) {
          await options.onChunk(enhancedChunk);
        }

        // Notify about PII detection
        if (options.onPIIDetected && chunkPIIResults.length > 0) {
          options.onPIIDetected(chunkPIIResults);
        }

        progressTracker.chunksProcessed++;
        progressTracker.totalRows += chunk.processedRows;
      };

      // Enhanced progress handler
      const onProgressWithMemory = (progress: StreamProgress) => {
        // Add memory usage to progress
        const enhancedProgress: StreamProgress = {
          ...progress,
          // Add custom metrics
          estimatedTimeRemaining: this.calculateEstimatedTime(progress, progressTracker),
          averageRowsPerSecond: progressTracker.totalRows / ((Date.now() - startTime) / 1000)
        };

        if (options.onProgress) {
          options.onProgress(enhancedProgress);
        }

        // Log memory usage periodically
        if (progress.chunksProcessed % 10 === 0) {
          const memoryUsageMB = (memoryUsageTracker.currentMemory - memoryUsageTracker.startMemory) / 1024 / 1024;
          console.log(`Memory usage after ${progress.chunksProcessed} chunks: ${memoryUsageMB.toFixed(2)}MB`);
        }
      };

      // Process file using base file stream service with DataCloak enhancements
      const result = await this.fileStreamService.streamProcessFile(filePath, {
        chunkSize,
        mimeType: options.mimeType,
        onProgress: onProgressWithMemory,
        onChunk: onChunkWithDataCloak,
        maxRows: options.maxRows
      });

      const processingTime = Date.now() - startTime;
      
      // Log final memory usage
      const finalMemoryMB = (memoryUsageTracker.peakMemory - memoryUsageTracker.startMemory) / 1024 / 1024;
      console.log(`Peak memory usage during processing: ${finalMemoryMB.toFixed(2)}MB`);
      
      return {
        totalRows: result.totalRows,
        totalBytes: result.totalBytes,
        chunksProcessed: result.chunksProcessed,
        processingTime,
        piiSummary: {
          totalPIIItems: piiSummary.totalPIIItems,
          piiTypes: piiSummary.piiTypes,
          fieldsWithPII: Array.from(piiSummary.fieldsWithPII)
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('DataCloak streaming failed', 500, 'DATACLOAK_STREAM_ERROR');
    }
  }

  /**
   * Validate and constrain chunk size
   */
  private validateChunkSize(requestedSize?: number): number {
    if (!requestedSize) {
      return DataCloakStreamService.DEFAULT_CHUNK_SIZE;
    }
    
    // Constrain to min/max limits
    if (requestedSize < DataCloakStreamService.MIN_CHUNK_SIZE) {
      console.warn(`Chunk size ${requestedSize} is below minimum, using ${DataCloakStreamService.MIN_CHUNK_SIZE}`);
      return DataCloakStreamService.MIN_CHUNK_SIZE;
    }
    
    if (requestedSize > DataCloakStreamService.MAX_CHUNK_SIZE) {
      console.warn(`Chunk size ${requestedSize} exceeds maximum, using ${DataCloakStreamService.MAX_CHUNK_SIZE}`);
      return DataCloakStreamService.MAX_CHUNK_SIZE;
    }
    
    return requestedSize;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTime(progress: StreamProgress, tracker: any): number {
    const elapsed = Date.now() - tracker.startTime;
    if (progress.percentComplete > 0 && progress.percentComplete < 100) {
      const estimatedTotal = elapsed / (progress.percentComplete / 100);
      return Math.max(0, estimatedTotal - elapsed);
    }
    return 0;
  }

  /**
   * Check if a PII type should be masked based on options
   */
  private shouldMaskPIIType(piiType: string, maskingOptions?: any): boolean {
    if (!maskingOptions) {
      return true; // Mask all by default
    }
    
    const typeMapping: Record<string, string> = {
      'EMAIL': 'email',
      'PHONE': 'phone',
      'SSN': 'ssn',
      'CREDIT_CARD': 'creditCard',
      'ADDRESS': 'address',
      'NAME': 'name'
    };
    
    const optionKey = typeMapping[piiType];
    return optionKey ? (maskingOptions[optionKey] !== false) : true;
  }

  /**
   * Get optimal chunk size based on file size and available memory
   */
  async getOptimalChunkSize(filePath: string): Promise<number> {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Get available memory (conservative estimate)
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const availableMemory = Math.min(freeMemory, totalMemory * 0.25); // Use max 25% of total memory
    
    // Calculate chunk size based on file size and memory
    let optimalSize: number;
    
    if (fileSize < 100 * 1024 * 1024) { // < 100MB
      optimalSize = Math.min(fileSize / 10, DataCloakStreamService.MAX_CHUNK_SIZE);
    } else if (fileSize < 1024 * 1024 * 1024) { // < 1GB
      optimalSize = Math.min(fileSize / 50, DataCloakStreamService.MAX_CHUNK_SIZE);
    } else { // >= 1GB
      optimalSize = Math.min(fileSize / 100, DataCloakStreamService.MAX_CHUNK_SIZE);
    }
    
    // Ensure we don't exceed available memory constraints
    const memoryConstrainedSize = Math.min(availableMemory / 10, optimalSize);
    
    // Apply min/max constraints
    return this.validateChunkSize(memoryConstrainedSize);
  }

  /**
   * Monitor memory usage during streaming
   */
  createMemoryMonitor(): {
    start: () => void;
    stop: () => void;
    getStats: () => { peak: number; current: number; duration: number };
  } {
    let interval: NodeJS.Timeout | null = null;
    let peakMemory = 0;
    let startMemory = 0;
    let startTime = 0;
    
    return {
      start: () => {
        startTime = Date.now();
        startMemory = process.memoryUsage().heapUsed;
        peakMemory = startMemory;
        
        interval = setInterval(() => {
          const current = process.memoryUsage().heapUsed;
          peakMemory = Math.max(peakMemory, current);
          
          // Log warning if memory usage is high
          const usageMB = (current - startMemory) / 1024 / 1024;
          if (usageMB > 400) {
            console.warn(`High memory usage detected: ${usageMB.toFixed(2)}MB`);
          }
        }, 1000);
      },
      
      stop: () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      },
      
      getStats: () => ({
        peak: (peakMemory - startMemory) / 1024 / 1024,
        current: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        duration: Date.now() - startTime
      })
    };
  }
}

// Import os for memory calculations
import * as os from 'os';