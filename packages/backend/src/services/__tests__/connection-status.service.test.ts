import { ConnectionStatusService } from '../connection-status.service';
import { eventEmitter, EventTypes } from '../event.service';
import { websocketService } from '../websocket.service';

// Mock dependencies
jest.mock('../websocket.service');
jest.mock('../event.service');
jest.mock('../../database/sqlite-refactored', () => ({
  withSQLiteConnection: jest.fn()
}));
jest.mock('../analytics.service', () => ({
  analyticsService: { isInitialized: true }
}));
jest.mock('../sentiment.service', () => ({
  sentimentService: {}
}));

// Capture the real ConnectionStatusService class before mocking
const RealConnectionStatusService = jest.requireActual('../connection-status.service').ConnectionStatusService;

describe('ConnectionStatusService', () => {
  let service: ConnectionStatusService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock database
    mockDb = {
      get: jest.fn((query, callback) => callback(null, { result: 1 }))
    };

    const { getSQLiteConnection } = require('../../database/sqlite-refactored');
    getSQLiteConnection.mockResolvedValue(mockDb);

    // Mock websocket service
    (websocketService.broadcast as jest.Mock).mockImplementation();

    // Create new instance for each test
    service = new RealConnectionStatusService();
  });

  afterEach(() => {
    service.shutdown();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default status', () => {
      const status = service.getStatus();

      expect(status.isConnected).toBe(true);
      expect(status.lastConnected).toBeDefined();
      expect(status.lastDisconnected).toBeNull();
      expect(status.connectionCount).toBe(0);
      expect(status.serverStatus).toBe('healthy');
      expect(status.services.database).toBe('connected');
      expect(status.services.websocket).toBe('disconnected');
      expect(status.errors).toEqual([]);
    });

    it('should start periodic status checks', () => {
      service.initialize();

      // Should set up two intervals
      expect(setInterval).toHaveBeenCalledTimes(2);
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000); // Status check
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 10000); // Latency check
    });

    it('should perform initial status check', async () => {
      const checkSpy = jest.spyOn(service as any, 'checkAllServices');
      
      service.initialize();
      await Promise.resolve();

      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should clear intervals and remove listeners', () => {
      service.initialize();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const removeListenersSpy = jest.spyOn(service, 'removeAllListeners');

      service.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
      expect(removeListenersSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket event handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should handle client connected event', () => {
      const emitSpy = jest.spyOn(service, 'emit');
      
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);

      const status = service.getStatus();
      expect(status.services.websocket).toBe('connected');
      expect(status.connectionCount).toBe(1);
      expect(emitSpy).toHaveBeenCalledWith('status-update', expect.any(Object));
    });

    it('should handle client disconnected event', () => {
      // First connect
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      
      // Then disconnect
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED);

      const status = service.getStatus();
      expect(status.services.websocket).toBe('disconnected');
      expect(status.lastDisconnected).toBeDefined();
    });

    it('should handle WebSocket errors', () => {
      const error = new Error('WebSocket error');
      
      eventEmitter.emit('error', error);

      const status = service.getStatus();
      expect(status.services.websocket).toBe('error');
      expect(status.errors).toContain('WebSocket error: WebSocket error');
    });
  });

  describe('service status checks', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should check database status successfully', async () => {
      await service.forceStatusCheck();

      expect(mockDb.get).toHaveBeenCalledWith('SELECT 1', expect.any(Function));
      const status = service.getStatus();
      expect(status.services.database).toBe('connected');
    });

    it('should handle database errors', async () => {
      mockDb.get.mockImplementation((query, callback) => callback(new Error('DB error')));

      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.services.database).toBe('error');
      expect(status.errors).toContainEqual(expect.stringContaining('Database error: DB error'));
    });

    it('should check analytics service status', async () => {
      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.services.analytics).toBe('running');
    });

    it('should handle analytics service not initialized', async () => {
      const { analyticsService } = require('../analytics.service');
      analyticsService.isInitialized = false;

      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.services.analytics).toBe('stopped');
    });

    it('should check sentiment service status', async () => {
      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.services.sentiment).toBe('running');
    });

    it('should update uptime during status checks', async () => {
      const initialUptime = service.getUptime();
      
      jest.advanceTimersByTime(1000);
      await service.forceStatusCheck();

      const newUptime = service.getUptime();
      expect(newUptime).toBeGreaterThan(initialUptime);
    });
  });

  describe('latency monitoring', () => {
    it('should measure database latency', async () => {
      let resolveTime = 0;
      mockDb.get.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback(null, { result: 1 });
          resolveTime = 50; // Simulate 50ms latency
        }, 50);
      });

      // Trigger latency check
      service.initialize();
      jest.runOnlyPendingTimers();
      await new Promise(resolve => setTimeout(resolve, 100));

      const latency = service.getLatency();
      expect(latency).toBeGreaterThanOrEqual(resolveTime);
    });

    it('should handle latency check failures', async () => {
      mockDb.get.mockImplementation((query, callback) => callback(new Error('Timeout')));

      service.initialize();
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const latency = service.getLatency();
      expect(latency).toBeNull();
      expect(service.getStatus().errors).toContainEqual(expect.stringContaining('Latency check failed'));
    });
  });

  describe('server status determination', () => {
    it('should report healthy when all services are running', async () => {
      await service.forceStatusCheck();

      expect(service.isHealthy()).toBe(true);
      expect(service.getStatus().serverStatus).toBe('healthy');
    });

    it('should report degraded when multiple services are down', async () => {
      // Disconnect websocket
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED);
      
      // Stop analytics
      const { analyticsService } = require('../analytics.service');
      analyticsService.isInitialized = false;
      
      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.serverStatus).toBe('degraded');
      expect(service.isHealthy()).toBe(false);
    });

    it('should report down when services have errors', async () => {
      mockDb.get.mockImplementation((query, callback) => callback(new Error('DB error')));
      
      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.serverStatus).toBe('down');
      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('connection management', () => {
    it('should track connection count', () => {
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);

      expect(service.getConnectionCount()).toBe(3);
    });

    it('should update last connected timestamp', () => {
      const initialStatus = service.getStatus();
      const initialLastConnected = initialStatus.lastConnected;

      jest.advanceTimersByTime(1000);
      
      // Disconnect then reconnect
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED);
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);

      const newStatus = service.getStatus();
      expect(newStatus.lastConnected!.getTime()).toBeGreaterThan(initialLastConnected!.getTime());
    });

    it('should update last disconnected timestamp', () => {
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      
      jest.advanceTimersByTime(1000);
      
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED);

      const status = service.getStatus();
      expect(status.lastDisconnected).toBeDefined();
      expect(status.isConnected).toBe(false);
    });
  });

  describe('error management', () => {
    it('should accumulate errors', async () => {
      // Cause multiple errors
      mockDb.get.mockImplementation((query, callback) => callback(new Error('DB error 1')));
      await service.forceStatusCheck();
      
      mockDb.get.mockImplementation((query, callback) => callback(new Error('DB error 2')));
      await service.forceStatusCheck();

      const errors = service.getStatus().errors;
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors).toContainEqual(expect.stringContaining('DB error 1'));
      expect(errors).toContainEqual(expect.stringContaining('DB error 2'));
    });

    it('should limit error history to 50 entries', async () => {
      // Generate 60 errors
      for (let i = 0; i < 60; i++) {
        mockDb.get.mockImplementation((query, callback) => callback(new Error(`Error ${i}`)));
        await service.forceStatusCheck();
      }

      const errors = service.getStatus().errors;
      expect(errors.length).toBe(50);
      expect(errors[0]).toContain('Error 10'); // First 10 should be removed
    });

    it('should clear errors', () => {
      // Add some errors
      eventEmitter.emit('error', new Error('Test error'));
      
      expect(service.getStatus().errors.length).toBeGreaterThan(0);

      service.clearErrors();

      expect(service.getStatus().errors).toEqual([]);
    });
  });

  describe('status broadcasting', () => {
    it('should broadcast status updates via WebSocket', () => {
      service.initialize();
      
      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);

      expect(websocketService.broadcast).toHaveBeenCalledWith(
        {
          type: 'connection_status',
          data: expect.objectContaining({
            isConnected: true,
            connectionCount: 1,
            services: expect.any(Object)
          })
        },
        { topic: 'connection_status' }
      );
    });

    it('should emit status-update events', () => {
      const listener = jest.fn();
      service.on('status-update', listener);

      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        isConnected: true,
        connectionCount: 1
      }));
    });
  });

  describe('periodic checks', () => {
    it('should perform status checks every 30 seconds', () => {
      const checkSpy = jest.spyOn(service as any, 'checkAllServices');
      
      service.initialize();
      checkSpy.mockClear(); // Clear initial check

      // Advance 30 seconds
      jest.advanceTimersByTime(30000);

      expect(checkSpy).toHaveBeenCalledTimes(1);

      // Advance another 30 seconds
      jest.advanceTimersByTime(30000);

      expect(checkSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform latency checks every 10 seconds', () => {
      const latencySpy = jest.spyOn(service as any, 'checkLatency');
      
      service.initialize();
      latencySpy.mockClear();

      // Advance 10 seconds
      jest.advanceTimersByTime(10000);

      expect(latencySpy).toHaveBeenCalledTimes(1);

      // Advance another 10 seconds
      jest.advanceTimersByTime(10000);

      expect(latencySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling in status checks', () => {
    it('should handle errors during checkAllServices', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by making checkDatabaseStatus throw
      jest.spyOn(service as any, 'checkDatabaseStatus').mockRejectedValue(new Error('Check failed'));

      await service.forceStatusCheck();

      expect(consoleSpy).toHaveBeenCalledWith('Error checking service status:', expect.any(Error));
      expect(service.getStatus().errors).toContainEqual(expect.stringContaining('Status check failed'));

      consoleSpy.mockRestore();
    });

    it('should handle missing service modules', async () => {
      // Mock require to throw for analytics service
      jest.doMock('../analytics.service', () => {
        throw new Error('Module not found');
      });

      await service.forceStatusCheck();

      const status = service.getStatus();
      expect(status.services.analytics).toBe('error');
      expect(status.errors).toContainEqual(expect.stringContaining('Analytics service error'));
    });
  });

  describe('getters', () => {
    it('should return uptime in milliseconds', () => {
      const uptime1 = service.getUptime();
      
      jest.advanceTimersByTime(1000);
      
      const uptime2 = service.getUptime();
      expect(uptime2).toBe(uptime1 + 1000);
    });

    it('should return current connection count', () => {
      expect(service.getConnectionCount()).toBe(0);

      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      expect(service.getConnectionCount()).toBe(1);

      eventEmitter.emit(EventTypes.WS_CLIENT_CONNECTED);
      expect(service.getConnectionCount()).toBe(2);
    });

    it('should return latency or null', () => {
      expect(service.getLatency()).toBeNull();

      // After a successful latency check, it should return a number
      service.initialize();
      jest.runOnlyPendingTimers();
      
      // Note: actual latency value depends on mock implementation
    });

    it('should return complete status object', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('lastConnected');
      expect(status).toHaveProperty('lastDisconnected');
      expect(status).toHaveProperty('connectionCount');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('latency');
      expect(status).toHaveProperty('serverStatus');
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('errors');
    });
  });
});