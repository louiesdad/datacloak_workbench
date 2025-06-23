import { dashboardBroadcastingService, DashboardBroadcastingService } from '../dashboard-broadcasting.service';
import { websocketService } from '../websocket.service';
import { eventEmitter, EventTypes } from '../event.service';
import { getJobQueueService } from '../job-queue.factory';
import { getCacheService } from '../cache.service';

// Mock dependencies
jest.mock('../websocket.service');
jest.mock('../job-queue.factory');
jest.mock('../cache.service');

describe('DashboardBroadcastingService', () => {
  let service: DashboardBroadcastingService;
  const mockClientId = 'test-client-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardBroadcastingService();
    
    // Mock WebSocket service
    (websocketService.sendToClient as jest.Mock).mockReturnValue(true);
    (websocketService.subscribeToTopic as jest.Mock).mockReturnValue(true);
    (websocketService.unsubscribeFromTopic as jest.Mock).mockReturnValue(true);
    
    // Mock job queue service
    (getJobQueueService as jest.Mock).mockReturnValue({
      getStats: jest.fn().mockReturnValue({
        total: 10,
        pending: 5,
        running: 2,
        completed: 2,
        failed: 1,
        cancelled: 0
      }),
      getJobs: jest.fn().mockReturnValue([
        {
          id: 'job-1',
          type: 'sentiment_analysis',
          status: 'running',
          progress: 50,
          startedAt: new Date()
        }
      ])
    });
    
    // Mock cache service
    (getCacheService as jest.Mock).mockReturnValue({
      getStats: jest.fn().mockResolvedValue({
        hitRate: 0.85,
        size: 100,
        memoryUsage: 1024 * 1024
      })
    });
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('Dashboard Subscription', () => {
    test('should create dashboard subscription', () => {
      service.subscribeToDashboard(mockClientId, {
        metrics: ['cpu', 'memory'],
        updateInterval: 1000
      });

      expect(websocketService.subscribeToTopic).toHaveBeenCalledWith(
        mockClientId,
        'dashboard',
        expect.any(Object)
      );
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'dashboard_subscribed',
          data: expect.objectContaining({
            metrics: ['cpu', 'memory'],
            updateInterval: 1000
          })
        })
      );
    });

    test('should send initial dashboard state', () => {
      service.subscribeToDashboard(mockClientId);

      // Should send initial state
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'dashboard_initial_state',
          data: expect.objectContaining({
            queueStats: expect.any(Object),
            activeJobs: expect.any(Array),
            costSummary: expect.any(Object),
            timestamp: expect.any(Date)
          })
        })
      );
    });

    test('should unsubscribe from dashboard', () => {
      service.subscribeToDashboard(mockClientId);
      service.unsubscribeFromDashboard(mockClientId);

      expect(websocketService.unsubscribeFromTopic).toHaveBeenCalledWith(
        mockClientId,
        'dashboard'
      );
    });

    test('should handle client disconnect', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED, { clientId: mockClientId });
      
      // Verify cleanup
      expect(websocketService.unsubscribeFromTopic).toHaveBeenCalledWith(
        mockClientId,
        'dashboard'
      );
    });
  });

  describe('Job Progress Broadcasting', () => {
    test('should broadcast job creation', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'job-123',
        type: 'sentiment_analysis',
        status: 'created'
      });

      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'job_progress_update',
          data: expect.objectContaining({
            jobId: 'job-123',
            status: 'created',
            progress: 0
          })
        })
      );
    });

    test('should broadcast job progress', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit(EventTypes.JOB_PROGRESS, {
        jobId: 'job-123',
        type: 'sentiment_analysis',
        status: 'running',
        progress: 50,
        message: 'Processing batch 5/10'
      });

      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'job_progress_update',
          data: expect.objectContaining({
            progress: 50,
            message: 'Processing batch 5/10'
          })
        })
      );
    });

    test('should broadcast job completion', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit(EventTypes.JOB_COMPLETE, {
        jobId: 'job-123',
        type: 'sentiment_analysis',
        result: { processed: 100 }
      });

      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'job_progress_update',
          data: expect.objectContaining({
            status: 'completed',
            progress: 100
          })
        })
      );
    });

    test('should broadcast job failure', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit(EventTypes.JOB_FAILED, {
        jobId: 'job-123',
        type: 'sentiment_analysis',
        error: 'Processing error'
      });

      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'job_progress_update',
          data: expect.objectContaining({
            status: 'failed',
            message: 'Processing error'
          })
        })
      );
    });

    test('should apply job type filters', () => {
      service.subscribeToDashboard(mockClientId, {
        filters: { jobTypes: ['sentiment_analysis'] }
      });
      
      // This should be broadcast
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'job-1',
        type: 'sentiment_analysis'
      });
      
      // This should NOT be broadcast
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'job-2',
        type: 'file_processing'
      });

      const jobUpdateCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'job_progress_update');
      
      expect(jobUpdateCalls).toHaveLength(1);
      expect(jobUpdateCalls[0][1].data.jobId).toBe('job-1');
    });
  });

  describe('Cost Tracking and Broadcasting', () => {
    test('should track and broadcast cost updates', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit('cost:incurred', {
        service: 'openai',
        operation: 'sentiment_analysis',
        cost: 0.05,
        currency: 'USD',
        units: 100,
        unitType: 'tokens',
        timestamp: new Date()
      });

      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'cost_update',
          data: expect.objectContaining({
            service: 'openai',
            cost: 0.05
          })
        })
      );
    });

    test('should send cost summary', () => {
      service.subscribeToDashboard(mockClientId);
      
      // Incur multiple costs
      service.recordCost('openai', 'sentiment', 0.05, 100, 'tokens');
      service.recordCost('openai', 'embedding', 0.02, 50, 'tokens');
      service.recordCost('datacloak', 'pii_scan', 0.01, 1, 'scan');

      // Check cost summary was sent
      const summaryCall = (websocketService.sendToClient as jest.Mock).mock.calls
        .find(call => call[1].type === 'cost_summary');
      
      expect(summaryCall).toBeDefined();
      expect(summaryCall[1].data.total).toBe(0.08);
      expect(summaryCall[1].data.byService).toEqual({
        openai: 0.07,
        datacloak: 0.01
      });
    });

    test('should apply service filters to cost updates', () => {
      service.subscribeToDashboard(mockClientId, {
        filters: { services: ['openai'] }
      });
      
      // This should be broadcast
      service.recordCost('openai', 'sentiment', 0.05, 100, 'tokens');
      
      // This should NOT be broadcast
      service.recordCost('datacloak', 'pii_scan', 0.01, 1, 'scan');

      const costUpdateCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'cost_update');
      
      expect(costUpdateCalls).toHaveLength(1);
      expect(costUpdateCalls[0][1].data.service).toBe('openai');
    });
  });

  describe('System Metrics Broadcasting', () => {
    test('should broadcast system metrics periodically', async () => {
      jest.useFakeTimers();
      
      service.subscribeToDashboard(mockClientId);
      
      // Fast-forward time to trigger metrics collection
      jest.advanceTimersByTime(5000);
      
      // Wait for async operations
      await Promise.resolve();
      
      // Check system metrics were broadcast
      const metricsCall = (websocketService.sendToClient as jest.Mock).mock.calls
        .find(call => call[1].type === 'system_metrics_update');
      
      expect(metricsCall).toBeDefined();
      
      jest.useRealTimers();
    });

    test('should apply metric category filters', async () => {
      jest.useFakeTimers();
      
      service.subscribeToDashboard(mockClientId, {
        filters: { metricCategories: ['cpu'] }
      });
      
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      
      const metricsCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'system_metrics_update');
      
      // Should only receive CPU metrics
      const cpuMetrics = metricsCalls.filter(call => call[1].data.category === 'cpu');
      expect(cpuMetrics.length).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });
  });

  describe('Custom Metrics', () => {
    test('should update custom metrics', () => {
      service.subscribeToDashboard(mockClientId, {
        metrics: ['custom_metric']
      });
      
      service.updateMetric('custom_metric', 42, 'units');
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'metric_update',
          data: expect.objectContaining({
            name: 'custom_metric',
            value: 42,
            unit: 'units'
          })
        })
      );
    });

    test('should respect metric subscription filters', () => {
      service.subscribeToDashboard(mockClientId, {
        metrics: ['metric_a']
      });
      
      service.updateMetric('metric_a', 1);
      service.updateMetric('metric_b', 2);
      
      const metricCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'metric_update');
      
      expect(metricCalls).toHaveLength(1);
      expect(metricCalls[0][1].data.name).toBe('metric_a');
    });
  });

  describe('Periodic Updates', () => {
    test('should send periodic updates when enabled', async () => {
      jest.useFakeTimers();
      
      service.subscribeToDashboard(mockClientId, {
        updateInterval: 1000
      });
      
      // Add some metrics
      service.updateMetric('test_metric', 100);
      
      // Advance time
      jest.advanceTimersByTime(1100);
      
      const updateCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'dashboard_metrics_update');
      
      expect(updateCalls.length).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });
  });

  describe('WebSocket Message Handling', () => {
    test('should handle subscribe_dashboard message', () => {
      eventEmitter.emit('ws:message', {
        clientId: mockClientId,
        message: {
          type: 'subscribe_dashboard',
          data: {
            metrics: ['cpu', 'memory'],
            updateInterval: 2000
          }
        }
      });
      
      expect(websocketService.subscribeToTopic).toHaveBeenCalledWith(
        mockClientId,
        'dashboard',
        expect.any(Object)
      );
    });

    test('should handle update_dashboard_filters message', () => {
      service.subscribeToDashboard(mockClientId);
      
      eventEmitter.emit('ws:message', {
        clientId: mockClientId,
        message: {
          type: 'update_dashboard_filters',
          data: {
            filters: { jobTypes: ['sentiment_analysis'] }
          }
        }
      });
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'dashboard_filters_updated'
        })
      );
    });
  });

  describe('Dashboard Statistics', () => {
    test('should provide dashboard statistics', () => {
      service.subscribeToDashboard('client1');
      service.subscribeToDashboard('client2');
      
      service.updateMetric('metric1', 1);
      service.updateMetric('metric2', 2);
      
      service.recordCost('openai', 'api', 0.10, 100, 'tokens');
      
      const stats = service.getDashboardStats();
      
      expect(stats).toEqual({
        activeSubscriptions: 2,
        totalMetrics: expect.any(Number),
        totalCost: 0.10,
        activeJobs: 2
      });
    });
  });
});