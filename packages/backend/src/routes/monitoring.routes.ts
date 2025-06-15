import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring.controller';
import { asyncHandler, validate } from '../middleware/async.middleware';

const router = Router();
const controller = new MonitoringController();

/**
 * @route GET /api/v1/monitoring/memory/current
 * @desc Get current memory metrics
 */
router.get(
  '/memory/current',
  asyncHandler(controller.getCurrentMetrics.bind(controller))
);

/**
 * @route GET /api/v1/monitoring/memory/history
 * @desc Get memory history
 * @query duration - Duration in milliseconds
 */
router.get(
  '/memory/history',
  asyncHandler(controller.getMemoryHistory.bind(controller))
);

/**
 * @route GET /api/v1/monitoring/memory/statistics
 * @desc Get memory statistics and recommendations
 */
router.get(
  '/memory/statistics',
  asyncHandler(controller.getMemoryStatistics.bind(controller))
);

/**
 * @route POST /api/v1/monitoring/memory/start
 * @desc Start memory monitoring
 * @body warning - Warning threshold percentage
 * @body critical - Critical threshold percentage
 * @body maxHeapSize - Maximum heap size in bytes
 */
router.post(
  '/memory/start',
  validate({
    body: {
      warning: 'optional',
      critical: 'optional',
      maxHeapSize: 'optional'
    }
  }),
  asyncHandler(controller.startMonitoring.bind(controller))
);

/**
 * @route POST /api/v1/monitoring/memory/stop
 * @desc Stop memory monitoring
 */
router.post(
  '/memory/stop',
  asyncHandler(controller.stopMonitoring.bind(controller))
);

/**
 * @route POST /api/v1/monitoring/memory/gc
 * @desc Force garbage collection
 */
router.post(
  '/memory/gc',
  asyncHandler(controller.forceGarbageCollection.bind(controller))
);

/**
 * @route DELETE /api/v1/monitoring/memory/history
 * @desc Clear memory history
 */
router.delete(
  '/memory/history',
  asyncHandler(controller.clearHistory.bind(controller))
);

/**
 * @route GET /api/v1/monitoring/memory/export
 * @desc Export memory metrics
 * @query format - Export format (json or csv)
 */
router.get(
  '/memory/export',
  asyncHandler(controller.exportMetrics.bind(controller))
);

/**
 * @route GET /api/v1/monitoring/system
 * @desc Get system information
 */
router.get(
  '/system',
  asyncHandler(controller.getSystemInfo.bind(controller))
);

export default router;