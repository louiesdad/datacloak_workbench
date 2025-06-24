/**
 * Job Factory
 * 
 * Generates test job queue data for testing background processing,
 * job scheduling, and queue management scenarios.
 */

import { AbstractFactory, testRandom } from './base.factory';

export interface TestJob {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retry';
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  result?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  progress: {
    current: number;
    total: number;
    percentage: number;
    message?: string;
  };
  timing: {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
  };
  attempts: {
    count: number;
    max: number;
    nextRetry?: Date;
  };
  metadata: {
    userId?: string;
    requestId?: string;
    source: string;
    tags: string[];
    timeout: number;
  };
}

export interface TestJobQueue {
  name: string;
  concurrency: number;
  status: 'running' | 'paused' | 'stopped';
  stats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  settings: {
    defaultTimeout: number;
    maxRetries: number;
    retryDelay: number;
    cleanupInterval: number;
  };
}

export interface TestJobEvent {
  id: string;
  jobId: string;
  type: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled' | 'retry';
  timestamp: Date;
  data?: any;
  metadata: {
    duration?: number;
    previousStatus?: string;
    newStatus?: string;
    error?: string;
  };
}

export class JobFactory extends AbstractFactory<TestJob> {
  build(overrides?: Partial<TestJob>): TestJob {
    const jobType = testRandom.choice([
      'sentiment-analysis',
      'data-export',
      'pii-masking',
      'batch-processing',
      'report-generation',
      'data-cleanup',
      'cache-warming',
      'system-maintenance'
    ]);

    const status = testRandom.choice(['pending', 'processing', 'completed', 'failed', 'cancelled', 'retry'] as const);
    const priority = testRandom.choice(['low', 'medium', 'high', 'critical'] as const);
    
    const createdAt = this.generateTimestamp(testRandom.integer(0, 30));
    const timing = this.generateTiming(status, createdAt);
    const progress = this.generateProgress(status);

    const base: TestJob = {
      id: this.generateUuid(),
      type: jobType,
      status,
      priority,
      payload: this.generatePayload(jobType),
      progress,
      timing,
      attempts: {
        count: status === 'retry' ? testRandom.integer(1, 3) : status === 'failed' ? testRandom.integer(1, 5) : 1,
        max: testRandom.integer(3, 5),
        nextRetry: status === 'retry' ? this.generateTimestamp(-testRandom.integer(1, 60)) : undefined
      },
      metadata: {
        userId: testRandom.boolean(0.7) ? `user_${testRandom.integer(1000, 9999)}` : undefined,
        requestId: this.generateUuid(),
        source: testRandom.choice(['api', 'web', 'cron', 'manual']),
        tags: this.generateTags(jobType),
        timeout: testRandom.integer(30000, 300000) // 30 seconds to 5 minutes
      }
    };

    // Add result for completed jobs
    if (status === 'completed') {
      base.result = this.generateResult(jobType);
    }

    // Add error for failed jobs
    if (status === 'failed') {
      base.error = this.generateError(jobType);
    }

    return this.merge(base, overrides);
  }

  /**
   * Generate timing information based on status
   */
  private generateTiming(status: string, createdAt: Date): TestJob['timing'] {
    const timing: TestJob['timing'] = { createdAt };

    if (status !== 'pending') {
      timing.startedAt = new Date(createdAt.getTime() + testRandom.integer(1000, 60000)); // Started 1s-1m later
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      timing.completedAt = new Date((timing.startedAt || createdAt).getTime() + testRandom.integer(1000, 300000)); // 1s-5m duration
      timing.duration = timing.completedAt.getTime() - (timing.startedAt || createdAt).getTime();
    }

    return timing;
  }

  /**
   * Generate progress information based on status
   */
  private generateProgress(status: string): TestJob['progress'] {
    let current: number, total: number, percentage: number, message: string | undefined;

    switch (status) {
      case 'pending':
        current = 0;
        total = testRandom.integer(100, 1000);
        percentage = 0;
        message = 'Waiting to start';
        break;
      case 'processing':
        total = testRandom.integer(100, 1000);
        current = testRandom.integer(1, total - 1);
        percentage = Math.round((current / total) * 100);
        message = `Processing item ${current} of ${total}`;
        break;
      case 'completed':
        total = testRandom.integer(100, 1000);
        current = total;
        percentage = 100;
        message = 'Completed successfully';
        break;
      case 'failed':
        total = testRandom.integer(100, 1000);
        current = testRandom.integer(1, total);
        percentage = Math.round((current / total) * 100);
        message = 'Failed during processing';
        break;
      case 'cancelled':
        total = testRandom.integer(100, 1000);
        current = testRandom.integer(0, total);
        percentage = Math.round((current / total) * 100);
        message = 'Cancelled by user';
        break;
      case 'retry':
        total = testRandom.integer(100, 1000);
        current = testRandom.integer(1, total);
        percentage = Math.round((current / total) * 100);
        message = 'Retrying after failure';
        break;
      default:
        current = 0;
        total = 100;
        percentage = 0;
    }

    return { current, total, percentage, message };
  }

