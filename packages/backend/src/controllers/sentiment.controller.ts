import { Request, Response } from 'express';
import { SuccessResponse } from '../types';
import { SentimentService } from '../services/sentiment.service';
import { sentimentAnalysisSchema, batchSentimentAnalysisSchema, paginationSchema } from '../validation/schemas';
import { AppError } from '../middleware/error.middleware';

export class SentimentController {
  private sentimentService = new SentimentService();

  async analyzeSentiment(req: Request, res: Response): Promise<void> {
    const { error, value } = sentimentAnalysisSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { text } = value;
    const analysis = await this.sentimentService.analyzeSentiment(text);
    
    const result: SuccessResponse = {
      data: analysis,
      message: 'Sentiment analysis completed',
    };
    
    res.json(result);
  }

  async batchAnalyzeSentiment(req: Request, res: Response): Promise<void> {
    const { error, value } = batchSentimentAnalysisSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { texts } = value;
    const analyses = await this.sentimentService.batchAnalyzeSentiment(texts);
    
    const result: SuccessResponse = {
      data: analyses,
      message: 'Batch sentiment analysis completed',
    };
    
    res.json(result);
  }

  async getAnalysisHistory(req: Request, res: Response): Promise<void> {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { page, pageSize } = value;
    const result = await this.sentimentService.getAnalysisHistory(page, pageSize);
    
    res.json(result);
  }

  async getStatistics(_req: Request, res: Response): Promise<void> {
    const statistics = await this.sentimentService.getStatistics();
    
    const result: SuccessResponse = {
      data: statistics,
    };
    
    res.json(result);
  }
}