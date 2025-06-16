import { Router } from 'express';
import { ExportController } from '../controllers/export.controller';
import { asyncHandler, validate } from '../middleware/async.middleware';

const router = Router();
const controller = new ExportController();

/**
 * @route POST /api/v1/export/dataset
 * @desc Export dataset with chunking support
 * @body tableName - Name of the table to export
 * @body format - Export format (csv, json, excel)
 * @body columns - Optional array of columns to include
 * @body filters - Optional filters to apply
 * @body chunkSize - Optional chunk size for large exports
 * @body maxRows - Optional maximum rows to export
 */
router.post(
  '/dataset',
  validate({
    body: {
      tableName: 'required',
      format: ['csv', 'json', 'excel'],
      columns: 'optional',
      filters: 'optional',
      chunkSize: 'optional',
      maxRows: 'optional'
    }
  }),
  asyncHandler(controller.exportDataset.bind(controller))
);

/**
 * @route GET /api/v1/export/stream
 * @desc Stream export for very large datasets
 * @query tableName - Name of the table to export
 * @query format - Export format (csv or json)
 * @query columns - Optional comma-separated columns
 * @query filters - Optional JSON filters
 */
router.get(
  '/stream',
  validate({
    query: {
      tableName: 'required',
      format: ['csv', 'json'],
      columns: 'optional',
      filters: 'optional'
    }
  }),
  asyncHandler(controller.streamExport.bind(controller))
);

/**
 * @route GET /api/v1/export/progress/:exportId
 * @desc Get export progress
 */
router.get(
  '/progress/:exportId',
  asyncHandler(controller.getExportProgress.bind(controller))
);

/**
 * @route POST /api/v1/export/cancel/:exportId
 * @desc Cancel an ongoing export
 */
router.post(
  '/cancel/:exportId',
  asyncHandler(controller.cancelExport.bind(controller))
);

/**
 * @route GET /api/v1/export/errors/statistics
 * @desc Get export error statistics
 */
router.get(
  '/errors/statistics',
  asyncHandler(controller.getErrorStatistics.bind(controller))
);

/**
 * @route POST /api/v1/export/cleanup
 * @desc Clean up old export files
 * @body maxAgeHours - Maximum age in hours for files to keep
 */
router.post(
  '/cleanup',
  validate({
    body: {
      maxAgeHours: 'optional'
    }
  }),
  asyncHandler(controller.cleanupExports.bind(controller))
);

/**
 * @route POST /api/v1/export/enhanced
 * @desc Enhanced export with additional formats and features
 * @body tableName - Name of the table to export
 * @body format - Export format (csv, json, excel, parquet)
 * @body columns - Optional array of columns to include
 * @body filters - Optional filters to apply
 * @body chunkSize - Optional chunk size for large exports
 * @body maxRows - Optional maximum rows to export
 * @body encryption - Optional encryption settings
 * @body compression - Optional compression settings
 * @body cloudStorage - Optional cloud storage settings (s3, azure)
 * @body resumable - Whether export should be resumable
 * @body notificationWebhook - Optional webhook URL for completion notification
 */
router.post(
  '/enhanced',
  validate({
    body: {
      tableName: 'required',
      format: ['csv', 'json', 'excel', 'parquet'],
      columns: 'optional',
      filters: 'optional',
      chunkSize: 'optional',
      maxRows: 'optional',
      encryption: 'optional',
      compression: 'optional',
      cloudStorage: 'optional',
      resumable: 'optional',
      notificationWebhook: 'optional'
    }
  }),
  asyncHandler(controller.exportEnhanced.bind(controller))
);

/**
 * @route GET /api/v1/export/transform
 * @desc Transform between export formats (streaming)
 * @query fromFormat - Source format
 * @query toFormat - Target format
 * @query tableName - Table to transform
 */
router.get(
  '/transform',
  validate({
    query: {
      fromFormat: ['csv', 'json'],
      toFormat: ['csv', 'json', 'parquet'],
      tableName: 'required'
    }
  }),
  asyncHandler(controller.createFormatTransform.bind(controller))
);

/**
 * @route POST /api/v1/export/resume/:exportId
 * @desc Resume an interrupted export
 * @param exportId - ID of the export to resume
 * @body options - Export options to continue with
 */
router.post(
  '/resume/:exportId',
  validate({
    body: {
      options: 'required'
    }
  }),
  asyncHandler(controller.resumeExport.bind(controller))
);

/**
 * @route GET /api/v1/export/stream-enhanced
 * @desc Enhanced streaming export for very large datasets
 * @query tableName - Name of the table to export
 * @query format - Export format (csv, json, excel, parquet)
 * @query columns - Optional comma-separated columns
 * @query filters - Optional JSON filters
 * @query chunkSize - Optional chunk size for processing
 * @query compression - Optional compression (gzip)
 * @query encryption - Optional encryption flag
 */
router.get(
  '/stream-enhanced',
  validate({
    query: {
      tableName: 'required',
      format: ['csv', 'json', 'excel', 'parquet'],
      columns: 'optional',
      filters: 'optional',
      chunkSize: 'optional',
      compression: 'optional',
      encryption: 'optional'
    }
  }),
  asyncHandler(controller.streamEnhancedExport.bind(controller))
);

/**
 * @route GET /api/v1/export/memory/stats
 * @desc Get current memory usage statistics
 */
router.get(
  '/memory/stats',
  asyncHandler(controller.getMemoryStats.bind(controller))
);

/**
 * @route POST /api/v1/export/memory/gc
 * @desc Force garbage collection
 */
router.post(
  '/memory/gc',
  asyncHandler(controller.forceGarbageCollection.bind(controller))
);

export default router;