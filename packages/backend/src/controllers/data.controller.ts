import { Request, Response } from 'express';
import { SuccessResponse, PaginatedResponse } from '../types';
import { Dataset, ExportResult } from '../types/api-types';
import { DataService } from '../services/data.service';
import { paginationSchema, exportDataSchema, datasetIdSchema } from '../validation/schemas';
import { AppError } from '../middleware/error.middleware';

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

export class DataController {
  private dataService = new DataService();

  async uploadData(req: RequestWithFile, res: Response): Promise<void> {
    console.log('Upload request received. Files:', req.files);
    console.log('Request headers:', req.headers);
    
    const file = req.file;
    
    if (!file) {
      console.error('No file found in request');
      console.error('Request body:', req.body);
      throw new AppError('No file provided', 400, 'NO_FILE');
    }

    console.log(`Processing file: ${file.originalname} (${file.size} bytes)`);
    
    try {
      const uploadResult = await this.dataService.uploadDataset(file);
      
      console.log('File processed successfully:', uploadResult);
      
      const result: SuccessResponse = {
        data: uploadResult,
        message: 'Data uploaded successfully',
      };
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  async getDatasets(req: Request, res: Response): Promise<void> {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { page, pageSize } = value;
    const result: PaginatedResponse<Dataset> = await this.dataService.getDatasets(page, pageSize);
    
    res.json(result);
  }

  async getDatasetById(req: Request, res: Response): Promise<void> {
    const { error, value } = datasetIdSchema.validate(req.params);
    if (error) {
      throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
    }

    const { id } = value;
    const dataset: Dataset = await this.dataService.getDatasetById(id);
    
    const result: SuccessResponse<Dataset> = {
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
    const exportResult: ExportResult = await this.dataService.exportData(format, {
      datasetId,
      dateRange,
      sentimentFilter,
    });
    
    const result: SuccessResponse<ExportResult> = {
      data: exportResult,
      message: 'Export initiated successfully',
    };
    
    res.json(result);
  }
}