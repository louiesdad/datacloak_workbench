import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { ExportErrorHandlerService } from '../services/export-error-handler.service';
import { AppError } from '../middleware/error.middleware';

export class ExportController {
  private exportService: ExportService;
  private errorHandler: ExportErrorHandlerService;

  constructor() {
    this.exportService = new ExportService();
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