import { MonitoringService } from '../monitoring.service';
import { JobQueueService } from '../job-queue.service';
import { metricsService } from '../metrics.service';

// Mock dependencies
jest.mock('../job-queue.service');
jest.mock('../metrics.service');

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockJobQueueService: jest.Mocked<JobQueueService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJobQueueService = new JobQueueService() as jest.Mocked<JobQueueService>;
  });

  describe('Queue Depth Metrics', () => {
    test('should track queue depth metrics', async () => {
      // RED: This test should fail because MonitoringService doesn't exist yet
      monitoringService = new MonitoringService({ jobQueueService: mockJobQueueService });
      
      // Simulate queue state
      const mockQueueMetrics = {
        pending: 10,
        running: 3,
        completed: 50,
        failed: 2
      };
      
      mockJobQueueService.getQueueMetrics = jest.fn().mockReturnValue(mockQueueMetrics);
      
      // Act
      const metrics = await monitoringService.getQueueDepthMetrics();
      
      // Assert
      expect(metrics).toEqual({
        depth: 10, // pending jobs
        running: 3,
        completed: 50,
        failed: 2,
        timestamp: expect.any(Date)
      });
      
      expect(mockJobQueueService.getQueueMetrics).toHaveBeenCalled();
    });

    test('should emit alerts when queue depth exceeds threshold', async () => {
      // RED: This test should fail - testing alert functionality
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        queueDepthThreshold: 100
      });
      
      const alertListener = jest.fn();
      monitoringService.on('alert:queue_depth_high', alertListener);
      
      // Simulate high queue depth
      mockJobQueueService.getQueueMetrics = jest.fn().mockReturnValue({
        pending: 150,
        running: 5,
        completed: 100,
        failed: 3
      });
      
      // Act
      await monitoringService.checkQueueDepth();
      
      // Assert
      expect(alertListener).toHaveBeenCalledWith({
        type: 'queue_depth_high',
        severity: 'warning',
        message: 'Queue depth (150) exceeds threshold (100)',
        metrics: {
          depth: 150,
          threshold: 100,
          timestamp: expect.any(Date)
        }
      });
    });

    test('should continuously monitor queue depth at specified interval', async () => {
      // RED: This test should fail - testing continuous monitoring
      jest.useFakeTimers();
      
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        monitoringInterval: 5000 // 5 seconds
      });
      
      const mockGetQueueMetrics = jest.fn().mockReturnValue({
        pending: 5,
        running: 2,
        completed: 20,
        failed: 0
      });
      mockJobQueueService.getQueueMetrics = mockGetQueueMetrics;
      
      // Start monitoring
      monitoringService.startMonitoring();
      
      // Fast-forward time by 15 seconds (3 intervals)
      jest.advanceTimersByTime(15000);
      
      // Assert - 1 initial call + 3 interval calls = 4 total
      expect(mockGetQueueMetrics).toHaveBeenCalledTimes(4);
      
      // Stop monitoring
      monitoringService.stopMonitoring();
      
      // Fast-forward time and ensure no more calls
      jest.advanceTimersByTime(10000);
      expect(mockGetQueueMetrics).toHaveBeenCalledTimes(4);
      
      jest.useRealTimers();
    });
  });

  describe('API Response Time Monitoring', () => {
    test('should track API response times and alert on high latency', async () => {
      // RED: This test should fail - MonitoringService doesn't have API monitoring yet
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        apiResponseTimeThreshold: 2000 // 2 seconds
      });
      
      const alertListener = jest.fn();
      monitoringService.on('alert:api_response_time_high', alertListener);
      
      // Simulate high API response time
      await monitoringService.recordApiResponse('/api/analyze', 3500, true);
      
      // Assert
      expect(alertListener).toHaveBeenCalledWith({
        type: 'api_response_time_high',
        severity: 'warning',
        message: 'API response time (3500ms) exceeds threshold (2000ms) for /api/analyze',
        metrics: {
          endpoint: '/api/analyze',
          responseTime: 3500,
          threshold: 2000,
          timestamp: expect.any(Date)
        }
      });
    });

    test('should calculate average API response times', async () => {
      // RED: This test should fail - testing average calculation
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService
      });
      
      // Record multiple API responses
      await monitoringService.recordApiResponse('/api/analyze', 1000, true);
      await monitoringService.recordApiResponse('/api/analyze', 2000, true);
      await monitoringService.recordApiResponse('/api/analyze', 1500, true);
      
      const avgResponseTime = await monitoringService.getAverageApiResponseTime('/api/analyze');
      
      expect(avgResponseTime).toBe(1500); // (1000 + 2000 + 1500) / 3
    });

    test('should track API error rates and alert on high error percentage', async () => {
      // RED: This test should fail - testing error rate monitoring
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        apiErrorRateThreshold: 0.1 // 10% error rate
      });
      
      const alertListener = jest.fn();
      monitoringService.on('alert:api_error_rate_high', alertListener);
      
      // Simulate API calls with errors
      await monitoringService.recordApiResponse('/api/analyze', 500, true);
      await monitoringService.recordApiResponse('/api/analyze', 600, false); // error
      await monitoringService.recordApiResponse('/api/analyze', 550, true);
      await monitoringService.recordApiResponse('/api/analyze', 700, false); // error
      await monitoringService.recordApiResponse('/api/analyze', 450, true);
      await monitoringService.recordApiResponse('/api/analyze', 500, false); // error
      
      // 3 errors out of 6 requests = 50% error rate
      await monitoringService.checkApiErrorRate();
      
      expect(alertListener).toHaveBeenCalledWith({
        type: 'api_error_rate_high',
        severity: 'critical',
        message: 'API error rate (50.0%) exceeds threshold (10.0%)',
        metrics: {
          errorRate: 0.5,
          threshold: 0.1,
          totalRequests: 6,
          failedRequests: 3,
          timestamp: expect.any(Date)
        }
      });
    });
  });

  describe('Resource Usage Monitoring', () => {
    test('should monitor CPU usage and alert on high usage', async () => {
      // RED: This test should fail - resource monitoring not implemented
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        cpuUsageThreshold: 80 // 80% CPU usage
      });
      
      const alertListener = jest.fn();
      monitoringService.on('alert:cpu_usage_high', alertListener);
      
      // Mock high CPU usage from metrics service
      const mockMetrics = {
        cpu: { usage: 95, loadAverage: [3.5, 2.8, 2.1] },
        memory: { usage: 45, total: 16000000000, used: 7200000000, free: 8800000000 },
        process: { uptime: 3600, memoryUsage: {} as any, cpuUsage: {} as any }
      };
      
      await monitoringService.checkResourceUsage(mockMetrics);
      
      expect(alertListener).toHaveBeenCalledWith({
        type: 'cpu_usage_high',
        severity: 'warning',
        message: 'CPU usage (95%) exceeds threshold (80%)',
        metrics: {
          cpuUsage: 95,
          threshold: 80,
          loadAverage: [3.5, 2.8, 2.1],
          timestamp: expect.any(Date)
        }
      });
    });

    test('should monitor memory usage and alert on high usage', async () => {
      // RED: This test should fail - memory monitoring not implemented
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        memoryUsageThreshold: 80 // 80% memory usage
      });
      
      const alertListener = jest.fn();
      monitoringService.on('alert:memory_usage_high', alertListener);
      
      // Mock high memory usage
      const mockMetrics = {
        cpu: { usage: 45, loadAverage: [1.5, 1.2, 1.0] },
        memory: { usage: 85, total: 16000000000, used: 13600000000, free: 2400000000 },
        process: { uptime: 3600, memoryUsage: {} as any, cpuUsage: {} as any }
      };
      
      await monitoringService.checkResourceUsage(mockMetrics);
      
      expect(alertListener).toHaveBeenCalledWith({
        type: 'memory_usage_high',
        severity: 'warning',
        message: 'Memory usage (85%) exceeds threshold (80%)',
        metrics: {
          memoryUsage: 85,
          threshold: 80,
          totalMemory: 16000000000,
          usedMemory: 13600000000,
          freeMemory: 2400000000,
          timestamp: expect.any(Date)
        }
      });
    });

    test('should integrate with metrics service for resource monitoring', async () => {
      // RED: This test should fail - integration not implemented
      const mockMetricsService = {
        getCurrentMetrics: jest.fn().mockReturnValue({
          cpu: { usage: 75, loadAverage: [2.0, 1.8, 1.5] },
          memory: { usage: 60, total: 16000000000, used: 9600000000, free: 6400000000 },
          process: { uptime: 7200, memoryUsage: {} as any, cpuUsage: {} as any },
          database: { connections: 10, queries: 1000, avgResponseTime: 50 },
          queue: { pending: 20, running: 5, completed: 100, failed: 2, throughput: 10 },
          api: { requests: 5000, errors: 50, avgResponseTime: 150, activeConnections: 25 }
        }),
        recordJobProcessing: jest.fn(),
        recordApiRequest: jest.fn()
      };
      
      monitoringService = new MonitoringService({ 
        jobQueueService: mockJobQueueService,
        metricsService: mockMetricsService as any
      });
      
      await monitoringService.startResourceMonitoring();
      
      // Wait a bit for monitoring to run
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockMetricsService.getCurrentMetrics).toHaveBeenCalled();
      
      await monitoringService.stopResourceMonitoring();
    });
  });
});