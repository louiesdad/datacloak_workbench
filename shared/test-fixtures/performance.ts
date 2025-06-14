/**
 * Shared Test Fixtures - Performance Testing
 * 
 * Test data and utilities for performance testing across all packages
 */

// =============================================================================
// Performance Benchmark Data
// =============================================================================

export const PERFORMANCE_BENCHMARKS = {
  fileUpload: {
    small: { size: 1024 * 1024, maxTime: 1000 }, // 1MB in 1s
    medium: { size: 1024 * 1024 * 10, maxTime: 5000 }, // 10MB in 5s
    large: { size: 1024 * 1024 * 100, maxTime: 30000 }, // 100MB in 30s
    huge: { size: 1024 * 1024 * 1024, maxTime: 300000 } // 1GB in 5min
  },
  sentimentAnalysis: {
    single: { maxTime: 500 }, // 500ms per text
    batch10: { maxTime: 2000 }, // 2s for 10 texts
    batch100: { maxTime: 15000 }, // 15s for 100 texts
    batch1000: { maxTime: 120000 } // 2min for 1000 texts
  },
  fieldInference: {
    small: { rows: 1000, columns: 10, maxTime: 2000 }, // 2s
    medium: { rows: 10000, columns: 50, maxTime: 10000 }, // 10s
    large: { rows: 100000, columns: 100, maxTime: 60000 }, // 1min
    huge: { rows: 1000000, columns: 200, maxTime: 300000 } // 5min
  },
  securityScan: {
    basic: { maxTime: 5000 }, // 5s
    thorough: { maxTime: 30000 }, // 30s
    comprehensive: { maxTime: 120000 } // 2min
  }
};

// =============================================================================
// Memory Usage Benchmarks
// =============================================================================

export const MEMORY_BENCHMARKS = {
  baseline: 50, // 50MB baseline memory usage
  fileProcessing: {
    perMB: 2, // 2MB RAM per 1MB file size
    maxUsage: 2048 // 2GB max memory usage
  },
  dataCaching: {
    perRow: 0.1, // 0.1KB per row
    maxCache: 512 // 512MB max cache size
  },
  analysisOperations: {
    sentiment: 1, // 1MB per batch operation
    inference: 5, // 5MB per inference operation
    security: 10 // 10MB per security scan
  }
};

// =============================================================================
// Load Test Scenarios
// =============================================================================

export const LOAD_TEST_SCENARIOS = {
  light: {
    concurrentUsers: 10,
    requestsPerMinute: 100,
    duration: 300000 // 5 minutes
  },
  moderate: {
    concurrentUsers: 50,
    requestsPerMinute: 500,
    duration: 600000 // 10 minutes
  },
  heavy: {
    concurrentUsers: 100,
    requestsPerMinute: 1000,
    duration: 1800000 // 30 minutes
  },
  stress: {
    concurrentUsers: 200,
    requestsPerMinute: 2000,
    duration: 3600000 // 1 hour
  }
};

// =============================================================================
// Synthetic Data Generators for Performance Testing
// =============================================================================

export function generateLargeCSV(rows: number, columns: number): string {
  const headers = Array.from({ length: columns }, (_, i) => `column_${i + 1}`);
  const headerRow = headers.join(',');
  
  const dataRows: string[] = [];
  for (let row = 0; row < rows; row++) {
    const rowData = headers.map((_, colIndex) => {
      // Generate different types of data for performance testing
      switch (colIndex % 5) {
        case 0: return `id_${row}`;
        case 1: return `user_${row}@example.com`;
        case 2: return Math.floor(Math.random() * 1000);
        case 3: return (Math.random() * 100).toFixed(2);
        case 4: return Math.random() > 0.5 ? 'true' : 'false';
        default: return `value_${row}_${colIndex}`;
      }
    });
    dataRows.push(rowData.join(','));
  }
  
  return [headerRow, ...dataRows].join('\n');
}

export function generateLargeTextArray(count: number, avgLength: number): string[] {
  const texts: string[] = [];
  const words = [
    'amazing', 'terrible', 'good', 'bad', 'excellent', 'poor', 'outstanding',
    'awful', 'fantastic', 'horrible', 'great', 'worst', 'best', 'average',
    'superb', 'disappointing', 'wonderful', 'dreadful', 'brilliant', 'mediocre'
  ];
  
  for (let i = 0; i < count; i++) {
    const wordCount = Math.floor(avgLength / 6); // Assume 6 chars per word
    const selectedWords = Array.from({ length: wordCount }, () => 
      words[Math.floor(Math.random() * words.length)]
    );
    texts.push(`Text ${i}: ${selectedWords.join(' ')}.`);
  }
  
  return texts;
}

