import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JobQueueService } from './job-queue.service';
import { RedisJobQueueService } from './redis-queue.service';
import { getCacheService } from './cache.service';
import { AppError } from '../middleware/error.middleware';

export interface BatchOptions {
  chunkSize: number;
  parallel: boolean;
  maxConcurrency?: number;
  retryOnFailure?: boolean;
  progressCallback?: (progress: BatchProgress) => void;
  timeout?: number;
}

export interface BatchProgress {
  batchId: string;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
  errors: BatchError[];
}

export interface BatchError {
  itemIndex: number;
  itemId?: string;
  error: string;
  timestamp: Date;
}

export interface BatchResult<T> {
  batchId: string;
  success: boolean;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  results: T[];
  errors: BatchError[];
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface BatchProcessor<T, R> {
  (items: T[], chunkIndex: number): Promise<R[]>;
}

export class BatchProcessingService extends EventEmitter {
  private activeJobs: Map<string, BatchProgress> = new Map();
  private cache = getCacheService();
  
  constructor(
    private jobQueue: JobQueueService | RedisJobQueueService
  ) {
    super();
  }

  /**
   * Process items in batches
   */
  async processBatch<T, R>(
    items: T[],
    processor: BatchProcessor<T, R>,
    options: BatchOptions
  ): Promise<BatchResult<R>> {
    const batchId = uuidv4();
    const startTime = new Date();
    const chunkSize = options.chunkSize || 100;
    const chunks = this.createChunks(items, chunkSize);
    
    const progress: BatchProgress = {
      batchId,
      totalItems: items.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      currentChunk: 0,
      totalChunks: chunks.length,
      percentComplete: 0,
      startTime,
      errors: []
    };

    this.activeJobs.set(batchId, progress);
    this.emit('batch:started', { batchId, totalItems: items.length, chunks: chunks.length });

    const results: R[] = [];
    
    try {
      if (options.parallel) {
        await this.processParallel(chunks, processor, progress, results, options);
      } else {
        await this.processSequential(chunks, processor, progress, results, options);
      }

      const processingTime = Date.now() - startTime.getTime();
      
      const batchResult: BatchResult<R> = {
        batchId,
        success: progress.failedItems === 0,
        totalItems: items.length,
        successfulItems: progress.successfulItems,
        failedItems: progress.failedItems,
        results,
        errors: progress.errors,
        processingTime,
        metadata: {
          chunkSize,
          parallel: options.parallel,
          chunks: chunks.length
        }
      };

      this.emit('batch:completed', batchResult);
      
      // Cache result for retrieval
      await this.cache.set(`batch:result:${batchId}`, batchResult, { ttl: 3600 });
      
      return batchResult;
    } catch (error) {
      this.emit('batch:failed', { batchId, error });
      throw error;
    } finally {
      this.activeJobs.delete(batchId);
    }
  }

  /**
   * Create batch job that can be processed asynchronously
   */
  async createBatchJob<T>(
    items: T[],
    jobType: string,
    options: BatchOptions & { priority?: 'low' | 'medium' | 'high' | 'critical' }
  ): Promise<string> {
    const batchId = uuidv4();
    const chunks = this.createChunks(items, options.chunkSize);
    
    // Store batch metadata
    await this.cache.set(`batch:meta:${batchId}`, {
      batchId,
      totalItems: items.length,
      chunks: chunks.length,
      chunkSize: options.chunkSize,
      createdAt: new Date(),
      status: 'pending'
    }, { ttl: 86400 }); // 24 hours

    // Create job for each chunk
    const jobIds: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const jobId = await this.jobQueue.addJob(jobType as any, {
        batchId,
        chunkIndex: i,
        totalChunks: chunks.length,
        items: chunks[i],
        options
      }, {
        priority: options.priority
      });
      
      jobIds.push(jobId);
    }

    // Store job mapping
    await this.cache.set(`batch:jobs:${batchId}`, jobIds, { ttl: 86400 });
    
    this.emit('batch:job:created', { batchId, jobs: jobIds.length });
    
    return batchId;
  }

  /**
   * Monitor batch job progress
   */
  async getBatchStatus(batchId: string): Promise<BatchProgress | null> {
    // Check active jobs first
    if (this.activeJobs.has(batchId)) {
      return this.activeJobs.get(batchId)!;
    }

    // Check cached metadata
    const metadata = await this.cache.get<any>(`batch:meta:${batchId}`);
    if (!metadata) {
      return null;
    }

    // Get job IDs
    const jobIds = await this.cache.get<string[]>(`batch:jobs:${batchId}`);
    if (!jobIds) {
      return null;
    }

    // Calculate progress from job statuses
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;
    let completedChunks = 0;

    for (const jobId of jobIds) {
      const job = await this.jobQueue.getJob(jobId);
      if (job) {
        if (job.status === 'completed') {
          completedChunks++;
          const result = job.result;
          if (result) {
            processedItems += result.processed || 0;
            successfulItems += result.successful || 0;
            failedItems += result.failed || 0;
          }
        } else if (job.status === 'failed') {
          completedChunks++;
          failedItems += job.data.items?.length || 0;
        }
      }
    }

    const progress: BatchProgress = {
      batchId,
      totalItems: metadata.totalItems,
      processedItems,
      successfulItems,
      failedItems,
      currentChunk: completedChunks,
      totalChunks: metadata.chunks,
      percentComplete: (completedChunks / metadata.chunks) * 100,
      startTime: new Date(metadata.createdAt),
      errors: []
    };

    return progress;
  }

