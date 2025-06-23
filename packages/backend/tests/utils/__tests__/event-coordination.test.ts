import { EventEmitter } from 'events';
import { EventTestHelpers, EventCapture } from '../event-test-helpers';
import { EventService, EventTypes } from '../../../src/services/event.service';

describe('Event System Test Coordination', () => {
  beforeEach(() => {
    EventTestHelpers.setupEventCapture();
  });

  afterEach(() => {
    EventTestHelpers.teardownEventCapture();
  });

  describe('Event Capture and Coordination', () => {
    it('should capture multiple events in sequence', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      // Emit a sequence of events
      mockEmitter.emit('step-1', { data: 'first' });
      mockEmitter.emit('step-2', { data: 'second' });
      mockEmitter.emit('step-3', { data: 'third' });

      const capturedEvents = (mockEmitter as any).getCapturedEvents();
      expect(capturedEvents).toHaveLength(3);
      expect(capturedEvents[0].eventType).toBe('step-1');
      expect(capturedEvents[1].eventType).toBe('step-2');
      expect(capturedEvents[2].eventType).toBe('step-3');
    });

    it('should wait for event sequences correctly', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      // Set up the sequence expectation
      const sequencePromise = new Promise<EventCapture[]>((resolve) => {
        setTimeout(() => {
          mockEmitter.emit('file-upload');
          mockEmitter.emit('file-processing');
          mockEmitter.emit('file-complete');
          
          const events = (mockEmitter as any).getCapturedEvents();
          resolve(events);
        }, 10);
      });

      const events = await sequencePromise;
      expect(events).toHaveLength(3);
      expect(events.map(e => e.eventType)).toEqual([
        'file-upload',
        'file-processing', 
        'file-complete'
      ]);
    });

    it('should handle concurrent event emissions', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      // Emit events concurrently
      const promises = [
        new Promise(resolve => {
          setTimeout(() => {
            mockEmitter.emit('async-task-1', { id: 1 });
            resolve(true);
          }, 5);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            mockEmitter.emit('async-task-2', { id: 2 });
            resolve(true);
          }, 10);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            mockEmitter.emit('async-task-3', { id: 3 });
            resolve(true);
          }, 15);
        })
      ];

      await Promise.all(promises);

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(3);
      
      const task1Events = (mockEmitter as any).getEventsByType('async-task-1');
      const task2Events = (mockEmitter as any).getEventsByType('async-task-2');
      const task3Events = (mockEmitter as any).getEventsByType('async-task-3');
      
      expect(task1Events).toHaveLength(1);
      expect(task2Events).toHaveLength(1);
      expect(task3Events).toHaveLength(1);
    });
  });

  describe('Event Simulation Scenarios', () => {
    it('should simulate file processing workflow', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      const fileId = 'test-file-123';

      // Simulate the file processing events
      EventTestHelpers.simulateFileProcessingEvents(mockEmitter, fileId);

      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 50));

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(4);

      // Verify progress events
      const progressEvents = (mockEmitter as any).getEventsByType(EventTypes.FILE_PROGRESS);
      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0].data.progress).toBe(25);
      expect(progressEvents[1].data.progress).toBe(50);
      expect(progressEvents[2].data.progress).toBe(75);

      // Verify completion event
      const completeEvents = (mockEmitter as any).getEventsByType(EventTypes.FILE_COMPLETE);
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].data.progress).toBe(100);
      expect(completeEvents[0].data.result.processed).toBe(true);
    });

    it('should simulate sentiment analysis workflow', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      const jobId = 'sentiment-job-456';

      // Simulate sentiment analysis events
      EventTestHelpers.simulateSentimentAnalysisEvents(mockEmitter, jobId);

      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 40));

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(3);

      // Verify progress events
      const progressEvents = (mockEmitter as any).getEventsByType(EventTypes.SENTIMENT_PROGRESS);
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0].data.progress).toBe(30);
      expect(progressEvents[1].data.progress).toBe(70);

      // Verify completion event
      const completeEvents = (mockEmitter as any).getEventsByType(EventTypes.SENTIMENT_COMPLETE);
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].data.result.averageScore).toBe(0.2);
    });

    it('should simulate job queue workflow', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      const jobId = 'queue-job-789';

      // Simulate job queue events
      EventTestHelpers.simulateJobQueueEvents(mockEmitter, jobId);

      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 30));

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(3);

      const eventTypes = events.map(e => e.eventType);
      expect(eventTypes).toEqual([
        EventTypes.JOB_CREATED,
        EventTypes.JOB_PROGRESS,
        EventTypes.JOB_COMPLETE
      ]);
    });

    it('should simulate error scenarios', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      const context = 'test-error-context';

      // Simulate error events
      EventTestHelpers.simulateErrorEvents(mockEmitter, context);

      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 25));

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(2);

      const sentimentErrors = (mockEmitter as any).getEventsByType(EventTypes.SENTIMENT_ERROR);
      const fileErrors = (mockEmitter as any).getEventsByType(EventTypes.FILE_ERROR);

      expect(sentimentErrors).toHaveLength(1);
      expect(fileErrors).toHaveLength(1);

      expect(sentimentErrors[0].data.retryable).toBe(true);
      expect(fileErrors[0].data.retryable).toBe(false);
    });
  });

  describe('Event Data Validation', () => {
    it('should validate event data structure', () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      mockEmitter.emit('test-event', {
        user: { id: 123, name: 'test' },
        metadata: { timestamp: new Date().toISOString() },
        nested: { deep: { value: 'test' } }
      });

      const events = (mockEmitter as any).getCapturedEvents();
      const event = events[0];

      // Test validation helper
      const isValid = EventTestHelpers.verifyEventData(event, [
        'user.id',
        'user.name',
        'metadata.timestamp',
        'nested.deep.value'
      ]);

      expect(isValid).toBe(true);

      // Test invalid field
      const isInvalid = EventTestHelpers.verifyEventData(event, [
        'user.nonexistent'
      ]);

      expect(isInvalid).toBe(false);
    });

    it('should provide event assertions with basic functionality', () => {
      // Clear any existing events first
      EventTestHelpers.clearCapturedEvents();
      
      // Use the real EventService for static assertions
      const eventService = EventService.getInstance();
      
      eventService.emit('test-assertion' as any, { count: 1 });
      eventService.emit('test-assertion' as any, { count: 2 });
      eventService.emit('other-event' as any, { data: 'test' });

      const assertions = EventTestHelpers.createEventAssertions('test-assertion');

      // Test basic assertions that should work
      expect(assertions.toHaveBeenEmitted()).toBe(true);
      expect(assertions.toHaveBeenEmittedTimes(2)).toBe(true);
      expect(assertions.toHaveBeenEmittedRecently()).toBe(true);

      // Test non-existent event type
      const nonExistentAssertions = EventTestHelpers.createEventAssertions('non-existent');
      expect(nonExistentAssertions.toHaveBeenEmitted()).toBe(false);
      expect(nonExistentAssertions.toHaveBeenEmittedTimes(0)).toBe(true);
    });
  });

  describe('Integration with Real EventService', () => {
    it('should coordinate with real EventService instance', () => {
      const eventService = EventService.getInstance();
      
      // Emit an event through the real service
      eventService.emit(EventTypes.FILE_PROGRESS, { 
        fileId: 'real-test', 
        progress: 50 
      });

      // Check if it was captured
      const capturedEvents = EventTestHelpers.getCapturedEvents();
      const progressEvents = EventTestHelpers.getEventsByType(EventTypes.FILE_PROGRESS);

      expect(capturedEvents.length).toBeGreaterThan(0);
      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].data.fileId).toBe('real-test');
    });

    it('should handle event service errors gracefully', () => {
      const eventService = EventService.getInstance();
      
      // This should not throw even if the event system has issues
      expect(() => {
        eventService.emit('invalid-event-type' as any, { data: 'test' });
      }).not.toThrow();

      // Capture should still work
      const capturedEvents = EventTestHelpers.getCapturedEvents();
      expect(Array.isArray(capturedEvents)).toBe(true);
    });
  });

  describe('Event Cleanup and Isolation', () => {
    it('should properly isolate events between tests', () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      mockEmitter.emit('isolated-event-1', { test: 1 });
      
      const events1 = (mockEmitter as any).getCapturedEvents();
      expect(events1).toHaveLength(1);
      
      // Clear events and emit new ones
      (mockEmitter as any).clearEvents();
      mockEmitter.emit('isolated-event-2', { test: 2 });
      
      const events2 = (mockEmitter as any).getCapturedEvents();
      expect(events2).toHaveLength(1);
      expect(events2[0].eventType).toBe('isolated-event-2');
    });

    it('should handle teardown correctly', () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      mockEmitter.emit('cleanup-test', { data: 'before teardown' });
      
      const eventsBefore = (mockEmitter as any).getCapturedEvents();
      expect(eventsBefore).toHaveLength(1);
      
      // Teardown should clean up properly
      EventTestHelpers.teardownEventCapture();
      EventTestHelpers.setupEventCapture();
      
      const eventsAfter = EventTestHelpers.getCapturedEvents();
      expect(eventsAfter).toHaveLength(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency events', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      // Emit 100 events rapidly
      for (let i = 0; i < 100; i++) {
        mockEmitter.emit('high-freq-event', { index: i });
      }

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(100);
      
      // Verify order is maintained
      for (let i = 0; i < 100; i++) {
        expect(events[i].data.index).toBe(i);
      }
    });

    it('should handle large event payloads', () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      const largePayload = {
        data: 'x'.repeat(10000), // 10KB string
        array: new Array(1000).fill({ nested: 'data' }),
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'test',
          large: 'y'.repeat(5000)
        }
      };

      mockEmitter.emit('large-payload-event', largePayload);

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.data.length).toBe(10000);
      expect(events[0].data.array).toHaveLength(1000);
    });

    it('should maintain event timing accuracy', async () => {
      const mockEmitter = EventTestHelpers.createMockEventEmitter();
      
      const startTime = Date.now();
      mockEmitter.emit('timing-test-1', { data: 'first' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      mockEmitter.emit('timing-test-2', { data: 'second' });
      const endTime = Date.now();

      const events = (mockEmitter as any).getCapturedEvents();
      expect(events).toHaveLength(2);
      
      const firstEventTime = events[0].timestamp;
      const secondEventTime = events[1].timestamp;
      
      expect(firstEventTime).toBeGreaterThanOrEqual(startTime);
      expect(secondEventTime).toBeGreaterThan(firstEventTime);
      expect(secondEventTime).toBeLessThanOrEqual(endTime);
    });
  });
});