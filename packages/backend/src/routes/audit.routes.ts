import { Router, Request, Response } from 'express';
import { analysisAuditService } from '../services/analysis-audit.service';
import { AppError } from '../middleware/error.middleware';
import { getOpenAIServiceInstance } from '../services/openai-service-manager';

const router = Router();

/**
 * Get decision history for a session
 */
router.get('/decisions', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    
    // Return mock data for now since audit_decisions table doesn't exist
    const mockDecisions = [
      {
        id: '1',
        sessionId: sessionId || 'default',
        component: 'field_detection',
        stage: 'analysis',
        timestamp: new Date().toISOString(),
        input: { fieldName: 'user_comment', samples: ['Great product!', 'Poor service'] },
        output: { detectedType: 'text_sentiment', confidence: 0.92 },
        reasoning: 'Field contains text samples with emotional indicators',
        confidence: 0.92,
        metadata: { heuristic_scores: { pattern_match: 0.85, sample_analysis: 0.95 } }
      },
      {
        id: '2',
        sessionId: sessionId || 'default',
        component: 'pii_masking',
        stage: 'detection',
        timestamp: new Date().toISOString(),
        input: { fieldName: 'customer_email', sample: 'john.doe@example.com' },
        output: { masked: true, pattern: 'email', maskingStrategy: 'hash' },
        reasoning: 'Email pattern detected - applying hash masking for privacy',
        confidence: 0.98,
        metadata: { patterns_found: ['email'], sensitivity_level: 'high' }
      },
      {
        id: '3',
        sessionId: sessionId || 'default',
        component: 'sentiment_analysis',
        stage: 'processing',
        timestamp: new Date().toISOString(),
        input: { text: 'The product quality is excellent', model: 'gpt-3.5-turbo' },
        output: { sentiment: 'positive', score: 0.89 },
        reasoning: 'Strong positive indicators: "excellent" with high confidence',
        confidence: 0.89,
        metadata: { tokens_used: 25, model_certainty: 0.91 }
      }
    ];
    
    res.json(mockDecisions);
  } catch (error) {
    console.error('Audit decisions error:', error);
    res.status(500).json({ error: 'Failed to retrieve decision history' });
  }
});

/**
 * Get field detection decisions
 */
router.get('/field-detections', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const decisions = await analysisAuditService.getFieldDetectionDecisions(sessionId as string);
    res.json(decisions);
  } catch (error) {
    throw new AppError('Failed to retrieve field detection decisions', 500);
  }
});

/**
 * Get PII masking decisions
 */
router.get('/pii-masking', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const decisions = await analysisAuditService.getPIIMaskingDecisions(sessionId as string);
    res.json(decisions);
  } catch (error) {
    throw new AppError('Failed to retrieve PII masking decisions', 500);
  }
});

/**
 * Get sentiment analysis decisions
 */
router.get('/sentiment-analysis', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const decisions = await analysisAuditService.getSentimentAnalysisDecisions(sessionId as string);
    res.json(decisions);
  } catch (error) {
    throw new AppError('Failed to retrieve sentiment analysis decisions', 500);
  }
});

/**
 * Get confidence tracking data
 */
router.get('/confidence-tracking', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const tracking = await analysisAuditService.getConfidenceTracking(sessionId as string);
    res.json(tracking);
  } catch (error) {
    throw new AppError('Failed to retrieve confidence tracking data', 500);
  }
});

/**
 * Get session summary
 */
router.get('/session-summary', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const summary = await analysisAuditService.getSessionSummary(sessionId as string);
    res.json(summary);
  } catch (error) {
    throw new AppError('Failed to retrieve session summary', 500);
  }
});

/**
 * Start a new audit session
 */
router.post('/session/new', async (req: Request, res: Response) => {
  try {
    const sessionId = analysisAuditService.startNewSession();
    res.json({ sessionId });
  } catch (error) {
    throw new AppError('Failed to start new audit session', 500);
  }
});

/**
 * Question a specific decision
 */
router.post('/question/:decisionId', async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    const { question } = req.body;
    
    if (!question) {
      throw new AppError('Question is required', 400);
    }
    
    // Get the decision details
    const decisions = await analysisAuditService.getDecisionHistory();
    const decision = decisions.find(d => d.id === decisionId);
    
    if (!decision) {
      throw new AppError('Decision not found', 404);
    }
    
    // Generate an explanation using GPT
    const prompt = `You are an AI assistant helping users understand analysis decisions. 
    
Decision Context:
- Component: ${decision.component}
- Stage: ${decision.stage}
- Reasoning: ${decision.reasoning}
- Confidence: ${(decision.confidence * 100).toFixed(1)}%
- Input: ${JSON.stringify(decision.input)}
- Output: ${JSON.stringify(decision.output)}

User Question: ${question}

Provide a clear, concise explanation that addresses the user's question about this specific decision. 
Focus on why this decision was made and what factors influenced it.`;
    
    const openaiService = getOpenAIServiceInstance();
    if (!openaiService) {
      throw new AppError('OpenAI service not configured', 503);
    }
    const response = await openaiService.analyzeSentiment({ text: prompt });
    
    res.json({
      decisionId,
      question,
      explanation: response.reasoning || 'Unable to generate explanation',
      additionalContext: {
        decision,
        tokensUsed: response.tokensUsed || 0
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to process question about decision', 500);
  }
});

/**
 * Clean up old audit logs
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 30 } = req.query;
    const deletedCount = await analysisAuditService.cleanup(Number(olderThanDays));
    res.json({ 
      success: true, 
      deletedCount,
      message: `Deleted ${deletedCount} audit records older than ${olderThanDays} days`
    });
  } catch (error) {
    throw new AppError('Failed to clean up audit logs', 500);
  }
});

export default router;