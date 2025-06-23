import { Router } from 'express';
import { PredictionController } from '../controllers/prediction.controller';

const router = Router();
const predictionController = new PredictionController();

// Mount the prediction controller routes
router.use('/', predictionController.router);

export default router;
export { router as predictionRoutes };