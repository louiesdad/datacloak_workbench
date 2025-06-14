import { Router } from 'express';
import multer from 'multer';
import { DataController } from '../controllers/data.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
const dataController = new DataController();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024, // 50GB limit
    fieldSize: 100 * 1024 * 1024, // 100MB field size
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// Data management endpoints
router.post('/upload', upload.single('file'), asyncHandler(dataController.uploadData));
router.get('/datasets', asyncHandler(dataController.getDatasets));
router.get('/datasets/:id', asyncHandler(dataController.getDatasetById));
router.delete('/datasets/:id', asyncHandler(dataController.deleteDataset));
router.post('/export', asyncHandler(dataController.exportData));

export const dataRoutes = router;