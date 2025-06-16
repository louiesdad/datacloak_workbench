import { eventEmitter, EventTypes, emitEvent } from '../event.service';

describe('EventService', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    eventEmitter.removeAllListeners();
  });

  describe('eventEmitter', () => {
    it('should emit and receive events', (done) => {
      const testData = { message: 'test' };
      
      eventEmitter.on('test:event', (data) => {
        expect(data).toEqual(testData);
        done();
      });
      
      eventEmitter.emit('test:event', testData);
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const testData = { value: 123 };
      
      eventEmitter.on('test:event', listener1);
      eventEmitter.on('test:event', listener2);
      
      eventEmitter.emit('test:event', testData);
      
      expect(listener1).toHaveBeenCalledWith(testData);
      expect(listener2).toHaveBeenCalledWith(testData);
    });

    it('should have increased max listeners', () => {
      expect(eventEmitter.getMaxListeners()).toBe(100);
    });
  });

  describe('EventTypes', () => {
    it('should have all required event types', () => {
      // Sentiment events
      expect(EventTypes.SENTIMENT_PROGRESS).toBe('sentiment:progress');
      expect(EventTypes.SENTIMENT_COMPLETE).toBe('sentiment:complete');
      expect(EventTypes.SENTIMENT_ERROR).toBe('sentiment:error');
      
      // File events
      expect(EventTypes.FILE_PROGRESS).toBe('file:progress');
      expect(EventTypes.FILE_COMPLETE).toBe('file:complete');
      expect(EventTypes.FILE_ERROR).toBe('file:error');
      
      // PII events
      expect(EventTypes.PII_DETECTED).toBe('pii:detected');
      expect(EventTypes.PII_SCAN_COMPLETE).toBe('pii:scan:complete');
      
      // Job events
      expect(EventTypes.JOB_CREATED).toBe('job:created');
      expect(EventTypes.JOB_PROGRESS).toBe('job:progress');
      expect(EventTypes.JOB_COMPLETE).toBe('job:complete');
      expect(EventTypes.JOB_FAILED).toBe('job:failed');
      expect(EventTypes.JOB_RETRY).toBe('job:retry');
      
      // System events
      expect(EventTypes.METRICS_UPDATE).toBe('metrics:update');
      expect(EventTypes.MEMORY_WARNING).toBe('memory:warning');
      expect(EventTypes.RATE_LIMIT_EXCEEDED).toBe('rateLimit:exceeded');
      
      // WebSocket events
      expect(EventTypes.WS_MESSAGE).toBe('ws:message');
      expect(EventTypes.WS_CLIENT_CONNECTED).toBe('ws:client:connected');
      expect(EventTypes.WS_CLIENT_DISCONNECTED).toBe('ws:client:disconnected');
      
      // Security events
      expect(EventTypes.SECURITY_ALERT).toBe('security:alert');
      expect(EventTypes.COMPLIANCE_CHECK).toBe('compliance:check');
      
      // Analytics events
      expect(EventTypes.ANALYTICS_UPDATE).toBe('analytics:update');
      expect(EventTypes.INSIGHTS_GENERATED).toBe('insights:generated');
    });
  });

  describe('emitEvent', () => {
    it('should emit event with timestamp', (done) => {
      const testData = { value: 'test' };
      const beforeTime = new Date().toISOString();
      
      eventEmitter.on('test:event', (data) => {
        expect(data.value).toBe('test');
        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
        done();
      });
      
      emitEvent('test:event', testData);
    });

    it('should merge data with timestamp', (done) => {
      const testData = { 
        id: '123',
        status: 'active',
        customTimestamp: 'should-be-overwritten'
      };
      
      eventEmitter.on('test:event', (data) => {
        expect(data.id).toBe('123');
        expect(data.status).toBe('active');
        expect(data.customTimestamp).toBe('should-be-overwritten');
        expect(data.timestamp).toBeDefined();
        expect(data.timestamp).not.toBe('should-be-overwritten');
        done();
      });
      
      emitEvent('test:event', testData);
    });
  });

  describe('event flow integration', () => {
    it('should support job lifecycle events', () => {
      const jobCreatedHandler = jest.fn();
      const jobProgressHandler = jest.fn();
      const jobCompleteHandler = jest.fn();
      
      eventEmitter.on(EventTypes.JOB_CREATED, jobCreatedHandler);
      eventEmitter.on(EventTypes.JOB_PROGRESS, jobProgressHandler);
      eventEmitter.on(EventTypes.JOB_COMPLETE, jobCompleteHandler);
      
      // Simulate job lifecycle
      emitEvent(EventTypes.JOB_CREATED, { jobId: 'job123', type: 'test' });
      emitEvent(EventTypes.JOB_PROGRESS, { jobId: 'job123', progress: 50 });
      emitEvent(EventTypes.JOB_COMPLETE, { jobId: 'job123', result: 'success' });
      
      expect(jobCreatedHandler).toHaveBeenCalledTimes(1);
      expect(jobProgressHandler).toHaveBeenCalledTimes(1);
      expect(jobCompleteHandler).toHaveBeenCalledTimes(1);
      
      expect(jobCreatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job123', type: 'test' })
      );
      expect(jobProgressHandler).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job123', progress: 50 })
      );
      expect(jobCompleteHandler).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job123', result: 'success' })
      );
    });

    it('should support sentiment analysis events', () => {
      const progressHandler = jest.fn();
      const completeHandler = jest.fn();
      const errorHandler = jest.fn();
      
      eventEmitter.on(EventTypes.SENTIMENT_PROGRESS, progressHandler);
      eventEmitter.on(EventTypes.SENTIMENT_COMPLETE, completeHandler);
      eventEmitter.on(EventTypes.SENTIMENT_ERROR, errorHandler);
      
      // Simulate sentiment analysis
      emitEvent(EventTypes.SENTIMENT_PROGRESS, { progress: 25, message: 'Analyzing...' });
      emitEvent(EventTypes.SENTIMENT_PROGRESS, { progress: 75, message: 'Almost done...' });
      emitEvent(EventTypes.SENTIMENT_COMPLETE, { 
        sentiment: 'positive', 
        score: 0.8, 
        confidence: 0.95 
      });
      
      expect(progressHandler).toHaveBeenCalledTimes(2);
      expect(completeHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should support PII detection events', () => {
      const detectedHandler = jest.fn();
      const scanCompleteHandler = jest.fn();
      
      eventEmitter.on(EventTypes.PII_DETECTED, detectedHandler);
      eventEmitter.on(EventTypes.PII_SCAN_COMPLETE, scanCompleteHandler);
      
      // Simulate PII detection
      emitEvent(EventTypes.PII_DETECTED, {
        type: 'email',
        location: 'field_3',
        confidence: 0.99
      });
      
      emitEvent(EventTypes.PII_SCAN_COMPLETE, {
        totalScanned: 100,
        piiFound: 3,
        duration: 1500
      });
      
      expect(detectedHandler).toHaveBeenCalledTimes(1);
      expect(scanCompleteHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should not throw when no listeners are registered', () => {
      expect(() => {
        emitEvent('non:existent:event', { data: 'test' });
      }).not.toThrow();
    });

    it.skip('should handle errors thrown by listeners', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const successListener = jest.fn();
      
      // Mock console.error to suppress error output in tests
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // When a listener throws, EventEmitter stops calling subsequent listeners
      // and the error is caught by our error handler
      eventEmitter.on('test:event', errorListener);
      eventEmitter.on('test:event', successListener);
      
      // Our EventEmitter has an error handler that logs errors
      // So this shouldn't throw
      expect(() => {
        emitEvent('test:event', { data: 'test' });
      }).not.toThrow();
      
      // The error listener was called
      expect(errorListener).toHaveBeenCalled();
      // The success listener after the error won't be called (Node.js behavior)
      expect(successListener).not.toHaveBeenCalled();
      
      // Verify that the error was logged
      expect(consoleError).toHaveBeenCalledWith('EventEmitter error:', expect.any(Error));
      
      // Clean up
      consoleError.mockRestore();
    });
  });

  describe('listener management', () => {
    it('should remove specific listener', () => {
      const listener = jest.fn();
      
      eventEmitter.on('test:event', listener);
      eventEmitter.emit('test:event', { data: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      
      eventEmitter.removeListener('test:event', listener);
      eventEmitter.emit('test:event', { data: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should support once listeners', () => {
      const listener = jest.fn();
      
      eventEmitter.once('test:event', listener);
      
      eventEmitter.emit('test:event', { data: 1 });
      eventEmitter.emit('test:event', { data: 2 });
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ data: 1 });
    });

    it('should count listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      expect(eventEmitter.listenerCount('test:event')).toBe(0);
      
      eventEmitter.on('test:event', listener1);
      expect(eventEmitter.listenerCount('test:event')).toBe(1);
      
      eventEmitter.on('test:event', listener2);
      expect(eventEmitter.listenerCount('test:event')).toBe(2);
      
      eventEmitter.removeListener('test:event', listener1);
      expect(eventEmitter.listenerCount('test:event')).toBe(1);
    });
  });
});