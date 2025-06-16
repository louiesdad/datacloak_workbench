import { Router, Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { adminAuthMiddleware, AuthenticatedRequest } from '../middleware/admin-auth.middleware';
import { IConfig, configSchema } from '../config/config.schema';

const router = Router();

// Get current configuration (sanitized)
router.get('/', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const configService = ConfigService.getInstance();
  return res.json({
    success: true,
    data: configService.getSanitizedConfig(),
  });
});

// Update single configuration value
router.put('/', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Configuration key is required',
      });
    }
    
    const configService = ConfigService.getInstance();
    await configService.update(key as keyof IConfig, value);
    
    return res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update multiple configuration values
router.put('/batch', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
    }
    
    const configService = ConfigService.getInstance();
    await configService.updateMultiple(updates);
    
    return res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update OpenAI API key
router.put('/openai-key', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OpenAI API key format',
      });
    }
    
    const configService = ConfigService.getInstance();
    await configService.update('OPENAI_API_KEY', apiKey);
    
    return res.json({
      success: true,
      message: 'OpenAI API key updated successfully',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get OpenAI configuration
router.get('/openai', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const configService = ConfigService.getInstance();
  const config = configService.getOpenAIConfig();
  
  // Sanitize API key
  if (config.apiKey) {
    config.apiKey = 'sk-***' + config.apiKey.slice(-4);
  }
  
  return res.json({
    success: true,
    data: {
      configured: configService.isOpenAIConfigured(),
      ...config,
    },
  });
});

// Validate configuration values
router.post('/validate', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Updates object is required',
      });
    }
    
    const configService = ConfigService.getInstance();
    const currentConfig = configService.getAll();
    const testConfig = { ...currentConfig, ...updates };
    
    // Validate using schema
    const { error } = configSchema.validate(testConfig);
    
    if (error) {
      return res.json({
        success: false,
        valid: false,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }
    
    return res.json({
      success: true,
      valid: true,
      message: 'Configuration is valid',
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;