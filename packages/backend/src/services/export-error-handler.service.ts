import { AppError } from '../middleware/error.middleware';
import { ExportOptions } from './export.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportErrorContext {
  format: string;
  rowCount?: number;
  chunkIndex?: number;
  filePath?: string;
  operation: 'fetch' | 'write' | 'merge' | 'stream';
  error: Error;
}

export interface ExportRetryOptions {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'partial' | 'abort';
  fallbackFormat?: string;
  partialExportPath?: string;
  message: string;
}

export class ExportErrorHandlerService {
  private static readonly DEFAULT_RETRY_OPTIONS: ExportRetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
  };

  private errorLog: Map<string, ExportErrorContext[]> = new Map();

  /**
   * Handle export error with appropriate recovery strategy
   */
  async handleExportError(
    context: ExportErrorContext,
    options?: ExportRetryOptions
  ): Promise<ErrorRecoveryStrategy> {
    const retryOptions = { ...ExportErrorHandlerService.DEFAULT_RETRY_OPTIONS, ...options };
    
    // Log error for analysis
    this.logError(context);

    // Determine error type and recovery strategy
    const errorType = this.categorizeError(context.error);
    
    switch (errorType) {
      case 'MEMORY_ERROR':
        return this.handleMemoryError(context);
        
      case 'DISK_SPACE_ERROR':
        return this.handleDiskSpaceError(context);
        
      case 'PERMISSION_ERROR':
        return this.handlePermissionError(context);
        
      case 'NETWORK_ERROR':
        return this.handleNetworkError(context);
        
      case 'DATA_CORRUPTION_ERROR':
        return this.handleDataCorruptionError(context);
        
      case 'FORMAT_ERROR':
        return this.handleFormatError(context);
        
      case 'TIMEOUT_ERROR':
        return this.handleTimeoutError(context);
        
      default:
        return this.handleGenericError(context);
    }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: Omit<ExportErrorContext, 'error'>,
    options?: ExportRetryOptions
  ): Promise<T> {
    const retryOptions = { ...ExportErrorHandlerService.DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const errorContext: ExportErrorContext = {
          ...context,
          error: lastError
        };
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt === retryOptions.maxRetries) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = retryOptions.retryDelay * Math.pow(retryOptions.backoffMultiplier, attempt - 1);
        
        // Notify retry callback
        if (retryOptions.onRetry) {
          retryOptions.onRetry(attempt, lastError);
        }
        
        // Log retry attempt
        console.log(`Retry attempt ${attempt}/${retryOptions.maxRetries} after ${delay}ms for ${context.operation} operation`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('enomem') || message.includes('out of memory')) {
      return 'MEMORY_ERROR';
    }
    
    if (message.includes('enospc') || message.includes('no space left')) {
      return 'DISK_SPACE_ERROR';
    }
    
    if (message.includes('eacces') || message.includes('permission denied')) {
      return 'PERMISSION_ERROR';
    }
    
    if (message.includes('econnrefused') || message.includes('network')) {
      return 'NETWORK_ERROR';
    }
    
    if (message.includes('corrupt') || message.includes('invalid data')) {
      return 'DATA_CORRUPTION_ERROR';
    }
    
    if (message.includes('unsupported format') || message.includes('invalid format')) {
      return 'FORMAT_ERROR';
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT_ERROR';
    }
    
    return 'GENERIC_ERROR';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorType = this.categorizeError(error);
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'MEMORY_ERROR' // Sometimes memory issues are temporary
    ];
    
    return retryableErrors.includes(errorType);
  }

  /**
   * Handle memory errors
   */
  private handleMemoryError(context: ExportErrorContext): ErrorRecoveryStrategy {
    // Suggest smaller chunk size or streaming
    return {
      type: 'fallback',
      message: 'Export failed due to memory constraints. Switching to streaming mode with smaller chunks.',
      fallbackFormat: 'stream'
    };
  }

  /**
   * Handle disk space errors
   */
  private handleDiskSpaceError(context: ExportErrorContext): ErrorRecoveryStrategy {
    // Try to clean up old exports first
    this.cleanupOldExports();
    
    return {
      type: 'retry',
      message: 'Export failed due to insufficient disk space. Old exports cleaned up, retrying...'
    };
  }

  /**
   * Handle permission errors
   */
  private handlePermissionError(context: ExportErrorContext): ErrorRecoveryStrategy {
    // Try alternative export directory
    const alternativePath = path.join(process.cwd(), 'temp', 'exports');
    
    return {
      type: 'fallback',
      message: `Export failed due to permission issues. Using alternative path: ${alternativePath}`,
      partialExportPath: alternativePath
    };
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(context: ExportErrorContext): ErrorRecoveryStrategy {
    return {
      type: 'retry',
      message: 'Export failed due to network issues. Will retry with exponential backoff.'
    };
  }

  /**
   * Handle data corruption errors
   */
  private handleDataCorruptionError(context: ExportErrorContext): ErrorRecoveryStrategy {
    return {
      type: 'partial',
      message: 'Data corruption detected. Attempting to export valid data only.',
      partialExportPath: context.filePath
    };
  }

  /**
   * Handle format errors
   */
  private handleFormatError(context: ExportErrorContext): ErrorRecoveryStrategy {
    // Suggest fallback format
    const fallbackFormat = context.format === 'excel' ? 'csv' : 
                          context.format === 'csv' ? 'json' : 'csv';
    
    return {
      type: 'fallback',
      message: `Export failed for ${context.format} format. Falling back to ${fallbackFormat}.`,
      fallbackFormat
    };
  }

  /**
   * Handle timeout errors
   */
  private handleTimeoutError(context: ExportErrorContext): ErrorRecoveryStrategy {
    return {
      type: 'retry',
      message: 'Export timed out. Will retry with increased timeout.'
    };
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(context: ExportErrorContext): ErrorRecoveryStrategy {
    return {
      type: 'abort',
      message: `Export failed with error: ${context.error.message}`
    };
  }

  /**
   * Log error for analysis
   */
  private logError(context: ExportErrorContext): void {
    const errorKey = `${context.format}_${context.operation}`;
    
    if (!this.errorLog.has(errorKey)) {
      this.errorLog.set(errorKey, []);
    }
    
    this.errorLog.get(errorKey)!.push({
      ...context,
      error: {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      } as Error
    });
    
    // Keep only last 100 errors per category
    const errors = this.errorLog.get(errorKey)!;
    if (errors.length > 100) {
      errors.splice(0, errors.length - 100);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): Record<string, {
    count: number;
    lastError?: ExportErrorContext;
    commonErrors: Record<string, number>;
  }> {
    const stats: Record<string, any> = {};
    
    for (const [key, errors] of this.errorLog.entries()) {
      const commonErrors: Record<string, number> = {};
      
      for (const error of errors) {
        const errorType = this.categorizeError(error.error);
        commonErrors[errorType] = (commonErrors[errorType] || 0) + 1;
      }
      
      stats[key] = {
        count: errors.length,
        lastError: errors[errors.length - 1],
        commonErrors
      };
    }
    
    return stats;
  }

  /**
   * Clean up old export files to free space
   */
  private cleanupOldExports(): void {
    const exportDir = path.join(process.cwd(), 'exports');
    
    try {
      const files = fs.readdirSync(exportDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of files) {
        const filePath = path.join(exportDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old export: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to clean up old exports:', error);
    }
  }

  /**
   * Validate export before starting
   */
  async validateExport(options: ExportOptions, estimatedSize: number): Promise<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Check disk space
    const availableSpace = await this.getAvailableDiskSpace();
    if (availableSpace < estimatedSize * 2) {
      errors.push(`Insufficient disk space. Need ${estimatedSize * 2} bytes, have ${availableSpace} bytes`);
    }
    
    // Check format support
    if (!['csv', 'json', 'excel'].includes(options.format)) {
      errors.push(`Unsupported format: ${options.format}`);
    }
    
    // Check memory for large exports
    const memoryUsage = process.memoryUsage();
    const availableMemory = memoryUsage.heapTotal - memoryUsage.heapUsed;
    
    if (estimatedSize > 100 * 1024 * 1024 && availableMemory < estimatedSize) {
      warnings.push('Large export detected. Consider using streaming mode.');
    }
    
    // Check export directory permissions
    try {
      const testFile = path.join(process.cwd(), 'exports', '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      errors.push('No write permission to export directory');
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Get available disk space
   */
  private async getAvailableDiskSpace(): Promise<number> {
    // This is a simplified implementation
    // In production, use a proper disk space checking library
    try {
      const stats = fs.statfsSync(process.cwd());
      return stats.bavail * stats.bsize;
    } catch {
      // Fallback to a reasonable default
      return 1024 * 1024 * 1024; // 1GB
    }
  }

  /**
   * Create error report for debugging
   */
  createErrorReport(exportId: string): string {
    const stats = this.getErrorStatistics();
    const report: string[] = [
      `Export Error Report - ${new Date().toISOString()}`,
      `Export ID: ${exportId}`,
      '',
      'Error Summary:',
      '=============='
    ];
    
    for (const [key, stat] of Object.entries(stats)) {
      report.push(`\n${key}:`);
      report.push(`  Total Errors: ${stat.count}`);
      
      if (stat.lastError) {
        report.push(`  Last Error: ${stat.lastError.error.message}`);
        report.push(`  Timestamp: ${new Date().toISOString()}`);
      }
      
      report.push('  Common Errors:');
      for (const [errorType, count] of Object.entries(stat.commonErrors)) {
        report.push(`    - ${errorType}: ${count} occurrences`);
      }
    }
    
    return report.join('\n');
  }
}