export function generateLargeDataset(options: {
  rows: number;
  columns: number;
  includesPII?: boolean;
  includesLongText?: boolean;
}): Record<string, any>[] {
  const { rows, columns, includesPII = false, includesLongText = false } = options;
  const dataset: Record<string, any>[] = [];
  
  for (let row = 0; row < rows; row++) {
    const record: Record<string, any> = {};
    
    for (let col = 0; col < columns; col++) {
      const fieldName = `field_${col}`;
      
      if (includesPII && col < 3) {
        // Add PII fields for testing
        switch (col) {
          case 0:
            record[fieldName] = `user_${row}@example.com`;
            break;
          case 1:
            record[fieldName] = `555-${String(row).padStart(3, '0')}-${String(row * 2).padStart(4, '0')}`;
            break;
          case 2:
            record[fieldName] = `${String(row).padStart(3, '0')}-${String(row * 2).padStart(2, '0')}-${String(row * 3).padStart(4, '0')}`;
            break;
        }
      } else if (includesLongText && col === columns - 1) {
        // Add long text field for sentiment testing
        record[fieldName] = generateLargeTextArray(1, 200)[0];
      } else {
        // Regular data
        switch (col % 4) {
          case 0:
            record[fieldName] = `id_${row}`;
            break;
          case 1:
            record[fieldName] = Math.floor(Math.random() * 1000);
            break;
          case 2:
            record[fieldName] = (Math.random() * 100).toFixed(2);
            break;
          case 3:
            record[fieldName] = Math.random() > 0.5;
            break;
        }
      }
    }
    
    dataset.push(record);
  }
  
  return dataset;
}

// =============================================================================
// Performance Monitoring Utilities
// =============================================================================

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart: number;
  memoryEnd?: number;
  memoryDelta?: number;
  operations: number;
  operationsPerSecond?: number;
}

export class PerformanceTimer {
  private metrics: PerformanceMetrics;
  
  constructor(operations: number = 1) {
    this.metrics = {
      startTime: performance.now(),
      memoryStart: this.getMemoryUsage(),
      operations
    };
  }
  
  stop(): PerformanceMetrics {
    this.metrics.endTime = performance.now();
    this.metrics.memoryEnd = this.getMemoryUsage();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    this.metrics.memoryDelta = this.metrics.memoryEnd - this.metrics.memoryStart;
    this.metrics.operationsPerSecond = this.metrics.operations / (this.metrics.duration / 1000);
    
    return this.metrics;
  }
  
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }
}

// =============================================================================
// Test Data Size Configurations
// =============================================================================

export const TEST_DATA_SIZES = {
  unit: {
    rows: 10,
    texts: 5,
    fileSize: 1024 // 1KB
  },
  integration: {
    rows: 1000,
    texts: 100,
    fileSize: 1024 * 100 // 100KB
  },
  performance: {
    rows: 10000,
    texts: 1000,
    fileSize: 1024 * 1024 // 1MB
  },
  stress: {
    rows: 100000,
    texts: 10000,
    fileSize: 1024 * 1024 * 10 // 10MB
  },
  extreme: {
    rows: 1000000,
    texts: 100000,
    fileSize: 1024 * 1024 * 100 // 100MB
  }
};

// =============================================================================
// Network Simulation Data
// =============================================================================

export const NETWORK_CONDITIONS = {
  excellent: {
    latency: 10, // 10ms
    bandwidth: 1000, // 1000 Mbps
    packetLoss: 0 // 0%
  },
  good: {
    latency: 50, // 50ms
    bandwidth: 100, // 100 Mbps
    packetLoss: 0.1 // 0.1%
  },
  fair: {
    latency: 100, // 100ms
    bandwidth: 10, // 10 Mbps
    packetLoss: 0.5 // 0.5%
  },
  poor: {
    latency: 300, // 300ms
    bandwidth: 1, // 1 Mbps
    packetLoss: 2 // 2%
  },
  mobile: {
    latency: 200, // 200ms
    bandwidth: 5, // 5 Mbps
    packetLoss: 1 // 1%
  }
};

// =============================================================================
// Concurrency Test Patterns
// =============================================================================

export const CONCURRENCY_PATTERNS = {
  sequential: {
    name: 'Sequential Processing',
    concurrent: 1,
    delay: 0
  },
  lowConcurrency: {
    name: 'Low Concurrency',
    concurrent: 5,
    delay: 100
  },
  mediumConcurrency: {
    name: 'Medium Concurrency',
    concurrent: 10,
    delay: 50
  },
  highConcurrency: {
    name: 'High Concurrency',
    concurrent: 20,
    delay: 10
  },
  maxConcurrency: {
    name: 'Maximum Concurrency',
    concurrent: 100,
    delay: 0
  }
};

// =============================================================================
// Export Performance Test Utilities
// =============================================================================

export const PERFORMANCE_TEST_UTILS = {
  generateLargeCSV,
  generateLargeTextArray,
  generateLargeDataset,
  PerformanceTimer
};

export const PERFORMANCE_EXPECTATIONS = {
  benchmarks: PERFORMANCE_BENCHMARKS,
  memory: MEMORY_BENCHMARKS,
  load: LOAD_TEST_SCENARIOS,
  dataSizes: TEST_DATA_SIZES,
  network: NETWORK_CONDITIONS,
  concurrency: CONCURRENCY_PATTERNS
};