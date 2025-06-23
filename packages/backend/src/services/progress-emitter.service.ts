import { eventEmitter } from './event.service';

interface JobInfo {
  jobId: string;
  totalRows: number;
  rowsProcessed: number;
  startTime: number;
  lastEmittedAt: number;
  lastEmittedRows: number;
}

interface SentimentJobInfo extends JobInfo {
  totalFiles: number;
  filesProcessed: number;
  currentFile?: string;
  totalRowsInCurrentFile?: number;
}

export class ProgressEmitter {
  private jobs = new Map<string, JobInfo | SentimentJobInfo>();

  initializeJob(jobId: string, totalRows: number): void {
    this.jobs.set(jobId, {
      jobId,
      totalRows,
      rowsProcessed: 0,
      startTime: Date.now(),
      lastEmittedAt: 0,
      lastEmittedRows: 0
    });
  }

  initializeSentimentAnalysis(jobId: string, totalFiles: number, estimatedTotalRows: number): void {
    this.jobs.set(jobId, {
      jobId,
      totalRows: estimatedTotalRows,
      rowsProcessed: 0,
      startTime: Date.now(),
      lastEmittedAt: 0,
      lastEmittedRows: 0,
      totalFiles,
      filesProcessed: 0
    } as SentimentJobInfo);
  }

  updateProgress(jobId: string, rowsProcessed: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.rowsProcessed = rowsProcessed;
    const progress = Math.round((rowsProcessed / job.totalRows) * 100);

    // Emit every 1000 rows
    const shouldEmit = Math.floor(rowsProcessed / 1000) > Math.floor(job.lastEmittedRows / 1000);
    
    if (shouldEmit || rowsProcessed === job.totalRows) {
      const timeElapsed = Date.now() - job.startTime;
      
      eventEmitter.emit('job:progress', {
        jobId,
        rowsProcessed,
        totalRows: job.totalRows,
        progress,
        timeElapsed
      });

      job.lastEmittedAt = Date.now();
      job.lastEmittedRows = rowsProcessed;

      // Emit completion event if done
      if (rowsProcessed === job.totalRows) {
        eventEmitter.emit('job:complete', {
          jobId,
          totalRows: job.totalRows,
          timeElapsed
        });
        this.jobs.delete(jobId);
      }
    }
  }

  updateSentimentProgress(jobId: string, update: {
    filesProcessed: number;
    currentFile: string;
    rowsInCurrentFile: number;
    totalRowsInCurrentFile: number;
  }): void {
    const job = this.jobs.get(jobId) as SentimentJobInfo;
    if (!job) return;

    job.filesProcessed = update.filesProcessed;
    job.currentFile = update.currentFile;
    job.totalRowsInCurrentFile = update.totalRowsInCurrentFile;
    
    const overallProgress = Math.round(
      ((update.filesProcessed + (update.rowsInCurrentFile / update.totalRowsInCurrentFile)) / job.totalFiles) * 100
    );

    eventEmitter.emit('sentiment:progress', {
      jobId,
      filesProcessed: update.filesProcessed,
      totalFiles: job.totalFiles,
      currentFile: update.currentFile,
      rowsInCurrentFile: update.rowsInCurrentFile,
      totalRowsInCurrentFile: update.totalRowsInCurrentFile,
      overallProgress,
      timestamp: new Date().toISOString()
    });
  }

  getJobInfo(jobId: string): any {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const timeElapsed = Date.now() - job.startTime;
    const progress = Math.round((job.rowsProcessed / job.totalRows) * 100);
    const remainingRows = job.totalRows - job.rowsProcessed;
    const rowsPerMs = job.rowsProcessed / timeElapsed;
    const estimatedTimeRemaining = remainingRows / rowsPerMs;

    return {
      jobId,
      rowsProcessed: job.rowsProcessed,
      totalRows: job.totalRows,
      progress,
      timeElapsed,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
    };
  }
}

// Export singleton instance
export const progressEmitter = new ProgressEmitter();