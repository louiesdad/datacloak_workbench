import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createLazyComponent, 
  preloadComponent, 
  useMemoryMonitor,
  usePerformanceTracker,
  debounce,
  throttle,
  memoizeWithTTL,
  createIntersectionObserver
} from '../performance';
import { renderHook, act } from '@testing-library/react';

// Mock React.lazy
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    lazy: vi.fn((importFunc) => {
      // Create a mock lazy component
      const LazyComponent = (props: any) => {
        return React.createElement('div', { 'data-testid': 'lazy-component', ...props });
      };
      LazyComponent.displayName = 'LazyComponent';
      return LazyComponent;
    })
  };
});

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createLazyComponent', () => {
    it('should create a lazy component', () => {
      const importFunc = () => Promise.resolve({ 
        default: () => React.createElement('div', {}, 'Test Component') 
      });
      
      const LazyComponent = createLazyComponent(importFunc);
      
      expect(LazyComponent).toBeDefined();
      expect(typeof LazyComponent).toBe('function');
    });

    it('should handle component with fallback', () => {
      const importFunc = () => Promise.resolve({ 
        default: () => React.createElement('div', {}, 'Test Component') 
      });
      
      const fallback = () => React.createElement('div', {}, 'Loading...');
      const LazyComponent = createLazyComponent(importFunc, fallback);
      
      expect(LazyComponent).toBeDefined();
    });
  });

  describe('preloadComponent', () => {
    it('should preload component module', async () => {
      const importFunc = vi.fn(() => Promise.resolve({ 
        default: () => React.createElement('div', {}, 'Test Component') 
      }));
      
      await preloadComponent(importFunc);
      
      expect(importFunc).toHaveBeenCalledOnce();
    });

    it('should handle preload errors gracefully', async () => {
      const importFunc = vi.fn(() => Promise.reject(new Error('Module not found')));
      
      // Should not throw
      await expect(preloadComponent(importFunc)).resolves.toBeUndefined();
      expect(importFunc).toHaveBeenCalledOnce();
    });

    it('should cache preloaded modules', async () => {
      const importFunc = vi.fn(() => Promise.resolve({ 
        default: () => React.createElement('div', {}, 'Test Component') 
      }));
      
      // Preload twice
      await preloadComponent(importFunc);
      await preloadComponent(importFunc);
      
      // Should only call import once due to caching
      expect(importFunc).toHaveBeenCalledOnce();
    });
  });

  describe('useMemoryMonitor', () => {
    it('should track memory usage', () => {
      // Mock performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 200 * 1024 * 1024  // 200MB
        },
        configurable: true
      });

      const { result } = renderHook(() => 
        useMemoryMonitor({
          warningThreshold: 100 * 1024 * 1024, // 100MB
          onWarning: vi.fn()
        })
      );

      expect(result.current.memoryUsage).toBeDefined();
      expect(result.current.memoryUsage.used).toBe(50 * 1024 * 1024);
    });

    it('should trigger warning when threshold exceeded', () => {
      const onWarning = vi.fn();
      
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 150 * 1024 * 1024, // 150MB
          totalJSHeapSize: 200 * 1024 * 1024,
          jsHeapSizeLimit: 300 * 1024 * 1024
        },
        configurable: true
      });

      renderHook(() => 
        useMemoryMonitor({
          warningThreshold: 100 * 1024 * 1024, // 100MB
          onWarning
        })
      );

      expect(onWarning).toHaveBeenCalledWith({
        used: 150 * 1024 * 1024,
        total: 200 * 1024 * 1024,
        limit: 300 * 1024 * 1024
      });
    });

    it('should handle browsers without memory API', () => {
      // Remove memory API
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true
      });

      const { result } = renderHook(() => 
        useMemoryMonitor({
          warningThreshold: 100 * 1024 * 1024,
          onWarning: vi.fn()
        })
      );

      expect(result.current.memoryUsage).toBeNull();
    });
  });

  describe('usePerformanceTracker', () => {
    it('should track performance metrics', () => {
      const { result } = renderHook(() => usePerformanceTracker());

      act(() => {
        result.current.startTiming('test-operation');
      });

      act(() => {
        vi.advanceTimersByTime(100);
        result.current.endTiming('test-operation');
      });

      const metrics = result.current.getMetrics();
      expect(metrics['test-operation']).toBeDefined();
      expect(metrics['test-operation'].duration).toBeGreaterThan(0);
    });

    it('should handle multiple timings', () => {
      const { result } = renderHook(() => usePerformanceTracker());

      // Start multiple timings
      act(() => {
        result.current.startTiming('operation-1');
        result.current.startTiming('operation-2');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.endTiming('operation-1');
      });

      act(() => {
        vi.advanceTimersByTime(100);
        result.current.endTiming('operation-2');
      });

      const metrics = result.current.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(2);
      expect(metrics['operation-1'].duration).toBeLessThan(metrics['operation-2'].duration);
    });

    it('should mark performance milestones', () => {
      const { result } = renderHook(() => usePerformanceTracker());

      act(() => {
        result.current.mark('component-mounted');
        result.current.mark('data-loaded');
      });

      const metrics = result.current.getMetrics();
      expect(metrics['component-mounted']).toBeDefined();
      expect(metrics['data-loaded']).toBeDefined();
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      // Call multiple times rapidly
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should have been called once with last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should cancel debounced calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      debouncedFn.cancel();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should flush debounced calls immediately', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      debouncedFn.flush();

      expect(mockFn).toHaveBeenCalledWith('test');
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      // Call multiple times
      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      // Should have been called immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Call again
      throttledFn('arg4');

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('arg4');
    });

    it('should cancel throttled calls', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('test');
      throttledFn.cancel();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should only have been called once initially
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoizeWithTTL', () => {
    it('should memoize function results', () => {
      const expensiveFn = vi.fn((x: number) => x * 2);
      const memoizedFn = memoizeWithTTL(expensiveFn, 1000);

      const result1 = memoizedFn(5);
      const result2 = memoizedFn(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(expensiveFn).toHaveBeenCalledTimes(1);
    });

    it('should expire cached results after TTL', () => {
      const expensiveFn = vi.fn((x: number) => x * 2);
      const memoizedFn = memoizeWithTTL(expensiveFn, 1000);

      memoizedFn(5);
      
      act(() => {
        vi.advanceTimersByTime(1001);
      });

      memoizedFn(5);

      expect(expensiveFn).toHaveBeenCalledTimes(2);
    });

    it('should handle different arguments', () => {
      const expensiveFn = vi.fn((x: number) => x * 2);
      const memoizedFn = memoizeWithTTL(expensiveFn, 1000);

      memoizedFn(5);
      memoizedFn(10);
      memoizedFn(5);

      expect(expensiveFn).toHaveBeenCalledTimes(2);
    });

    it('should clear cache manually', () => {
      const expensiveFn = vi.fn((x: number) => x * 2);
      const memoizedFn = memoizeWithTTL(expensiveFn, 1000);

      memoizedFn(5);
      memoizedFn.clear();
      memoizedFn(5);

      expect(expensiveFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('createIntersectionObserver', () => {
    let mockObserver: any;

    beforeEach(() => {
      mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      };

      global.IntersectionObserver = vi.fn(() => mockObserver);
    });

    it('should create intersection observer', () => {
      const callback = vi.fn();
      const observer = createIntersectionObserver(callback, {
        threshold: 0.5
      });

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.5 }
      );
      expect(observer).toBe(mockObserver);
    });

    it('should handle intersection entries', () => {
      const callback = vi.fn();
      
      // Capture the callback passed to IntersectionObserver
      let observerCallback: any;
      (global.IntersectionObserver as any).mockImplementation((cb: any) => {
        observerCallback = cb;
        return mockObserver;
      });

      createIntersectionObserver(callback);

      // Simulate intersection
      const mockEntries = [
        { isIntersecting: true, target: document.createElement('div') }
      ];
      
      observerCallback(mockEntries);

      expect(callback).toHaveBeenCalledWith(mockEntries);
    });

    it('should provide fallback for unsupported browsers', () => {
      // Remove IntersectionObserver
      (global as any).IntersectionObserver = undefined;

      const callback = vi.fn();
      const observer = createIntersectionObserver(callback);

      expect(observer).toBeNull();
    });
  });
});