import { ProgressEmitter } from '../progress-emitter.service';
import { eventEmitter } from '../event.service';

jest.mock('../event.service', () => ({
  eventEmitter: {
    emit: jest.fn()
  }
}));

describe('ProgressEmitter Service', () => {
  let progressEmitter: ProgressEmitter;

  beforeEach(() => {
    progressEmitter = new ProgressEmitter();
    jest.clearAllMocks();
  });

  describe('Job Progress Tracking', () => {
    test('should emit progress events every 1000 rows', () => {
      const jobId = 'job-123';
      
      // Initialize job
      progressEmitter.initializeJob(jobId, 5000);
      
      // Process 999 rows - should not emit
      progressEmitter.updateProgress(jobId, 999);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      
      // Process 1000th row - should emit
      progressEmitter.updateProgress(jobId, 1000);
      expect(eventEmitter.emit).toHaveBeenCalledWith('job:progress', {
        jobId,
        rowsProcessed: 1000,
        totalRows: 5000,
        progress: 20,
        timeElapsed: expect.any(Number)
      });
      
      // Process to 1999 - should not emit again
      jest.clearAllMocks();
      progressEmitter.updateProgress(jobId, 1999);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      
      // Process to 2000 - should emit
      progressEmitter.updateProgress(jobId, 2000);
      expect(eventEmitter.emit).toHaveBeenCalledWith('job:progress', {
        jobId,
        rowsProcessed: 2000,
        totalRows: 5000,
        progress: 40,
        timeElapsed: expect.any(Number)
      });
    });

    test('should emit completion event when job finishes', () => {
      const jobId = 'job-456';
      
      progressEmitter.initializeJob(jobId, 1000);
      progressEmitter.updateProgress(jobId, 1000);
      
      // Should emit both progress and complete events
      expect(eventEmitter.emit).toHaveBeenCalledWith('job:progress', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('job:complete', {
        jobId,
        totalRows: 1000,
        timeElapsed: expect.any(Number)
      });
    });
  });

  describe('Sentiment Analysis Progress', () => {
    test('should track sentiment analysis progress with file details', () => {
      const jobId = 'sentiment-789';
      
      progressEmitter.initializeSentimentAnalysis(jobId, 3, 10000);
      
      // Update progress for first file
      progressEmitter.updateSentimentProgress(jobId, {
        filesProcessed: 0,
        currentFile: 'file1.csv',
        rowsInCurrentFile: 1000,
        totalRowsInCurrentFile: 3000
      });
      
      expect(eventEmitter.emit).toHaveBeenCalledWith('sentiment:progress', {
        jobId,
        filesProcessed: 0,
        totalFiles: 3,
        currentFile: 'file1.csv',
        rowsInCurrentFile: 1000,
        totalRowsInCurrentFile: 3000,
        overallProgress: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Time Estimation', () => {
    test('should calculate estimated time remaining', () => {
      const jobId = 'job-time';
      
      progressEmitter.initializeJob(jobId, 10000);
      
      // Simulate processing over time
      const startTime = Date.now();
      progressEmitter.updateProgress(jobId, 1000);
      
      // Get progress info
      const info = progressEmitter.getJobInfo(jobId);
      expect(info).toMatchObject({
        jobId,
        rowsProcessed: 1000,
        totalRows: 10000,
        progress: 10,
        estimatedTimeRemaining: expect.any(Number)
      });
    });
  });
});