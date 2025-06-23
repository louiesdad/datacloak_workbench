/**
 * Log Retention System
 * 
 * Implements 90-day audit log retention, 30-day technical log retention,
 * and automated cleanup jobs with configurable policies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../config/logger';
import { withSQLiteConnection } from '../database/sqlite-refactored';

export interface LogRetentionPolicy {
  name: string;
  logType: 'audit' | 'technical' | 'security' | 'performance';
  retentionDays: number;
  compressionEnabled: boolean;
  archiveEnabled: boolean;
  archivePath?: string;
  cleanupSchedule: string; // cron expression
  isActive: boolean;
}

export interface LogCleanupJob {
  id: string;
  policyName: string;
  scheduledAt: string;
  executedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  deletedFiles: number;
  deletedSize: number;
  archivedFiles: number;
  archivedSize: number;
  errors: string[];
  duration?: number;
}

export interface LogRetentionMetrics {
  totalLogFiles: number;
  totalLogSize: number;
  oldestLogDate: string;
  newestLogDate: string;
  logsByType: Record<string, { count: number; size: number }>;
  retentionCompliance: Record<string, boolean>;
  cleanupHistory: LogCleanupJob[];
  storageUtilization: number;
}

export class LogRetentionSystem {
  private policies: Map<string, LogRetentionPolicy>;
  private cleanupJobs: LogCleanupJob[];
  private cleanupTimers: Map<string, NodeJS.Timer>;
  private logBasePath: string;

  constructor(logBasePath: string = path.join(process.cwd(), 'logs')) {
    this.policies = new Map();
    this.cleanupJobs = [];
    this.cleanupTimers = new Map();
    this.logBasePath = logBasePath;
    
    this.initializeDefaultPolicies();
    this.ensureLogDirectories();
    this.scheduleCleanupJobs();
    this.initializeDatabase();
  }

  /**
   * Initialize default retention policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: LogRetentionPolicy[] = [
      {
        name: 'audit-logs',
        logType: 'audit',
        retentionDays: 90,
        compressionEnabled: true,
        archiveEnabled: true,
        archivePath: path.join(this.logBasePath, 'archive', 'audit'),
        cleanupSchedule: '0 2 * * *', // Daily at 2 AM
        isActive: true
      },
      {
        name: 'technical-logs',
        logType: 'technical',
        retentionDays: 30,
        compressionEnabled: true,
        archiveEnabled: false,
        cleanupSchedule: '0 3 * * *', // Daily at 3 AM
        isActive: true
      },
      {
        name: 'security-logs',
        logType: 'security',
        retentionDays: 180, // 6 months for security logs
        compressionEnabled: true,
        archiveEnabled: true,
        archivePath: path.join(this.logBasePath, 'archive', 'security'),
        cleanupSchedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
        isActive: true
      },
      {
        name: 'performance-logs',
        logType: 'performance',
        retentionDays: 7, // Keep performance logs for 1 week
        compressionEnabled: false,
        archiveEnabled: false,
        cleanupSchedule: '0 1 * * *', // Daily at 1 AM
        isActive: true
      }
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.name, policy);
    });
  }

  /**
   * Ensure log directories exist
   */
  private ensureLogDirectories(): void {
    const directories = [
      this.logBasePath,
      path.join(this.logBasePath, 'audit'),
      path.join(this.logBasePath, 'technical'),
      path.join(this.logBasePath, 'security'),
      path.join(this.logBasePath, 'performance'),
      path.join(this.logBasePath, 'archive'),
      path.join(this.logBasePath, 'archive', 'audit'),
      path.join(this.logBasePath, 'archive', 'security')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Initialize database tables for log retention tracking
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await withSQLiteConnection(async (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS log_retention_jobs (
            id TEXT PRIMARY KEY,
            policy_name TEXT NOT NULL,
            scheduled_at TEXT NOT NULL,
            executed_at TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            deleted_files INTEGER DEFAULT 0,
            deleted_size INTEGER DEFAULT 0,
            archived_files INTEGER DEFAULT 0,
            archived_size INTEGER DEFAULT 0,
            errors TEXT,
            duration INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS log_retention_metrics (
            id TEXT PRIMARY KEY,
            snapshot_date TEXT NOT NULL,
            total_files INTEGER,
            total_size INTEGER,
            oldest_log_date TEXT,
            newest_log_date TEXT,
            metrics_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_retention_jobs_policy ON log_retention_jobs(policy_name);
          CREATE INDEX IF NOT EXISTS idx_retention_jobs_status ON log_retention_jobs(status);
          CREATE INDEX IF NOT EXISTS idx_retention_metrics_date ON log_retention_metrics(snapshot_date);
        `);
      });
    } catch (error) {
      logger.error('Failed to initialize log retention database:', error);
    }
  }

  /**
   * Schedule cleanup jobs based on policies
   */
  private scheduleCleanupJobs(): void {
    for (const [policyName, policy] of this.policies) {
      if (policy.isActive) {
        this.scheduleCleanupJob(policyName, policy);
      }
    }
  }

  /**
   * Schedule individual cleanup job
   */
  private scheduleCleanupJob(policyName: string, policy: LogRetentionPolicy): void {
    // Parse cron schedule and convert to interval for simplicity
    // In production, use a proper cron library like node-cron
    const interval = this.parseCronToInterval(policy.cleanupSchedule);
    
    const timer = setInterval(async () => {
      await this.executeCleanupJob(policyName);
    }, interval);
    
    this.cleanupTimers.set(policyName, timer);
    
    logger.info(`Scheduled cleanup job for policy: ${policyName}`, {
      schedule: policy.cleanupSchedule,
      retentionDays: policy.retentionDays
    });
  }

  /**
   * Execute cleanup job for specific policy
   */
  async executeCleanupJob(policyName: string): Promise<LogCleanupJob> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    const job: LogCleanupJob = {
      id: this.generateJobId(),
      policyName,
      scheduledAt: new Date().toISOString(),
      status: 'running',
      deletedFiles: 0,
      deletedSize: 0,
      archivedFiles: 0,
      archivedSize: 0,
      errors: []
    };

    const startTime = Date.now();

    try {
      logger.info(`Starting cleanup job for policy: ${policyName}`, { jobId: job.id });

      const logTypeDir = path.join(this.logBasePath, policy.logType);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      if (fs.existsSync(logTypeDir)) {
        const files = fs.readdirSync(logTypeDir);
        
        for (const file of files) {
          const filePath = path.join(logTypeDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            try {
              if (policy.archiveEnabled && policy.archivePath) {
                // Archive the file
                await this.archiveFile(filePath, policy.archivePath, policy.compressionEnabled);
                job.archivedFiles++;
                job.archivedSize += stats.size;
              } else {
                // Delete the file
                fs.unlinkSync(filePath);
                job.deletedFiles++;
                job.deletedSize += stats.size;
              }
            } catch (error) {
              const errorMsg = `Failed to process file ${file}: ${error.message}`;
              job.errors.push(errorMsg);
              logger.error(errorMsg);
            }
          }
        }
      }

      job.status = 'completed';
      job.executedAt = new Date().toISOString();
      job.duration = Date.now() - startTime;

      logger.info(`Cleanup job completed for policy: ${policyName}`, {
        jobId: job.id,
        deletedFiles: job.deletedFiles,
        archivedFiles: job.archivedFiles,
        duration: job.duration
      });

    } catch (error) {
      job.status = 'failed';
      job.errors.push(error.message);
      job.executedAt = new Date().toISOString();
      job.duration = Date.now() - startTime;

      logger.error(`Cleanup job failed for policy: ${policyName}`, {
        jobId: job.id,
        error: error.message
      });
    }

    this.cleanupJobs.push(job);
    await this.saveCleanupJob(job);
    
    return job;
  }

  /**
   * Archive file with optional compression
   */
  private async archiveFile(sourcePath: string, archivePath: string, compress: boolean): Promise<void> {
    const fileName = path.basename(sourcePath);
    const archiveFilePath = path.join(archivePath, fileName);
    
    // Ensure archive directory exists
    if (!fs.existsSync(archivePath)) {
      fs.mkdirSync(archivePath, { recursive: true });
    }

    if (compress) {
      // Use gzip compression
      const zlib = require('zlib');
      const compressedPath = `${archiveFilePath}.gz`;
      
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(compressedPath);
      const gzip = zlib.createGzip();
      
      await new Promise<void>((resolve, reject) => {
        readStream
          .pipe(gzip)
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });
      
      fs.unlinkSync(sourcePath); // Remove original after compression
    } else {
      // Simple copy
      fs.copyFileSync(sourcePath, archiveFilePath);
      fs.unlinkSync(sourcePath);
    }
  }

  /**
   * Get log retention metrics
   */
  async getRetentionMetrics(): Promise<LogRetentionMetrics> {
    const metrics: LogRetentionMetrics = {
      totalLogFiles: 0,
      totalLogSize: 0,
      oldestLogDate: '',
      newestLogDate: '',
      logsByType: {},
      retentionCompliance: {},
      cleanupHistory: [...this.cleanupJobs].slice(-10), // Last 10 cleanup jobs
      storageUtilization: 0
    };

    let oldestDate = new Date();
    let newestDate = new Date(0);

    for (const [policyName, policy] of this.policies) {
      const logTypeDir = path.join(this.logBasePath, policy.logType);
      let typeCount = 0;
      let typeSize = 0;
      let oldestInType = new Date();
      let newestInType = new Date(0);
      let violationsCount = 0;

      if (fs.existsSync(logTypeDir)) {
        const files = fs.readdirSync(logTypeDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        for (const file of files) {
          const filePath = path.join(logTypeDir, file);
          const stats = fs.statSync(filePath);
          
          typeCount++;
          typeSize += stats.size;
          
          if (stats.mtime < oldestInType) {
            oldestInType = stats.mtime;
          }
          if (stats.mtime > newestInType) {
            newestInType = stats.mtime;
          }
          
          // Check retention compliance
          if (stats.mtime < cutoffDate) {
            violationsCount++;
          }
        }
      }

      metrics.logsByType[policy.logType] = { count: typeCount, size: typeSize };
      metrics.retentionCompliance[policyName] = violationsCount === 0;
      metrics.totalLogFiles += typeCount;
      metrics.totalLogSize += typeSize;

      if (oldestInType < oldestDate && typeCount > 0) {
        oldestDate = oldestInType;
      }
      if (newestInType > newestDate && typeCount > 0) {
        newestDate = newestInType;
      }
    }

    metrics.oldestLogDate = oldestDate.toISOString();
    metrics.newestLogDate = newestDate.toISOString();

    // Calculate storage utilization (assuming 1GB max)
    const maxStorage = 1024 * 1024 * 1024; // 1GB
    metrics.storageUtilization = (metrics.totalLogSize / maxStorage) * 100;

    await this.saveMetricsSnapshot(metrics);
    return metrics;
  }

  /**
   * Add or update retention policy
   */
  addPolicy(policy: LogRetentionPolicy): void {
    this.policies.set(policy.name, policy);
    
    if (policy.isActive) {
      // Stop existing timer if any
      const existingTimer = this.cleanupTimers.get(policy.name);
      if (existingTimer) {
        clearInterval(existingTimer);
      }
      
      // Schedule new cleanup job
      this.scheduleCleanupJob(policy.name, policy);
    }
    
    logger.info(`Added/updated retention policy: ${policy.name}`, {
      logType: policy.logType,
      retentionDays: policy.retentionDays
    });
  }

  /**
   * Remove retention policy
   */
  removePolicy(policyName: string): boolean {
    const policy = this.policies.get(policyName);
    if (!policy) {
      return false;
    }

    // Stop cleanup timer
    const timer = this.cleanupTimers.get(policyName);
    if (timer) {
      clearInterval(timer);
      this.cleanupTimers.delete(policyName);
    }

    this.policies.delete(policyName);
    
    logger.info(`Removed retention policy: ${policyName}`);
    return true;
  }

  /**
   * Get all policies
   */
  getPolicies(): LogRetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get cleanup job history
   */
  getCleanupHistory(limit: number = 50): LogCleanupJob[] {
    return [...this.cleanupJobs]
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, limit);
  }

  /**
   * Force cleanup job execution
   */
  async forceCleanup(policyName: string): Promise<LogCleanupJob> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    return await this.executeCleanupJob(policyName);
  }

  /**
   * Test retention policy (dry run)
   */
  async testPolicy(policyName: string): Promise<{
    filesToDelete: string[];
    filesToArchive: string[];
    estimatedSavings: number;
  }> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    const result = {
      filesToDelete: [] as string[],
      filesToArchive: [] as string[],
      estimatedSavings: 0
    };

    const logTypeDir = path.join(this.logBasePath, policy.logType);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    if (fs.existsSync(logTypeDir)) {
      const files = fs.readdirSync(logTypeDir);
      
      for (const file of files) {
        const filePath = path.join(logTypeDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          if (policy.archiveEnabled) {
            result.filesToArchive.push(file);
          } else {
            result.filesToDelete.push(file);
          }
          result.estimatedSavings += stats.size;
        }
      }
    }

    return result;
  }

  /**
   * Save cleanup job to database
   */
  private async saveCleanupJob(job: LogCleanupJob): Promise<void> {
    try {
      await withSQLiteConnection(async (db) => {
        const stmt = db.prepare(`
          INSERT INTO log_retention_jobs (
            id, policy_name, scheduled_at, executed_at, status,
            deleted_files, deleted_size, archived_files, archived_size,
            errors, duration
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          job.id,
          job.policyName,
          job.scheduledAt,
          job.executedAt || null,
          job.status,
          job.deletedFiles,
          job.deletedSize,
          job.archivedFiles,
          job.archivedSize,
          JSON.stringify(job.errors),
          job.duration || null
        );
      });
    } catch (error) {
      logger.error('Failed to save cleanup job to database:', error);
    }
  }

  /**
   * Save metrics snapshot to database
   */
  private async saveMetricsSnapshot(metrics: LogRetentionMetrics): Promise<void> {
    try {
      await withSQLiteConnection(async (db) => {
        const stmt = db.prepare(`
          INSERT INTO log_retention_metrics (
            id, snapshot_date, total_files, total_size,
            oldest_log_date, newest_log_date, metrics_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          this.generateJobId(),
          new Date().toISOString().split('T')[0], // Date only
          metrics.totalLogFiles,
          metrics.totalLogSize,
          metrics.oldestLogDate,
          metrics.newestLogDate,
          JSON.stringify({
            logsByType: metrics.logsByType,
            retentionCompliance: metrics.retentionCompliance,
            storageUtilization: metrics.storageUtilization
          })
        );
      });
    } catch (error) {
      logger.error('Failed to save metrics snapshot to database:', error);
    }
  }

  /**
   * Parse cron expression to interval (simplified)
   */
  private parseCronToInterval(cronExpression: string): number {
    // Simplified cron parsing - in production use a proper cron library
    const parts = cronExpression.split(' ');
    
    // Daily schedule (0 hour * * *)
    if (parts[1] && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 24 * 60 * 60 * 1000; // 24 hours
    }
    
    // Weekly schedule (0 hour * * 0)
    if (parts[4] === '0') {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    
    // Default to daily
    return 24 * 60 * 60 * 1000;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `retention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    for (const timer of this.cleanupTimers.values()) {
      clearInterval(timer);
    }
    this.cleanupTimers.clear();
    
    logger.info('Log retention system shutdown complete');
  }
}

// Export singleton instance
export const logRetentionSystem = new LogRetentionSystem();