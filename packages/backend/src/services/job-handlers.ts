import { Job, JobHandler } from './job-queue.service';
import { SentimentService } from './sentiment.service';
import { DataService } from './data.service';
import { SecurityService } from './security.service';
import { FileStreamService, StreamProgress } from './file-stream.service';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';

/**
 * Job handler for batch sentiment analysis
 */
export const createSentimentAnalysisBatchHandler = (
  sentimentService: SentimentService
): JobHandler => {
  return async (job: Job, updateProgress: (progress: number) => void) => {
    const { texts, enablePIIMasking = true } = job.data;
    
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Invalid job data: texts array is required');
    }

    const results: any[] = [];
    const total = texts.length;
    let processed = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults: any[] = [];

      for (const text of batch) {
        try {
          const result = await sentimentService.analyzeSentiment(text, enablePIIMasking);
          batchResults.push({
            originalText: text,
            ...result
          });
        } catch (error) {
          batchResults.push({
            originalText: text,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        processed++;
        updateProgress((processed / total) * 100);
      }

      results.push(...batchResults);
    }

    return {
      totalProcessed: processed,
      results,
      summary: {
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length
      }
    };
  };
};

/**
 * Job handler for large file processing
 */
export const createFileProcessingHandler = (
  _dataService: DataService,
  fileStreamService: FileStreamService
): JobHandler => {
  return async (job: Job, updateProgress: (progress: number) => void) => {
    const { filePath, datasetId, processingType = 'parse' } = job.data;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const results: any[] = [];
    let totalRows = 0;

    const progressCallback = (progress: StreamProgress) => {
      updateProgress(progress.percentComplete);
    };

    const chunkCallback = async (chunkResult: any) => {
      totalRows += chunkResult.processedRows;
      
      if (processingType === 'parse') {
        // Just collect data for parsing
        results.push(...chunkResult.data);
      } else if (processingType === 'analyze') {
        // Process each chunk through sentiment analysis
        const sentimentService = new SentimentService();
        for (const row of chunkResult.data) {
          try {
            const textFields = Object.values(row).filter(val => 
              typeof val === 'string' && val.length > 10
            );
            
            if (textFields.length > 0) {
              const result = await sentimentService.analyzeSentiment(textFields[0] as string);
              results.push({ ...row, sentiment: result });
            }
          } catch (error) {
            // Skip rows that can't be analyzed
          }
        }
      }
    };

    try {
      const streamResult = await fileStreamService.streamProcessFile(filePath, {
        onProgress: progressCallback,
        onChunk: chunkCallback,
        chunkSize: 256 * 1024 * 1024 // 256MB chunks
      });

      return {
        datasetId,
        totalRows: streamResult.totalRows,
        processedRows: totalRows,
        processingTime: streamResult.processingTime,
        results: processingType === 'parse' ? results.slice(0, 1000) : results // Limit results for memory
      };
    } catch (error) {
      throw new Error(`File processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
};

/**
 * Job handler for security scanning
 */
export const createSecurityScanHandler = (
  securityService: SecurityService
): JobHandler => {
  return async (job: Job, updateProgress: (progress: number) => void) => {
    const { filePath, datasetId, scanType = 'full' } = job.data;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    updateProgress(10);

    try {
      await securityService.initialize();
      updateProgress(20);

      if (scanType === 'full') {
        // Full security scan with detailed analysis
        const scanResult = await securityService.scanDataset(datasetId);
        updateProgress(80);

        // Generate additional security metrics
        const auditResult = await securityService.auditFile(filePath);
        updateProgress(100);

        return {
          datasetId,
          scanResult,
          auditResult,
          summary: {
            piiItemsDetected: scanResult.piiItemsDetected,
            complianceScore: scanResult.complianceScore,
            riskLevel: scanResult.complianceScore >= 0.8 ? 'low' : scanResult.complianceScore >= 0.6 ? 'medium' : 'high',
            recommendations: scanResult.recommendations
          }
        };
      } else {
        // Quick PII detection scan
        const fileContent = fs.readFileSync(filePath, 'utf-8').slice(0, 10000); // First 10KB
        updateProgress(50);

        const piiResults = await securityService.detectPII(fileContent);
        updateProgress(100);

        return {
          datasetId,
          quickScan: true,
          piiResults,
          summary: {
            piiItemsDetected: piiResults.length,
            piiTypes: [...new Set(piiResults.map(r => r.piiType))]
          }
        };
      }
    } catch (error) {
      throw new Error(`Security scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
};

/**
 * Job handler for data export
 */
export const createDataExportHandler = (
  dataService: DataService
): JobHandler => {
  return async (job: Job, updateProgress: (progress: number) => void) => {
    const { datasetId, format, filters, includeMetadata = false } = job.data;

    updateProgress(10);

    try {
      // Get dataset info
      const dataset = dataService.getDatasetById(datasetId);
      updateProgress(20);

      // Get upload directory
      const uploadDir = path.join(process.cwd(), 'data', 'uploads');
      const filePath = path.join(uploadDir, dataset.filename);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Dataset file not found: ${filePath}`);
      }

      updateProgress(30);

      // Read and process data based on format
      let data: any[] = [];
      const mimeType = dataset.mimeType || '';

      if (mimeType === 'text/csv' || mimeType === 'text/plain') {
        // Parse CSV
        data = await new Promise((resolve, reject) => {
          const results: any[] = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: any) => {
              results.push(row);
            })
            .on('end', () => resolve(results))
            .on('error', reject);
        });
      } else {
        // Parse Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      updateProgress(70);

      // Apply filters if provided
      if (filters) {
        if (filters.limit) {
          data = data.slice(0, filters.limit);
        }
        if (filters.columns) {
          data = data.map(row => {
            const filtered: any = {};
            filters.columns.forEach((col: string) => {
              if (row[col] !== undefined) {
                filtered[col] = row[col];
              }
            });
            return filtered;
          });
        }
      }

      updateProgress(90);

      // Generate export data
      const exportData = {
        metadata: includeMetadata ? {
          datasetId,
          originalFilename: dataset.originalFilename,
          recordCount: data.length,
          exportedAt: new Date().toISOString(),
          format
        } : undefined,
        data
      };

      updateProgress(100);

      return {
        exportData,
        recordCount: data.length,
        format,
        summary: {
          totalRecords: data.length,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`Data export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
};

/**
 * Register all job handlers with a job queue service
 */
export const registerAllHandlers = (
  jobQueue: any,
  services: {
    sentimentService: SentimentService;
    dataService: DataService;
    securityService: SecurityService;
    fileStreamService: FileStreamService;
  }
): void => {
  jobQueue.registerHandler(
    'sentiment_analysis_batch',
    createSentimentAnalysisBatchHandler(services.sentimentService)
  );

  jobQueue.registerHandler(
    'file_processing',
    createFileProcessingHandler(services.dataService, services.fileStreamService)
  );

  jobQueue.registerHandler(
    'security_scan',
    createSecurityScanHandler(services.securityService)
  );

  jobQueue.registerHandler(
    'data_export',
    createDataExportHandler(services.dataService)
  );
};