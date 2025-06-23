import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JobQueueService, Job, JobType, JobStatus, JobPriority, JobOptions, JobHandler } from './job-queue.service';
import { getEnhancedDatabaseService } from './enhanced-database.service';
import { enhancedCacheService } from './enhanced-cache.service';
import { eventEmitter, EventTypes } from './event.service';

/**
 * Enhanced Job Queue Service
 * TASK-204: Job Queue Enhancement
 * 
 * Extends the base job queue with advanced features for large dataset risk assessments,
 * priority-based scheduling, progress tracking, and failure recovery mechanisms.
 */

export interface EnhancedJob extends Job {
  // Enhanced job properties
  batchSize?: number;
  totalBatches?: number;
  currentBatch?: number;
  retryInfo?: JobRetryInfo;
  dependencies?: string[]; // Job IDs this job depends on
  tags?: string[]; // For job categorization and filtering
  estimatedDuration?: number; // Expected duration in milliseconds
  actualDuration?: number; // Actual execution time
  resourceRequirements?: ResourceRequirements;
  parentJobId?: string; // For job hierarchies
  childJobIds?: string[]; // Child jobs spawned by this job
}

export interface JobRetryInfo {
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  lastRetryAt?: Date;
  retryReasons?: string[];
}

export interface ResourceRequirements {
  memoryMB: number;
  cpuCores: number;
  diskSpaceGB?: number;
  networkBandwidthMbps?: number;
}

export interface JobBatch {
  batchId: string;
  parentJobId: string;
  batchNumber: number;
  totalBatches: number;
  dataSlice: any; // Subset of data for this batch
  status: JobStatus;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export interface JobSchedulingPolicy {
  strategy: 'fifo' | 'priority' | 'resource_aware' | 'deadline_first';
  maxConcurrentJobs: number;
  resourceLimits: ResourceRequirements;
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    baseDelayMs: number;
  };
}

export interface JobProgressUpdate {
  jobId: string;
  progress: number;
  stage: string;
  message?: string;
  metadata?: any;
  timestamp: Date;
}

// Enhanced job types for risk assessment workflows
export type EnhancedJobType = 
  | JobType 
  | 'large_dataset_risk_assessment'
  | 'batch_pattern_validation' 
  | 'compliance_framework_analysis'
  | 'data_lineage_tracking'
  | 'performance_benchmarking'
  | 'cache_warming'
  | 'data_retention_cleanup';

export class EnhancedJobQueueService extends EventEmitter {
  private baseQueue: JobQueueService;
  private enhancedJobs: Map<string, EnhancedJob> = new Map();
  private jobBatches: Map<string, JobBatch[]> = new Map();
  private jobDependencies: Map<string, Set<string>> = new Map();
  private schedulingPolicy: JobSchedulingPolicy;
  private resourceUsage: ResourceRequirements = { memoryMB: 0, cpuCores: 0 };
  private jobProgressHistory: Map<string, JobProgressUpdate[]> = new Map();
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor(options?: {
    maxConcurrentJobs?: number;
    schedulingPolicy?: Partial<JobSchedulingPolicy>;
  }) {
    super();
    
    this.baseQueue = new JobQueueService({
      maxConcurrentJobs: options?.maxConcurrentJobs || 5
    });

    this.schedulingPolicy = {
      strategy: 'priority',
      maxConcurrentJobs: options?.maxConcurrentJobs || 5,
      resourceLimits: {
        memoryMB: 4096, // 4GB
        cpuCores: 4
      },
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000
      },
      ...options?.schedulingPolicy
    };

