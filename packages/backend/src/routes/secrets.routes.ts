import { Router, Request, Response, NextFunction } from 'express';
import { SecretManagerService } from '../services/secret-manager.service';
import { SecretValidator, secretUtils } from '../config/secrets';
import { authenticate, authorize } from '../middleware/auth.middleware';
import logger from '../config/logger';
const router = Router();
const secretManager = SecretManagerService.getInstance();

// Middleware to check if secret management is enabled
const checkSecretManagementEnabled = (req: Request, res: Response, next: NextFunction): void => {
  const configService = require('../services/config.service').ConfigService.getInstance();
  const enabled = configService.get('ENABLE_SECRET_MANAGEMENT_API');
  
  if (!enabled) {
    res.status(403).json({
      error: 'Secret management API is disabled'
    });
    return;
  }
  
  return next();
};

// Apply authentication and admin requirements to all routes
router.use(authenticate);
router.use(authorize(['admin']));
router.use(checkSecretManagementEnabled);

/**
 * List all available secrets (keys only, not values)
 */
router.get('/secrets', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string || 'env';
    
    // Get list of secret keys from environment
    const secretKeys = Object.keys(process.env)
      .filter(key => secretUtils.isSecretKey(key))
      .map(key => ({
        key,
        hasPolicy: !!secretUtils.getSecretPolicy(key),
        rotationRequired: false, // TODO: Check rotation metadata
      }));
    
    res.json({
      provider,
      secrets: secretKeys,
      count: secretKeys.length
    });
  } catch (error) {
    logger.error('Failed to list secrets:', error);
    res.status(500).json({ error: 'Failed to list secrets' });
  }
});

/**
 * Get secret metadata (not the value)
 */
router.get('/secrets/:key/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    
    // Validate key format
    if (!key.match(/^[A-Z0-9_]+$/)) {
      res.status(400).json({ error: 'Invalid secret key format' });
      return;
    }
    
    const policy = secretUtils.getSecretPolicy(key);
    const exists = process.env[key] !== undefined;
    
    res.json({
      key,
      exists,
      policy: policy ? {
        minLength: policy.minLength,
        maxLength: policy.maxLength,
        rotationIntervalDays: policy.rotationInterval 
          ? Math.floor(policy.rotationInterval / (24 * 60 * 60 * 1000))
          : null,
        hasComplexityRequirements: !!policy.complexity
      } : null
    });
  } catch (error) {
    logger.error('Failed to get secret metadata:', error);
    res.status(500).json({ error: 'Failed to get secret metadata' });
  }
});

/**
 * Validate a secret value without storing it
 */
router.post('/secrets/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;
    
    if (!key || !value) {
      res.status(400).json({ error: 'Key and value are required' });
      return;
    }
    
    const validation = SecretValidator.validateSecret(key, value);
    
    res.json({
      key,
      valid: validation.valid,
      errors: validation.errors || []
    });
  } catch (error) {
    logger.error('Failed to validate secret:', error);
    res.status(500).json({ error: 'Failed to validate secret' });
  }
});

/**
 * Generate a secure secret value
 */
router.post('/secrets/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.body;
    
    if (!key) {
      res.status(400).json({ error: 'Key is required' });
      return;
    }
    
    const value = SecretValidator.generateSecureSecret(key);
    const validation = SecretValidator.validateSecret(key, value);
    
    res.json({
      key,
      value,
      valid: validation.valid,
      length: value.length
    });
  } catch (error) {
    logger.error('Failed to generate secret:', error);
    res.status(500).json({ error: 'Failed to generate secret' });
  }
});

/**
 * Update a secret (requires additional confirmation)
 */
router.put('/secrets/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value, confirmKey } = req.body;
    const userId = (req as any).user?.id || 'admin';
    
    // Double-check confirmation
    if (confirmKey !== key) {
      res.status(400).json({ 
        error: 'Confirmation key does not match' 
      });
      return;
    }
    
    // Validate the new value
    const validation = SecretValidator.validateSecret(key, value);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid secret value',
        details: validation.errors
      });
      return;
    }
    
    // Update the secret
    await secretManager.setSecret(key, value, {
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      source: 'api'
    }, userId);
    
    logger.info(`Secret ${key} updated by ${userId}`);
    
    res.json({
      message: 'Secret updated successfully',
      key
    });
  } catch (error) {
    logger.error('Failed to update secret:', error);
    res.status(500).json({ error: 'Failed to update secret' });
  }
});

