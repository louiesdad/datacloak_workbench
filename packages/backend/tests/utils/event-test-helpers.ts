import { EventEmitter } from 'events';
import { EventService, EventTypes } from '../../src/services/event.service';

export interface EventCapture {
  eventType: string;
  data: any;
  timestamp: number;
}

export class EventTestHelpers {
  private static capturedEvents: EventCapture[] = [];
  private static eventEmitter: EventEmitter;
  private static originalEmit: any;

  static setupEventCapture(): void {
    this.capturedEvents = [];
    this.eventEmitter = EventService.getInstance()['emitter'] || new EventEmitter();
    
    // Store original emit method
    this.originalEmit = this.eventEmitter.emit.bind(this.eventEmitter);
    
    // Override emit to capture events
    this.eventEmitter.emit = (eventType: string, ...args: any[]) => {
      // Capture the event
      this.capturedEvents.push({
        eventType,
        data: args[0] || {},
        timestamp: Date.now()
      });
      
      // Call original emit
      return this.originalEmit(eventType, ...args);
    };
  }

  static teardownEventCapture(): void {
    if (this.originalEmit && this.eventEmitter) {
      this.eventEmitter.emit = this.originalEmit;
    }
    this.capturedEvents = [];
  }

  static getCapturedEvents(): EventCapture[] {
    return [...this.capturedEvents];
  }

  static getEventsByType(eventType: string): EventCapture[] {
    return this.capturedEvents.filter(event => event.eventType === eventType);
  }

  static getLastEvent(): EventCapture | null {
    return this.capturedEvents.length > 0 
      ? this.capturedEvents[this.capturedEvents.length - 1]
      : null;
  }

