import { lazy, ComponentType, LazyExoticComponent } from 'react';

// Memory management utilities
export class MemoryManager {
  private static observers = new Map<string, PerformanceObserver>();
  private static memoryThreshold = 0.8; // 80% of available memory

  // Monitor memory usage
  static startMemoryMonitoring(onMemoryPressure?: () => void) {
    if ('memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usedRatio > this.memoryThreshold) {
          console.warn(`High memory usage detected: ${(usedRatio * 100).toFixed(1)}%`);
          if (onMemoryPressure) {
            onMemoryPressure();
          }
          this.triggerGarbageCollection();
        }
      };

      // Check memory every 30 seconds
      const intervalId = setInterval(checkMemory, 30000);
      
      return () => clearInterval(intervalId);
    }
    
    return () => {}; // No-op if memory API not available
  }

  // Force garbage collection (development only)
  static triggerGarbageCollection() {
    if (process.env.NODE_ENV === 'development' && (window as any).gc) {
      (window as any).gc();
    }
  }

  // Get current memory usage
  static getMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  // Clear large objects from memory
  static clearLargeObjects(objects: any[]) {
    objects.forEach(obj => {
      if (obj && typeof obj === 'object') {
        // Clear arrays
        if (Array.isArray(obj)) {
          obj.length = 0;
        } else {
          // Clear object properties
          Object.keys(obj).forEach(key => {
            delete obj[key];
          });
        }
      }
    });
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  // Start measuring performance
  static startMeasurement(name: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(name, duration);
      return duration;
    };
  }

  // Record a performance metric
  static recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name)!;
    metrics.push(value);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // Get performance statistics
  static getStats(name: string) {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const sorted = [...metrics].sort((a, b) => a - b);
    const sum = metrics.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics),
      avg: sum / metrics.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // Log performance report
  static logReport() {
    console.group('Performance Report');
    
    for (const [name, metrics] of this.metrics.entries()) {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`, {
          'Avg (ms)': stats.avg.toFixed(2),
          'P95 (ms)': stats.p95.toFixed(2),
          'Count': stats.count
        });
      }
    }
    
    // Memory usage
    const memory = MemoryManager.getMemoryUsage();
    if (memory) {
      console.log('Memory Usage:', {
        'Used (MB)': (memory.used / 1024 / 1024).toFixed(2),
        'Percentage': memory.usagePercentage.toFixed(1) + '%'
      });
    }
    
    console.groupEnd();
  }
}

// Virtual scrolling implementation for large datasets
export class VirtualScroller {
  private container: HTMLElement;
  private itemHeight: number;
  private totalItems: number;
  private visibleItems: number;
  private scrollTop = 0;
  private renderCallback: (startIndex: number, endIndex: number) => void;

  constructor(
    container: HTMLElement,
    itemHeight: number,
    totalItems: number,
    renderCallback: (startIndex: number, endIndex: number) => void
  ) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.totalItems = totalItems;
    this.renderCallback = renderCallback;
    this.visibleItems = Math.ceil(container.clientHeight / itemHeight) + 5; // Buffer

    this.setupScrollListener();
    this.updateVisibleItems();
  }

  private setupScrollListener() {
    this.container.addEventListener('scroll', () => {
      this.scrollTop = this.container.scrollTop;
      this.updateVisibleItems();
    });
  }

  private updateVisibleItems() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleItems, this.totalItems);
    
    this.renderCallback(startIndex, endIndex);
  }

  updateTotalItems(newTotal: number) {
    this.totalItems = newTotal;
    this.updateVisibleItems();
  }

  destroy() {
    // Clean up event listeners
    this.container.removeEventListener('scroll', this.updateVisibleItems);
  }
}

// Code splitting utilities
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ComponentType
): LazyExoticComponent<T> {
  const LazyComponent = lazy(() => 
    importFunc().then(module => {
      // Add a small delay in development to test loading states
      if (process.env.NODE_ENV === 'development') {
        return new Promise(resolve => {
          setTimeout(() => resolve(module), 500);
        });
      }
      return module;
    })
  );

  // Set display name for debugging
  LazyComponent.displayName = `Lazy(${importFunc.toString().match(/\.\/(.+)'/)?.[1] || 'Component'})`;

  return LazyComponent;
}

// Preload components for better UX
export const preloadComponent = (importFunc: () => Promise<any>) => {
  // Preload on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => importFunc());
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => importFunc(), 100);
  }
};

// Bundle analyzer for development
export const analyzeBundleSize = () => {
  if (process.env.NODE_ENV === 'development') {
    const modules = (window as any).webpackChunkName || [];
    console.group('Bundle Analysis');
    console.log('Loaded chunks:', modules);
    
    // Estimate bundle sizes (rough approximation)
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach((script, index) => {
      const src = (script as HTMLScriptElement).src;
      if (src) {
        fetch(src, { method: 'HEAD' })
          .then(response => {
            const size = response.headers.get('content-length');
            if (size) {
              console.log(`Script ${index + 1}: ${(parseInt(size) / 1024).toFixed(1)}KB`);
            }
          })
          .catch(() => {}); // Ignore errors
      }
    });
    
    console.groupEnd();
  }
};

// Image optimization utilities
export class ImageOptimizer {
  // Lazy load images
  static setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // Observe all lazy images
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });

      return imageObserver;
    }
    return null;
  }

  // Convert image to WebP if supported
  static async convertToWebP(file: File): Promise<File | Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/webp', 0.8);
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }
}

// Cache management
export class CacheManager {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static set(key: string, data: any, ttlMs = 300000) { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  static clear() {
    this.cache.clear();
  }

  static cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Auto cleanup every 5 minutes
  static startAutoCleanup() {
    const intervalId = setInterval(() => this.cleanup(), 300000);
    return () => clearInterval(intervalId);
  }
}

// Performance hooks for React components
export const usePerformanceMonitor = (componentName: string) => {
  const endMeasurement = React.useRef<(() => number) | null>(null);

  React.useEffect(() => {
    endMeasurement.current = PerformanceMonitor.startMeasurement(`${componentName}_render`);

    return () => {
      if (endMeasurement.current) {
        endMeasurement.current();
      }
    };
  });
};

export const useMemoryCleanup = (dependencies: any[]) => {
  React.useEffect(() => {
    return () => {
      // Clean up large objects when component unmounts
      MemoryManager.clearLargeObjects(dependencies);
    };
  }, []);
};

// Add React import
import React from 'react';