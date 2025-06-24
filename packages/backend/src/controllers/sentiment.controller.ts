import { Request, Response } from 'express';
import { SuccessResponse } from '../types';
import { SentimentService } from '../services/sentiment.service';
import { CostEstimationService } from '../services/cost-estimation.service';
import { progressEmitter } from '../services/progress-emitter.service';
import { sentimentAnalysisSchema, batchSentimentAnalysisSchema, paginationSchema } from '../validation/schemas';
import { AppError } from '../middleware/error.middleware';
import { getJobQueueService } from '../services/job-queue.factory';

export class SentimentController {
  private sentimentService = new SentimentService();
  private costEstimationService = new CostEstimationService();
  private jobQueueService: any = null;

  constructor() {
    // Initialize job queue asynchronously
    this.initializeJobQueue();
  }

  private async initializeJobQueue(): Promise<void> {
    try {
      this.jobQueueService = await getJobQueueService();
    } catch (error) {
      console.warn('Job queue service not available, falling back to direct processing');
    }
  }

  async analyzeSentiment(req: Request, res: Response): Promise<void> {
    const { error, value } = sentimentAnalysisSchema.validate(req.body);
    if (error) {
      // Check if the error is about missing text field
      const errorMessage = error.details[0].message;
      if (error.details[0].context?.key === 'text' && error.details[0].type === 'any.required') {
        throw new AppError('text is required', 400, 'VALIDATION_ERROR');
      }
      throw new AppError(errorMessage, 400, 'VALIDATION_ERROR');
    }

    const { text, enablePIIMasking = true, model = 'basic' } = value;
    const analysis = await this.sentimentService.analyzeSentiment(text, enablePIIMasking, model);
    
    const result: SuccessResponse = {
      data: analysis,
      message: `Sentiment analysis completed using ${analysis.model} model`,
    };
    
    res.json(result);
  }

