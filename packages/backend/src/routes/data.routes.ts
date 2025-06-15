import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { DataController } from '../controllers/data.controller';
import { asyncHandler } from '../middleware/validation.middleware';
import { AppError } from '../middleware/error.middleware';

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
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});

// Multer error handler
const handleMulterError = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      throw new AppError('File size exceeds limit', 400, 'FILE_TOO_LARGE');
    }
    throw new AppError(err.message, 400, 'UPLOAD_ERROR');
  } else if (err) {
    if (err.message === 'INVALID_FILE_TYPE') {
      throw new AppError('Unsupported file type. Only CSV and Excel files are allowed.', 400, 'INVALID_FILE_TYPE');
    }
    throw new AppError(err.message, 400, 'UPLOAD_ERROR');
  }
  next();
};

// Data management endpoints
router.post('/upload', upload.single('file'), handleMulterError, asyncHandler(dataController.uploadData.bind(dataController)));
router.get('/datasets', asyncHandler(dataController.getDatasets.bind(dataController)));
router.get('/datasets/:id', asyncHandler(dataController.getDatasetById.bind(dataController)));
router.delete('/datasets/:id', asyncHandler(dataController.deleteDataset.bind(dataController)));
router.post('/export', asyncHandler(dataController.exportData.bind(dataController)));

export const dataRoutes = router;