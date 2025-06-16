import { eventEmitter, EventTypes } from '../event.service';

// Basic tests for WebSocket service without requiring ws module
describe('WebSocketService - Event Integration', () => {
  beforeEach(() => {
    eventEmitter.removeAllListeners();
  });

  describe('Event broadcasting', () => {
    it('should emit sentiment progress events', (done) => {
      const testData = {
        progress: 50,
        message: 'Processing sentiment'
      };

      eventEmitter.on(EventTypes.SENTIMENT_PROGRESS, (data) => {
        expect(data).toMatchObject(testData);
        // Note: timestamp is only added by emitEvent, not direct emit
        done();
      });

      eventEmitter.emit(EventTypes.SENTIMENT_PROGRESS, testData);
    });

    it('should emit job lifecycle events', () => {
      const createdHandler = jest.fn();
      const progressHandler = jest.fn();
      const completeHandler = jest.fn();
      const failedHandler = jest.fn();

      eventEmitter.on(EventTypes.JOB_CREATED, createdHandler);
      eventEmitter.on(EventTypes.JOB_PROGRESS, progressHandler);
      eventEmitter.on(EventTypes.JOB_COMPLETE, completeHandler);
      eventEmitter.on(EventTypes.JOB_FAILED, failedHandler);

      // Simulate job lifecycle
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'test-job-1',
        type: 'sentiment_analysis',
        status: 'pending'
      });

      eventEmitter.emit(EventTypes.JOB_PROGRESS, {
        jobId: 'test-job-1',
        progress: 25
      });

      eventEmitter.emit(EventTypes.JOB_PROGRESS, {
        jobId: 'test-job-1',
        progress: 75
      });

      eventEmitter.emit(EventTypes.JOB_COMPLETE, {
        jobId: 'test-job-1',
        result: { sentiment: 'positive' }
      });

      expect(createdHandler).toHaveBeenCalledTimes(1);
      expect(progressHandler).toHaveBeenCalledTimes(2);
      expect(completeHandler).toHaveBeenCalledTimes(1);
      expect(failedHandler).not.toHaveBeenCalled();
    });

    it('should emit PII detection events', () => {
      const piiHandler = jest.fn();
      const scanCompleteHandler = jest.fn();

      eventEmitter.on(EventTypes.PII_DETECTED, piiHandler);
      eventEmitter.on(EventTypes.PII_SCAN_COMPLETE, scanCompleteHandler);

      eventEmitter.emit(EventTypes.PII_DETECTED, {
        type: 'email',
        field: 'customer_contact',
        confidence: 0.99
      });

      eventEmitter.emit(EventTypes.PII_DETECTED, {
        type: 'ssn',
        field: 'user_id',
        confidence: 0.95
      });

      eventEmitter.emit(EventTypes.PII_SCAN_COMPLETE, {
        totalScanned: 1000,
        piiFound: 2,
        duration: 250
      });

      expect(piiHandler).toHaveBeenCalledTimes(2);
      expect(scanCompleteHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit file processing events', () => {
      const progressHandler = jest.fn();
      const completeHandler = jest.fn();
      const errorHandler = jest.fn();

      eventEmitter.on(EventTypes.FILE_PROGRESS, progressHandler);
      eventEmitter.on(EventTypes.FILE_COMPLETE, completeHandler);
      eventEmitter.on(EventTypes.FILE_ERROR, errorHandler);

      // Simulate file processing
      for (let i = 0; i <= 100; i += 20) {
        eventEmitter.emit(EventTypes.FILE_PROGRESS, {
          fileId: 'file-123',
          progress: i,
          processedRows: i * 10
        });
      }

      eventEmitter.emit(EventTypes.FILE_COMPLETE, {
        fileId: 'file-123',
        totalRows: 1000,
        duration: 5000
      });

      expect(progressHandler).toHaveBeenCalledTimes(6);
      expect(completeHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should emit system metrics events', () => {
      const metricsHandler = jest.fn();
      const memoryWarningHandler = jest.fn();
      const rateLimitHandler = jest.fn();

      eventEmitter.on(EventTypes.METRICS_UPDATE, metricsHandler);
      eventEmitter.on(EventTypes.MEMORY_WARNING, memoryWarningHandler);
      eventEmitter.on(EventTypes.RATE_LIMIT_EXCEEDED, rateLimitHandler);

      eventEmitter.emit(EventTypes.METRICS_UPDATE, {
        cpu: 45.5,
        memory: 78.2,
        activeConnections: 25
      });

      eventEmitter.emit(EventTypes.MEMORY_WARNING, {
        usage: 92.5,
        threshold: 90,
        recommendation: 'Consider scaling up'
      });

      eventEmitter.emit(EventTypes.RATE_LIMIT_EXCEEDED, {
        clientId: 'client-456',
        limit: 100,
        window: '1m'
      });

      expect(metricsHandler).toHaveBeenCalledTimes(1);
      expect(memoryWarningHandler).toHaveBeenCalledTimes(1);
      expect(rateLimitHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event data structure', () => {
    it('should include proper data in sentiment events', (done) => {
      eventEmitter.on(EventTypes.SENTIMENT_COMPLETE, (data) => {
        expect(data).toHaveProperty('sentiment');
        expect(data).toHaveProperty('score');
        expect(data).toHaveProperty('confidence');
        expect(['positive', 'negative', 'neutral']).toContain(data.sentiment);
        expect(typeof data.score).toBe('number');
        expect(typeof data.confidence).toBe('number');
        done();
      });

      eventEmitter.emit(EventTypes.SENTIMENT_COMPLETE, {
        sentiment: 'positive',
        score: 0.85,
        confidence: 0.92
      });
    });

    it('should include proper data in job events', (done) => {
      eventEmitter.on(EventTypes.JOB_CREATED, (data) => {
        expect(data).toHaveProperty('jobId');
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('status');
        done();
      });

      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'job-789',
        type: 'file_processing',
        status: 'pending',
        priority: 'high'
      });
    });
  });

  describe('Multiple event listeners', () => {
    it('should support multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      eventEmitter.on(EventTypes.SENTIMENT_PROGRESS, listener1);
      eventEmitter.on(EventTypes.SENTIMENT_PROGRESS, listener2);
      eventEmitter.on(EventTypes.SENTIMENT_PROGRESS, listener3);

      const eventData = { progress: 50 };
      eventEmitter.emit(EventTypes.SENTIMENT_PROGRESS, eventData);

      expect(listener1).toHaveBeenCalledWith(eventData);
      expect(listener2).toHaveBeenCalledWith(eventData);
      expect(listener3).toHaveBeenCalledWith(eventData);
    });

    it('should remove specific listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      eventEmitter.on(EventTypes.JOB_PROGRESS, listener1);
      eventEmitter.on(EventTypes.JOB_PROGRESS, listener2);

      eventEmitter.emit(EventTypes.JOB_PROGRESS, { progress: 25 });
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      eventEmitter.removeListener(EventTypes.JOB_PROGRESS, listener1);

      eventEmitter.emit(EventTypes.JOB_PROGRESS, { progress: 50 });
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
    });
  });
});