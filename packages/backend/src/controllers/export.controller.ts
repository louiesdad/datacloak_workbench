import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { EnhancedExportService } from '../services/enhanced-export.service';
import { ExportErrorHandlerService } from '../services/export-error-handler.service';
import { AppError } from '../middleware/error.middleware';

export class ExportController {
  private exportService: ExportService;
  private enhancedExportService: EnhancedExportService;
  private errorHandler: ExportErrorHandlerService;

  constructor() {
    this.exportService = new ExportService();
    this.enhancedExportService = new EnhancedExportService();
    this.errorHandler = new ExportErrorHandlerService();
  }

  /**
   * Export large dataset with chunking
   */
  async exportDataset(req: Request, res: Response): Promise<void> {
    try {
      const { tableName, format, columns, filters, chunkSize, maxRows } = req.body;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      if (!['csv', 'json', 'excel'].includes(format)) {
        throw new AppError('Invalid export format. Use csv, json, or excel', 400, 'INVALID_FORMAT');
      }

      // Validate export before starting
      const estimatedSize = await this.estimateExportSize(tableName, filters);
      const validation = await this.errorHandler.validateExport(
        { format, columns, filters, chunkSize, maxRows },
        estimatedSize
      );

      if (!validation.valid) {
        throw new AppError(
          `Export validation failed: ${validation.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Send warnings if any
      if (validation.warnings.length > 0) {
        res.setHeader('X-Export-Warnings', validation.warnings.join('; '));
      }

      // Start chunked export
      const result = await this.errorHandler.executeWithRetry(
        async () => {
          return await this.exportService.exportLargeDataset(
            tableName,
            { format, columns, filters, chunkSize, maxRows },
            (progress) => {
              // Send progress via Server-Sent Events if supported
              if (res.headersSent) return;
              
              res.write(`data: ${JSON.stringify({
                type: 'progress',
                data: progress
              })}\n\n`);
            }
          );
        },
        {
          format,
          operation: 'fetch'
        }
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      // Handle export error with recovery strategy
      const errorContext = {
        format: req.body.format,
        operation: 'fetch' as const,
        error: error as Error
      };

      const strategy = await this.errorHandler.handleExportError(errorContext);

      if (strategy.type === 'fallback' && strategy.fallbackFormat) {
        // Retry with fallback format
        req.body.format = strategy.fallbackFormat;
        return this.exportDataset(req, res);
      }

      throw new AppError(
        strategy.message,
        500,
        'EXPORT_ERROR'
      );
    }
  }

  /**
   * Stream export for very large datasets
   */
  async streamExport(req: Request, res: Response): Promise<void> {
    try {
      const { tableName, format, columns, filters } = req.query;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      const exportFormat = format as string;
      if (!['csv', 'json'].includes(exportFormat)) {
        throw new AppError('Streaming only supports csv and json formats', 400, 'INVALID_FORMAT');
      }

      // Set appropriate headers
      const contentType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
      const filename = `export_${tableName}_${Date.now()}.${exportFormat}`;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');

      // Create export stream
      const stream = this.exportService.createExportStream(
        tableName as string,
        {
          format: exportFormat as 'csv' | 'json',
          columns: columns ? (Array.isArray(columns) ? columns : [columns]) as string[] : undefined,
          filters: filters ? JSON.parse(filters as string) : undefined
        }
      );

      // Handle stream errors
      stream.on('error', async (error) => {
        const errorContext = {
          format: exportFormat,
          operation: 'stream' as const,
          error
        };

        const strategy = await this.errorHandler.handleExportError(errorContext);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: strategy.message
          });
        }
      });

      // Pipe stream to response
      stream.pipe(res);

    } catch (error) {
      throw new AppError(
        `Stream export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'STREAM_ERROR'
      );
    }
  }

  /**
   * Get export progress
   */
  async getExportProgress(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      const progress = this.exportService.getExportProgress(exportId);

      if (!progress) {
        throw new AppError('Export not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: progress
      });

    } catch (error) {
      throw new AppError(
        'Failed to get export progress',
        500,
        'PROGRESS_ERROR'
      );
    }
  }

  /**
   * Cancel an export
   */
  async cancelExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      const cancelled = this.exportService.cancelExport(exportId);

