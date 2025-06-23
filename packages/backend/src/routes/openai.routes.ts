import { Router, Request, Response } from 'express';
import { getOpenAIServiceInstance } from '../services/openai-service-manager';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';

const router = Router();

// Get usage statistics (public for demo purposes)
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
    }
    
    const stats = openaiService.getUsageStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get usage statistics'
    });
  }
});

// Get logs for debugging (public for demo purposes)
router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
    }
    
    const { type, model, limit } = req.query;
    
    const logs = openaiService.getLogs({
      type: type as string,
      model: model as string,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get logs'
    });
  }
});

// Clear statistics (admin only)
router.post('/stats/clear', adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
    }
    
    openaiService.clearStats();
    
    res.json({
      success: true,
      message: 'Statistics cleared successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear statistics'
    });
  }
});

// Test connection
router.get('/test', adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
    }
    
    const result = await openaiService.testConnection();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Connection test failed'
    });
  }
});

// Batch sentiment analysis
router.post('/sentiment/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { texts, model, batchSize } = req.body;
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Array of texts is required'
      });
      return;
    }
    
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
    }
    
    const results = await openaiService.analyzeSentimentBatch(texts, {
      model,
      batchSize,
      onProgress: (completed, total) => {
        console.log(`Batch progress: ${completed}/${total}`);
      }
    });
    
    res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Batch analysis failed'
    });
  }
});

// Streaming sentiment analysis for large text
router.post('/sentiment/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, chunkSize, model } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Text is required'
      });
      return;
    }
    
    const openaiService = getOpenAIServiceInstance();
    
    if (!openaiService) {
      res.status(503).json({
        success: false,
        error: 'OpenAI service not configured'
      });
      return;
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