  /**
   * Cancel batch processing
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    const jobIds = await this.cache.get<string[]>(`batch:jobs:${batchId}`);
    if (!jobIds) {
      return false;
    }

    let cancelledCount = 0;
    for (const jobId of jobIds) {
      if (await this.jobQueue.cancelJob(jobId)) {
        cancelledCount++;
      }
    }

    this.emit('batch:cancelled', { batchId, cancelledJobs: cancelledCount });
    
    // Clean up cache
    await this.cache.del(`batch:meta:${batchId}`);
    await this.cache.del(`batch:jobs:${batchId}`);
    
    return cancelledCount > 0;
  }

  /**
   * Process chunks sequentially
   */
  private async processSequential<T, R>(
    chunks: T[][],
    processor: BatchProcessor<T, R>,
    progress: BatchProgress,
    results: R[],
    options: BatchOptions
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      progress.currentChunk = i + 1;
      
      try {
        const chunkResults = await this.processChunkWithTimeout(
          chunks[i],
          i,
          processor,
          options.timeout
        );
        
        if (Array.isArray(chunkResults)) {
          results.push(...chunkResults);
          progress.processedItems += chunks[i].length;
          progress.successfulItems += chunks[i].length;
        }
      } catch (error) {
        await this.handleChunkError(chunks[i], i, error, progress, options);
      }
      
      this.updateProgress(progress, options);
    }
  }

  /**
   * Process chunks in parallel
   */
  private async processParallel<T, R>(
    chunks: T[][],
    processor: BatchProcessor<T, R>,
    progress: BatchProgress,
    results: R[],
    options: BatchOptions
  ): Promise<void> {
    const maxConcurrency = options.maxConcurrency || 5;
    const chunkResults: (R[] | Error)[] = new Array(chunks.length);
    
    // Process in batches to respect concurrency limit
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const batch = chunks.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((chunk, index) => 
        this.processChunkWithTimeout(chunk, i + index, processor, options.timeout)
          .then(result => {
            chunkResults[i + index] = result;
            progress.processedItems += chunk.length;
            progress.successfulItems += chunk.length;
            progress.currentChunk++;
            this.updateProgress(progress, options);
            return result;
          })
          .catch(error => {
            chunkResults[i + index] = error;
            this.handleChunkError(chunk, i + index, error, progress, options);
            progress.currentChunk++;
            this.updateProgress(progress, options);
            throw error;
          })
      );

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect successful results
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          results.push(...result.value);
        }
      });
    }
  }

  /**
   * Process chunk with timeout
   */
  private async processChunkWithTimeout<T, R>(
    chunk: T[],
    chunkIndex: number,
    processor: BatchProcessor<T, R>,
    timeout?: number
  ): Promise<R[]> {
    if (!timeout) {
      return processor(chunk, chunkIndex);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Chunk processing timeout')), timeout);
    });

    return Promise.race([
      processor(chunk, chunkIndex),
      timeoutPromise
    ]);
  }

  /**
   * Handle chunk processing error
   */
  private async handleChunkError<T>(
    chunk: T[],
    chunkIndex: number,
    error: any,
    progress: BatchProgress,
    options: BatchOptions
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Record error for each item in chunk
    chunk.forEach((item, index) => {
      progress.errors.push({
        itemIndex: chunkIndex * options.chunkSize + index,
        error: errorMessage,
        timestamp: new Date()
      });
    });
    
    progress.failedItems += chunk.length;
    progress.processedItems += chunk.length;
    
    this.emit('batch:chunk:error', {
      batchId: progress.batchId,
      chunkIndex,
      error: errorMessage,
      itemCount: chunk.length
    });

    if (options.retryOnFailure) {
      // Could implement retry logic here
      this.emit('batch:chunk:retry', { batchId: progress.batchId, chunkIndex });
    }
  }

  /**
   * Update and emit progress
   */
  private updateProgress(progress: BatchProgress, options: BatchOptions): void {
    progress.percentComplete = (progress.processedItems / progress.totalItems) * 100;
    
    // Calculate estimated time remaining
    const elapsed = Date.now() - progress.startTime.getTime();
    const itemsPerMs = progress.processedItems / elapsed;
    const remainingItems = progress.totalItems - progress.processedItems;
    progress.estimatedTimeRemaining = remainingItems / itemsPerMs;
    
    if (options.progressCallback) {
      options.progressCallback(progress);
    }
    
    this.emit('batch:progress', progress);
  }

  /**
   * Create chunks from items array
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get active batch jobs
   */
  getActiveJobs(): BatchProgress[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Clean up old batch results
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const keys = await this.cache.keys('batch:*');
    let cleaned = 0;
    
    for (const key of keys) {
      try {
        const data = await this.cache.get<any>(key);
        if (data && data.createdAt) {
          const age = Date.now() - new Date(data.createdAt).getTime();
          if (age > olderThanMs) {
            await this.cache.del(key);
            cleaned++;
          }
        }
      } catch (error) {
        // Log error but continue cleaning other keys
        console.error(`Failed to clean up ${key}:`, error);
      }
    }
    
    return cleaned;
  }
}