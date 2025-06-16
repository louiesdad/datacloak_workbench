import { EnhancedExportService } from '../enhanced-export.service';

describe('Memory Monitoring', () => {
  let service: EnhancedExportService;

  beforeEach(() => {
    service = new EnhancedExportService();
  });

  it('should get memory statistics', () => {
    const memoryStats = service.getMemoryStats();
    
    expect(memoryStats).toHaveProperty('heapUsed');
    expect(memoryStats).toHaveProperty('heapTotal');
    expect(memoryStats).toHaveProperty('external');
    expect(memoryStats).toHaveProperty('rss');
    expect(memoryStats).toHaveProperty('peakMemoryUsage');
    expect(memoryStats).toHaveProperty('gcCollections');
    expect(memoryStats).toHaveProperty('averageMemoryUsage');
    
    expect(typeof memoryStats.heapUsed).toBe('number');
    expect(memoryStats.heapUsed).toBeGreaterThan(0);
  });

  it('should check if memory usage is safe', () => {
    const isSafe = service.isMemoryUsageSafe();
    expect(typeof isSafe).toBe('boolean');
  });

  it('should get memory thresholds', () => {
    const thresholds = service.getMemoryThresholds();
    
    expect(thresholds).toHaveProperty('warningThreshold');
    expect(thresholds).toHaveProperty('criticalThreshold');
    expect(thresholds).toHaveProperty('gcThreshold');
    
    expect(typeof thresholds.warningThreshold).toBe('number');
    expect(typeof thresholds.criticalThreshold).toBe('number');
    expect(typeof thresholds.gcThreshold).toBe('number');
  });

  it('should force garbage collection if needed', () => {
    const result = service.forceGarbageCollection();
    expect(typeof result).toBe('boolean');
  });

  it('should handle memory monitoring during export initialization', () => {
    // This test ensures the memory monitor is properly initialized
    expect(() => service.getMemoryStats()).not.toThrow();
    expect(() => service.isMemoryUsageSafe()).not.toThrow();
    expect(() => service.getMemoryThresholds()).not.toThrow();
  });
});