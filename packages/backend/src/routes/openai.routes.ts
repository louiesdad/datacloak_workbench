import { Router, Request, Response } from 'express';
import { OpenAIService } from '../services/openai.service';
import { ConfigService } from '../services/config.service';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';

const router = Router();

// Get OpenAI service instance
const getOpenAIService = (): OpenAIService | null => {
  const configService = ConfigService.getInstance();
  const config = configService.getOpenAIConfig();
  
  if (!config.apiKey) {
    return null;
  }
  
  return new OpenAIService({
    apiKey: config.apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    timeout: config.timeout
  });
};

// Get usage statistics (admin only)
router.get('/stats', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    const stats = openaiService.getUsageStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get usage statistics'
    });
  }
});

// Get logs for debugging (admin only)
router.get('/logs', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    const { type, model, limit } = req.query;
    
    const logs = openaiService.getLogs({
      type: type as string,
      model: model as string,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });
    
    return res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get logs'
    });
  }
});

// Clear statistics (admin only)
router.post('/stats/clear', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    openaiService.clearStats();
    
    return res.json({
      success: true,
      message: 'Statistics cleared successfully'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear statistics'
    });
  }
});

// Test connection
router.get('/test', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    const result = await openaiService.testConnection();
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Connection test failed'
    });
  }
});

// Batch sentiment analysis
router.post('/sentiment/batch', async (req: Request, res: Response) => {
  try {
    const { texts, model, batchSize } = req.body;
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of texts is required'
      });
    }
    
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    const results = await openaiService.analyzeSentimentBatch(texts, {
      model,
      batchSize,
      onProgress: (completed, total) => {
        console.log(`Batch progress: ${completed}/${total}`);
      }
    });
    
    return res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Batch analysis failed'
    });
  }
});

// Streaming sentiment analysis for large text
router.post('/sentiment/stream', async (req: Request, res: Response) => {
  try {
    const { text, chunkSize, model } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }
    
    const openaiService = getOpenAIService();
    
    if (!openaiService) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
    }
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Stream results
    const stream = openaiService.analyzeSentimentStream(text, {
      chunkSize,
      model,
      onProgress: (processed, total) => {
        res.write(`event: progress\ndata: ${JSON.stringify({ processed, total })}\n\n`);
      }
    });
    
    for await (const result of stream) {
      res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
    }
    
    res.write('event: complete\ndata: {}\n\n');
    res.end();
    
  } catch (error: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;