import { EventEmitter } from 'events';
import { eventEmitter, EventTypes, emitEvent } from '../event.service';

describe('EventService', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    eventEmitter.removeAllListeners();
  });

  describe('basic functionality', () => {
    it('should be an instance of EventEmitter', () => {
      expect(eventEmitter).toBeInstanceOf(EventEmitter);
    });

    it('should emit and receive events', (done) => {
      const testData = { message: 'test' };
      
      eventEmitter.on('test-event', (data) => {
        expect(data).toEqual(testData);
        done();
      });
      
      eventEmitter.emit('test-event', testData);
    });

    it('should handle multiple listeners', () => {
      const results: string[] = [];
      
      eventEmitter.on('multi-test', () => results.push('listener1'));
      eventEmitter.on('multi-test', () => results.push('listener2'));
      
      eventEmitter.emit('multi-test');
      
      expect(results).toEqual(['listener1', 'listener2']);
    });

    it('should support once listeners', () => {
      let count = 0;
      
      eventEmitter.once('once-test', () => count++);
      
      eventEmitter.emit('once-test');
      eventEmitter.emit('once-test');
      
      expect(count).toBe(1);
    });

    it('should remove listeners', () => {
      let called = false;
      const listener = () => { called = true; };
      
      eventEmitter.on('remove-test', listener);
      eventEmitter.removeListener('remove-test', listener);
      
      eventEmitter.emit('remove-test');
      
      expect(called).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should emit error events', (done) => {
      const error = new Error('Test error');
      
      eventEmitter.on('error', (err) => {
        expect(err).toBe(error);
        done();
      });
      
      eventEmitter.emit('error', error);
    });
  });

  describe('event patterns', () => {
    it('should handle namespaced events', () => {
      const results: string[] = [];
      
      eventEmitter.on('app:start', () => results.push('app started'));
      eventEmitter.on('app:stop', () => results.push('app stopped'));
      
      eventEmitter.emit('app:start');
      eventEmitter.emit('app:stop');
      
      expect(results).toEqual(['app started', 'app stopped']);
    });

    it('should pass multiple arguments', (done) => {
      eventEmitter.on('multi-args', (arg1, arg2, arg3) => {
        expect(arg1).toBe('first');
        expect(arg2).toBe(42);
        expect(arg3).toEqual({ key: 'value' });
        done();
      });
      
      eventEmitter.emit('multi-args', 'first', 42, { key: 'value' });
    });
  });

  describe('listener management', () => {
    it('should return listener count', () => {
      eventEmitter.on('count-test', () => {});
      eventEmitter.on('count-test', () => {});
      
      expect(eventEmitter.listenerCount('count-test')).toBe(2);
    });

    it('should return event names', () => {
      eventEmitter.on('event1', () => {});
      eventEmitter.on('event2', () => {});
      
      const events = eventEmitter.eventNames();
      expect(events).toContain('event1');
      expect(events).toContain('event2');
    });

    it('should get max listeners', () => {
      expect(eventEmitter.getMaxListeners()).toBeGreaterThan(0);
    });

    it('should set max listeners', () => {
      eventEmitter.setMaxListeners(20);
      expect(eventEmitter.getMaxListeners()).toBe(20);
    });
  });

  describe('async patterns', () => {
    it('should work with async/await', async () => {
      const promise = new Promise((resolve) => {
        eventEmitter.once('async-test', resolve);
      });
      
      eventEmitter.emit('async-test', 'success');
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should handle multiple async listeners', async () => {
      const results: string[] = [];
      
      eventEmitter.on('async-multi', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push('listener1');
      });
      
      eventEmitter.on('async-multi', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push('listener2');
      });
      
      eventEmitter.emit('async-multi');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(results.length).toBe(2);
    });
  });

  describe('EventTypes constants', () => {
    it('should have all expected event types', () => {
      expect(EventTypes.SENTIMENT_PROGRESS).toBe('sentiment:progress');
      expect(EventTypes.FILE_COMPLETE).toBe('file:complete');
      expect(EventTypes.PII_DETECTED).toBe('pii:detected');
      expect(EventTypes.JOB_CREATED).toBe('job:created');
      expect(EventTypes.METRICS_UPDATE).toBe('metrics:update');
      expect(EventTypes.WS_CLIENT_CONNECTED).toBe('ws:client:connected');
      expect(EventTypes.SECURITY_ALERT).toBe('security:alert');
      expect(EventTypes.ANALYTICS_UPDATE).toBe('analytics:update');
    });
  });

  describe('emitEvent helper', () => {
    it('should emit events with timestamp', (done) => {
      const testData = { value: 42 };
      
      eventEmitter.on('helper-test', (data) => {
        expect(data.value).toBe(42);
        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
        done();
      });
      
      emitEvent('helper-test', testData);
    });

    it('should preserve original data', (done) => {
      const complexData = {
        user: 'test',
        nested: { level: 2 },
        array: [1, 2, 3]
      };
      
      eventEmitter.on('complex-test', (data) => {
        expect(data.user).toBe('test');
        expect(data.nested.level).toBe(2);
        expect(data.array).toEqual([1, 2, 3]);
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      emitEvent('complex-test', complexData);
    });
  });
});