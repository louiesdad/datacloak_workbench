import { Readable, Transform } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { AppError } from '../middleware/error.middleware';
import { ExportService, ExportOptions, ExportProgress, ChunkedExportResult } from './export.service';
// Optional cloud storage imports - will be undefined if packages not installed
let S3Client: any, PutObjectCommand: any, CreateMultipartUploadCommand: any, UploadPartCommand: any, CompleteMultipartUploadCommand: any;
let BlobServiceClient: any;
let parquet: any;

try {
  const aws = require('@aws-sdk/client-s3');
  S3Client = aws.S3Client;
  PutObjectCommand = aws.PutObjectCommand;
  CreateMultipartUploadCommand = aws.CreateMultipartUploadCommand;
  UploadPartCommand = aws.UploadPartCommand;
  CompleteMultipartUploadCommand = aws.CompleteMultipartUploadCommand;
} catch (e) {
  // AWS SDK not installed
}

try {
  const azure = require('@azure/storage-blob');
  BlobServiceClient = azure.BlobServiceClient;
} catch (e) {
  // Azure SDK not installed
}

try {
  parquet = require('parquetjs-lite');
} catch (e) {
  // Parquet library not installed
}

export interface EnhancedExportOptions extends Omit<ExportOptions, 'format'> {
  format: 'csv' | 'json' | 'excel' | 'parquet';
  encryption?: {
    enabled: boolean;
    algorithm?: string;
    password?: string;
  };
  compression?: {
    enabled: boolean;
    type?: 'gzip' | 'zip';
  };
  cloudStorage?: {
    provider: 's3' | 'azure' | 'gcs';
    bucket?: string;
    path?: string;
    credentials?: any;
  };
  resumable?: boolean;
  notificationWebhook?: string;
}

export interface ExportMetadata {
  exportId: string;
  format: string;
  rowCount: number;
  fileSize: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  cloudUrl?: string;
  created: Date;
  expires?: Date;
  memoryStats?: MemoryStats;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  peakMemoryUsage: number;
  gcCollections: number;
  averageMemoryUsage: number;
}

export interface MemoryThresholds {
  warningThreshold: number;  // MB
  criticalThreshold: number; // MB
  gcThreshold: number;       // MB
}

class MemoryMonitor {
  private memoryHistory: number[] = [];
  private gcCollections = 0;
  private peakMemoryUsage = 0;
  private startTime = Date.now();
  private thresholds: MemoryThresholds;

  constructor(thresholds?: Partial<MemoryThresholds>) {
    this.thresholds = {
      warningThreshold: thresholds?.warningThreshold || 512, // 512MB
      criticalThreshold: thresholds?.criticalThreshold || 1024, // 1GB
      gcThreshold: thresholds?.gcThreshold || 256 // 256MB
    };

    // Monitor GC events if available
    if (global.gc) {
      const originalGc = global.gc;
      (global as any).gc = () => {
        this.gcCollections++;
        return originalGc();
      };
    }
  }

  getCurrentMemoryUsage(): MemoryStats {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    // Track peak memory usage
    if (heapUsedMB > this.peakMemoryUsage) {
      this.peakMemoryUsage = heapUsedMB;
    }

    // Add to history for average calculation
    this.memoryHistory.push(heapUsedMB);
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift(); // Keep only last 100 measurements
    }

    const averageMemoryUsage = this.memoryHistory.reduce((a, b) => a + b, 0) / this.memoryHistory.length;

    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      peakMemoryUsage: Math.round(this.peakMemoryUsage),
      gcCollections: this.gcCollections,
      averageMemoryUsage: Math.round(averageMemoryUsage)
    };
  }

  checkMemoryThresholds(): 'normal' | 'warning' | 'critical' {
    const memStats = this.getCurrentMemoryUsage();
    
    if (memStats.heapUsed > this.thresholds.criticalThreshold) {
      return 'critical';
    } else if (memStats.heapUsed > this.thresholds.warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }

  shouldForceGC(): boolean {
    const memStats = this.getCurrentMemoryUsage();
    return memStats.heapUsed > this.thresholds.gcThreshold;
  }

  forceGarbageCollection(): void {
    if (global.gc) {
      console.log('Forcing garbage collection due to high memory usage');
      (global as any).gc();
      this.gcCollections++;
    }
  }

  logMemoryStats(context: string): void {
    const memStats = this.getCurrentMemoryUsage();
    const threshold = this.checkMemoryThresholds();
    
    if (threshold !== 'normal') {
      console.warn(`[${context}] Memory ${threshold}: ${JSON.stringify(memStats)}`);
    } else {
      console.log(`[${context}] Memory usage: Heap ${memStats.heapUsed}MB, RSS ${memStats.rss}MB`);
    }
  }
}

