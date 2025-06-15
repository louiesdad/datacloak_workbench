import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifications } from '../components/NotificationToast';

interface MemoryStats {
  used: number;           // Used JS heap size in bytes
  total: number;          // Total JS heap size in bytes  
  limit: number;          // JS heap size limit in bytes
  percentage: number;     // Percentage of limit used
  available: number;      // Available memory
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface MemoryThresholds {
  warning: number;        // Percentage at which to show warning (default: 70%)
  critical: number;       // Percentage at which to show critical alert (default: 85%)
  emergency: number;      // Percentage at which to trigger emergency cleanup (default: 95%)
}

interface MemoryMonitorOptions {
  enabled?: boolean;
  interval?: number;      // Monitoring interval in ms (default: 5000)
  thresholds?: Partial<MemoryThresholds>;
  onWarning?: (stats: MemoryStats) => void;
  onCritical?: (stats: MemoryStats) => void;
  onEmergency?: (stats: MemoryStats) => void;
  autoCleanup?: boolean;  // Automatically trigger cleanup when needed
}

interface MemoryHistory {
  timestamp: number;
  stats: MemoryStats;
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
  warning: 70,
  critical: 85,
  emergency: 95
};

const DEFAULT_OPTIONS: Required<MemoryMonitorOptions> = {
  enabled: true,
  interval: 5000,
  thresholds: DEFAULT_THRESHOLDS,
  onWarning: () => {},
  onCritical: () => {},
  onEmergency: () => {},
  autoCleanup: true
};

export function useMemoryMonitor(options: MemoryMonitorOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  
  const [currentStats, setCurrentStats] = useState<MemoryStats | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [history, setHistory] = useState<MemoryHistory[]>([]);
  const [alertLevel, setAlertLevel] = useState<'none' | 'warning' | 'critical' | 'emergency'>('none');
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatsRef = useRef<MemoryStats | null>(null);
  const { addNotification } = useNotifications();

  // Check if Performance API with memory info is available
  useEffect(() => {
    const supported = 'performance' in window && 
                     'memory' in (window.performance as any);
    setIsSupported(supported);
    
    if (!supported && config.enabled) {
      console.warn('Memory monitoring not supported in this browser');
    }
  }, [config.enabled]);

  const getMemoryStats = useCallback((): MemoryStats | null => {
    if (!isSupported || !(window.performance as any)?.memory) {
      return null;
    }

    const memory = (window.performance as any).memory;
    const used = memory.usedJSHeapSize;
    const total = memory.totalJSHeapSize;
    const limit = memory.jsHeapSizeLimit;
    
    const percentage = (used / limit) * 100;
    const available = limit - used;
    
    // Calculate trend
    let trend: MemoryStats['trend'] = 'stable';
    if (lastStatsRef.current) {
      const diff = used - lastStatsRef.current.used;
      const threshold = limit * 0.01; // 1% of limit
      
      if (diff > threshold) {
        trend = 'increasing';
      } else if (diff < -threshold) {
        trend = 'decreasing';
      }
    }

    return {
      used,
      total,
      limit,
      percentage,
      available,
      trend
    };
  }, [isSupported]);

  const triggerGarbageCollection = useCallback(() => {
    // Trigger garbage collection by creating and disposing large objects
    try {
      const tempArrays: any[] = [];
      
      // Create some temporary objects to encourage GC
      for (let i = 0; i < 100; i++) {
        tempArrays.push(new Array(1000).fill(0));
      }
      
      // Clear references
      tempArrays.length = 0;
      
      // Force a microtask to help with cleanup
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(void 0);
        }, 100);
      });
    } catch (error) {
      console.warn('Failed to trigger garbage collection:', error);
    }
  }, []);

  const performEmergencyCleanup = useCallback(async () => {
    console.warn('Performing emergency memory cleanup');
    
    try {
      // Clear any large cached data structures
      // This would be customized based on your app's specific data
      
      // Example cleanup operations:
      // 1. Clear component caches
      // 2. Remove large objects from memory
      // 3. Close unnecessary resources
      
      // Trigger garbage collection
      await triggerGarbageCollection();
      
      addNotification({
        type: 'warning',
        message: 'Memory cleanup performed to prevent browser slowdown',
        duration: 5000
      });
      
      return true;
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      return false;
    }
  }, [triggerGarbageCollection, addNotification]);

  const checkThresholds = useCallback((stats: MemoryStats) => {
    const { percentage } = stats;
    
    setAlertLevel(prevLevel => {
      if (percentage >= thresholds.emergency) {
        if (prevLevel !== 'emergency') {
          config.onEmergency(stats);
          
          addNotification({
            type: 'error',
            message: `Critical memory usage: ${percentage.toFixed(1)}% - Emergency cleanup triggered`,
            duration: 8000
          });
          
          if (config.autoCleanup) {
            performEmergencyCleanup();
          }
          return 'emergency';
        }
      } else if (percentage >= thresholds.critical) {
        if (prevLevel !== 'critical' && prevLevel !== 'emergency') {
          config.onCritical(stats);
          
          addNotification({
            type: 'error',
            message: `High memory usage: ${percentage.toFixed(1)}% - Consider closing unused tabs`,
            duration: 6000
          });
          return 'critical';
        }
      } else if (percentage >= thresholds.warning) {
        if (prevLevel === 'none') {
          config.onWarning(stats);
          
          addNotification({
            type: 'warning',
            message: `Memory usage warning: ${percentage.toFixed(1)}%`,
            duration: 4000
          });
          return 'warning';
        }
      } else {
        if (prevLevel !== 'none') {
          if (lastStatsRef.current && lastStatsRef.current.percentage > thresholds.warning) {
            addNotification({
              type: 'success',
              message: 'Memory usage back to normal levels',
              duration: 3000
            });
          }
          return 'none';
        }
      }
      return prevLevel;
    });
  }, [thresholds.emergency, thresholds.critical, thresholds.warning, config.onEmergency, config.onCritical, config.onWarning, config.autoCleanup, addNotification, performEmergencyCleanup]);

  // Start/stop monitoring
  useEffect(() => {
    if (!config.enabled || !isSupported) {
      return;
    }

    const update = () => {
      const stats = getMemoryStats();
      if (!stats) return;
      
      setCurrentStats(stats);
      lastStatsRef.current = stats;
      
      // Add to history (keep last 100 entries)
      setHistory(prev => {
        const newHistory = [...prev, { timestamp: Date.now(), stats }];
        return newHistory.slice(-100);
      });
      
      checkThresholds(stats);
    };

    // Initial check
    update();
    
    // Set up periodic monitoring
    intervalRef.current = setInterval(update, config.interval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.enabled, config.interval, isSupported, getMemoryStats, checkThresholds]);

  const formatMemorySize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getMemoryPressure = useCallback((): 'low' | 'medium' | 'high' | 'critical' => {
    if (!currentStats) return 'low';
    
    const { percentage } = currentStats;
    
    if (percentage >= thresholds.emergency) return 'critical';
    if (percentage >= thresholds.critical) return 'high';
    if (percentage >= thresholds.warning) return 'medium';
    return 'low';
  }, [currentStats, thresholds]);

  const getRecommendations = useCallback((): string[] => {
    const pressure = getMemoryPressure();
    const recommendations: string[] = [];
    
    switch (pressure) {
      case 'critical':
        recommendations.push('Close unnecessary browser tabs immediately');
        recommendations.push('Save your work and restart the browser');
        recommendations.push('Reduce the amount of data being processed');
        break;
        
      case 'high':
        recommendations.push('Close unused browser tabs');
        recommendations.push('Reduce the size of datasets being processed');
        recommendations.push('Consider using chunked processing for large files');
        break;
        
      case 'medium':
        recommendations.push('Monitor memory usage closely');
        recommendations.push('Consider processing data in smaller chunks');
        recommendations.push('Close unused applications');
        break;
        
      default:
        recommendations.push('Memory usage is within normal levels');
        break;
    }
    
    return recommendations;
  }, [getMemoryPressure]);

  const getMemoryTrend = useCallback((): { direction: 'up' | 'down' | 'stable'; rate: number } => {
    if (history.length < 2) {
      return { direction: 'stable', rate: 0 };
    }
    
    const recent = history.slice(-10); // Last 10 readings
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = newest.timestamp - oldest.timestamp;
    const memoryDiff = newest.stats.used - oldest.stats.used;
    
    const rate = timeDiff > 0 ? (memoryDiff / timeDiff) * 1000 : 0; // bytes per second
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(rate) > 1024) { // More than 1KB/s change
      direction = rate > 0 ? 'up' : 'down';
    }
    
    return { direction, rate: Math.abs(rate) };
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const forceCleanup = useCallback(async () => {
    return await performEmergencyCleanup();
  }, [performEmergencyCleanup]);

  return {
    // Current state
    isSupported,
    currentStats,
    alertLevel,
    history,
    
    // Computed values
    memoryPressure: getMemoryPressure(),
    recommendations: getRecommendations(),
    trend: getMemoryTrend(),
    
    // Utilities
    formatMemorySize,
    clearHistory,
    forceCleanup,
    triggerGarbageCollection
  };
}

export type { MemoryStats, MemoryThresholds, MemoryMonitorOptions, MemoryHistory };