/**
 * Rotate a secret
 */
router.post('/secrets/:key/rotate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const userId = (req as any).user?.id || 'admin';
    
    const newValue = await secretManager.rotateSecret(key, userId);
    
    logger.info(`Secret ${key} rotated by ${userId}`);
    
    res.json({
      message: 'Secret rotated successfully',
      key,
      length: newValue.length
    });
  } catch (error) {
    logger.error('Failed to rotate secret:', error);
    res.status(500).json({ error: 'Failed to rotate secret' });
  }
});

/**
 * Delete a secret (requires additional confirmation)
 */
router.delete('/secrets/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { confirmKey, confirmAction } = req.body;
    const userId = (req as any).user?.id || 'admin';
    
    // Double-check confirmation
    if (confirmKey !== key || confirmAction !== 'DELETE') {
      res.status(400).json({ 
        error: 'Invalid confirmation' 
      });
      return;
    }
    
    await secretManager.deleteSecret(key, userId);
    
    logger.info(`Secret ${key} deleted by ${userId}`);
    
    res.json({
      message: 'Secret deleted successfully',
      key
    });
  } catch (error) {
    logger.error('Failed to delete secret:', error);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

/**
 * Get secret access audit log
 */
router.get('/secrets/audit/access', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: any = {};
    
    if (req.query.secretKey) {
      filters.secretKey = req.query.secretKey as string;
    }
    if (req.query.accessedBy) {
      filters.accessedBy = req.query.accessedBy as string;
    }
    if (req.query.operation) {
      filters.operation = req.query.operation as string;
    }
    
    const log = secretManager.getAccessLog(filters);
    
    res.json({
      count: log.length,
      entries: log.slice(0, 100) // Limit to most recent 100
    });
  } catch (error) {
    logger.error('Failed to get audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

/**
 * Export full audit log
 */
router.get('/secrets/audit/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const exportData = await secretManager.exportAccessLog();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="secret-audit-log.json"');
    res.send(exportData);
  } catch (error) {
    logger.error('Failed to export audit log:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

/**
 * Get rotation schedule and status
 */
router.get('/secrets/rotation/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const secretKeys = Object.keys(process.env)
      .filter(key => secretUtils.isSecretKey(key));
    
    const rotationStatus = secretKeys.map(key => {
      const policy = secretUtils.getSecretPolicy(key);
      const rotationInterval = policy?.rotationInterval;
      
      return {
        key,
        rotationEnabled: !!rotationInterval,
        rotationIntervalDays: rotationInterval 
          ? Math.floor(rotationInterval / (24 * 60 * 60 * 1000))
          : null,
        // TODO: Get actual last rotation date from metadata
        lastRotated: null,
        nextRotation: null
      };
    });
    
    res.json({
      secrets: rotationStatus.filter(s => s.rotationEnabled),
      totalSecrets: secretKeys.length,
      rotationEnabledCount: rotationStatus.filter(s => s.rotationEnabled).length
    });
  } catch (error) {
    logger.error('Failed to get rotation status:', error);
    res.status(500).json({ error: 'Failed to get rotation status' });
  }
});

/**
 * Set up automatic rotation for a secret
 */
router.post('/secrets/:key/rotation/enable', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { intervalDays } = req.body;
    
    if (!intervalDays || intervalDays < 1) {
      res.status(400).json({ 
        error: 'Interval days must be at least 1' 
      });
      return;
    }
    
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    secretManager.setupRotationSchedule(key, intervalMs);
    
    logger.info(`Rotation enabled for ${key} every ${intervalDays} days`);
    
    res.json({
      message: 'Rotation schedule enabled',
      key,
      intervalDays
    });
  } catch (error) {
    logger.error('Failed to enable rotation:', error);
    res.status(500).json({ error: 'Failed to enable rotation' });
  }
});

/**
 * Clear secret cache (useful after external changes)
 */
router.post('/secrets/cache/clear', async (req: Request, res: Response): Promise<void> => {
  try {
    secretManager.clearCache();
    
    logger.info('Secret cache cleared');
    
    res.json({
      message: 'Secret cache cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;