  static getLastEventOfType(eventType: string): EventCapture | null {
    const events = this.getEventsByType(eventType);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  static clearCapturedEvents(): void {
    this.capturedEvents = [];
  }

  static waitForEvent(eventType: string, timeout: number = 5000): Promise<EventCapture> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Event ${eventType} not received within ${timeout}ms`));
      }, timeout);

      const checkForEvent = () => {
        const event = this.getLastEventOfType(eventType);
        if (event) {
          clearTimeout(timeoutId);
          resolve(event);
        } else {
          setTimeout(checkForEvent, 10);
        }
      };

      checkForEvent();
    });
  }

  static waitForEvents(eventTypes: string[], timeout: number = 5000): Promise<EventCapture[]> {
    return Promise.all(
      eventTypes.map(eventType => this.waitForEvent(eventType, timeout))
    );
  }

  static waitForEventSequence(eventTypes: string[], timeout: number = 10000): Promise<EventCapture[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Event sequence ${eventTypes.join(' -> ')} not completed within ${timeout}ms`));
      }, timeout);

      const checkSequence = () => {
        const capturedTypes = this.capturedEvents.map(e => e.eventType);
        const hasSequence = this.hasEventSequence(capturedTypes, eventTypes);
        
        if (hasSequence) {
          clearTimeout(timeoutId);
          const sequenceEvents = this.extractEventSequence(eventTypes);
          resolve(sequenceEvents);
        } else {
          setTimeout(checkSequence, 10);
        }
      };

      checkSequence();
    });
  }

  private static hasEventSequence(capturedTypes: string[], expectedTypes: string[]): boolean {
    let expectedIndex = 0;
    
    for (const capturedType of capturedTypes) {
      if (capturedType === expectedTypes[expectedIndex]) {
        expectedIndex++;
        if (expectedIndex === expectedTypes.length) {
          return true;
        }
      }
    }
    
    return false;
  }

  private static extractEventSequence(eventTypes: string[]): EventCapture[] {
    const result: EventCapture[] = [];
    let searchIndex = 0;
    
    for (const eventType of eventTypes) {
      for (let i = searchIndex; i < this.capturedEvents.length; i++) {
        if (this.capturedEvents[i].eventType === eventType) {
          result.push(this.capturedEvents[i]);
          searchIndex = i + 1;
          break;
        }
      }
    }
    
    return result;
  }

  // Create a mock event emitter for testing
  static createMockEventEmitter(): EventEmitter {
    const emitter = new EventEmitter();
    const capturedEvents: EventCapture[] = [];

    const originalEmit = emitter.emit.bind(emitter);
    emitter.emit = (eventType: string, ...args: any[]) => {
      capturedEvents.push({
        eventType,
        data: args[0] || {},
        timestamp: Date.now()
      });
      return originalEmit(eventType, ...args);
    };

    // Add helper methods
    (emitter as any).getCapturedEvents = () => [...capturedEvents];
    (emitter as any).getEventsByType = (type: string) => 
      capturedEvents.filter(event => event.eventType === type);
    (emitter as any).clearEvents = () => capturedEvents.length = 0;

    return emitter;
  }

  // Simulate common event scenarios for testing
  static simulateFileProcessingEvents(emitter: EventEmitter, fileId: string): void {
    setTimeout(() => {
      emitter.emit(EventTypes.FILE_PROGRESS, { 
        fileId, 
        progress: 25, 
        message: 'Reading file...' 
      });
    }, 10);

    setTimeout(() => {
      emitter.emit(EventTypes.FILE_PROGRESS, { 
        fileId, 
        progress: 50, 
        message: 'Processing data...' 
      });
    }, 20);

    setTimeout(() => {
      emitter.emit(EventTypes.FILE_PROGRESS, { 
        fileId, 
        progress: 75, 
        message: 'Analyzing content...' 
      });
    }, 30);

    setTimeout(() => {
      emitter.emit(EventTypes.FILE_COMPLETE, { 
        fileId, 
        progress: 100, 
        result: { processed: true, records: 100 }
      });
    }, 40);
  }

  static simulateSentimentAnalysisEvents(emitter: EventEmitter, jobId: string): void {
    setTimeout(() => {
      emitter.emit(EventTypes.SENTIMENT_PROGRESS, { 
        jobId, 
        progress: 30, 
        processed: 30, 
        total: 100 
      });
    }, 10);

    setTimeout(() => {
      emitter.emit(EventTypes.SENTIMENT_PROGRESS, { 
        jobId, 
        progress: 70, 
        processed: 70, 
        total: 100 
      });
    }, 20);

    setTimeout(() => {
      emitter.emit(EventTypes.SENTIMENT_COMPLETE, { 
        jobId, 
        progress: 100, 
        result: { 
          positive: 40, 
          negative: 30, 
          neutral: 30,
          averageScore: 0.2
        }
      });
    }, 30);
  }

  static simulateJobQueueEvents(emitter: EventEmitter, jobId: string): void {
    setTimeout(() => {
      emitter.emit(EventTypes.JOB_CREATED, { jobId, type: 'sentiment-analysis' });
    }, 5);

    setTimeout(() => {
      emitter.emit(EventTypes.JOB_PROGRESS, { jobId, progress: 50 });
    }, 15);

    setTimeout(() => {
      emitter.emit(EventTypes.JOB_COMPLETE, { jobId, result: { success: true } });
    }, 25);
  }

  static simulateErrorEvents(emitter: EventEmitter, context: string): void {
    setTimeout(() => {
      emitter.emit(EventTypes.SENTIMENT_ERROR, { 
        context, 
        error: 'Rate limit exceeded',
        retryable: true
      });
    }, 10);

    setTimeout(() => {
      emitter.emit(EventTypes.FILE_ERROR, { 
        context, 
        error: 'File format not supported',
        retryable: false
      });
    }, 20);
  }

  // Helper to verify event data structure
  static verifyEventData(event: EventCapture, expectedFields: string[]): boolean {
    if (!event || !event.data) return false;

    return expectedFields.every(field => {
      const fieldParts = field.split('.');
      let current = event.data;
      
      for (const part of fieldParts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return false;
        }
      }
      
      return true;
    });
  }

  // Helper to create event assertions for tests
  static createEventAssertions(eventType: string) {
    return {
      toHaveBeenEmitted: () => {
        const events = this.getEventsByType(eventType);
        return events.length > 0;
      },
      
      toHaveBeenEmittedTimes: (count: number) => {
        const events = this.getEventsByType(eventType);
        return events.length === count;
      },
      
      toHaveBeenEmittedWith: (expectedData: any) => {
        const events = this.getEventsByType(eventType);
        return events.some(event => 
          JSON.stringify(event.data) === JSON.stringify(expectedData)
        );
      },
      
      toHaveBeenEmittedRecently: (withinMs: number = 1000) => {
        const events = this.getEventsByType(eventType);
        if (events.length === 0) return false;
        
        const lastEvent = events[events.length - 1];
        return (Date.now() - lastEvent.timestamp) <= withinMs;
      }
    };
  }
}