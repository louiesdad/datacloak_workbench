import { Router } from 'express';
import { StreamController } from '../controllers/stream.controller';
import { asyncHandler } from '../middleware/async.middleware';

const router = Router();
const streamController = new StreamController();

// Get streaming configuration for a file
router.get('/config/:filename', asyncHandler(streamController.getStreamConfig.bind(streamController)));

// Stream process a file with Server-Sent Events
router.post('/process/:filename', asyncHandler(streamController.streamProcess.bind(streamController)));

// Get current memory usage statistics
router.get('/memory', asyncHandler(streamController.getMemoryStats.bind(streamController)));

// Process a specific chunk
router.post('/chunk/:filename', asyncHandler(streamController.processChunk.bind(streamController)));

export { router as streamRoutes };