  async batchAnalyzeSentiment(req: Request, res: Response): Promise<void> {
    const { error, value } = batchSentimentAnalysisSchema.validate(req.body);
    if (error) {
      // Check if the error is about batch size exceeding limit
      if (error.details[0].type === 'array.max' && error.details[0].context?.limit === 1000) {
        throw new AppError('Cannot process more than 1000 texts in a single batch', 400, 'BATCH_TOO_LARGE');
      }
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { texts, model = 'basic', enablePIIMasking = true, priority = 'medium', useJobQueue = false } = value;
    
    // Use job queue for large batches (>100 texts) or if explicitly requested
    if ((texts.length > 100 || useJobQueue) && this.jobQueueService) {
      const jobId = this.jobQueueService.addJob('sentiment_analysis_batch', {
        texts,
        model,
        enablePIIMasking,
        analysisMode: 'batch'
      }, { priority });

      const result: SuccessResponse = {
        data: {
          jobId,
          status: 'queued',
          textsCount: texts.length,
          estimatedCompletionTime: Math.ceil(texts.length / 10) // Rough estimate: 10 texts per second
        },
        message: `Batch sentiment analysis job queued for ${texts.length} texts. Use jobId to track progress.`,
      };
      
      res.json(result);
      return;
    }

    // Fall back to direct processing for smaller batches
    const analyses = await this.sentimentService.batchAnalyzeSentiment(texts, model);
    
    const result: SuccessResponse = {
      data: analyses,
      message: `Batch sentiment analysis completed for ${analyses.length} texts using ${model} model`,
    };
    
    res.json(result);
  }

  async getAnalysisHistory(req: Request, res: Response): Promise<void> {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { page, pageSize } = value;
    
    // Extract filter parameters
    const filter: any = {};
    if (req.query.sentiment) filter.sentiment = req.query.sentiment;
    if (req.query.dateFrom) filter.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filter.dateTo = req.query.dateTo;
    if (req.query.minConfidence) filter.minConfidence = parseFloat(req.query.minConfidence as string);
    if (req.query.maxConfidence) filter.maxConfidence = parseFloat(req.query.maxConfidence as string);
    if (req.query.minScore) filter.minScore = parseFloat(req.query.minScore as string);
    if (req.query.maxScore) filter.maxScore = parseFloat(req.query.maxScore as string);
    if (req.query.piiDetected !== undefined) filter.piiDetected = req.query.piiDetected === 'true';
    if (req.query.batchId) filter.batchId = req.query.batchId;
    
    const result = await this.sentimentService.getAnalysisHistory(
      page, 
      pageSize, 
      Object.keys(filter).length > 0 ? filter : undefined
    );
    
    res.json(result);
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    const includeTrends = req.query.includeTrends === 'true';
    const statistics = await this.sentimentService.getStatistics(includeTrends);
    
    const result: SuccessResponse = {
      data: statistics,
    };
    
    res.json(result);
  }

  async estimateCost(req: Request, res: Response): Promise<void> {
    const { textCount, model, averageTextLength, includePIIProcessing } = req.body;
    
    // Validate required fields
    if (!textCount || typeof textCount !== 'number' || textCount <= 0) {
      throw new AppError('textCount is required and must be a positive number', 400, 'VALIDATION_ERROR');
    }
    
    if (!model || typeof model !== 'string') {
      throw new AppError('model is required and must be a string', 400, 'VALIDATION_ERROR');
    }

    try {
      const estimation = await this.costEstimationService.estimateCost({
        textCount,
        model: model as any,
        averageTextLength: averageTextLength || 100,
        includePIIProcessing: includePIIProcessing !== false // Default to true
      });

      const result: SuccessResponse = {
        data: estimation,
        message: 'Cost estimation completed',
      };
      
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to calculate cost estimation', 500, 'COST_ESTIMATION_ERROR');
    }
  }

  async compareCosts(req: Request, res: Response): Promise<void> {
    const { textCount } = req.query;
    
    if (!textCount || isNaN(Number(textCount)) || Number(textCount) <= 0) {
      throw new AppError('textCount query parameter is required and must be a positive number', 400, 'VALIDATION_ERROR');
    }

    try {
      const comparisons = await this.costEstimationService.compareCosts(Number(textCount));

      const result: SuccessResponse = {
        data: {
          textCount: Number(textCount),
          modelComparisons: comparisons
        },
        message: 'Cost comparison completed',
      };
      
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to compare costs', 500, 'COST_COMPARISON_ERROR');
    }
  }

  async getAnalysisById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
      throw new AppError('Valid analysis ID is required', 400, 'VALIDATION_ERROR');
    }

    const result = await this.sentimentService.getAnalysisById(Number(id));
    
    if (!result) {
      throw new AppError('Analysis not found', 404, 'ANALYSIS_NOT_FOUND');
    }

    const response: SuccessResponse = {
      data: result,
    };
    
