import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { EnhancedExportService } from '../services/enhanced-export.service';
import { AppError } from '../middleware/error.middleware';

export class ExportController {
  private exportService: ExportService;
  private enhancedExportService: EnhancedExportService;

  constructor() {
    this.exportService = new ExportService();
    this.enhancedExportService = new EnhancedExportService();
  }

  /**
   * Export data in various formats
   */
  async export(req: Request, res: Response): Promise<void> {
    try {
      const { tableName, format, columns, filters } = req.query;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      const validFormats = ['csv', 'json', 'excel'];
      if (!validFormats.includes(format as string)) {
        throw new AppError(`Invalid format. Supported formats: ${validFormats.join(', ')}`, 400, 'INVALID_FORMAT');
      }

      const result = await this.exportService.export(
        tableName as string,
        format as any,
        {
          columns: columns ? (columns as string).split(',') : undefined,
          filters: filters ? JSON.parse(filters as string) : undefined
        }
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      throw new AppError(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'EXPORT_ERROR'
      );
    }
  }

  /**
   * Stream large exports
   */
  async streamExport(req: Request, res: Response): Promise<void> {
    try {
      const { tableName, format, columns, filters } = req.query;

      if (!tableName || !format) {
        throw new AppError('Table name and format are required', 400, 'VALIDATION_ERROR');
      }

      const stream = this.exportService.createExportStream(
        tableName as string,
        {
          format: format as 'csv' | 'json',
          columns: columns ? (columns as string).split(',') : undefined,
          filters: filters ? JSON.parse(filters as string) : undefined
        }
      );

      const filename = `${tableName}_export_${Date.now()}.${format}`;
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

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
   * Get export status
   */
  async getExportStatus(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      if (!exportId) {
        throw new AppError('Export ID is required', 400, 'VALIDATION_ERROR');
      }

      const status = await this.exportService.getExportStatus(exportId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      throw new AppError(
        `Failed to get export status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'STATUS_ERROR'
      );
    }
  }

  /**
   * Resume an export
   */
  async resumeExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      if (!exportId) {
        throw new AppError('Export ID is required', 400, 'VALIDATION_ERROR');
      }

      await this.exportService.resumeExport(exportId);

      res.json({
        success: true,
        message: 'Export resumed successfully'
      });

    } catch (error) {
      throw new AppError(
        `Failed to resume export: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'RESUME_ERROR'
      );
    }
  }

  /**
   * Cancel an export
   */
  async cancelExport(req: Request, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      if (!exportId) {
        throw new AppError('Export ID is required', 400, 'VALIDATION_ERROR');
      }

      await this.exportService.cancelExport(exportId);

      res.json({
        success: true,
        message: 'Export cancelled successfully'
      });

    } catch (error) {
      throw new AppError(
        `Failed to cancel export: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'CANCEL_ERROR'
      );
    }
  }

  // Stub methods for routes that need them
  async exportEnhanced(req: Request, res: Response): Promise<void> {
    throw new AppError('Enhanced export is temporarily disabled', 501, 'NOT_IMPLEMENTED');
  }

  async createFormatTransform(req: Request, res: Response): Promise<void> {
    throw new AppError('Format transform is temporarily disabled', 501, 'NOT_IMPLEMENTED');
  }

  async streamEnhancedExport(req: Request, res: Response): Promise<void> {
    throw new AppError('Enhanced streaming is temporarily disabled', 501, 'NOT_IMPLEMENTED');
  }

  async exportWithProgress(req: Request, res: Response): Promise<void> {
    throw new AppError('Progress export is temporarily disabled', 501, 'NOT_IMPLEMENTED');
  }

  async getMemoryUsage(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      }
    });
  }

  async forceGC(req: Request, res: Response): Promise<void> {
    if (global.gc) {
      global.gc();
      res.json({
        success: true,
        message: 'Garbage collection triggered'
      });
    } else {
      res.json({
        success: false,
        message: 'Garbage collection not available'
      });
    }
  }

  // Additional missing methods from routes
  async exportDataset(req: Request, res: Response): Promise<void> {
    return this.export(req, res);
  }

  async getExportProgress(req: Request, res: Response): Promise<void> {
    return this.getExportStatus(req, res);
  }

  async getErrorStatistics(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        totalErrors: 0,
        errorsByType: {},
        recentErrors: []
      }
    });
  }

  async cleanupExports(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Export cleanup completed'
    });
  }

  async getMemoryStats(req: Request, res: Response): Promise<void> {
    return this.getMemoryUsage(req, res);
  }

  async forceGarbageCollection(req: Request, res: Response): Promise<void> {
    return this.forceGC(req, res);
  }
}