      if (!cancelled) {
        throw new AppError('Export not found or already completed', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Export cancelled successfully'
      });

    } catch (error) {
      throw new AppError(
        'Failed to cancel export',
        500,
        'CANCEL_ERROR'
      );
    }
  }

  /**
   * Get export error statistics
   */
  async getErrorStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.errorHandler.getErrorStatistics();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      throw new AppError(
        'Failed to get error statistics',
        500,
        'STATS_ERROR'
      );
    }
  }

  /**
   * Clean up old exports
   */
  async cleanupExports(req: Request, res: Response): Promise<void> {
    try {
      const { maxAgeHours } = req.body;

      const deletedCount = await this.exportService.cleanupOldExports(
        maxAgeHours || 24
      );

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old export files`
      });

    } catch (error) {
      throw new AppError(
        'Failed to cleanup exports',
        500,
        'CLEANUP_ERROR'
      );
    }
  }

  /**
   * Enhanced export with additional formats and features
   */
  async exportEnhanced(req: Request, res: Response): Promise<void> {
    try {
      const {
        tableName,
        format,
        columns,
        filters,
        chunkSize,
        maxRows,
        encryption,
        compression,
        cloudStorage,
        resumable,
        notificationWebhook
      } = req.body;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      if (!['csv', 'json', 'excel', 'parquet'].includes(format)) {
        throw new AppError('Invalid export format. Use csv, json, excel, or parquet', 400, 'INVALID_FORMAT');
      }

      // Enhanced export options
      const options = {
        format: format as 'csv' | 'json' | 'excel' | 'parquet',
        columns,
        filters,
        chunkSize,
        maxRows,
        encryption,
        compression,
        cloudStorage,
        resumable,
        notificationWebhook
      };

      // Execute enhanced export
      const result = await this.enhancedExportService.exportEnhanced(
        tableName,
        options,
        (progress) => {
          // Send progress updates if client supports Server-Sent Events
          if (req.headers.accept?.includes('text/event-stream')) {
            res.write(`data: ${JSON.stringify({
              type: 'progress',
              data: progress
            })}\n\n`);
          }
        }
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      throw new AppError(
        `Enhanced export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'ENHANCED_EXPORT_ERROR'
      );
    }
  }

  /**
   * Create a format transform stream
   */
  async createFormatTransform(req: Request, res: Response): Promise<void> {
    try {
      const { fromFormat, toFormat, tableName } = req.query;

      if (!fromFormat || !toFormat || !tableName) {
        throw new AppError('fromFormat, toFormat, and tableName are required', 400, 'VALIDATION_ERROR');
      }

      // Create transform stream
      const transformStream = this.enhancedExportService.createFormatTransformStream(
        fromFormat as string,
        toFormat as string
      );

      // Set appropriate headers
      const filename = `${tableName}_converted_${Date.now()}.${toFormat}`;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Create source stream
      const sourceStream = this.exportService.createExportStream(
        tableName as string,
        { format: fromFormat as 'csv' | 'json' }
      );

      // Pipe through transform
      sourceStream.pipe(transformStream).pipe(res);

    } catch (error) {
      throw new AppError(
        `Format transform failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'TRANSFORM_ERROR'
      );
    }
  }

  /**
   * Enhanced streaming export for very large datasets
   */
  async streamEnhancedExport(req: Request, res: Response): Promise<void> {
    try {
      const { tableName, format, columns, filters, chunkSize, compression, encryption } = req.query;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      const enhancedFormat = format as string;
      if (!['csv', 'json', 'excel', 'parquet'].includes(enhancedFormat)) {
        throw new AppError('Streaming supports csv, json, excel, and parquet formats', 400, 'INVALID_FORMAT');
      }

      // Set appropriate headers
      const contentTypes = {
        csv: 'text/csv',
        json: 'application/json',
        excel: 'text/csv', // Simplified Excel as CSV for streaming
        parquet: 'application/octet-stream'
      };
      
      const filename = `export_${tableName}_${Date.now()}.${enhancedFormat}`;
      
      res.setHeader('Content-Type', contentTypes[enhancedFormat as keyof typeof contentTypes]);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Add compression headers if requested
      if (compression === 'gzip') {
        res.setHeader('Content-Encoding', 'gzip');
      }

      // Create enhanced export stream
      const options = {
        format: enhancedFormat as 'csv' | 'json' | 'excel' | 'parquet',
        columns: columns ? (Array.isArray(columns) ? columns : [columns]) as string[] : undefined,
        filters: filters ? JSON.parse(filters as string) : undefined,
        chunkSize: chunkSize ? parseInt(chunkSize as string) : undefined,
        compression: compression ? { enabled: true, type: compression as 'gzip' } : undefined,
        encryption: encryption ? { enabled: true } : undefined
      };

      const stream = this.enhancedExportService.createEnhancedExportStream(
        tableName as string,
        options
      );

      // Handle stream errors
      stream.on('error', async (error) => {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: `Enhanced stream export failed: ${error.message}`
          });
        }
      });

      // Apply compression if requested
      if (compression === 'gzip') {
        const zlib = require('zlib');
        const gzip = zlib.createGzip();
        stream.pipe(gzip).pipe(res);
      } else {
        stream.pipe(res);
      }

    } catch (error) {
      throw new AppError(
        `Enhanced stream export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'ENHANCED_STREAM_ERROR'
      );
    }
  }

  /**
   * Resume an interrupted export
   */
  async resumeExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;
      const { options } = req.body;

      if (!exportId || !options) {
        throw new AppError('Export ID and options are required', 400, 'VALIDATION_ERROR');
      }

      const result = await this.enhancedExportService.exportEnhanced(
        '', // Table name will be retrieved from saved state
        { ...options, resumable: true },
        (progress) => {
          if (req.headers.accept?.includes('text/event-stream')) {
            res.write(`data: ${JSON.stringify({
              type: 'progress',
              data: progress
            })}\n\n`);
          }
        }
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      throw new AppError(
        `Resume export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'RESUME_ERROR'
      );
    }
  }

  /**
   * Get memory statistics for monitoring
   */
  async getMemoryStats(req: Request, res: Response): Promise<void> {
    try {
      const memoryStats = this.enhancedExportService.getMemoryStats();
      const isMemorySafe = this.enhancedExportService.isMemoryUsageSafe();
      const memoryThresholds = this.enhancedExportService.getMemoryThresholds();

      res.json({
        success: true,
        data: {
          memoryStats,
          isMemorySafe,
          memoryThresholds,
          recommendations: this.getMemoryRecommendations(memoryStats, memoryThresholds)
        }
      });

    } catch (error) {
      throw new AppError(
        'Failed to get memory statistics',
        500,
        'MEMORY_STATS_ERROR'
      );
    }
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection(req: Request, res: Response): Promise<void> {
    try {
      const beforeStats = this.enhancedExportService.getMemoryStats();
      const gcForced = this.enhancedExportService.forceGarbageCollection();
      const afterStats = this.enhancedExportService.getMemoryStats();

      res.json({
        success: true,
        data: {
          gcForced,
          memoryBefore: beforeStats,
          memoryAfter: afterStats,
          memoryFreed: beforeStats.heapUsed - afterStats.heapUsed
        }
      });

    } catch (error) {
      throw new AppError(
        'Failed to force garbage collection',
        500,
        'GC_ERROR'
      );
    }
  }

  /**
   * Get memory recommendations based on current usage
   */
  private getMemoryRecommendations(memoryStats: any, thresholds: any): string[] {
    const recommendations: string[] = [];

    if (memoryStats.heapUsed > thresholds.criticalThreshold) {
      recommendations.push('Critical: Memory usage is above critical threshold. Consider increasing heap size or reducing concurrent operations.');
    } else if (memoryStats.heapUsed > thresholds.warningThreshold) {
      recommendations.push('Warning: Memory usage is high. Consider forcing garbage collection or reducing chunk sizes.');
    }

    if (memoryStats.gcCollections === 0) {
      recommendations.push('No garbage collections detected. Consider enabling garbage collection monitoring.');
    }

    if (memoryStats.external > 100) {
      recommendations.push('High external memory usage detected. This may indicate large file buffers or external library usage.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage is within normal limits.');
    }

    return recommendations;
  }

  /**
   * Estimate export size
   */
  private async estimateExportSize(
    tableName: string,
    filters?: Record<string, any>
  ): Promise<number> {
    // Simple estimation based on row count and average row size
    // In production, this should query the actual data
    const avgRowSize = 1024; // 1KB average
    const rowCount = 10000; // Would query actual count
    
    return rowCount * avgRowSize;
  }
}