import { Router, Request, Response } from 'express';
import { ImpactCalculatorService } from '../services/impact-calculator.service';
import { CausalAnalysisService } from '../services/causal-analysis.service';
import { PowerAnalysisService } from '../services/power-analysis.service';
import { ConfidenceIntervalService } from '../services/confidence-interval.service';

const router = Router();

// Validation helpers
function validateAnalysisRequest(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.fields || !Array.isArray(data.fields) || data.fields.length === 0) {
    errors.push('At least one field must be specified for analysis');
  }
  
  if (data.preEventWindow && !isValidTimeWindow(data.preEventWindow)) {
    errors.push('Invalid pre-event window format');
  }
  
  if (data.postEventWindow && !isValidTimeWindow(data.postEventWindow)) {
    errors.push('Invalid post-event window format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function isValidTimeWindow(window: string): boolean {
  const validWindows = ['1_day', '3_days', '7_days', '14_days', '30_days'];
  return validWindows.includes(window);
}

// POST /api/analysis/events/:eventId/impact
router.post('/events/:eventId/impact', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const analysisRequest = req.body;

    // Validate request
    const validation = validateAnalysisRequest(analysisRequest);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid analysis parameters',
          details: {
            errors: validation.errors
          }
        }
      });
    }

    const impactCalculatorService = new ImpactCalculatorService();
    
    // Handle different analysis types
    let result;
    if (analysisRequest.analysisType === 'quick') {
      result = await impactCalculatorService.calculateBeforeAfterImpact(eventId, analysisRequest);
    } else {
      result = await impactCalculatorService.calculateMultiFieldImpact(eventId, analysisRequest);
    }

    res.status(200).json({
      success: true,
      data: {
        analysis: result,
        analysisId: result.analysisId
      },
      message: 'Impact analysis completed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'analysis_error',
        message: 'Failed to perform impact analysis',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          eventId: req.params.eventId
        }
      }
    });
  }
});

// GET /api/analysis/events/:eventId/impact/:analysisId
router.get('/events/:eventId/impact/:analysisId', async (req: Request, res: Response) => {
  try {
    const { analysisId } = req.params;
    const impactCalculatorService = new ImpactCalculatorService();
    
    const analysis = await (impactCalculatorService as any).getAnalysisById(analysisId);

    res.status(200).json({
      success: true,
      data: {
        analysis
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: 'Impact analysis not found',
          details: {
            analysisId: req.params.analysisId,
            eventId: req.params.eventId
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to retrieve analysis',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    }
  }
});

// GET /api/analysis/events/:eventId/impact
router.get('/events/:eventId/impact', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { status, analysisType, sortBy, sortOrder } = req.query;
    
    const impactCalculatorService = new ImpactCalculatorService();
    
    const filters = {
      status: status as string,
      analysisType: analysisType as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string
    };

    const analyses = await (impactCalculatorService as any).getAnalysesByEventId(eventId, filters);

    res.status(200).json({
      success: true,
      data: {
        analyses,
        count: analyses.length,
        eventId
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to retrieve analyses',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// POST /api/analysis/events/:eventId/effect-size
router.post('/events/:eventId/effect-size', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const effectSizeRequest = req.body;

    const causalAnalysisService = new CausalAnalysisService();
    const result = await causalAnalysisService.calculateEffectSize(eventId, effectSizeRequest);

    res.status(200).json({
      success: true,
      data: {
        effectSizeAnalysis: result
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'analysis_error',
        message: 'Failed to calculate effect size',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// POST /api/analysis/events/:eventId/power-analysis
router.post('/events/:eventId/power-analysis', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const powerAnalysisRequest = req.body;

    const powerAnalysisService = new PowerAnalysisService();
    const result = await powerAnalysisService.analyzeEventImpactPower(eventId, powerAnalysisRequest);

    res.status(200).json({
      success: true,
      data: {
        powerAnalysis: result
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'analysis_error',
        message: 'Failed to perform power analysis',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// POST /api/analysis/events/:eventId/confidence-intervals
router.post('/events/:eventId/confidence-intervals', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const confidenceRequest = req.body;

    const confidenceIntervalService = new ConfidenceIntervalService();
    const result = await confidenceIntervalService.calculateEventImpactConfidenceInterval(eventId, confidenceRequest);

    res.status(200).json({
      success: true,
      data: {
        confidenceIntervals: result
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'analysis_error',
        message: 'Failed to calculate confidence intervals',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// POST /api/analysis/events/:eventId/comprehensive
router.post('/events/:eventId/comprehensive', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const comprehensiveRequest = req.body;

    const impactCalculatorService = new ImpactCalculatorService();
    const causalAnalysisService = new CausalAnalysisService();
    const powerAnalysisService = new PowerAnalysisService();
    const confidenceIntervalService = new ConfidenceIntervalService();

    const warnings: string[] = [];
    const comprehensiveResult: any = {
      eventId,
      analysisId: `COMPREHENSIVE-${Date.now()}`,
      overview: {}
    };

    // Perform impact analysis
    try {
      comprehensiveResult.impactAnalysis = await impactCalculatorService.calculateMultiFieldImpact(eventId, comprehensiveRequest);
    } catch (error) {
      warnings.push(`Impact analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Perform effect size analysis if requested
    if (comprehensiveRequest.includeEffectSize) {
      try {
        comprehensiveResult.effectSizeAnalysis = await causalAnalysisService.calculateEffectSize(eventId, comprehensiveRequest);
      } catch (error) {
        warnings.push(`Effect size analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Perform power analysis if requested
    if (comprehensiveRequest.includePowerAnalysis) {
      try {
        comprehensiveResult.powerAnalysis = await powerAnalysisService.analyzeEventImpactPower(eventId, comprehensiveRequest);
      } catch (error) {
        warnings.push(`Power analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Perform confidence interval analysis if requested
    if (comprehensiveRequest.includeConfidenceIntervals) {
      try {
        comprehensiveResult.confidenceIntervals = await confidenceIntervalService.calculateEventImpactConfidenceInterval(eventId, comprehensiveRequest);
      } catch (error) {
        warnings.push(`Confidence interval analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Determine response status
    const hasAnyResults = comprehensiveResult.impactAnalysis || 
                         comprehensiveResult.effectSizeAnalysis || 
                         comprehensiveResult.powerAnalysis || 
                         comprehensiveResult.confidenceIntervals;

    const responseStatus = warnings.length > 0 && hasAnyResults ? 206 : 200;

    const response: any = {
      success: true,
      data: {
        comprehensiveAnalysis: comprehensiveResult
      },
      message: 'Comprehensive impact analysis completed successfully'
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.status(responseStatus).json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'analysis_error',
        message: 'Failed to perform comprehensive analysis',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// DELETE /api/analysis/events/:eventId/impact/:analysisId
router.delete('/events/:eventId/impact/:analysisId', async (req: Request, res: Response) => {
  try {
    const { eventId, analysisId } = req.params;
    const impactCalculatorService = new ImpactCalculatorService();
    
    await (impactCalculatorService as any).deleteAnalysis(analysisId);

    res.status(200).json({
      success: true,
      data: {
        deleted: true,
        analysisId,
        eventId
      },
      message: 'Impact analysis deleted successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: 'Impact analysis not found',
          details: {
            analysisId: req.params.analysisId,
            eventId: req.params.eventId
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to delete analysis',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    }
  }
});

export { router as impactAnalysisRouter };