export class EnhancedExportService extends ExportService {
  private s3Client?: any;
  private azureClient?: any;
  private resumableExports: Map<string, ResumableExportState> = new Map();
  private memoryMonitor: MemoryMonitor;

  constructor() {
    super();
    this.memoryMonitor = new MemoryMonitor({
      warningThreshold: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '512'),
      criticalThreshold: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '1024'),
      gcThreshold: parseInt(process.env.MEMORY_GC_THRESHOLD || '256')
    });
    this.initializeCloudClients();
  }

  private initializeCloudClients() {
    // Initialize S3 client if AWS credentials are available and SDK is installed
    if (S3Client && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
    }

    // Initialize Azure client if credentials are available and SDK is installed
    if (BlobServiceClient && process.env.AZURE_STORAGE_CONNECTION_STRING) {
      this.azureClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );
    }
  }

  /**
   * Enhanced export with additional formats and features
   */
  async exportEnhanced(
    tableName: string,
    options: EnhancedExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportMetadata> {
    const exportId = crypto.randomUUID();
    const startTime = new Date();

    // Initialize memory monitoring for this export
    this.memoryMonitor.logMemoryStats(`Export Start: ${exportId}`);

    try {
      // Check if this is a resume request
      if (options.resumable && this.resumableExports.has(exportId)) {
        return this.resumeExport(exportId, options, onProgress);
      }

      // Memory check before starting export
      const memoryStatus = this.memoryMonitor.checkMemoryThresholds();
      if (memoryStatus === 'critical') {
        this.memoryMonitor.forceGarbageCollection();
        
        // Re-check after GC
        const postGcStatus = this.memoryMonitor.checkMemoryThresholds();
        if (postGcStatus === 'critical') {
          throw new AppError('Insufficient memory to start export', 503, 'MEMORY_CRITICAL');
        }
      }

      // Export data based on format
      let result: ChunkedExportResult;
      
      if (options.format === 'parquet') {
        if (!parquet) {
          throw new AppError('Parquet export requires parquetjs-lite package to be installed', 400, 'PARQUET_NOT_AVAILABLE');
        }
        result = await this.exportToParquet(tableName, options, exportId, onProgress);
      } else {
        result = await this.exportLargeDataset(tableName, options as ExportOptions, onProgress);
      }

      // Memory monitoring after data export
      this.memoryMonitor.logMemoryStats(`Data Export Complete: ${exportId}`);
      
      // Force GC if memory usage is high before post-processing
      if (this.memoryMonitor.shouldForceGC()) {
        this.memoryMonitor.forceGarbageCollection();
      }

      // Apply encryption if requested
      if (options.encryption?.enabled) {
        this.memoryMonitor.logMemoryStats(`Encryption Start: ${exportId}`);
        await this.encryptExportFiles(result, options.encryption);
        this.memoryMonitor.logMemoryStats(`Encryption Complete: ${exportId}`);
      }

      // Apply compression if requested
      if (options.compression?.enabled) {
        this.memoryMonitor.logMemoryStats(`Compression Start: ${exportId}`);
        await this.compressExportFiles(result, options.compression);
        this.memoryMonitor.logMemoryStats(`Compression Complete: ${exportId}`);
      }

      // Upload to cloud storage if configured
      let cloudUrl: string | undefined;
      if (options.cloudStorage) {
        this.memoryMonitor.logMemoryStats(`Cloud Upload Start: ${exportId}`);
        cloudUrl = await this.uploadToCloud(result, options.cloudStorage);
        this.memoryMonitor.logMemoryStats(`Cloud Upload Complete: ${exportId}`);
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(result);

      // Final memory stats for metadata
      const finalMemoryStats = this.memoryMonitor.getCurrentMemoryUsage();
      this.memoryMonitor.logMemoryStats(`Export Finalization: ${exportId}`);

      // Create metadata with memory statistics
      const metadata: ExportMetadata = {
        exportId,
        format: options.format,
        rowCount: result.totalRows,
        fileSize: result.totalSize,
        checksum,
        encrypted: options.encryption?.enabled || false,
        compressed: options.compression?.enabled || false,
        cloudUrl,
        created: startTime,
        expires: this.calculateExpiration(),
        memoryStats: finalMemoryStats
      };

      // Send notification if webhook provided
      if (options.notificationWebhook) {
        await this.sendExportNotification(metadata, options.notificationWebhook);
      }

      return metadata;

    } catch (error) {
      // Save state for resumable exports
      if (options.resumable) {
        this.saveResumableState(exportId, tableName, options);
      }
      
      throw error;
    }
  }

  /**
   * Export to Parquet format
   */
  private async exportToParquet(
    tableName: string,
    options: EnhancedExportOptions,
    exportId: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ChunkedExportResult> {
    const schema = await this.inferParquetSchema(tableName);
    const writer = await parquet.ParquetWriter.openFile(schema, 
      path.join(process.cwd(), 'exports', `export_${exportId}.parquet`)
    );

    const chunkSize = options.chunkSize || 10000;
    let offset = 0;
    let totalRows = 0;
    const chunks: any[] = [];

    try {
      while (true) {
        const data = await super.getDataChunk(tableName, options as ExportOptions, offset, chunkSize);
        if (data.length === 0) break;

        for (const row of data) {
          await writer.appendRow(row);
        }

        totalRows += data.length;
        offset += data.length;

        if (onProgress) {
          onProgress({
            exportId,
            totalRows,
            processedRows: totalRows,
            percentComplete: 100, // We don't know total in advance
            status: 'processing',
            startTime: new Date()
          });
        }

        if (data.length < chunkSize) break;
      }

      await writer.close();

      const stats = fs.statSync(writer.path);
      
      return {
        exportId,
        chunks: [{
          chunkIndex: 0,
          startRow: 0,
          endRow: totalRows - 1,
          rowCount: totalRows,
          size: stats.size,
          path: writer.path,
          created: new Date()
        }],
        totalRows,
        totalSize: stats.size,
        format: 'parquet',
        completed: true
      };
    } catch (error) {
      await writer.close();
      throw error;
    }
  }

  /**
   * Infer Parquet schema from table
   */
  private async inferParquetSchema(tableName: string): Promise<any> {
    // Get sample data to infer schema
    const sampleData = await super.getDataChunk(tableName, { format: 'csv' } as ExportOptions, 0, 100);
    if (sampleData.length === 0) {
      throw new AppError('No data available to infer schema', 400, 'NO_DATA');
    }

    const fields: any = {};
    const firstRow = sampleData[0];

    for (const [key, value] of Object.entries(firstRow)) {
      if (typeof value === 'string') {
        fields[key] = { type: 'UTF8', optional: true };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          fields[key] = { type: 'INT64', optional: true };
        } else {
          fields[key] = { type: 'DOUBLE', optional: true };
        }
      } else if (typeof value === 'boolean') {
        fields[key] = { type: 'BOOLEAN', optional: true };
      } else if (value instanceof Date) {
        fields[key] = { type: 'TIMESTAMP_MILLIS', optional: true };
      } else {
        fields[key] = { type: 'UTF8', optional: true }; // Default to string
      }
    }

    return new parquet.ParquetSchema(fields);
  }

  /**
   * Encrypt export files with enhanced security
   */
  private async encryptExportFiles(
    result: ChunkedExportResult,
    encryptionConfig: any
  ): Promise<void> {
    const algorithm = encryptionConfig.algorithm || 'aes-256-gcm'; // Use GCM for authenticated encryption
    const password = encryptionConfig.password || process.env.EXPORT_ENCRYPTION_KEY;
    
    if (!password) {
      throw new AppError('Encryption password not provided', 400, 'NO_ENCRYPTION_KEY');
    }

    // Generate a random salt for each export
    const salt = crypto.randomBytes(32);
    const key = crypto.scryptSync(password, salt, 32);

    for (const chunk of result.chunks) {
      const inputPath = chunk.path;
      const outputPath = `${inputPath}.enc`;
      
      // Generate a random IV for each file
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      const input = fs.createReadStream(inputPath);
      const output = fs.createWriteStream(outputPath);
      
      // Write salt and IV at the beginning of the file
      output.write(salt);
      output.write(iv);
      
      await new Promise<void>((resolve, reject) => {
        input
          .pipe(cipher)
          .pipe(output, { end: false })
          .on('finish', () => {
            // For GCM mode, append the auth tag
            if (algorithm.includes('gcm')) {
              output.write(cipher.getAuthTag());
            }
            output.end();
            resolve();
          })
          .on('error', reject);
      });

      // Verify encryption was successful
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new AppError('Encryption failed - output file is empty', 500, 'ENCRYPTION_FAILED');
      }

      // Replace original with encrypted file
      fs.unlinkSync(inputPath);
      fs.renameSync(outputPath, inputPath);
      
      // Update chunk size to reflect encrypted file size
      chunk.size = stats.size;
      
      // Log encryption success (without sensitive data)
      console.log(`File encrypted successfully: ${path.basename(inputPath)}, size: ${stats.size} bytes`);
    }
  }

  /**
   * Compress export files
   */
  private async compressExportFiles(
    result: ChunkedExportResult,
    compressionConfig: any
  ): Promise<void> {
    const type = compressionConfig.type || 'gzip';

    for (const chunk of result.chunks) {
      const inputPath = chunk.path;
      const outputPath = type === 'gzip' ? `${inputPath}.gz` : `${inputPath}.zip`;
      
      if (type === 'gzip') {
        const gzip = zlib.createGzip({ level: 9 });
        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);
        
        await new Promise<void>((resolve, reject) => {
          input
            .pipe(gzip)
            .pipe(output)
            .on('finish', () => resolve())
            .on('error', reject);
        });
      } else {
        // ZIP compression would require additional library like archiver
        throw new AppError('ZIP compression not yet implemented', 501, 'NOT_IMPLEMENTED');
      }

      // Update file info
      const stats = fs.statSync(outputPath);
      chunk.size = stats.size;
      
      // Replace original with compressed file
      fs.unlinkSync(inputPath);
      fs.renameSync(outputPath, inputPath);
    }
  }

  /**
   * Upload to cloud storage
   */
  private async uploadToCloud(
    result: ChunkedExportResult,
    cloudConfig: any
  ): Promise<string> {
    switch (cloudConfig.provider) {
      case 's3':
        return this.uploadToS3(result, cloudConfig);
      case 'azure':
        return this.uploadToAzure(result, cloudConfig);
      default:
        throw new AppError('Unsupported cloud provider', 400, 'UNSUPPORTED_PROVIDER');
    }
  }

  /**
   * Upload to S3 with enhanced features
   */
  private async uploadToS3(
    result: ChunkedExportResult,
    cloudConfig: any
  ): Promise<string> {
    if (!S3Client) {
      throw new AppError('S3 export requires @aws-sdk/client-s3 package to be installed', 400, 'S3_SDK_NOT_AVAILABLE');
    }
    if (!this.s3Client) {
      throw new AppError('S3 client not configured', 500, 'S3_NOT_CONFIGURED');
    }

    const bucket = cloudConfig.bucket || process.env.S3_EXPORT_BUCKET;
    if (!bucket) {
      throw new AppError('S3 bucket not specified', 400, 'NO_BUCKET');
    }

    // Enhanced path generation with timestamp and export metadata
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `exports/${timestamp}/${result.exportId}/${result.exportId}.${result.format}`;
    const key = cloudConfig.path || defaultPath;

    // Enhanced metadata for S3 objects
    const metadata = {
      'export-id': result.exportId,
      'export-format': result.format,
      'total-rows': result.totalRows.toString(),
      'file-count': result.chunks.length.toString(),
      'created-at': new Date().toISOString(),
      'datacloak-version': process.env.npm_package_version || 'unknown'
    };

    // Enhanced tags for S3 objects (for cost tracking and governance)
    const tagging = [
      'project=datacloak-sentiment-workbench',
      'type=export',
      `format=${result.format}`,
      `export-id=${result.exportId}`,
      `created=${new Date().toISOString().split('T')[0]}`
    ].join('&');

    try {
      if (result.chunks.length === 1) {
        // Single file upload with enhanced options
        const fileContent = fs.readFileSync(result.chunks[0].path);
        
        await this.s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
          ContentType: this.getContentType(result.format),
          ServerSideEncryption: 'AES256',
          Metadata: metadata,
          Tagging: tagging,
          StorageClass: cloudConfig.storageClass || 'STANDARD', // Allow configurable storage class
          CacheControl: 'max-age=31536000', // 1 year cache for exports
          ContentDisposition: `attachment; filename="${result.exportId}.${result.format}"`
        }));

        console.log(`S3 upload completed: s3://${bucket}/${key}`);
        return `s3://${bucket}/${key}`;
      } else {
        // Multipart upload for large files with progress tracking
        console.log(`Starting multipart upload for ${result.chunks.length} chunks`);
        
        const multipartUpload = await this.s3Client.send(new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: this.getContentType(result.format),
          ServerSideEncryption: 'AES256',
          Metadata: metadata,
          Tagging: tagging,
          StorageClass: cloudConfig.storageClass || 'STANDARD',
          CacheControl: 'max-age=31536000',
          ContentDisposition: `attachment; filename="${result.exportId}.${result.format}"`
        }));

        const uploadId = multipartUpload.UploadId!;
        const parts: any[] = [];

        // Upload parts with retry logic
        for (let i = 0; i < result.chunks.length; i++) {
          const chunk = result.chunks[i];
          const partNumber = i + 1;
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              const fileContent = fs.readFileSync(chunk.path);
              
              const uploadPart = await this.s3Client.send(new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: fileContent
              }));

              parts.push({
                ETag: uploadPart.ETag,
                PartNumber: partNumber
              });

              console.log(`Uploaded part ${partNumber}/${result.chunks.length} (${chunk.size} bytes)`);
              break;
            } catch (error) {
              retryCount++;
              if (retryCount >= maxRetries) {
                // Abort multipart upload on failure
                try {
                  await this.s3Client.send({
                    name: 'AbortMultipartUploadCommand',
                    input: { Bucket: bucket, Key: key, UploadId: uploadId }
                  });
                } catch (abortError) {
                  console.error('Failed to abort multipart upload:', abortError);
                }
                throw new AppError(`Failed to upload part ${partNumber} after ${maxRetries} retries: ${error}`, 500, 'S3_UPLOAD_FAILED');
              }
              console.warn(`Retrying part ${partNumber} upload (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            }
          }
        }

        await this.s3Client.send(new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts }
        }));

        console.log(`S3 multipart upload completed: s3://${bucket}/${key}`);
        return `s3://${bucket}/${key}`;
      }
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new AppError(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500, 'S3_UPLOAD_ERROR');
    }
  }

  /**
   * Upload to Azure Blob Storage with enhanced features
   */
  private async uploadToAzure(
    result: ChunkedExportResult,
    cloudConfig: any
  ): Promise<string> {
    if (!BlobServiceClient) {
      throw new AppError('Azure export requires @azure/storage-blob package to be installed', 400, 'AZURE_SDK_NOT_AVAILABLE');
    }
    if (!this.azureClient) {
      throw new AppError('Azure client not configured', 500, 'AZURE_NOT_CONFIGURED');
    }

    const containerName = cloudConfig.bucket || process.env.AZURE_CONTAINER_NAME || 'exports';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `exports/${timestamp}/${result.exportId}/${result.exportId}.${result.format}`;
    const blobName = cloudConfig.path || defaultPath;

    try {
      const containerClient = this.azureClient.getContainerClient(containerName);
      
      // Create container if it doesn't exist with proper access level
      await containerClient.createIfNotExists({
        access: 'blob', // Allow anonymous read access to blobs
        metadata: {
          'created-by': 'datacloak-sentiment-workbench',
          'purpose': 'export-storage'
        }
      });

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Enhanced metadata for Azure blobs
      const metadata = {
        'exportId': result.exportId,
        'exportFormat': result.format,
        'totalRows': result.totalRows.toString(),
        'fileCount': result.chunks.length.toString(),
        'createdAt': new Date().toISOString(),
        'datacloakVersion': process.env.npm_package_version || 'unknown'
      };

      // Enhanced blob properties
      const blobHttpHeaders = {
        blobContentType: this.getContentType(result.format),
        blobContentDisposition: `attachment; filename="${result.exportId}.${result.format}"`,
        blobCacheControl: 'max-age=31536000', // 1 year cache
      };

      // Enhanced tags for Azure blobs (for cost tracking and governance)
      const tags = {
        'project': 'datacloak-sentiment-workbench',
        'type': 'export',
        'format': result.format,
        'exportId': result.exportId,
        'created': new Date().toISOString().split('T')[0]
      };

      if (result.chunks.length === 1) {
        // Single file upload with enhanced options
        await blockBlobClient.uploadFile(result.chunks[0].path, {
          metadata,
          blobHTTPHeaders: blobHttpHeaders,
          tags,
          tier: cloudConfig.accessTier || 'Hot' // Allow configurable access tier
        });

        console.log(`Azure upload completed: ${blockBlobClient.url}`);
      } else {
        // Block upload for large files with retry logic
        console.log(`Starting Azure block upload for ${result.chunks.length} chunks`);
        
        const blockIds: string[] = [];
        const maxRetries = 3;

        for (let i = 0; i < result.chunks.length; i++) {
          const chunk = result.chunks[i];
          const blockId = Buffer.from(`block-${String(i).padStart(8, '0')}`).toString('base64');
          blockIds.push(blockId);

          let retryCount = 0;
          while (retryCount < maxRetries) {
            try {
              const fileContent = fs.readFileSync(chunk.path);
              await blockBlobClient.stageBlock(blockId, fileContent, fileContent.length);
              
              console.log(`Uploaded block ${i + 1}/${result.chunks.length} (${chunk.size} bytes)`);
              break;
            } catch (error) {
              retryCount++;
              if (retryCount >= maxRetries) {
                throw new AppError(`Failed to upload block ${i + 1} after ${maxRetries} retries: ${error}`, 500, 'AZURE_UPLOAD_FAILED');
              }
              console.warn(`Retrying block ${i + 1} upload (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            }
          }
        }

        // Commit the block list with metadata and properties
        await blockBlobClient.commitBlockList(blockIds, {
          metadata,
          blobHTTPHeaders: blobHttpHeaders,
          tags,
          tier: cloudConfig.accessTier || 'Hot'
        });

        console.log(`Azure block upload completed: ${blockBlobClient.url}`);
      }

      return blockBlobClient.url;
    } catch (error) {
      console.error('Azure upload failed:', error);
      throw new AppError(`Azure upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500, 'AZURE_UPLOAD_ERROR');
    }
  }

  /**
   * Calculate checksum for exported files
   */
  private async calculateChecksum(result: ChunkedExportResult): Promise<string> {
    const hash = crypto.createHash('sha256');

    for (const chunk of result.chunks) {
      const fileContent = fs.readFileSync(chunk.path);
      hash.update(fileContent);
    }

    return hash.digest('hex');
  }

  /**
   * Get content type for file format
   */
  private getContentType(format: string): string {
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      parquet: 'application/octet-stream'
    };
    return contentTypes[format] || 'application/octet-stream';
  }

  /**
   * Calculate expiration date
   */
  private calculateExpiration(): Date {
    const expirationHours = parseInt(process.env.EXPORT_EXPIRATION_HOURS || '24');
    return new Date(Date.now() + expirationHours * 60 * 60 * 1000);
  }

  /**
   * Decrypt export files (utility method for downloading encrypted exports)
   */
  async decryptExportFile(
    encryptedFilePath: string,
    password: string,
    outputPath: string
  ): Promise<void> {
    if (!password) {
      throw new AppError('Decryption password not provided', 400, 'NO_DECRYPTION_KEY');
    }

    const encryptedContent = fs.readFileSync(encryptedFilePath);
    
    // Extract salt, IV, and encrypted data
    const salt = encryptedContent.subarray(0, 32);
    const iv = encryptedContent.subarray(32, 48);
    const authTag = encryptedContent.subarray(-16); // Last 16 bytes for GCM auth tag
    const encrypted = encryptedContent.subarray(48, -16);
    
    // Derive key from password and salt
    const key = crypto.scryptSync(password, salt, 32);
    
    // Create decipher with GCM mode
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const output = fs.createWriteStream(outputPath);
    
    await new Promise<void>((resolve, reject) => {
      const input = new Readable({
        read() {
          this.push(encrypted);
          this.push(null);
        }
      });
      
      input
        .pipe(decipher)
        .pipe(output)
        .on('finish', () => resolve())
        .on('error', reject);
    });
    
    console.log(`File decrypted successfully: ${outputPath}`);
  }

  /**
   * Send enhanced export notification webhook with retry logic
   */
  private async sendExportNotification(
    metadata: ExportMetadata,
    webhookUrl: string
  ): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;
    
    const payload = {
      event: 'export_completed',
      metadata: {
        ...metadata,
        // Don't include sensitive cloud URLs in webhook
        cloudUrl: metadata.cloudUrl ? '[REDACTED]' : undefined
      },
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DataCloak-Sentiment-Workbench/1.0',
            'X-DataCloak-Event': 'export_completed',
            'X-DataCloak-Signature': this.generateWebhookSignature(payload)
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (response.ok) {
          console.log(`Export notification sent successfully to ${webhookUrl}`);
          return;
        } else {
          throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(`Failed to send export notification after ${maxRetries} retries:`, error);
          return; // Don't throw error for webhook failures
        }
        console.warn(`Retrying webhook notification (attempt ${retryCount}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }
  }

  /**
   * Generate webhook signature for security verification
   */
  private generateWebhookSignature(payload: any): string {
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Resume an interrupted export
   */
  private async resumeExport(
    exportId: string,
    options: EnhancedExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportMetadata> {
    const state = this.resumableExports.get(exportId);
    if (!state) {
      throw new AppError('No resumable export found', 404, 'EXPORT_NOT_FOUND');
    }

    // Continue from last checkpoint
    const result = await this.exportLargeDataset(
      state.tableName,
      { ...options, ...state.lastCheckpoint },
      onProgress
    );

    // Continue with encryption, compression, and upload...
    return this.exportEnhanced(state.tableName, options, onProgress);
  }

  /**
   * Save resumable export state
   */
  private saveResumableState(
    exportId: string,
    tableName: string,
    options: EnhancedExportOptions
  ): void {
    this.resumableExports.set(exportId, {
      exportId,
      tableName,
      options,
      lastCheckpoint: {
        offset: 0, // Would be updated during export
        processedRows: 0
      },
      created: new Date()
    });
  }


  /**
   * Create a streaming export for very large datasets with enhanced features
   */
  createEnhancedExportStream(
    tableName: string,
    options: EnhancedExportOptions
  ): Readable {
    const chunkSize = options.chunkSize || 10000;
    let offset = 0;
    let isFirstChunk = true;
    let isDone = false;
    let chunkCount = 0;
    
    // Bind methods to avoid 'this' context issues
    const getDataChunk = super.getDataChunk.bind(this);
    const dataToEnhancedCSVString = this.dataToEnhancedCSVString.bind(this);
    const dataToParquetBuffer = this.dataToParquetBuffer.bind(this);
    const memoryMonitor = this.memoryMonitor;
    
    // Log initial memory state
    memoryMonitor.logMemoryStats(`Stream Export Start: ${tableName}`);
    
    return new Readable({
      objectMode: false,
      async read() {
        if (isDone) {
          memoryMonitor.logMemoryStats(`Stream Export Complete: ${tableName}`);
          this.push(null);
          return;
        }

        try {
          // Check memory before processing each chunk
          if (chunkCount % 10 === 0) { // Check every 10 chunks
            const memoryStatus = memoryMonitor.checkMemoryThresholds();
            if (memoryStatus === 'critical') {
              memoryMonitor.forceGarbageCollection();
              memoryMonitor.logMemoryStats(`Stream GC Triggered: chunk ${chunkCount}`);
            } else if (memoryStatus === 'warning') {
              memoryMonitor.logMemoryStats(`Stream Memory Warning: chunk ${chunkCount}`);
            }
          }

          const data = await getDataChunk(tableName, options as ExportOptions, offset, chunkSize);
          
          if (data.length === 0) {
            isDone = true;
            this.push(null);
            return;
          }

          let chunk: string | Buffer;
          
          switch (options.format) {
            case 'csv':
              chunk = dataToEnhancedCSVString(data, isFirstChunk && options.includeHeaders !== false);
              break;
            case 'json':
              if (isFirstChunk) {
                chunk = '[\n' + data.map(row => JSON.stringify(row)).join(',\n');
              } else {
                chunk = ',\n' + data.map(row => JSON.stringify(row)).join(',\n');
              }
              if (data.length < chunkSize) {
                chunk += '\n]';
              }
              break;
            case 'excel':
              // For streaming Excel, we'll use a simplified CSV-like format
              chunk = dataToEnhancedCSVString(data, isFirstChunk && options.includeHeaders !== false);
              break;
            case 'parquet':
              // For Parquet streaming, we'll need to buffer and write in larger chunks
              chunk = await dataToParquetBuffer(data, isFirstChunk);
              break;
            default:
              throw new Error(`Streaming not supported for ${options.format} format`);
          }

          this.push(chunk);
          offset += data.length;
          isFirstChunk = false;
          chunkCount++;
          
          if (data.length < chunkSize) {
            isDone = true;
          }
        } catch (error) {
          memoryMonitor.logMemoryStats(`Stream Export Error: ${tableName}`);
          this.destroy(error as Error);
        }
      }
    });
  }

  /**
   * Get memory statistics for monitoring
   */
  getMemoryStats(): MemoryStats {
    return this.memoryMonitor.getCurrentMemoryUsage();
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (this.memoryMonitor.shouldForceGC()) {
      this.memoryMonitor.forceGarbageCollection();
      return true;
    }
    return false;
  }

  /**
   * Get memory thresholds configuration
   */
  getMemoryThresholds(): MemoryThresholds {
    return this.memoryMonitor['thresholds'];
  }

  /**
   * Check if memory usage is within safe limits
   */
  isMemoryUsageSafe(): boolean {
    return this.memoryMonitor.checkMemoryThresholds() === 'normal';
  }

  /**
   * Create a transform stream for format conversion
   */
  createFormatTransformStream(
    fromFormat: string,
    toFormat: string
  ): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
          // Parse input format
          let data: any;
          if (fromFormat === 'csv') {
            // CSV parsing logic
            data = (this as any).parseCSVChunk(chunk);
          } else if (fromFormat === 'json') {
            data = JSON.parse(chunk);
          }

          // Convert to output format
          let output: any;
          if (toFormat === 'parquet') {
            // Parquet conversion would be handled differently
            output = data;
          } else if (toFormat === 'json' && fromFormat === 'csv') {
            output = JSON.stringify(data);
          } else if (toFormat === 'avro' && fromFormat === 'json') {
            // Avro conversion (simplified - would need proper Avro schema)
            output = JSON.stringify(data);
          }

          callback(null, output);
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  /**
   * Convert data to Parquet buffer format (simplified implementation)
   */
  private async dataToParquetBuffer(data: any[], isFirstChunk: boolean): Promise<Buffer> {
    // This is a simplified implementation. In production, use a proper Parquet library
    const jsonString = JSON.stringify(data);
    return Buffer.from(jsonString, 'utf-8');
  }

  /**
   * Create data to CSV string for streaming
   */
  private dataToEnhancedCSVString(data: any[], includeHeaders: boolean): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows: string[] = [];
    
    if (includeHeaders) {
      rows.push(headers.map(h => `"${h}"`).join(','));
    }
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value.toString();
      });
      rows.push(values.join(','));
    }
    
    return rows.join('\n') + '\n';
  }

  /**
   * Parse CSV chunk
   */
  private parseCSVChunk(chunk: any): any[] {
    // Simple CSV parsing - in production use a proper CSV parser
    const lines = chunk.toString().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  }
}

interface ResumableExportState {
  exportId: string;
  tableName: string;
  options: EnhancedExportOptions;
  lastCheckpoint: any;
  created: Date;
}