import { Router, Request, Response } from 'express';
import { circuitBreakerManager } from '../services/circuit-breaker.service';
import { authenticateOrBypass } from '../middleware/auth.middleware';

const router = Router();

/**
 * Get status of all circuit breakers
 */
router.get('/status', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    const metrics = circuitBreakerManager.getAllMetrics();
    res.json({
      status: 'ok',
      breakers: metrics,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get circuit breaker status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific circuit breaker status
 */
router.get('/status/:name', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const breaker = circuitBreakerManager.getBreaker(name);
    
    if (!breaker) {
      res.status(404).json({
        error: 'Circuit breaker not found',
        name
      });
      return;
    }

    res.json({
      name,
      metrics: breaker.getMetrics(),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get circuit breaker status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset a specific circuit breaker
 */
router.post('/reset/:name', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const breaker = circuitBreakerManager.getBreaker(name);
    
    if (!breaker) {
      res.status(404).json({
        error: 'Circuit breaker not found',
        name
      });
      return;
    }

    breaker.reset();
    
    res.json({
      message: `Circuit breaker ${name} has been reset`,
      metrics: breaker.getMetrics()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset all circuit breakers
 */
router.post('/reset', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    circuitBreakerManager.resetAll();
    
    res.json({
      message: 'All circuit breakers have been reset',
      metrics: circuitBreakerManager.getAllMetrics()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset circuit breakers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Force open a circuit breaker (for testing)
 */
router.post('/force-open/:name', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const breaker = circuitBreakerManager.getBreaker(name);
    
    if (!breaker) {
      res.status(404).json({
        error: 'Circuit breaker not found',
        name
      });
      return;
    }

    breaker.forceOpen();
    
    res.json({
      message: `Circuit breaker ${name} has been forced open`,
      metrics: breaker.getMetrics()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to force open circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Force close a circuit breaker (for testing)
 */
router.post('/force-close/:name', authenticateOrBypass, (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const breaker = circuitBreakerManager.getBreaker(name);
    
    if (!breaker) {
      res.status(404).json({
        error: 'Circuit breaker not found',
        name
      });
      return;
    }

    breaker.forceClose();
    
    res.json({
      message: `Circuit breaker ${name} has been forced closed`,
      metrics: breaker.getMetrics()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to force close circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export const circuitBreakerRoutes = router;