import { Request, Response } from 'express';
import { SuccessResponse } from '../types';
import { DataCloakStreamService, DataCloakChunkResult } from '../services/datacloak-stream.service';
import { FileStreamService } from '../services/file-stream.service';
import { AppError } from '../middleware/error.middleware';
import * as path from 'path';
import * as fs from 'fs';

export class StreamController {
  private dataCloakStreamService = new DataCloakStreamService();
  private fileStreamService = new FileStreamService();

  /**
   * Get streaming configuration for a file
   */
  async getStreamConfig(req: Request, res: Response): Promise<void> {
    const { filename } = req.params;
    
    if (!filename) {
      throw new AppError('Filename is required', 400, 'MISSING_FILENAME');
    }

    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    const stats = fs.statSync(filePath);
    const optimalChunkSize = await this.dataCloakStreamService.getOptimalChunkSize(filePath);
    const memoryEstimate = await this.fileStreamService.estimateMemoryUsage(filePath);

    const result: SuccessResponse = {
      data: {
        filename,
        fileSize: stats.size,
        optimalChunkSize,
        recommendedChunkSizeMB: Math.round(optimalChunkSize / 1024 / 1024),
        estimatedMemoryUsageMB: Math.round(memoryEstimate.estimatedMemoryUsage / 1024 / 1024),
        estimatedProcessingTimeSeconds: Math.round(memoryEstimate.estimatedProcessingTime / 1000),
        maxChunkSizeMB: 4,
        minChunkSizeMB: 0.008,
        chunks: await this.fileStreamService.getFileChunks(filePath, optimalChunkSize)
      },
      message: 'Stream configuration retrieved successfully'
    };

    res.json(result);
  }

  /**
   * Stream process a file chunk by chunk with Server-Sent Events
   */
  async streamProcess(req: Request, res: Response): Promise<void> {
    const { filename } = req.params;
    const { chunkSize, preservePII, maskingOptions } = req.body;

    if (!filename) {
      throw new AppError('Filename is required', 400, 'MISSING_FILENAME');
    }

    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Stream processing started' })}\n\n`);

    let totalProcessed = 0;
    let totalPIIDetected = 0;
    const startTime = Date.now();

    try {
      const result = await this.dataCloakStreamService.streamProcessWithDataCloak(filePath, {
        chunkSize: chunkSize || undefined,
        preservePII: preservePII || false,
        maskingOptions: maskingOptions || {
          email: true,
          phone: true,
          ssn: true,
          creditCard: true,
          address: true,
          name: true
        },
        onProgress: (progress) => {
          // Send progress update
          res.write(`event: progress\ndata: ${JSON.stringify({
            bytesProcessed: progress.bytesProcessed,
            totalBytes: progress.totalBytes,
            rowsProcessed: progress.rowsProcessed,
            chunksProcessed: progress.chunksProcessed,
            totalChunks: progress.totalChunks,
            percentComplete: progress.percentComplete,
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
            averageRowsPerSecond: progress.averageRowsPerSecond
          })}\n\n`);
        },
        onChunk: async (chunk) => {
          totalProcessed += chunk.processedRows;
          
          const dataCloakChunk = chunk as DataCloakChunkResult;
          
          // Send chunk complete event with summary
          res.write(`event: chunk\ndata: ${JSON.stringify({
            chunkIndex: chunk.chunkInfo.chunkIndex,
            rowsInChunk: chunk.processedRows,
            totalRowsProcessed: totalProcessed,
            piiDetected: dataCloakChunk.piiDetectionResults?.length || 0,
            securityMetrics: dataCloakChunk.securityMetrics
          })}\n\n`);
        },
        onPIIDetected: (piiResults) => {
          totalPIIDetected += piiResults.length;
          
          // Send PII detection event
          res.write(`event: pii-detected\ndata: ${JSON.stringify({
            count: piiResults.length,
            totalPIIDetected,
            types: [...new Set(piiResults.map(r => r.piiType))]
          })}\n\n`);
        }
      });

      // Send completion event
      res.write(`event: complete\ndata: ${JSON.stringify({
        totalRows: result.totalRows,
        totalBytes: result.totalBytes,
        chunksProcessed: result.chunksProcessed,
        processingTime: result.processingTime,
        processingTimeSeconds: Math.round(result.processingTime / 1000),
        piiSummary: result.piiSummary,
        averageSpeed: Math.round(result.totalRows / (result.processingTime / 1000))
      })}\n\n`);

    } catch (error) {
      // Send error event
      res.write(`event: error\ndata: ${JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: error instanceof AppError ? error.code : 'STREAM_ERROR'
      })}\n\n`);
    } finally {
      // Close the connection
      res.end();
    }
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(req: Request, res: Response): Promise<void> {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();

    const result: SuccessResponse = {
      data: {
        process: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        system: {
          totalMemory: Math.round(totalMem / 1024 / 1024),
          freeMemory: Math.round(freeMem / 1024 / 1024),
          usedMemory: Math.round((totalMem - freeMem) / 1024 / 1024),
          percentUsed: Math.round(((totalMem - freeMem) / totalMem) * 100)
        },
        limits: {
          recommendedMaxUsage: 500, // MB
          warningThreshold: 400, // MB
          criticalThreshold: 450 // MB
        }
      },
      message: 'Memory statistics retrieved'
    };

    res.json(result);
  }

  /**
   * Process a specific chunk of a file
   */
  async processChunk(req: Request, res: Response): Promise<void> {
    const { filename } = req.params;
    const { chunkIndex, startByte, endByte } = req.body;

    if (!filename) {
      throw new AppError('Filename is required', 400, 'MISSING_FILENAME');
    }

    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }

    const chunkInfo = {
      chunkIndex: chunkIndex || 0,
      startByte: startByte || 0,
      endByte: endByte || 0,
      totalSize: fs.statSync(filePath).size,
      totalChunks: 1,
      isLastChunk: false
    };

    const chunkBuffer = await this.fileStreamService.readFileChunk(filePath, chunkInfo);

    const result: SuccessResponse = {
      data: {
        chunkIndex: chunkInfo.chunkIndex,
        size: chunkBuffer.length,
        startByte: chunkInfo.startByte,
        endByte: chunkInfo.endByte,
        data: chunkBuffer.toString('base64') // Send as base64 for binary safety
      },
      message: 'Chunk processed successfully'
    };

    res.json(result);
  }
}