  /**
   * Generate job payload based on type
   */
  private generatePayload(jobType: string): any {
    switch (jobType) {
      case 'sentiment-analysis':
        return {
          texts: Array.from({ length: testRandom.integer(10, 100) }, () => 
            `Sample text for sentiment analysis ${testRandom.string(20)}`
          ),
          options: {
            language: 'en',
            confidence: 0.8,
            includeEntities: testRandom.boolean()
          }
        };

      case 'data-export':
        return {
          format: testRandom.choice(['csv', 'json', 'xlsx']),
          filters: {
            dateRange: {
              start: this.generateTimestamp(30).toISOString(),
              end: new Date().toISOString()
            },
            categories: testRandom.choice([['positive'], ['negative'], ['positive', 'negative'], null])
          },
          options: {
            includePII: false,
            compressed: testRandom.boolean()
          }
        };

      case 'pii-masking':
        return {
          datasetId: this.generateUuid(),
          fields: ['email', 'phone', 'name', 'address'],
          maskingStrategy: testRandom.choice(['redact', 'replace', 'encrypt']),
          confidence: 0.8
        };

      case 'batch-processing':
        return {
          batchId: this.generateUuid(),
          itemCount: testRandom.integer(100, 10000),
          chunkSize: testRandom.integer(10, 100),
          parallel: testRandom.boolean()
        };

      case 'report-generation':
        return {
          reportType: testRandom.choice(['daily', 'weekly', 'monthly', 'custom']),
          dateRange: {
            start: this.generateTimestamp(7).toISOString(),
            end: new Date().toISOString()
          },
          format: testRandom.choice(['pdf', 'html', 'json']),
          sections: ['summary', 'analytics', 'trends']
        };

      default:
        return {
          operation: jobType,
          parameters: {
            id: this.generateUuid(),
            options: {
              verbose: testRandom.boolean(),
              dryRun: testRandom.boolean()
            }
          }
        };
    }
  }

  /**
   * Generate job result based on type
   */
  private generateResult(jobType: string): any {
    switch (jobType) {
      case 'sentiment-analysis':
        return {
          totalProcessed: testRandom.integer(10, 100),
          sentimentCounts: {
            positive: testRandom.integer(5, 40),
            negative: testRandom.integer(5, 30),
            neutral: testRandom.integer(5, 25),
            mixed: testRandom.integer(0, 10)
          },
          averageConfidence: testRandom.float(0.7, 0.95)
        };

      case 'data-export':
        return {
          fileUrl: `https://exports.example.com/file_${this.generateUuid()}.csv`,
          recordCount: testRandom.integer(100, 10000),
          fileSize: testRandom.integer(1024, 1024 * 1024 * 10), // 1KB to 10MB
          checksum: testRandom.string(32)
        };

      case 'pii-masking':
        return {
          processedRecords: testRandom.integer(100, 1000),
          maskedFields: testRandom.integer(50, 500),
          confidence: {
            high: testRandom.integer(40, 80),
            medium: testRandom.integer(10, 30),
            low: testRandom.integer(0, 20)
          }
        };

      default:
        return {
          success: true,
          processedItems: testRandom.integer(1, 1000),
          duration: testRandom.integer(1000, 300000),
          summary: `${jobType} completed successfully`
        };
    }
  }

  /**
   * Generate job error
   */
  private generateError(jobType: string): TestJob['error'] {
    const errors = [
      { message: 'Connection timeout', code: 'TIMEOUT' },
      { message: 'Insufficient memory', code: 'OUT_OF_MEMORY' },
      { message: 'Invalid input data', code: 'INVALID_DATA' },
      { message: 'External service unavailable', code: 'SERVICE_UNAVAILABLE' },
      { message: 'Processing limit exceeded', code: 'LIMIT_EXCEEDED' },
      { message: 'Unexpected error occurred', code: 'INTERNAL_ERROR' }
    ];

    const error = testRandom.choice(errors);
    return {
      message: `${jobType}: ${error.message}`,
      code: error.code,
      stack: testRandom.boolean(0.3) ? `Error: ${error.message}\n    at process (job.js:123:45)` : undefined
    };
  }