    this.setupBaseQueueListeners();
    this.registerEnhancedJobHandlers();
  }

  // ==============================================
  // ENHANCED JOB MANAGEMENT
  // ==============================================

  /**
   * Add an enhanced job with advanced features
   */
  addEnhancedJob(
    type: EnhancedJobType,
    data: any,
    options: JobOptions & {
      batchSize?: number;
      dependencies?: string[];
      tags?: string[];
      estimatedDuration?: number;
      resourceRequirements?: Partial<ResourceRequirements>;
      parentJobId?: string;
    } = {}
  ): string {
    const jobId = uuidv4();
    
    const enhancedJob: EnhancedJob = {
      id: jobId,
      type: type as JobType,
      status: 'pending',
      priority: options.priority || 'medium',
      data,
      progress: 0,
      createdAt: new Date(),
      batchSize: options.batchSize,
      dependencies: options.dependencies || [],
      tags: options.tags || [],
      estimatedDuration: options.estimatedDuration,
      resourceRequirements: {
        memoryMB: 512,
        cpuCores: 1,
        ...options.resourceRequirements
      },
      parentJobId: options.parentJobId,
      childJobIds: [],
      retryInfo: {
        attempts: 0,
        maxAttempts: this.schedulingPolicy.retryPolicy.maxAttempts,
        backoffMs: this.schedulingPolicy.retryPolicy.baseDelayMs,
        retryReasons: []
      }
    };

    this.enhancedJobs.set(jobId, enhancedJob);

    // Handle dependencies
    if (enhancedJob.dependencies && enhancedJob.dependencies.length > 0) {
      for (const depId of enhancedJob.dependencies) {
        if (!this.jobDependencies.has(depId)) {
          this.jobDependencies.set(depId, new Set());
        }
        this.jobDependencies.get(depId)!.add(jobId);
      }
    }

    // Handle parent-child relationships
    if (options.parentJobId) {
      const parentJob = this.enhancedJobs.get(options.parentJobId);
      if (parentJob) {
        parentJob.childJobIds = parentJob.childJobIds || [];
        parentJob.childJobIds.push(jobId);
      }
    }

    // Determine if this should be batched
    if (this.shouldBatchJob(enhancedJob)) {
      this.createJobBatches(enhancedJob);
    } else {
      // Add to base queue for immediate processing
      this.addToBaseQueue(enhancedJob);
    }

    this.emit('enhanced_job:added', enhancedJob);
    
    // Log job creation for audit purposes
    this.logJobEvent(jobId, 'job_created', {
      type,
      priority: enhancedJob.priority,
      resourceRequirements: enhancedJob.resourceRequirements
    });

    return jobId;
  }

  /**
   * Create batches for large dataset processing
   */
  private createJobBatches(job: EnhancedJob): void {
    if (!job.batchSize || !job.data.dataset) return;

    const dataset = job.data.dataset;
    const batchSize = job.batchSize;
    const totalBatches = Math.ceil(dataset.length / batchSize);
    
    job.totalBatches = totalBatches;
    job.currentBatch = 0;

    const batches: JobBatch[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const startIndex = i * batchSize;
      const endIndex = Math.min(startIndex + batchSize, dataset.length);
      const dataSlice = dataset.slice(startIndex, endIndex);

      const batch: JobBatch = {
        batchId: uuidv4(),
        parentJobId: job.id,
        batchNumber: i + 1,
        totalBatches,
        dataSlice,
        status: 'pending'
      };

      batches.push(batch);
    }

    this.jobBatches.set(job.id, batches);
    this.emit('job:batched', {
      jobId: job.id,
      totalBatches,
      batchSize
    });

    // Start processing batches
    this.processBatchedJob(job);
  }

  /**
   * Process a batched job
   */
  private async processBatchedJob(job: EnhancedJob): Promise<void> {
    const batches = this.jobBatches.get(job.id);
    if (!batches) return;

    job.status = 'running';
    job.startedAt = new Date();
    this.updateJobProgress(job.id, 0, 'Starting batch processing');

    try {
      const results: any[] = [];
      let completedBatches = 0;

      // Process batches sequentially or in parallel based on resource availability
      const concurrentBatches = Math.min(3, batches.length); // Process up to 3 batches concurrently
      
      for (let i = 0; i < batches.length; i += concurrentBatches) {
        const batchGroup = batches.slice(i, i + concurrentBatches);
        
        const batchPromises = batchGroup.map(async (batch) => {
          try {
            batch.status = 'running';
            batch.startTime = new Date();
            
            const batchResult = await this.processBatch(job, batch);
            
            batch.status = 'completed';
            batch.endTime = new Date();
            batch.result = batchResult;
            
            return batchResult;
          } catch (error) {
            batch.status = 'failed';
            batch.endTime = new Date();
            batch.error = error instanceof Error ? error.message : String(error);
            throw error;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          completedBatches++;
          const progress = (completedBatches / batches.length) * 100;
          
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch ${i + index + 1} failed:`, result.reason);
          }
          
          this.updateJobProgress(
            job.id, 
            progress, 
            `Completed batch ${completedBatches}/${batches.length}`
          );
        });
      }

      // Aggregate results
      const aggregatedResult = this.aggregateBatchResults(job, results);
      
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.result = aggregatedResult;
      job.actualDuration = job.completedAt.getTime() - job.startedAt!.getTime();

      this.emit('enhanced_job:completed', job);
      this.logJobEvent(job.id, 'job_completed', {
        duration: job.actualDuration,
        batchesProcessed: batches.length
      });

      // Process dependent jobs
      this.processDependentJobs(job.id);

    } catch (error) {
      await this.handleJobFailure(job, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Process a single batch
   */
  private async processBatch(job: EnhancedJob, batch: JobBatch): Promise<any> {
    switch (job.type) {
      case 'large_dataset_risk_assessment':
        return this.processRiskAssessmentBatch(job, batch);
      case 'batch_pattern_validation':
        return this.processPatternValidationBatch(job, batch);
      case 'compliance_framework_analysis':
        return this.processComplianceAnalysisBatch(job, batch);
      default:
        throw new Error(`Unknown batch job type: ${job.type}`);
    }
  }

  /**
   * Process risk assessment batch
   */
  private async processRiskAssessmentBatch(job: EnhancedJob, batch: JobBatch): Promise<any> {
    const { frameworkId, analysisOptions } = job.data;
    const records = batch.dataSlice;

    const batchResults = {
      batchId: batch.batchId,
      recordsProcessed: records.length,
      riskScores: [] as number[],
      violations: [] as any[],
      recommendations: [] as string[],
      processingTime: 0
    };

    const startTime = Date.now();

    for (const record of records) {
      // Simulate risk assessment processing
      const riskScore = Math.floor(Math.random() * 100);
      batchResults.riskScores.push(riskScore);

      if (riskScore > 75) {
        batchResults.violations.push({
          recordId: record.id,
          riskScore,
          violationType: 'high_risk_detected',
          details: 'Record contains high-risk data patterns'
        });
      }

      if (riskScore > 85) {
        batchResults.recommendations.push(`Immediate review required for record ${record.id}`);
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    batchResults.processingTime = Date.now() - startTime;

    // Cache batch results for potential reuse
    await enhancedCacheService.cacheRiskAssessment(
      `${job.id}-batch-${batch.batchId}`,
      batch.dataSlice,
      frameworkId,
      batchResults
    );

    return batchResults;
  }

  /**
   * Process pattern validation batch
   */
  private async processPatternValidationBatch(job: EnhancedJob, batch: JobBatch): Promise<any> {
    const { patterns, validationOptions } = job.data;
    const testData = batch.dataSlice;

    const batchResults = {
      batchId: batch.batchId,
      patternsValidated: patterns.length,
      testDataCount: testData.length,
      validationResults: [] as any[],
      performanceMetrics: {
        avgProcessingTime: 0,
        totalExecutions: 0,
        successRate: 0
      }
    };

    for (const pattern of patterns) {
      const validationResult = await enhancedCacheService.testPatternWithCache(
        pattern.id,
        testData
      );


      // Handle case where validationResult might be undefined or null - be more lenient
      let processedResult = validationResult;
      if (processedResult === null || processedResult === undefined) {
        console.warn(`Pattern validation returned null/undefined for pattern ${pattern.id}`);
        // Create empty result rather than skipping entirely
        processedResult = [];
      }
      
      // Ensure it's an array (convert single results to array)
      if (!Array.isArray(processedResult)) {
        processedResult = [processedResult];
      }

      const accuracy = processedResult.length > 0 ? 
        processedResult.filter(r => r?.matches).length / processedResult.length : 0;
      const avgProcessingTime = processedResult.length > 0 ? 
        processedResult.reduce((sum, r) => sum + (r?.processingTime || 0), 0) / processedResult.length : 0;

      batchResults.validationResults.push({
        patternId: pattern.id,
        results: processedResult,
        accuracy,
        avgProcessingTime
      });

      batchResults.performanceMetrics.totalExecutions += processedResult.length;
    }

    // Safe division operations to prevent NaN
    batchResults.performanceMetrics.avgProcessingTime = 
      batchResults.validationResults.length > 0 ? 
      batchResults.validationResults.reduce((sum, r) => sum + r.avgProcessingTime, 0) / 
      batchResults.validationResults.length : 0;

    batchResults.performanceMetrics.successRate = 
      batchResults.validationResults.length > 0 ? 
      batchResults.validationResults.reduce((sum, r) => sum + r.accuracy, 0) / 
      batchResults.validationResults.length : 0;

    return batchResults;
  }

  /**
   * Process compliance analysis batch
   */
  private async processComplianceAnalysisBatch(job: EnhancedJob, batch: JobBatch): Promise<any> {
    const { frameworks, complianceRules } = job.data;
    const records = batch.dataSlice;

    const batchResults = {
      batchId: batch.batchId,
      recordsAnalyzed: records.length,
      complianceResults: [] as any[],
      overallComplianceScore: 0,
      violations: [] as any[]
    };

    for (const record of records) {
      const recordCompliance = {
        recordId: record.id,
        frameworkResults: {} as any,
        overallScore: 0,
        violations: [] as any[]
      };

      let totalScore = 0;
      let frameworkCount = 0;

      for (const framework of frameworks) {
        const frameworkScore = Math.floor(Math.random() * 100);
        recordCompliance.frameworkResults[framework.id] = {
          score: frameworkScore,
          status: frameworkScore >= 70 ? 'compliant' : 'non_compliant',
          checkedRules: complianceRules.length,
          passedRules: Math.floor((frameworkScore / 100) * complianceRules.length)
        };

        totalScore += frameworkScore;
        frameworkCount++;

        if (frameworkScore < 70) {
          recordCompliance.violations.push({
            framework: framework.id,
            severity: frameworkScore < 50 ? 'critical' : 'warning',
            message: `Compliance score below threshold: ${frameworkScore}%`
          });
        }
      }

      recordCompliance.overallScore = frameworkCount > 0 ? totalScore / frameworkCount : 0;
      batchResults.complianceResults.push(recordCompliance);
      batchResults.violations.push(...recordCompliance.violations);
    }

    batchResults.overallComplianceScore = 
      batchResults.complianceResults.reduce((sum, r) => sum + r.overallScore, 0) / 
      batchResults.complianceResults.length;

    return batchResults;
  }

  /**
   * Aggregate results from all batches
   */
  private aggregateBatchResults(job: EnhancedJob, batchResults: any[]): any {
    switch (job.type) {
      case 'large_dataset_risk_assessment':
        return this.aggregateRiskAssessmentResults(batchResults);
      case 'batch_pattern_validation':
        return this.aggregatePatternValidationResults(batchResults);
      case 'compliance_framework_analysis':
        return this.aggregateComplianceResults(batchResults);
      default:
        return { batchResults, totalBatches: batchResults.length };
    }
  }

  /**
   * Aggregate risk assessment results
   */
  private aggregateRiskAssessmentResults(batchResults: any[]): any {
    const aggregated = {
      totalRecordsProcessed: 0,
      overallRiskScore: 0,
      riskDistribution: {
        low: 0,    // 0-25
        medium: 0, // 26-50
        high: 0,   // 51-75
        critical: 0 // 76-100
      },
      totalViolations: 0,
      recommendations: [] as string[],
      batchSummary: batchResults.map(batch => ({
        batchId: batch.batchId,
        recordsProcessed: batch.recordsProcessed,
        avgRiskScore: batch.riskScores.reduce((sum: number, score: number) => sum + score, 0) / batch.riskScores.length,
        violationsCount: batch.violations.length,
        processingTime: batch.processingTime
      }))
    };

    for (const batch of batchResults) {
      aggregated.totalRecordsProcessed += batch.recordsProcessed;
      aggregated.totalViolations += batch.violations.length;
      aggregated.recommendations.push(...batch.recommendations);

      // Calculate risk distribution
      for (const score of batch.riskScores) {
        if (score <= 25) aggregated.riskDistribution.low++;
        else if (score <= 50) aggregated.riskDistribution.medium++;
        else if (score <= 75) aggregated.riskDistribution.high++;
        else aggregated.riskDistribution.critical++;
      }
    }

    // Calculate overall risk score
    const allScores = batchResults.flatMap(batch => batch.riskScores);
    aggregated.overallRiskScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

    return aggregated;
  }

  /**
   * Aggregate pattern validation results
   */
  private aggregatePatternValidationResults(batchResults: any[]): any {
    const aggregated = {
      totalPatternsValidated: batchResults.reduce((sum, batch) => sum + batch.patternsValidated, 0),
      totalTestDataProcessed: batchResults.reduce((sum, batch) => sum + batch.testDataCount, 0),
      overallAccuracy: 0,
      avgProcessingTime: 0,
      patternPerformance: {} as any,
      batchSummary: batchResults.map(batch => ({
        batchId: batch.batchId,
        accuracy: batch.performanceMetrics.successRate,
        processingTime: batch.performanceMetrics.avgProcessingTime
      }))
    };

    const allValidationResults = batchResults.flatMap(batch => batch.validationResults);
    
    aggregated.overallAccuracy = 
      allValidationResults.reduce((sum, result) => sum + result.accuracy, 0) / allValidationResults.length;
    
    aggregated.avgProcessingTime = 
      allValidationResults.reduce((sum, result) => sum + result.avgProcessingTime, 0) / allValidationResults.length;

    // Group by pattern ID for performance analysis
    for (const result of allValidationResults) {
      if (!aggregated.patternPerformance[result.patternId]) {
        aggregated.patternPerformance[result.patternId] = {
          executions: 0,
          totalAccuracy: 0,
          totalProcessingTime: 0
        };
      }
      
      const perf = aggregated.patternPerformance[result.patternId];
      perf.executions++;
      perf.totalAccuracy += result.accuracy;
      perf.totalProcessingTime += result.avgProcessingTime;
    }

    // Calculate averages for each pattern
    for (const patternId in aggregated.patternPerformance) {
      const perf = aggregated.patternPerformance[patternId];
      perf.avgAccuracy = perf.totalAccuracy / perf.executions;
      perf.avgProcessingTime = perf.totalProcessingTime / perf.executions;
    }

    return aggregated;
  }

  /**
   * Aggregate compliance analysis results
   */
  private aggregateComplianceResults(batchResults: any[]): any {
    const aggregated = {
      totalRecordsAnalyzed: batchResults.reduce((sum, batch) => sum + batch.recordsAnalyzed, 0),
      overallComplianceScore: 0,
      frameworkScores: {} as any,
      totalViolations: batchResults.reduce((sum, batch) => sum + batch.violations.length, 0),
      violationsByFramework: {} as any,
      batchSummary: batchResults.map(batch => ({
        batchId: batch.batchId,
        recordsAnalyzed: batch.recordsAnalyzed,
        complianceScore: batch.overallComplianceScore,
        violationsCount: batch.violations.length
      }))
    };

    const allComplianceResults = batchResults.flatMap(batch => batch.complianceResults);
    
    aggregated.overallComplianceScore = 
      allComplianceResults.reduce((sum, result) => sum + result.overallScore, 0) / allComplianceResults.length;

    // Aggregate framework-specific scores
    for (const result of allComplianceResults) {
      for (const frameworkId in result.frameworkResults) {
        if (!aggregated.frameworkScores[frameworkId]) {
          aggregated.frameworkScores[frameworkId] = {
            totalScore: 0,
            recordCount: 0,
            avgScore: 0
          };
        }
        
        const fwScore = aggregated.frameworkScores[frameworkId];
        fwScore.totalScore += result.frameworkResults[frameworkId].score;
        fwScore.recordCount++;
      }
    }

    // Calculate average scores
    for (const frameworkId in aggregated.frameworkScores) {
      const fwScore = aggregated.frameworkScores[frameworkId];
      fwScore.avgScore = fwScore.totalScore / fwScore.recordCount;
    }

    // Count violations by framework
    const allViolations = batchResults.flatMap(batch => batch.violations);
    for (const violation of allViolations) {
      if (!aggregated.violationsByFramework[violation.framework]) {
        aggregated.violationsByFramework[violation.framework] = 0;
      }
      aggregated.violationsByFramework[violation.framework]++;
    }

    return aggregated;
  }

  // ==============================================
  // JOB RETRY AND FAILURE HANDLING
  // ==============================================

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: EnhancedJob, error: string): Promise<void> {
    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();

    if (job.retryInfo) {
      job.retryInfo.attempts++;
      job.retryInfo.retryReasons!.push(error);
      job.retryInfo.lastRetryAt = new Date();
    }

    this.logJobEvent(job.id, 'job_failed', {
      error,
      attempt: job.retryInfo?.attempts || 0,
      maxAttempts: job.retryInfo?.maxAttempts || 0
    });

    // Check if job should be retried
    if (this.shouldRetryJob(job)) {
      await this.scheduleJobRetry(job);
    } else {
      this.emit('enhanced_job:failed_permanently', job);
      
      // Handle dependent jobs - mark them as failed too
      const dependents = this.jobDependencies.get(job.id);
      if (dependents) {
        for (const dependentId of dependents) {
          const dependentJob = this.enhancedJobs.get(dependentId);
          if (dependentJob && dependentJob.status === 'pending') {
            await this.handleJobFailure(dependentJob, `Dependency failed: ${job.id}`);
          }
        }
      }
    }
  }

  /**
   * Check if job should be retried
   */
  private shouldRetryJob(job: EnhancedJob): boolean {
    if (!job.retryInfo) return false;
    return job.retryInfo.attempts < job.retryInfo.maxAttempts;
  }

  /**
   * Schedule job retry with backoff
   */
  private async scheduleJobRetry(job: EnhancedJob): Promise<void> {
    if (!job.retryInfo) return;

    let delay = job.retryInfo.backoffMs;
    
    switch (this.schedulingPolicy.retryPolicy.backoffStrategy) {
      case 'exponential':
        delay = job.retryInfo.backoffMs * Math.pow(2, job.retryInfo.attempts - 1);
        break;
      case 'linear':
        delay = job.retryInfo.backoffMs * job.retryInfo.attempts;
        break;
      case 'fixed':
      default:
        // Keep original delay
        break;
    }

    const timeout = setTimeout(() => {
      job.status = 'pending';
      job.error = undefined;
      job.progress = 0;
      
      this.emit('enhanced_job:retrying', job);
      this.logJobEvent(job.id, 'job_retry_scheduled', {
        attempt: job.retryInfo!.attempts,
        delay
      });

      // Re-add to processing queue
      this.addToBaseQueue(job);
      
      // Remove from timeout tracking
      this.retryTimeouts.delete(timeout);
    }, delay);
    
    // Track timeout for cleanup
    this.retryTimeouts.add(timeout);
  }

  // ==============================================
  // DEPENDENCY AND SCHEDULING MANAGEMENT
  // ==============================================

  /**
   * Process jobs that were waiting for dependencies
   */
  private processDependentJobs(completedJobId: string): void {
    const dependents = this.jobDependencies.get(completedJobId);
    if (!dependents) return;

    for (const dependentId of dependents) {
      const dependentJob = this.enhancedJobs.get(dependentId);
      if (!dependentJob || dependentJob.status !== 'pending') continue;

      // Check if all dependencies are satisfied
      const allDependenciesMet = dependentJob.dependencies!.every(depId => {
        const depJob = this.enhancedJobs.get(depId);
        return depJob && depJob.status === 'completed';
      });

      if (allDependenciesMet) {
        this.addToBaseQueue(dependentJob);
        this.emit('enhanced_job:dependencies_satisfied', dependentJob);
      }
    }

    // Clean up dependency tracking
    this.jobDependencies.delete(completedJobId);
  }

  // ==============================================
  // PROGRESS TRACKING AND MONITORING
  // ==============================================

  /**
   * Update job progress with detailed tracking
   */
  private updateJobProgress(jobId: string, progress: number, stage: string, metadata?: any): void {
    const job = this.enhancedJobs.get(jobId);
    if (!job) return;

    job.progress = Math.max(0, Math.min(100, progress));

    const progressUpdate: JobProgressUpdate = {
      jobId,
      progress,
      stage,
      metadata,
      timestamp: new Date()
    };

    // Store progress history
    if (!this.jobProgressHistory.has(jobId)) {
      this.jobProgressHistory.set(jobId, []);
    }
    this.jobProgressHistory.get(jobId)!.push(progressUpdate);

    this.emit('enhanced_job:progress', progressUpdate);
    
    // Emit to base queue for SSE/WebSocket updates
    eventEmitter.emit(EventTypes.JOB_PROGRESS, {
      jobId,
      type: job.type,
      progress,
      status: job.status,
      stage,
      metadata
    });
  }

  /**
   * Get detailed job progress history
   */
  getJobProgressHistory(jobId: string): JobProgressUpdate[] {
    return this.jobProgressHistory.get(jobId) || [];
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  /**
   * Determine if job should be processed in batches
   */
  private shouldBatchJob(job: EnhancedJob): boolean {
    if (job.batchSize && job.data.dataset) {
      return job.data.dataset.length > job.batchSize;
    }
    
    // Auto-batch large datasets
    if (job.data.dataset && job.data.dataset.length > 1000) {
      job.batchSize = 100; // Default batch size
      return true;
    }

    return false;
  }

  /**
   * Add job to base queue for processing
   */
  private addToBaseQueue(job: EnhancedJob): void {
    // Check resource availability
    if (!this.hasAvailableResources(job.resourceRequirements!)) {
      // Queue for later processing
      setTimeout(() => this.addToBaseQueue(job), 5000);
      return;
    }

    this.baseQueue.addJob(job.type, job, {
      priority: job.priority,
      maxRetries: 0 // Handle retries ourselves
    });
  }

  /**
   * Check if resources are available for job
   */
  private hasAvailableResources(requirements: ResourceRequirements): boolean {
    return (
      this.resourceUsage.memoryMB + requirements.memoryMB <= this.schedulingPolicy.resourceLimits.memoryMB &&
      this.resourceUsage.cpuCores + requirements.cpuCores <= this.schedulingPolicy.resourceLimits.cpuCores
    );
  }

  /**
   * Log job events for audit and monitoring
   */
  private async logJobEvent(jobId: string, eventType: string, details: any): Promise<void> {
    try {
      const enhancedDb = getEnhancedDatabaseService();
      if (!enhancedDb) {
        // Fallback: log to console if database service unavailable
        console.log(`Job Event: ${eventType} for job ${jobId}`, details);
        return;
      }

      // Check if method exists, but allow test mocks to override
      if (typeof enhancedDb.createAuditLog !== 'function') {
        console.log(`Job Event: ${eventType} for job ${jobId}`, details);
        return;
      }

      await enhancedDb.createAuditLog({
        event_type: eventType,
        event_category: 'system',
        description: `Job ${eventType}: ${jobId}`,
        details,
        resource_type: 'job',
        resource_id: jobId,
        severity: eventType.includes('failed') ? 'error' : 'info'
      });
    } catch (error) {
      console.error('Failed to log job event:', error);
    }
  }

  /**
   * Set up listeners for base queue events
   */
  private setupBaseQueueListeners(): void {
    this.baseQueue.on('job:started', (job: Job) => {
      const enhancedJob = this.enhancedJobs.get(job.id);
      if (enhancedJob && enhancedJob.resourceRequirements) {
        this.resourceUsage.memoryMB += enhancedJob.resourceRequirements.memoryMB;
        this.resourceUsage.cpuCores += enhancedJob.resourceRequirements.cpuCores;
      }
    });

    this.baseQueue.on('job:completed', (job: Job) => {
      const enhancedJob = this.enhancedJobs.get(job.id);
      if (enhancedJob) {
        this.releaseJobResources(enhancedJob);
        this.processDependentJobs(job.id);
      }
    });

    this.baseQueue.on('job:failed', (job: Job) => {
      const enhancedJob = this.enhancedJobs.get(job.id);
      if (enhancedJob) {
        this.releaseJobResources(enhancedJob);
        this.handleJobFailure(enhancedJob, job.error || 'Unknown error');
      }
    });
  }

  /**
   * Release resources used by job
   */
  private releaseJobResources(job: EnhancedJob): void {
    if (job.resourceRequirements) {
      this.resourceUsage.memoryMB = Math.max(0, this.resourceUsage.memoryMB - job.resourceRequirements.memoryMB);
      this.resourceUsage.cpuCores = Math.max(0, this.resourceUsage.cpuCores - job.resourceRequirements.cpuCores);
    }
  }

  /**
   * Register handlers for enhanced job types
   */
  private registerEnhancedJobHandlers(): void {
    // These handlers will be called by the base queue
    // The actual processing logic is in the batch processing methods above
    
    this.baseQueue.registerHandler('large_dataset_risk_assessment', async (job: Job, updateProgress) => {
      const enhancedJob = this.enhancedJobs.get(job.id);
      if (!enhancedJob) throw new Error('Enhanced job not found');
      
      // Job will be handled by processBatchedJob if batched
      if (this.shouldBatchJob(enhancedJob)) {
        return { message: 'Batched job processing handled separately' };
      }
      
      // Handle non-batched jobs normally
      return this.processRiskAssessmentBatch(enhancedJob, {
        batchId: uuidv4(),
        parentJobId: job.id,
        batchNumber: 1,
        totalBatches: 1,
        dataSlice: job.data.dataset || [],
        status: 'running'
      });
    });

    // Add more handlers as needed...
  }

  // ==============================================
  // PUBLIC API METHODS
  // ==============================================

  /**
   * Get enhanced job by ID
   */
  getEnhancedJob(jobId: string): EnhancedJob | undefined {
    return this.enhancedJobs.get(jobId);
  }

  /**
   * Get all enhanced jobs with filtering
   */
  getEnhancedJobs(filter?: {
    status?: JobStatus;
    type?: EnhancedJobType;
    tags?: string[];
    parentJobId?: string;
  }): EnhancedJob[] {
    let jobs = Array.from(this.enhancedJobs.values());

    if (filter?.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }

    if (filter?.type) {
      jobs = jobs.filter(job => job.type === filter.type);
    }

    if (filter?.tags && filter.tags.length > 0) {
      jobs = jobs.filter(job => 
        job.tags && job.tags.some(tag => filter.tags!.includes(tag))
      );
    }

    if (filter?.parentJobId) {
      jobs = jobs.filter(job => job.parentJobId === filter.parentJobId);
    }

    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get job batches for a job
   */
  getJobBatches(jobId: string): JobBatch[] {
    return this.jobBatches.get(jobId) || [];
  }

  /**
   * Get enhanced queue statistics
   */
  getEnhancedStats(): any {
    const baseStats = this.baseQueue.getStats();
    const enhancedJobs = Array.from(this.enhancedJobs.values());

    return {
      ...baseStats,
      enhanced: {
        totalJobs: enhancedJobs.length,
        batchedJobs: this.jobBatches.size,
        jobsWithDependencies: enhancedJobs.filter(j => j.dependencies && j.dependencies.length > 0).length,
        avgEstimatedDuration: enhancedJobs
          .filter(j => j.estimatedDuration)
          .reduce((sum, j) => sum + (j.estimatedDuration || 0), 0) / enhancedJobs.length,
        resourceUsage: this.resourceUsage,
        resourceLimits: this.schedulingPolicy.resourceLimits
      }
    };
  }

  /**
   * Cancel enhanced job and its children
   */
  cancelEnhancedJob(jobId: string): boolean {
    const job = this.enhancedJobs.get(jobId);
    if (!job) return false;

    // Cancel the main job
    const cancelled = this.baseQueue.cancelJob(jobId);
    
    if (cancelled && job.childJobIds) {
      // Cancel child jobs
      for (const childId of job.childJobIds) {
        this.cancelEnhancedJob(childId);
      }
    }

    return cancelled;
  }

  /**
   * Cleanup old jobs and free memory
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const baseCleanup = this.baseQueue.cleanup(olderThanMs);
    const cutoff = new Date(Date.now() - olderThanMs);
    let removed = 0;

    // Clean up enhanced job data
    for (const [id, job] of this.enhancedJobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && job.completedAt < cutoff) {
        this.enhancedJobs.delete(id);
        this.jobBatches.delete(id);
        this.jobProgressHistory.delete(id);
        removed++;
      }
    }

    return baseCleanup + removed;
  }

  /**
   * Shutdown the enhanced job queue and clean up resources
   */
  shutdown(): void {
    // Clear all pending retry timeouts
    for (const timeout of this.retryTimeouts) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    // Clean up all data structures
    this.enhancedJobs.clear();
    this.jobBatches.clear();
    this.jobDependencies.clear();
    this.jobProgressHistory.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const enhancedJobQueueService = new EnhancedJobQueueService();