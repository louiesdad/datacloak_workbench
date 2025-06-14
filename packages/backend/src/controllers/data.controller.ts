import { Request, Response } from 'express';
import { SuccessResponse } from '../types';
import { DataService } from '../services/data.service';
import { paginationSchema, exportDataSchema, datasetIdSchema } from '../validation/schemas';
import { AppError } from '../middleware/error.middleware';

export class DataController {
  private dataService = new DataService();

  async uploadData(req: Request, res: Response): Promise<void> {
    const file = req.file;
    
    if (!file) {
      throw new AppError('No file provided', 400, 'NO_FILE');
    }

    const uploadResult = await this.dataService.uploadDataset(file);
    
    const result: SuccessResponse = {
      data: uploadResult,
      message: 'Data uploaded successfully',
    };
    
    res.status(201).json(result);
  }

  async getDatasets(req: Request, res: Response): Promise<void> {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { page, pageSize } = value;
    const result = await this.dataService.getDatasets(page, pageSize);
    
    res.json(result);
  }

  async getDatasetById(req: Request, res: Response): Promise<void> {
    const { error, value } = datasetIdSchema.validate(req.params);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { id } = value;
    const dataset = this.dataService.getDatasetById(id);
    
    const result: SuccessResponse = {
      data: dataset,
    };
    
    res.json(result);
  }

  async deleteDataset(req: Request, res: Response): Promise<void> {
    const { error, value } = datasetIdSchema.validate(req.params);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { id } = value;
    await this.dataService.deleteDataset(id);
    
    const result: SuccessResponse = {
      data: { id },
      message: 'Dataset deleted successfully',
    };
    
    res.json(result);
  }

  async exportData(req: Request, res: Response): Promise<void> {
    const { error, value } = exportDataSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { format, datasetId, dateRange, sentimentFilter } = value;
    const exportResult = await this.dataService.exportData(format, {
      datasetId,
      dateRange,
      sentimentFilter,
    });
    
    const result: SuccessResponse = {
      data: exportResult,
      message: 'Export initiated successfully',
    };
    
    res.json(result);
  }
}