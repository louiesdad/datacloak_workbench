import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../database';

const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: dbStatus,
    },
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();
  const isReady = dbStatus.sqlite === 'connected' && dbStatus.duckdb === 'connected';
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString(),
  });
});

export const healthRoutes = router;