import { useCallback, useEffect, useRef, useState } from 'react';

export interface WebWorkerHook<T, R> {
  data: R | null;
  error: string | null;
  isLoading: boolean;
  progress: number;
  execute: (payload: T) => Promise<R>;
  cancel: () => void;
}

export function useWebWorker<T = any, R = any>(
  workerFactory: () => Worker,
  options: {
    timeout?: number;
    onProgress?: (progress: number, details?: any) => void;
    onError?: (error: string) => void;
  } = {}
): WebWorkerHook<T, R> {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promiseRef = useRef<{
    resolve: (value: R) => void;
    reject: (reason: string) => void;
  } | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    promiseRef.current = null;
    setIsLoading(false);
    setProgress(0);
  }, []);

  // Cancel current operation
  const cancel = useCallback(() => {
    if (promiseRef.current) {
      promiseRef.current.reject('Operation cancelled');
    }
    cleanup();
  }, [cleanup]);

  // Execute worker task
  const execute = useCallback(async (payload: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        reject('Web Workers are not supported in this environment');
        return;
      }

      // Cancel any existing operation
      cancel();

      // Reset state
      setData(null);
      setError(null);
      setIsLoading(true);
      setProgress(0);

      try {
        // Create new worker
        workerRef.current = workerFactory();
        promiseRef.current = { resolve, reject };

        // Set up timeout
        if (options.timeout) {
          timeoutRef.current = setTimeout(() => {
            reject('Worker operation timed out');
            cleanup();
          }, options.timeout);
        }

        // Handle worker messages
        workerRef.current.onmessage = (event) => {
          const { type, payload: resultPayload } = event.data;

          switch (type) {
            case 'PROCESSING_COMPLETE':
            case 'VALIDATION_COMPLETE':
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              setData(resultPayload);
              setIsLoading(false);
              setProgress(100);
              if (promiseRef.current) {
                promiseRef.current.resolve(resultPayload);
                promiseRef.current = null;
              }
              break;

            case 'PROCESSING_ERROR':
              const errorMessage = resultPayload?.error || 'Worker processing failed';
              setError(errorMessage);
              setIsLoading(false);
              options.onError?.(errorMessage);
              if (promiseRef.current) {
                promiseRef.current.reject(errorMessage);
                promiseRef.current = null;
              }
              cleanup();
              break;

            case 'PROGRESS_UPDATE':
              const progressValue = resultPayload?.progress || 0;
              setProgress(progressValue);
              options.onProgress?.(progressValue, resultPayload);
              break;

            default:
              console.warn('Unknown worker message type:', type);
          }
        };

        // Handle worker errors
        workerRef.current.onerror = (event) => {
          const errorMessage = `Worker error: ${event.message}`;
          setError(errorMessage);
          setIsLoading(false);
          options.onError?.(errorMessage);
          if (promiseRef.current) {
            promiseRef.current.reject(errorMessage);
            promiseRef.current = null;
          }
          cleanup();
        };

        // Send task to worker
        workerRef.current.postMessage(payload);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start worker';
        setError(errorMessage);
        setIsLoading(false);
        options.onError?.(errorMessage);
        reject(errorMessage);
        cleanup();
      }
    });
  }, [cancel, cleanup, options, workerFactory]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    data,
    error,
    isLoading,
    progress,
    execute,
    cancel
  };
}

// Specific hook for file processing
export function useFileProcessor() {
  const workerFactory = useCallback(() => {
    return new Worker(
      new URL('../workers/fileProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }, []);

  return useWebWorker(workerFactory, {
    timeout: 60000, // 60 second timeout
    onProgress: (progress, details) => {
      console.log(`File processing: ${progress}%`, details);
    },
    onError: (error) => {
      console.error('File processing error:', error);
    }
  });
}

// Performance monitoring
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    memoryUsed: 0,
    memoryLimit: 0,
    responseTime: 0,
    isResponsive: true
  });

  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    const monitor = () => {
      const currentTime = performance.now();
      const responseTime = currentTime - lastTime;
      
      // Check if UI is responsive (should be under 16ms for 60fps)
      const isResponsive = responseTime < 100; // Allow some margin
      
      // Memory monitoring (if available)
      let memoryUsed = 0;
      let memoryLimit = 0;
      
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsed = memory.usedJSHeapSize / (1024 * 1024); // MB
        memoryLimit = memory.jsHeapSizeLimit / (1024 * 1024); // MB
      }

      setMetrics({
        memoryUsed,
        memoryLimit,
        responseTime,
        isResponsive
      });

      lastTime = currentTime;
      frameId = requestAnimationFrame(monitor);
    };

    frameId = requestAnimationFrame(monitor);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return metrics;
};