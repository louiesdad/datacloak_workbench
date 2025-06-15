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

export default router;