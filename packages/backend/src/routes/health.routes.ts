import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../database';
import { duckDBPool } from '../database/duckdb-pool';

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

router.get('/duckdb-pool', async (_req: Request, res: Response) => {
  try {
    const poolStats = await duckDBPool.getPoolStats();
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      pool: poolStats,
      recommendations: {
        ...(poolStats.poolHealth === 'warning' && { warning: 'Pool under stress - consider scaling' }),
        ...(poolStats.poolHealth === 'critical' && { critical: 'Pool in critical state - immediate attention required' })
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export const healthRoutes = router;