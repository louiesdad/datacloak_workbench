import { withSQLiteConnection } from '../database/sqlite-refactored';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SecurityService } from './security.service';
import { FileStreamService } from './file-stream.service';
import { DataCloakStreamService, DataCloakStreamOptions } from './datacloak-stream.service';
import { detectDelimiter, createFlexibleCsvParser } from './csv-parser-fix';
import { PapaParseAdapter } from './papaparse-adapter';
import { EventEmitter } from 'events';

export interface Dataset {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  recordCount: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
  securityAuditId?: string;
  piiDetected?: number;
  complianceScore?: number;
  riskLevel?: string;
}

export interface AnalysisBatch {
  id: string;
  datasetId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  completedRecords: number;
  createdAt: string;
  updatedAt: string;
}

export interface FieldStatistics {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'unknown';
  sampleValues: any[];
  nullCount: number;
  totalCount: number;
  uniqueCount: number;
  completeness: number;
  uniqueness: number;
  mostCommonValue?: any;
  mostCommonValueCount?: number;
  minLength?: number;
  maxLength?: number;
  averageLength?: number;
  piiDetected?: boolean;
  piiType?: string;
  confidenceScore?: number;
  warnings?: string[];
  dataQualityScore?: number;
}

export interface StreamingOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  batchSize?: number;
  enableProgressTracking?: boolean;
  onProgress?: (progress: StreamProgress) => void;
  enableDataCloak?: boolean;
  timeout?: number;
}

export interface StreamProgress {
  processedBytes: number;
  totalBytes: number;
  processedRecords: number;
  estimatedTotalRecords?: number;
  percentComplete: number;
  bytesPerSecond: number;
  estimatedTimeRemaining?: number;
  memoryUsage?: number;
  errors?: string[];
}

export interface UploadResult {
  dataset: Dataset;
  previewData: any[];
  fieldInfo: FieldStatistics[];
  securityScan?: SecurityScanResult;
  dataQuality?: DataQualityReport;
}

export interface SecurityScanResult {
  piiItemsDetected: number;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  violations?: string[];
  maskingApplied?: boolean;
}

export interface DataQualityReport {
  overallScore: number;
  issues: Array<{
    type: 'completeness' | 'consistency' | 'validity' | 'uniqueness';
    severity: 'low' | 'medium' | 'high';
    field?: string;
    description: string;
    count?: number;
  }>;
  recommendations: string[];
}

export interface ParseOptions {
  skipErrors?: boolean;
  maxErrors?: number;
  sampleSize?: number;
  enableTypeInference?: boolean;
  customDelimiter?: string;
}

export class RefactoredDataService extends EventEmitter {
  private securityService: SecurityService;
  private fileStreamService: FileStreamService;
  private dataCloakStreamService: DataCloakStreamService;
  private papaParseAdapter: PapaParseAdapter;
  
