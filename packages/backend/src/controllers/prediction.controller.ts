import { Router, Request, Response, NextFunction } from 'express';
import { PredictionService } from '../services/prediction.service';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../middleware/error.middleware';

export class PredictionController {
  public router: Router;
  private predictionService: PredictionService;

  constructor() {
    this.router = Router();
    this.predictionService = new PredictionService();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Get predictions for a customer
    this.router.get(
      '/customer/:customerId',
      asyncHandler(this.getCustomerPredictions.bind(this))
    );

    // Generate new predictions
    this.router.post(
      '/generate/:customerId',
      asyncHandler(this.generatePredictions.bind(this))
    );

    // Get high-risk customers
    this.router.get(
      '/high-risk',
      asyncHandler(this.getHighRiskCustomers.bind(this))
    );

    // Batch process predictions
    this.router.post(
      '/batch-process',
      asyncHandler(this.batchProcessPredictions.bind(this))
    );

    // Export predictions
    this.router.get(
      '/export/:customerId',
      asyncHandler(this.exportPredictions.bind(this))
    );
  }

  private async getCustomerPredictions(
    req: Request,
    res: Response
  ): Promise<void> {
    const { customerId } = req.params;

    if (!customerId) {
      throw new AppError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
    }

    // Try to get saved predictions first
    const savedPredictions = await this.predictionService.getSavedPredictions(customerId);

    if (savedPredictions && savedPredictions.length > 0) {
      // Transform saved predictions to expected format
      const response = {
        customerId,
        predictions: savedPredictions.map(p => ({
          daysAhead: 0, // Calculate from date difference if needed
          predictedSentiment: p.predictedSentiment,
          confidenceLower: p.confidenceLower,
          confidenceUpper: p.confidenceUpper,
          predictedDate: p.predictedDate,
        })),
      };
      res.json(response);
    } else {
      // Generate new predictions
      const predictions = await this.predictionService.generatePredictions(customerId);
      res.json(predictions);
    }
  }

  private async generatePredictions(
    req: Request,
    res: Response
  ): Promise<void> {
    const { customerId } = req.params;

    if (!customerId) {
      throw new AppError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
    }

    const predictions = await this.predictionService.generatePredictions(customerId);
    res.status(201).json(predictions);
  }

  private async getHighRiskCustomers(
    req: Request,
    res: Response
  ): Promise<void> {
    const threshold = req.query.threshold ? Number(req.query.threshold) : 40;

    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      throw new AppError('Invalid threshold parameter', 400, 'INVALID_THRESHOLD');
    }

    const riskAssessment = await this.predictionService.identifyHighRiskCustomers(threshold);
    res.json(riskAssessment);
  }

  private async batchProcessPredictions(
    req: Request,
    res: Response
  ): Promise<void> {
    // Start batch processing asynchronously
    const result = await this.predictionService.processBatchPredictions();

    res.status(202).json({
      message: 'Batch processing started',
      result,
    });
  }

  private async exportPredictions(
    req: Request,
    res: Response
  ): Promise<void> {
    const { customerId } = req.params;
    const format = (req.query.format as 'csv' | 'json') || 'csv';

    if (!customerId) {
      throw new AppError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
    }

    const predictions = await this.predictionService.generatePredictions(customerId);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="predictions-${customerId}.json"`
      );
      res.json(predictions);
    } else {
      // Convert to CSV
      const csvHeaders = ['Days Ahead', 'Predicted Date', 'Predicted Sentiment', 'Lower Bound', 'Upper Bound'];
      const csvRows = [
        csvHeaders.join(','),
        ...predictions.predictions.map(p =>
          [
            p.daysAhead,
            p.predictedDate,
            p.predictedSentiment.toFixed(2),
            p.confidenceLower.toFixed(2),
            p.confidenceUpper.toFixed(2),
          ].join(',')
        ),
      ];

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="predictions-${customerId}.csv"`
      );
      res.send(csvContent);
    }
  }
}