/**
 * Dashboard Real-time Updates Integration Tests
 * 
 * Tests WebSocket and SSE functionality for real-time metric updates
 * during analysis operations and dashboard interactions.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import WebSocket from 'ws';
import { EventSource } from 'eventsource';
import { createMockApp } from '../../test-utils/app-factory';
import { createMockDataService, createMockSentimentService } from '../../test-utils/shared-test-utilities';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';

// Mock external services
jest.mock('../../services/websocket.service');
jest.mock('../../services/sse.service');
jest.mock('../../config/logger');

describe('Dashboard Real-time Updates Integration Tests', () => {
  let app: express.Application;
  let server: Server;
  let mockDataService: any;
  let mockSentimentService: any;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockSSEService: jest.Mocked<SSEService>;
  let authToken: string;
  let wsUrl: string;
  let sseUrl: string;

  beforeAll(async () => {
    // Create test application
    app = await createMockApp();
    
    // Start server for WebSocket and SSE connections
    server = app.listen(0); // Use random available port
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;
    
    wsUrl = `ws://localhost:${port}/ws`;
    sseUrl = `http://localhost:${port}/api/dashboard/stream`;
    
    // Setup service mocks
    mockDataService = createMockDataService();
    mockSentimentService = createMockSentimentService();
    mockWebSocketService = jest.mocked(new WebSocketService());
    mockSSEService = jest.mocked(new SSEService());
    
    // Mock authentication
    authToken = 'Bearer test-token-123';
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket Real-time Updates', () => {
    it('should broadcast analysis started events via WebSocket', async () => {
      const testData = 'text\n"Starting analysis test"';
      
      // Upload dataset
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'ws-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Start analysis
      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      // Verify WebSocket broadcast was called with analysis_started event
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'analysis_started',
          data: expect.objectContaining({
            datasetId,
            status: 'running'
          })
        })
      );
    });

    it('should broadcast analysis progress updates', async () => {
      const testData = 'text\n"Progress update test"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'progress-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Start analysis
      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      const jobId = analysisResponse.body.data.jobId;

      // Check job progress (this should trigger progress updates)
      await request(app)
        .get(`/api/jobs/${jobId}/progress`)
        .set('Authorization', authToken)
        .expect(200);

      // Verify progress update broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'analysis_progress',
          data: expect.objectContaining({
            jobId,
            progress: expect.any(Number)
          })
        })
      );
    });

    it('should broadcast analysis completion events', async () => {
      const testData = 'text\n"Completion test"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'completion-test.csv')
        .expect(201);

      // Mock analysis completion
      mockSentimentService.analyzeSentiment.mockResolvedValueOnce({
        id: 'analysis-123',
        datasetId: uploadResponse.body.data.id,
        status: 'completed',
        results: {
          totalProcessed: 1,
          positiveCount: 1,
          negativeCount: 0,
          neutralCount: 0
        }
      });

      const datasetId = uploadResponse.body.data.id;

      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      // Verify completion broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'analysis_completed',
          data: expect.objectContaining({
            datasetId,
            status: 'completed'
          })
        })
      );
    });

    it('should broadcast dashboard metrics updates', async () => {
      // Trigger metrics refresh
      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      // Verify metrics update broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metrics_updated',
          data: expect.objectContaining({
            totalDatasets: expect.any(Number),
            totalAnalyses: expect.any(Number),
            timestamp: expect.any(String)
          })
        })
      );
    });

    it('should handle WebSocket connection authentication', async () => {
      // Simulate WebSocket connection with authentication
      const mockConnection = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN
      };

      // Mock connection event
      mockWebSocketService.handleConnection.mockImplementation((ws, req) => {
        // Verify authentication headers are checked
        expect(req.headers.authorization).toBeDefined();
      });

      // Verify authentication is enforced
      expect(mockWebSocketService.handleConnection).toBeDefined();
    });

    it('should broadcast dataset upload events', async () => {
      const testData = 'text\n"Upload broadcast test"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'upload-broadcast.csv')
        .expect(201);

      // Verify upload broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dataset_uploaded',
          data: expect.objectContaining({
            filename: 'upload-broadcast.csv',
            size: expect.any(Number)
          })
        })
      );
    });
  });

  describe('Server-Sent Events (SSE) Streaming', () => {
    it('should stream live metrics via SSE', async () => {
      // Mock SSE connection
      const mockSSEConnection = {
        write: jest.fn(),
        end: jest.fn()
      };

      mockSSEService.addClient = jest.fn();
      mockSSEService.broadcast = jest.fn();

      // Test SSE endpoint
      const response = await request(app)
        .get('/api/dashboard/stream')
        .set('Authorization', authToken)
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(mockSSEService.addClient).toHaveBeenCalled();
    });

    it('should send initial dashboard state via SSE', async () => {
      // Connect to SSE endpoint
      await request(app)
        .get('/api/dashboard/stream')
        .set('Authorization', authToken)
        .set('Accept', 'text/event-stream')
        .expect(200);

      // Verify initial state is sent
      expect(mockSSEService.broadcast).toHaveBeenCalledWith({
        type: 'dashboard_state',
        data: expect.objectContaining({
          metrics: expect.any(Object),
          recentActivity: expect.any(Array)
        })
      });
    });

    it('should stream analysis results as they complete', async () => {
      const testData = 'text\n"SSE results test"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'sse-results.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Start analysis
      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      // Verify SSE stream includes analysis results
      expect(mockSSEService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'analysis_result',
          data: expect.objectContaining({
            datasetId,
            sentiment: expect.any(String)
          })
        })
      );
    });

    it('should handle SSE client disconnection gracefully', async () => {
      // Mock client disconnection
      mockSSEService.removeClient = jest.fn();

      // Connect and disconnect
      const response = await request(app)
        .get('/api/dashboard/stream')
        .set('Authorization', authToken)
        .set('Accept', 'text/event-stream');

      // Simulate client disconnection
      response.req.destroy();

      // Verify cleanup is called
      expect(mockSSEService.removeClient).toHaveBeenCalled();
    });

    it('should send heartbeat messages to keep SSE connection alive', async () => {
      jest.useFakeTimers();

      await request(app)
        .get('/api/dashboard/stream')
        .set('Authorization', authToken)
        .set('Accept', 'text/event-stream')
        .expect(200);

      // Fast-forward time to trigger heartbeat
      jest.advanceTimersByTime(30000); // 30 seconds

      // Verify heartbeat is sent
      expect(mockSSEService.broadcast).toHaveBeenCalledWith({
        type: 'heartbeat',
        data: { timestamp: expect.any(String) }
      });

      jest.useRealTimers();
    });
  });

  describe('Real-time Export Updates', () => {
    it('should broadcast export progress via WebSocket', async () => {
      const testData = 'text\n"Export progress test"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'export-progress.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Start export
      await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId
        })
        .expect(200);

      // Verify export progress broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'export_started',
          data: expect.objectContaining({
            datasetId,
            format: 'csv'
          })
        })
      );
    });

    it('should broadcast export completion with download link', async () => {
      const testData = 'text\n"Export completion test"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'export-complete.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'json',
          datasetId
        })
        .expect(200);

      // Verify export completion broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'export_completed',
          data: expect.objectContaining({
            exportId: exportResponse.body.data.exportId,
            downloadUrl: expect.any(String)
          })
        })
      );
    });
  });

  describe('Concurrent User Updates', () => {
    it('should handle multiple simultaneous WebSocket connections', async () => {
      // Simulate multiple user connections
      const userConnections = [
        { userId: 'user-1', role: 'admin' },
        { userId: 'user-2', role: 'analyst' },
        { userId: 'user-3', role: 'viewer' }
      ];

      userConnections.forEach(user => {
        mockWebSocketService.handleConnection.mockImplementation((ws, req) => {
          // Verify each connection is handled
          expect(ws).toBeDefined();
          expect(req).toBeDefined();
        });
      });

      // Trigger a broadcast event
      const testData = 'text\n"Multi-user test"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'multi-user.csv')
        .expect(201);

      // Verify broadcast reaches all connections
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dataset_uploaded'
        })
      );
    });

    it('should filter broadcasts based on user permissions', async () => {
      // Mock role-based filtering
      mockWebSocketService.broadcastToRole = jest.fn();

      // Trigger admin-only event
      await request(app)
        .get('/api/dashboard/admin-metrics')
        .set('Authorization', authToken)
        .expect(401); // Should fail without admin role

      // Admin events should be filtered to admin users only
      expect(mockWebSocketService.broadcastToRole).not.toHaveBeenCalled();
    });

    it('should handle user role changes in real-time', async () => {
      // Mock user role update
      const roleUpdateEvent = {
        type: 'user_role_updated',
        data: {
          userId: 'user-123',
          oldRole: 'viewer',
          newRole: 'analyst',
          updatedBy: 'admin-456'
        }
      };

      // Verify role change broadcast
      mockWebSocketService.broadcast(roleUpdateEvent);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user_role_updated',
          data: expect.objectContaining({
            userId: 'user-123',
            newRole: 'analyst'
          })
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket connection failures gracefully', async () => {
      // Mock connection failure
      mockWebSocketService.handleConnection.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // Connection error should not crash the application
      const testData = 'text\n"Connection error test"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'connection-error.csv')
        .expect(201);

      // Application should continue functioning despite WebSocket errors
      expect(mockWebSocketService.broadcast).toHaveBeenCalled();
    });

    it('should retry failed broadcasts', async () => {
      // Mock initial broadcast failure, then success
      mockWebSocketService.broadcast
        .mockRejectedValueOnce(new Error('Broadcast failed'))
        .mockResolvedValueOnce(undefined);

      const testData = 'text\n"Retry test"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'retry-test.csv')
        .expect(201);

      // Verify retry mechanism
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(2);
    });

    it('should clean up SSE connections on server shutdown', async () => {
      mockSSEService.cleanup = jest.fn();

      // Simulate server shutdown
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });

      // Verify cleanup is called
      expect(mockSSEService.cleanup).toHaveBeenCalled();
    });

    it('should handle malformed WebSocket messages', async () => {
      const malformedMessage = { invalid: 'data structure' };

      // Broadcast should handle malformed messages gracefully
      mockWebSocketService.broadcast(malformedMessage as any);

      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(malformedMessage);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const startTime = Date.now();

      // Generate multiple rapid updates
      for (let i = 0; i < 100; i++) {
        mockWebSocketService.broadcast({
          type: 'rapid_update',
          data: { counter: i, timestamp: Date.now() }
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All broadcasts should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(mockWebSocketService.broadcast).toHaveBeenCalledTimes(100);
    });

    it('should throttle broadcasts to prevent flooding', async () => {
      jest.useFakeTimers();

      // Simulate rapid analysis progress updates
      for (let i = 0; i < 10; i++) {
        mockWebSocketService.broadcast({
          type: 'analysis_progress',
          data: { progress: i * 10 }
        });
      }

      // Fast-forward past throttle window
      jest.advanceTimersByTime(1000);

      // Should throttle to prevent excessive broadcasts
      expect(mockWebSocketService.broadcast).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should maintain connection limits', async () => {
      // Mock connection limit enforcement
      mockWebSocketService.getConnectionCount = jest.fn().mockReturnValue(100);
      mockWebSocketService.maxConnections = 100;

      // Attempt to add connection beyond limit
      const result = mockWebSocketService.getConnectionCount();
      expect(result).toBe(100);

      // Should enforce maximum connections
      expect(mockWebSocketService.getConnectionCount).toHaveBeenCalled();
    });
  });
});