  private static readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_PREVIEW_ROWS = 100;
  private static readonly SUPPORTED_MIME_TYPES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/tab-separated-values'
  ];

  constructor() {
    super();
    this.securityService = new SecurityService();
    this.fileStreamService = new FileStreamService();
    this.dataCloakStreamService = new DataCloakStreamService();
    this.papaParseAdapter = new PapaParseAdapter();
  }

  private getUploadDir(): string {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
  }

  async uploadDataset(file: Express.Multer.File, options: ParseOptions = {}): Promise<UploadResult> {
    this.validateFile(file);

    const datasetId = uuidv4();
    const uploadDir = this.getUploadDir();
    const fileExtension = path.extname(file.originalname);
    const filename = `${datasetId}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);

    try {
      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);
      this.emit('file-saved', { datasetId, filePath });

      // Parse file and get preview data
      const parseResult = await this.parseFile(filePath, file.mimetype, options);
      this.emit('file-parsed', { datasetId, recordCount: parseResult.recordCount });

      // Perform security scan
      const securityScan = await this.performSecurityScan(datasetId, parseResult.previewData);
      
      // Generate data quality report
      const dataQuality = this.generateDataQualityReport(parseResult.fieldInfo);

      // Store dataset metadata
      const dataset = await this.storeDatasetMetadata({
        id: datasetId,
        filename,
        originalFilename: file.originalname,
        size: file.size,
        recordCount: parseResult.recordCount,
        mimeType: file.mimetype,
        securityScan
      });

      const result: UploadResult = {
        dataset,
        previewData: parseResult.previewData,
        fieldInfo: parseResult.fieldInfo,
        securityScan,
        dataQuality
      };

      this.emit('upload-completed', { datasetId, result });
      return result;

    } catch (error) {
      this.emit('upload-failed', { datasetId, error });
      
      // Cleanup file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw error;
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new AppError('No file provided', 400, 'NO_FILE');
    }

    if (!RefactoredDataService.SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError(
        `Unsupported file type: ${file.mimetype}. Supported types: ${RefactoredDataService.SUPPORTED_MIME_TYPES.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      );
    }

    if (file.size > 50 * 1024 * 1024 * 1024) { // 50GB limit
      throw new AppError('File too large. Maximum size is 50GB', 400, 'FILE_TOO_LARGE');
    }
  }

  private async parseFile(
    filePath: string, 
    mimeType: string, 
    options: ParseOptions = {}
  ): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    const fileSize = fs.statSync(filePath).size;
    const isLargeFile = fileSize > RefactoredDataService.LARGE_FILE_THRESHOLD;

    if (isLargeFile) {
      return this.parseLargeFile(filePath, mimeType, options);
    } else {
      return this.parseSmallFile(filePath, mimeType, options);
    }
  }

  private async parseSmallFile(
    filePath: string, 
    mimeType: string, 
    options: ParseOptions
  ): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    let data: any[] = [];

    try {
      if (mimeType === 'text/csv' || mimeType === 'text/plain' || mimeType === 'text/tab-separated-values') {
        data = await this.papaParseAdapter.parseFile(filePath, {});
      } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        data = this.parseExcelFile(filePath);
      } else {
        throw new AppError(`Unsupported file type for parsing: ${mimeType}`, 400, 'UNSUPPORTED_TYPE');
      }

      const previewData = data.slice(0, RefactoredDataService.MAX_PREVIEW_ROWS);
      const fieldInfo = this.generateFieldStatistics(data, options);

      return {
        previewData,
        fieldInfo,
        recordCount: data.length
      };
    } catch (error) {
      throw new AppError(
        `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400,
        'PARSE_ERROR'
      );
    }
  }

  private async parseLargeFile(
    filePath: string, 
    mimeType: string, 
    options: ParseOptions
  ): Promise<{
    previewData: any[];
    fieldInfo: FieldStatistics[];
    recordCount: number;
  }> {
    const streamOptions: StreamingOptions = {
      chunkSize: 64 * 1024, // 64KB chunks
      batchSize: 1000,
      maxMemoryUsage: 512, // 512MB
      enableProgressTracking: true,
      onProgress: (progress) => {
        this.emit('parse-progress', progress);
      }
    };

    const result = await this.fileStreamService.streamProcessFile(filePath, {
      chunkSize: streamOptions.chunkSize,
      mimeType: mimeType,
      maxRows: 1000 // Get preview data
    });
    
    // Convert the result to expected format
    return {
      previewData: [], // streamProcessFile doesn't return preview data
      fieldInfo: [],   // Would need separate analysis
      recordCount: result.totalRows
    };
  }

  private parseExcelFile(filePath: string): any[] {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    } catch (error) {
      throw new AppError(
        `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400,
        'EXCEL_PARSE_ERROR'
      );
    }
  }

  private generateFieldStatistics(data: any[], options: ParseOptions): FieldStatistics[] {
    if (!data.length) return [];

    const sampleSize = Math.min(options.sampleSize || 1000, data.length);
    const sampleData = data.slice(0, sampleSize);
    const fields = Object.keys(sampleData[0] || {});

    return fields.map(field => {
      const values = sampleData.map(row => row[field]).filter(val => val !== null && val !== undefined && val !== '');
      const allValues = data.map(row => row[field]);
      
      const nullCount = allValues.length - values.length;
      const uniqueValues = new Set(values);
      const totalCount = allValues.length;

      const statistics: FieldStatistics = {
        name: field,
        type: this.inferFieldType(values),
        sampleValues: Array.from(uniqueValues).slice(0, 5),
        nullCount,
        totalCount,
        uniqueCount: uniqueValues.size,
        completeness: totalCount > 0 ? ((totalCount - nullCount) / totalCount) * 100 : 0,
        uniqueness: totalCount > 0 ? (uniqueValues.size / totalCount) * 100 : 0,
        warnings: []
      };

      // Add string-specific statistics
      if (statistics.type === 'string') {
        const stringValues = values.filter(v => typeof v === 'string');
        if (stringValues.length > 0) {
          const lengths = stringValues.map(v => v.length);
          statistics.minLength = Math.min(...lengths);
          statistics.maxLength = Math.max(...lengths);
          statistics.averageLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        }
      }

      // Find most common value
      const valueCounts = new Map<any, number>();
      values.forEach(value => {
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      });

      if (valueCounts.size > 0) {
        const [mostCommon, count] = Array.from(valueCounts.entries())
          .sort(([,a], [,b]) => b - a)[0];
        statistics.mostCommonValue = mostCommon;
        statistics.mostCommonValueCount = count;
      }

      // Generate warnings
      this.addDataQualityWarnings(statistics);

      // Calculate data quality score
      statistics.dataQualityScore = this.calculateFieldQualityScore(statistics);

      return statistics;
    });
  }

  private inferFieldType(values: any[]): FieldStatistics['type'] {
    if (!values.length) return 'unknown';

    const sample = values.slice(0, 100); // Sample first 100 values
    
    // Email detection
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (sample.some(v => typeof v === 'string' && emailRegex.test(v))) {
      return 'email';
    }

    // Date detection (check before phone to avoid conflict)
    const dateCount = sample.filter(v => {
      if (typeof v === 'string') {
        // More specific date patterns
        const datePatterns = [
          /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
          /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
          /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
          /^\d{2}-\d{2}-\d{4}$/   // MM-DD-YYYY
        ];
        
        if (datePatterns.some(pattern => pattern.test(v))) {
          const date = new Date(v);
          return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
        }
      }
      return false;
    }).length;
    
    if (dateCount / sample.length > 0.8) {
      return 'date';
    }

    // Phone detection  
    const phoneRegex = /^[\+]?[(]?[\d]{3}[)]?[\s\-]?[\d]{3}[\s\-]?[\d]{4}$/;
    if (sample.some(v => typeof v === 'string' && phoneRegex.test(v))) {
      return 'phone';
    }

    // Number detection
    const numberCount = sample.filter(v => {
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        const num = parseFloat(v);
        return !isNaN(num) && isFinite(num);
      }
      return false;
    }).length;

    if (numberCount / sample.length > 0.8) {
      return 'number';
    }

    // Boolean detection
    const booleanValues = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n']);
    const booleanCount = sample.filter(v => 
      typeof v === 'boolean' || 
      (typeof v === 'string' && booleanValues.has(v.toLowerCase()))
    ).length;

    if (booleanCount / sample.length > 0.8) {
      return 'boolean';
    }

    return 'string';
  }

  private addDataQualityWarnings(statistics: FieldStatistics): void {
    const warnings: string[] = [];

    // Completeness warnings
    if (statistics.completeness < 50) {
      warnings.push(`Low completeness: ${statistics.completeness.toFixed(1)}% of values are missing`);
    }

    // Uniqueness warnings
    if (statistics.uniqueness < 10) {
      warnings.push(`Low uniqueness: Only ${statistics.uniqueness.toFixed(1)}% of values are unique`);
    }

    // Type-specific warnings
    if (statistics.type === 'string') {
      if (statistics.maxLength && statistics.maxLength > 1000) {
        warnings.push(`Very long strings detected (max length: ${statistics.maxLength})`);
      }
      if (statistics.averageLength && statistics.averageLength < 2) {
        warnings.push('Very short string values detected');
      }
    }

    statistics.warnings = warnings;
  }

  private calculateFieldQualityScore(statistics: FieldStatistics): number {
    let score = 100;

    // Completeness factor (0-40 points)
    score -= (100 - statistics.completeness) * 0.4;

    // Uniqueness factor (0-20 points for non-ID fields)
    if (statistics.uniqueness < 50 && !statistics.name.toLowerCase().includes('id')) {
      score -= (50 - statistics.uniqueness) * 0.2;
    }

    // Warning factor (0-20 points)
    score -= (statistics.warnings?.length || 0) * 10;

    // Type inference confidence (0-20 points)
    if (statistics.type === 'unknown') {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async performSecurityScan(
    datasetId: string, 
    previewData: any[]
  ): Promise<SecurityScanResult | undefined> {
    try {
      await this.securityService.initialize();
      const scanResult = await this.securityService.scanDataset(datasetId);
      
      return {
        piiItemsDetected: scanResult.piiItemsDetected,
        complianceScore: scanResult.complianceScore,
        riskLevel: this.getRiskLevel(scanResult.complianceScore),
        recommendations: scanResult.recommendations,
        violations: scanResult.violations,
        maskingApplied: false
      };
    } catch (error) {
      console.warn('Security scan failed:', error);
      this.emit('security-scan-failed', { datasetId, error });
      return undefined;
    }
  }

  private getRiskLevel(complianceScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (complianceScore >= 90) return 'low';
    if (complianceScore >= 70) return 'medium';
    if (complianceScore >= 50) return 'high';
    return 'critical';
  }

  private generateDataQualityReport(fieldInfo: FieldStatistics[]): DataQualityReport {
    const issues: DataQualityReport['issues'] = [];
    let totalScore = 0;

    fieldInfo.forEach(field => {
      totalScore += field.dataQualityScore || 0;

      // Check for specific issues
      if (field.completeness < 70) {
        issues.push({
          type: 'completeness',
          severity: field.completeness < 50 ? 'high' : 'medium',
          field: field.name,
          description: `Field "${field.name}" has ${field.completeness.toFixed(1)}% completeness`,
          count: field.nullCount
        });
      }

      if (field.uniqueness < 10 && !field.name.toLowerCase().includes('id')) {
        issues.push({
          type: 'uniqueness',
          severity: 'medium',
          field: field.name,
          description: `Field "${field.name}" has low uniqueness (${field.uniqueness.toFixed(1)}%)`,
          count: field.uniqueCount
        });
      }

      if (field.type === 'unknown') {
        issues.push({
          type: 'validity',
          severity: 'low',
          field: field.name,
          description: `Unable to determine data type for field "${field.name}"`,
        });
      }
    });

    const overallScore = fieldInfo.length > 0 ? totalScore / fieldInfo.length : 100;

    const recommendations: string[] = [];
    if (overallScore < 70) {
      recommendations.push('Consider data cleansing before analysis');
    }
    if (issues.some(i => i.type === 'completeness' && i.severity === 'high')) {
      recommendations.push('Address missing data in critical fields');
    }
    if (issues.some(i => i.type === 'validity')) {
      recommendations.push('Review data types and formats');
    }

    return {
      overallScore,
      issues,
      recommendations
    };
  }

  private async storeDatasetMetadata(data: {
    id: string;
    filename: string;
    originalFilename: string;
    size: number;
    recordCount: number;
    mimeType: string;
    securityScan?: SecurityScanResult;
  }): Promise<Dataset> {
    return withSQLiteConnection(async (db) => {
      const stmt = db.prepare(`
        INSERT INTO datasets (
          id, filename, original_filename, size, record_count, mime_type,
          pii_detected, compliance_score, risk_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.id,
        data.filename,
        data.originalFilename,
        data.size,
        data.recordCount,
        data.mimeType,
        data.securityScan?.piiItemsDetected || 0,
        data.securityScan?.complianceScore || 100,
        data.securityScan?.riskLevel || 'low'
      );

      // Retrieve the created dataset
      const selectStmt = db.prepare('SELECT * FROM datasets WHERE id = ?');
      const dataset = selectStmt.get(data.id) as any;

      return {
        id: dataset.id,
        filename: dataset.filename,
        originalFilename: dataset.original_filename,
        size: dataset.size,
        recordCount: dataset.record_count,
        mimeType: dataset.mime_type,
        createdAt: dataset.created_at,
        updatedAt: dataset.updated_at,
        piiDetected: dataset.pii_detected,
        complianceScore: dataset.compliance_score,
        riskLevel: dataset.risk_level
      };
    });
  }

  async getDatasets(): Promise<Dataset[]> {
    return withSQLiteConnection(async (db) => {
      const stmt = db.prepare('SELECT * FROM datasets ORDER BY created_at DESC');
      const rows = stmt.all() as any[];

      return rows.map(row => ({
        id: row.id,
        filename: row.filename,
        originalFilename: row.original_filename,
        size: row.size,
        recordCount: row.record_count,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        piiDetected: row.pii_detected,
        complianceScore: row.compliance_score,
        riskLevel: row.risk_level
      }));
    });
  }

  async getDatasetById(id: string): Promise<Dataset | null> {
    return withSQLiteConnection(async (db) => {
      const stmt = db.prepare('SELECT * FROM datasets WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) return null;

      return {
        id: row.id,
        filename: row.filename,
        originalFilename: row.original_filename,
        size: row.size,
        recordCount: row.record_count,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        piiDetected: row.pii_detected,
        complianceScore: row.compliance_score,
        riskLevel: row.risk_level
      };
    });
  }

  async deleteDataset(id: string): Promise<void> {
    const dataset = await this.getDatasetById(id);
    if (!dataset) {
      throw new AppError('Dataset not found', 404, 'DATASET_NOT_FOUND');
    }

    // Delete physical file
    const uploadDir = this.getUploadDir();
    const filePath = path.join(uploadDir, dataset.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await withSQLiteConnection(async (db) => {
      const stmt = db.prepare('DELETE FROM datasets WHERE id = ?');
      stmt.run(id);
    });

    this.emit('dataset-deleted', { id });
  }

}