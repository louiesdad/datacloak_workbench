import { Router } from 'express';
import { DataController } from '../controllers/data.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
const dataController = new DataController();

// Data management endpoints
router.post('/upload', asyncHandler(dataController.uploadData));
router.get('/datasets', asyncHandler(dataController.getDatasets));
router.get('/datasets/:id', asyncHandler(dataController.getDatasetById));
router.delete('/datasets/:id', asyncHandler(dataController.deleteDataset));
router.post('/export', asyncHandler(dataController.exportData));

export const dataRoutes = router;