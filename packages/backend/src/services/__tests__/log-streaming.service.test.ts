import { logStreamingService, LogStreamingService } from '../log-streaming.service';
import { websocketService } from '../websocket.service';
import { eventEmitter, EventTypes } from '../event.service';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('../websocket.service');
jest.mock('fs');

describe('LogStreamingService', () => {
  let service: LogStreamingService;
  const mockClientId = 'test-client-123';
  const mockStreamId = 'test-stream-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LogStreamingService();
    
    // Mock WebSocket service methods
    (websocketService.sendToClient as jest.Mock).mockReturnValue(true);
    (websocketService.subscribeToTopic as jest.Mock).mockReturnValue(true);
    (websocketService.unsubscribeFromTopic as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('Log Capture', () => {
    test('should capture console.log messages', async () => {
      const streamId = service.startStream(mockClientId, { level: 'info' });
      
      // Wait for stream to be ready
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.log('Test log message');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_entry',
          data: expect.objectContaining({
            streamId,
            entry: expect.objectContaining({
              level: 'info',
              message: 'Test log message'
            })
          })
        })
      );
    });

    test('should capture console.error messages', async () => {
      const streamId = service.startStream(mockClientId, { level: 'error' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.error('Test error message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_entry',
          data: expect.objectContaining({
            entry: expect.objectContaining({
              level: 'error',
              message: 'Test error message'
            })
          })
        })
      );
    });

    test('should respect log level filtering', async () => {
      const streamId = service.startStream(mockClientId, { level: 'error' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.info('Info message');
      console.warn('Warning message');
      console.error('Error message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should only receive error message
      const calls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'log_entry');
      
      expect(calls).toHaveLength(1);
      expect(calls[0][1].data.entry.level).toBe('error');
    });
  });

  describe('Stream Management', () => {
    test('should start a log stream', () => {
      const streamId = service.startStream(mockClientId, {
        level: 'info',
        source: 'test-service'
      });
      
      expect(streamId).toBeDefined();
      expect(websocketService.subscribeToTopic).toHaveBeenCalledWith(
        mockClientId,
        'logs',
        { streamId }
      );
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_started'
        })
      );
    });

    test('should stop a log stream', () => {
      const streamId = service.startStream(mockClientId, {});
      const stopped = service.stopStream(streamId);
      
      expect(stopped).toBe(true);
      expect(websocketService.unsubscribeFromTopic).toHaveBeenCalledWith(
        mockClientId,
        'logs'
      );
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_stopped'
        })
      );
    });

    test('should pause and resume a stream', () => {
      const streamId = service.startStream(mockClientId, {});
      
      // Pause
      const paused = service.pauseStream(streamId);
      expect(paused).toBe(true);
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_paused'
        })
      );
      
      // Resume
      const resumed = service.resumeStream(streamId);
      expect(resumed).toBe(true);
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_resumed'
        })
      );
    });

    test('should handle client disconnect', () => {
      const streamId = service.startStream(mockClientId, {});
      
      // Simulate client disconnect
      eventEmitter.emit(EventTypes.WS_CLIENT_DISCONNECTED, { clientId: mockClientId });
      
      // Stream should be stopped
      const streamInfo = service.getStreamInfo(streamId);
      expect(streamInfo).toBeUndefined();
    });
  });

  describe('Historical Logs', () => {
    test('should send historical logs when tail option is set', async () => {
      // Generate some logs first
      console.log('Log 1');
      console.log('Log 2');
      console.log('Log 3');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const streamId = service.startStream(mockClientId, { tail: 2 });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that historical logs were sent
      const historicalCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => 
          call[1].type === 'log_entry' && 
          call[1].data.historical === true
        );
      
      expect(historicalCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('File Tailing', () => {
    test('should tail a log file', async () => {
      const mockLogPath = '/logs/test.log';
      const mockLogContent = 'Log line 1\nLog line 2\n';
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue({
        on: jest.fn(),
        destroy: jest.fn()
      });
      
      const streamId = service.startStream(mockClientId, {
        source: 'file:test.log',
        follow: true
      });
      
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.createReadStream).toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const streamId = service.startStream(mockClientId, {
        source: 'file:nonexistent.log',
        follow: true
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_error',
          data: expect.objectContaining({
            error: expect.stringContaining('not found')
          })
        })
      );
    });
  });

  describe('WebSocket Message Handling', () => {
    test('should handle start_log_stream message', () => {
      eventEmitter.emit('ws:message', {
        clientId: mockClientId,
        message: {
          type: 'start_log_stream',
          data: {
            options: { level: 'info' }
          }
        }
      });
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_started'
        })
      );
    });

    test('should handle stop_log_stream message', () => {
      const streamId = service.startStream(mockClientId, {});
      
      eventEmitter.emit('ws:message', {
        clientId: mockClientId,
        message: {
          type: 'stop_log_stream',
          data: { streamId }
        }
      });
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_stream_stopped'
        })
      );
    });
  });

  describe('Stream Statistics', () => {
    test('should provide stream statistics', () => {
      const stream1 = service.startStream('client1', {});
      const stream2 = service.startStream('client2', {});
      
      const stats = service.getStreamStats();
      
      expect(stats).toEqual({
        activeStreams: 2,
        totalEntriesStreamed: 0,
        bufferSize: expect.any(Number),
        clientCount: 2
      });
    });

    test('should track entries streamed', async () => {
      const streamId = service.startStream(mockClientId, {});
      
      console.log('Test log 1');
      console.log('Test log 2');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const streamInfo = service.getStreamInfo(streamId);
      expect(streamInfo?.entriesStreamed).toBeGreaterThan(0);
    });
  });

  describe('Filtering', () => {
    test('should filter by source', async () => {
      const streamId = service.startStream(mockClientId, {
        source: 'auth-service'
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // These logs should be filtered based on source
      console.log('Message from auth-service');
      console.log('Message from other-service');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logCalls = (websocketService.sendToClient as jest.Mock).mock.calls
        .filter(call => call[1].type === 'log_entry');
      
      // Should only receive logs matching the source filter
      expect(logCalls.some(call => 
        call[1].data.entry.source.includes('auth-service')
      )).toBe(true);
    });

    test('should filter by time range', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      const future = new Date(now.getTime() + 60000); // 1 minute from now
      
      const streamId = service.startStream(mockClientId, {
        startTime: past,
        endTime: future
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.log('Message within time range');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(websocketService.sendToClient).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'log_entry'
        })
      );
    });
  });
});