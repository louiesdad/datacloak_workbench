import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { adminAuthMiddleware, AuthenticatedRequest } from '../middleware/admin-auth.middleware';
import { IConfig, configSchema } from '../config/config.schema';

const router = Router();

// Get current configuration (sanitized)
router.get('/', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const configService = ConfigService.getInstance();
  res.json({
    success: true,
    data: configService.getSanitizedConfig(),
  });
});

// Update single configuration value
router.put('/', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      res.status(400).json({
        success: false,
        error: 'Configuration key is required',
      });
      return;
    }
    
    const configService = ConfigService.getInstance();
    await configService.update(key as keyof IConfig, value);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

// Update multiple configuration values
router.put('/batch', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
      return;
    }
    
    const configService = ConfigService.getInstance();
    await configService.updateMultiple(updates);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

// Update OpenAI API key
router.put('/openai-key', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      res.status(400).json({
        success: false,
        error: 'Invalid OpenAI API key format',
      });
    }
    
    const configService = ConfigService.getInstance();
    await configService.update('OPENAI_API_KEY', apiKey);
    
    res.json({
      success: true,
      message: 'OpenAI API key updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

// Get OpenAI configuration
router.get('/openai', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const configService = ConfigService.getInstance();
  const config = configService.getOpenAIConfig();
  
  // Sanitize API key
  if (config.apiKey) {
    config.apiKey = 'sk-***' + config.apiKey.slice(-4);
  }
  
  res.json({
    success: true,
    data: {
      configured: configService.isOpenAIConfigured(),
      ...config,
    },
  });
});

// Validate configuration values
router.post('/validate', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
      return;
    }
    
    const configService = ConfigService.getInstance();
    const currentConfig = configService.getAll();
    const testConfig = { ...currentConfig, ...updates };
    
    // Validate using schema
    const { error } = configSchema.validate(testConfig);
    
    if (error) {
      res.json({
        success: false,
        valid: false,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }
    
    res.json({
      success: true,
      valid: true,
      message: 'Configuration is valid',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }
});

export default router;