  /**
   * Generate tags based on job type
   */
  private generateTags(jobType: string): string[] {
    const baseTags = [jobType.split('-')[0]];
    
    const additionalTags = ['batch', 'automated', 'user-requested', 'scheduled', 'high-priority', 'background'];
    const tagCount = testRandom.integer(1, 3);
    
    for (let i = 0; i < tagCount; i++) {
      const tag = testRandom.choice(additionalTags);
      if (!baseTags.includes(tag)) {
        baseTags.push(tag);
      }
    }
    
    return baseTags;
  }

  /**
   * Create pending job
   */
  createPending(overrides?: Partial<TestJob>): TestJob {
    return this.create({
      status: 'pending',
      progress: {
        current: 0,
        total: testRandom.integer(100, 1000),
        percentage: 0,
        message: 'Waiting to start'
      },
      timing: {
        createdAt: this.generateTimestamp()
      },
      ...overrides
    });
  }

  /**
   * Create processing job
   */
  createProcessing(overrides?: Partial<TestJob>): TestJob {
    const total = testRandom.integer(100, 1000);
    const current = testRandom.integer(1, total - 1);
    
    return this.create({
      status: 'processing',
      progress: {
        current,
        total,
        percentage: Math.round((current / total) * 100),
        message: `Processing item ${current} of ${total}`
      },
      ...overrides
    });
  }

  /**
   * Create completed job
   */
  createCompleted(overrides?: Partial<TestJob>): TestJob {
    const total = testRandom.integer(100, 1000);
    
    return this.create({
      status: 'completed',
      progress: {
        current: total,
        total,
        percentage: 100,
        message: 'Completed successfully'
      },
      ...overrides
    });
  }

  /**
   * Create failed job
   */
  createFailed(overrides?: Partial<TestJob>): TestJob {
    return this.create({
      status: 'failed',
      attempts: {
        count: testRandom.integer(1, 5),
        max: 5,
        nextRetry: undefined
      },
      ...overrides
    });
  }

  /**
   * Create job queue
   */
  createQueue(overrides?: Partial<TestJobQueue>): TestJobQueue {
    const pending = testRandom.integer(0, 100);
    const processing = testRandom.integer(0, 20);
    const completed = testRandom.integer(100, 1000);
    const failed = testRandom.integer(0, 50);

    const base: TestJobQueue = {
      name: testRandom.choice(['default', 'high-priority', 'batch', 'export', 'analytics']),
      concurrency: testRandom.integer(1, 10),
      status: testRandom.choice(['running', 'paused', 'stopped']),
      stats: {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed
      },
      settings: {
        defaultTimeout: testRandom.integer(30000, 300000),
        maxRetries: testRandom.integer(3, 5),
        retryDelay: testRandom.integer(1000, 60000),
        cleanupInterval: testRandom.integer(3600000, 86400000) // 1-24 hours
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Create job event
   */
  createEvent(jobId?: string, overrides?: Partial<TestJobEvent>): TestJobEvent {
    const type = testRandom.choice(['created', 'started', 'progress', 'completed', 'failed', 'cancelled', 'retry'] as const);
    
    const base: TestJobEvent = {
      id: this.generateUuid(),
      jobId: jobId || this.generateUuid(),
      type,
      timestamp: this.generateTimestamp(),
      metadata: {}
    };

    if (type === 'progress') {
      base.data = {
        current: testRandom.integer(1, 100),
        total: 100,
        message: 'Processing...'
      };
    }

    if (type === 'completed') {
      base.metadata.duration = testRandom.integer(1000, 300000);
    }

    if (type === 'failed') {
      base.metadata.error = 'Processing failed';
    }

    return this.merge(base, overrides);
  }

  /**
   * Create job workflow (multiple related jobs)
   */
  createWorkflow(jobCount: number = 3): TestJob[] {
    const workflowId = this.generateUuid();
    const jobs: TestJob[] = [];

    for (let i = 0; i < jobCount; i++) {
      const job = this.create({
        metadata: {
          ...this.create().metadata,
          tags: ['workflow', workflowId, `step-${i + 1}`]
        }
      });
      jobs.push(job);
    }

    return jobs;
  }
}

// Export factory instance
export const jobFactory = new JobFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('job', jobFactory);