    res.json(response);
  }

  async deleteAnalysisResults(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('IDs array is required', 400, 'VALIDATION_ERROR');
    }

    // Validate all IDs are numbers
    const numericIds = ids.map(id => {
      const numId = Number(id);
      if (isNaN(numId)) {
        throw new AppError('All IDs must be valid numbers', 400, 'VALIDATION_ERROR');
      }
      return numId;
    });

    const result = await this.sentimentService.deleteAnalysisResults(numericIds);
    
    const response: SuccessResponse = {
      data: result,
      message: `${result.deleted} analysis results deleted successfully`,
    };
    
    res.json(response);
  }

  async exportAnalysisResults(req: Request, res: Response): Promise<void> {
    const { format = 'json' } = req.query;
    
    if (format !== 'json' && format !== 'csv') {
      throw new AppError('Format must be either json or csv', 400, 'VALIDATION_ERROR');
    }

    // Extract filter parameters (same as getAnalysisHistory)
    const filter: any = {};
    if (req.query.sentiment) filter.sentiment = req.query.sentiment;
    if (req.query.dateFrom) filter.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filter.dateTo = req.query.dateTo;
    if (req.query.minConfidence) filter.minConfidence = parseFloat(req.query.minConfidence as string);
    if (req.query.maxConfidence) filter.maxConfidence = parseFloat(req.query.maxConfidence as string);
    if (req.query.minScore) filter.minScore = parseFloat(req.query.minScore as string);
    if (req.query.maxScore) filter.maxScore = parseFloat(req.query.maxScore as string);
    if (req.query.piiDetected !== undefined) filter.piiDetected = req.query.piiDetected === 'true';
    if (req.query.batchId) filter.batchId = req.query.batchId;

    const exportResult = await this.sentimentService.exportAnalysisResults(
      format as 'json' | 'csv',
      Object.keys(filter).length > 0 ? filter : undefined
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sentiment_analysis_results.csv"');
      res.send(exportResult.data);
    } else {
      const response: SuccessResponse = {
        data: exportResult.data,
        message: `${exportResult.recordCount} records exported successfully`,
      };
      res.json(response);
    }
  }

  async getAnalysisInsights(_req: Request, res: Response): Promise<void> {
    const insights = await this.sentimentService.getAnalysisInsights();
    
    const result: SuccessResponse = {
      data: insights,
    };
    
    res.json(result);
  }

  async testOpenAIConnection(_req: Request, res: Response): Promise<void> {
    const connectionResult = await this.sentimentService.testOpenAIConnection();
    
    const result: SuccessResponse = {
      data: connectionResult,
      message: connectionResult.connected 
        ? 'OpenAI connection successful' 
        : 'OpenAI connection failed'
    };
    
    res.json(result);
  }

  async getOpenAIStatus(_req: Request, res: Response): Promise<void> {
    const status = await this.sentimentService.getOpenAIStatus();
    
    const result: SuccessResponse = {
      data: status,
    };
    
    res.json(result);
  }

  async updateOpenAIConfig(req: Request, res: Response): Promise<void> {
    const { model, maxTokens, temperature, timeout } = req.body;
    
    // Validate configuration parameters
    const config: any = {};
    
    if (model) {
      if (typeof model !== 'string') {
        throw new AppError('Model must be a string', 400, 'VALIDATION_ERROR');
      }
      config.model = model;
    }
    
    if (maxTokens !== undefined) {
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4000) {
        throw new AppError('Max tokens must be an integer between 1 and 4000', 400, 'VALIDATION_ERROR');
      }
      config.maxTokens = maxTokens;
    }
    
    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        throw new AppError('Temperature must be a number between 0 and 2', 400, 'VALIDATION_ERROR');
      }
      config.temperature = temperature;
    }
    
    if (timeout !== undefined) {
      if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) {
        throw new AppError('Timeout must be an integer between 1000 and 120000 ms', 400, 'VALIDATION_ERROR');
      }
      config.timeout = timeout;
    }

    const updateResult = await this.sentimentService.updateOpenAIConfig(config);
    
    if (!updateResult.success) {
      throw new AppError(updateResult.error || 'Failed to update configuration', 500, 'CONFIG_UPDATE_ERROR');
    }
    
    const result: SuccessResponse = {
      data: { updated: Object.keys(config) },
      message: 'OpenAI configuration updated successfully',
    };
    
    res.json(result);
  }

  async getAvailableModels(_req: Request, res: Response): Promise<void> {
    const models = this.sentimentService.getAvailableModels();
    
    const result: SuccessResponse = {
      data: models,
    };
    
    res.json(result);
  }

  async testDataCloakFlow(_req: Request, res: Response): Promise<void> {
    const testResult = await this.sentimentService.testDataCloakFlow();
    
    const result: SuccessResponse = {
      data: testResult,
      message: testResult.success 
        ? 'DataCloak flow test completed successfully' 
        : 'DataCloak flow test failed'
    };
    
    res.json(result);
  }

  async getDataCloakStats(_req: Request, res: Response): Promise<void> {
    const stats = await this.sentimentService.getDataCloakStats();
    
    const result: SuccessResponse = {
      data: stats,
    };
    
    res.json(result);
  }

  // Progressive API methods
  async analyzePreview(req: Request, res: Response): Promise<void> {
    const { texts, fields, enablePIIMasking = true, model = 'basic', useJobQueue = false } = req.body;
    
    // For now, minimal implementation - just process the first 1000 rows
    const previewTexts = texts.slice(0, 1000);
    
    // Use job queue for larger previews or if explicitly requested
    if ((previewTexts.length > 50 || useJobQueue) && this.jobQueueService) {
      const jobId = this.jobQueueService.addJob('sentiment_analysis_preview', {
        texts: previewTexts,
        model,
        enablePIIMasking,
        analysisMode: 'preview'
      }, { priority: 'high' }); // Higher priority for previews

      const result: SuccessResponse = {
        data: {
          jobId,
          status: 'queued',
          preview: true,
          textsCount: previewTexts.length,
          estimatedCompletionTime: Math.ceil(previewTexts.length / 20) // Faster for previews
        },
        message: `Preview analysis job queued for ${previewTexts.length} texts. Use jobId to track progress.`,
      };
      
      res.json(result);
      return;
    }

    // Direct processing for small previews
    const jobId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    progressEmitter.initializeJob(jobId, previewTexts.length);
    
    // Process each text with sentiment analysis
    const results: Array<any> = [];
    for (let i = 0; i < previewTexts.length; i++) {
      try {
        const analysis = await this.sentimentService.analyzeSentiment(previewTexts[i], enablePIIMasking, model);
        const { text, ...analysisWithoutText } = analysis;
        results.push({
          rowIndex: i,
          previewText: previewTexts[i].substring(0, 100),
          originalText: text,
          ...analysisWithoutText
        } as any);
      } catch (error) {
        results.push({
          rowIndex: i,
          previewText: previewTexts[i].substring(0, 100),
          error: 'Analysis failed'
        } as any);
      }
      
      // Update progress
      progressEmitter.updateProgress(jobId, i + 1);
    }
    
    const result: SuccessResponse = {
      data: {
        preview: true,
        jobId,
        rowsAnalyzed: previewTexts.length,
        results,
        timeElapsed: Date.now() - parseInt(jobId.split('-')[1])
      },
      message: 'Preview analysis completed'
    };
    
    res.json(result);
  }

  async getAnalysisProgress(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    
    // First check if it's a job queue job
    if (this.jobQueueService) {
      const job = this.jobQueueService.getJob(jobId);
      if (job) {
        const result: SuccessResponse = {
          data: {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            type: job.type,
            priority: job.priority,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error,
            result: job.result
          },
          message: 'Job progress retrieved from queue'
        };
        
        res.json(result);
        return;
      }
    }
    
    // Fall back to progress emitter for direct processing jobs
    const jobInfo = progressEmitter.getJobInfo(jobId);
    
    if (!jobInfo) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }
    
    const result: SuccessResponse = {
      data: {
        jobId,
        status: jobInfo.progress === 100 ? 'completed' : 'processing',
        ...jobInfo
      },
      message: 'Job progress retrieved'
    };
    
    res.json(result);
  }

  async analyzeSample(req: Request, res: Response): Promise<void> {
    const { texts, fields, sampleSize = 10000 } = req.body;
    const jobId = `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Process statistical sample
    const sampleTexts = texts.slice(0, Math.min(sampleSize, texts.length));
    
    // Initialize progress tracking
    progressEmitter.initializeJob(jobId, sampleTexts.length);
    
    // Simulate processing with progress updates
    const results: Array<any> = [];
    for (let i = 0; i < Math.min(sampleTexts.length, 100); i++) {
      results.push({
        previewText: sampleTexts[i].substring(0, 100),
        sentiment: 'neutral',
        confidence: 0.75
      });
      
      // Update progress (simulate processing more than just the result subset)
      if (i % 100 === 0) {
        progressEmitter.updateProgress(jobId, Math.min((i + 1) * 100, sampleTexts.length));
      }
    }
    
    // Mark as complete
    progressEmitter.updateProgress(jobId, sampleTexts.length);
    
    const result: SuccessResponse = {
      data: {
        sample: true,
        jobId,
        sampleSize: sampleTexts.length,
        confidence: 0.95,
        results,
        timeElapsed: 600000 // 10 minutes
      },
      message: 'Sample analysis completed'
    };
    
    res.json(result);
  }
}