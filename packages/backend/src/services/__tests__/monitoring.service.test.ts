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
});