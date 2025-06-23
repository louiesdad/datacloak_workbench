import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import WebSocket from 'ws';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';
import jwt from 'jsonwebtoken';

describe('Real-time Features E2E Tests', () => {
  let app: express.Application;
  let server: Server;
  let wsService: WebSocketService;
  let sseService: SSEService;
  let serverPort: number;
  let validToken: string;
  const jwtSecret = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create auth token
    validToken = jwt.sign({ username: 'testuser', role: 'admin' }, jwtSecret);

    // Initialize services
    sseService = new SSEService();
    wsService = new WebSocketService();

    // Routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    // SSE endpoint
    app.get('/api/events', (req, res) => {
      const userId = req.query.userId as string;
      const clientId = sseService.addClient(res, userId);
      
      // Send test data after connection
      setTimeout(() => {
        sseService.sendProgress(clientId, 'job-123', 50, 'Processing...');
      }, 100);
    });

    // Job simulation endpoint
    app.post('/api/jobs/start', (req, res) => {
      const jobId = 'job-' + Date.now();
      res.json({ jobId, status: 'started' });

      // Simulate job progress
      const userId = req.body.userId;
      if (userId) {
        setTimeout(() => {
          sseService.broadcast('job:progress', {
            jobId,
            progress: 25,
            message: 'Starting analysis'
          });
        }, 100);

        setTimeout(() => {
          sseService.broadcast('job:progress', {
            jobId,
            progress: 75,
            message: 'Processing data'
          });
        }, 200);

        setTimeout(() => {
          sseService.broadcast('job:complete', {
            jobId,
            result: { sentiment: 'positive', confidence: 0.95 }
          });
        }, 300);
      }
    });

    // Start server
    server = app.listen(0);
    serverPort = (server.address() as any).port;

    // Initialize WebSocket service
    wsService.initialize(server);
  });

  afterAll(async () => {
    // Cleanup
    sseService.stopPingInterval();
    wsService.shutdown();
    
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Server-Sent Events (SSE)', () => {
    it('should establish SSE connection and receive events', (done) => {
      let receivedData = '';
      
      const req = request(app)
        .get('/api/events?userId=test-user')
        .set('Accept', 'text/event-stream')
        .expect(200)
        .expect('Content-Type', /text\/event-stream/)
        .expect('Cache-Control', 'no-cache');

      req.on('response', (res) => {
        res.on('data', (chunk) => {
          receivedData += chunk.toString();
          
          // Check if we received the progress event
          if (receivedData.includes('event: progress')) {
            req.abort();
            expect(receivedData).toContain('job-123');
            expect(receivedData).toContain('"progress":50');
            done();
          }
        });
      });

      req.end();
    });

    it('should broadcast job progress events', async () => {
      // Create a mock SSE client
      const mockResponse = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn()
      };
      
      const clientId = sseService.addClient(mockResponse as any, 'test-user');

      // Start a job
      const jobRes = await request(app)
        .post('/api/jobs/start')
        .send({ userId: 'test-user' })
        .expect(200);

      expect(jobRes.body.jobId).toBeDefined();
      expect(jobRes.body.status).toBe('started');

      // Wait for progress events
      await new Promise(resolve => setTimeout(resolve, 400));

      // Check that events were sent
      const writeCalls = mockResponse.write.mock.calls;
      const progressEvents = writeCalls.filter(call => 
        call[0].includes('event: job:progress')
      );
      const completeEvents = writeCalls.filter(call => 
        call[0].includes('event: job:complete')
      );

      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      expect(completeEvents.length).toBe(1);

      // Cleanup
      sseService.removeClient(clientId);
    });
  });

  describe('WebSocket Communication', () => {
    it('should establish WebSocket connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should receive welcome message on connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('connection');
        expect(message.data.message).toContain('Connected to DataCloak');
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should handle heartbeat messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection') {
          receivedWelcome = true;
          // Send heartbeat
          ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
        } else if (message.type === 'heartbeat_response' && receivedWelcome) {
          expect(message.data.timestamp).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should handle topic subscription', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let clientId: string;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection') {
          clientId = message.data.clientId;
          // Subscribe to sentiment topic
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { topic: 'sentiment' }
          }));
        } else if (message.type === 'subscription') {
          expect(message.data.topic).toBe('sentiment');
          expect(message.data.subscribed).toBe(true);
          
          // Verify subscription
          const clientInfo = wsService.getClientInfo(clientId);
          expect(clientInfo?.subscriptions.has('sentiment')).toBe(true);
          
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  describe('Real-time Workflow Integration', () => {
    it('should coordinate SSE and WebSocket for job updates', async () => {
      // Setup SSE client
      const sseClient = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn()
      };
      const sseClientId = sseService.addClient(sseClient as any, 'integration-user');

      // Setup WebSocket client
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      // Subscribe to jobs topic via WebSocket
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'jobs' }
      }));

      // Start a job
      const jobRes = await request(app)
        .post('/api/jobs/start')
        .send({ userId: 'integration-user' })
        .expect(200);

      const jobId = jobRes.body.jobId;

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check SSE received events
      const sseWrites = sseClient.write.mock.calls;
      expect(sseWrites.some(call => 
        call[0].includes('job:progress')
      )).toBe(true);

      // Cleanup
      sseService.removeClient(sseClientId);
      ws.close();
    });

    it('should handle multiple concurrent connections', async () => {
      const clients = [];
      
      // Create multiple SSE clients
      for (let i = 0; i < 3; i++) {
        const mockResponse = {
          writeHead: jest.fn(),
          write: jest.fn(),
          on: jest.fn()
        };
        const clientId = sseService.addClient(mockResponse as any, `user-${i}`);
        clients.push({ clientId, response: mockResponse });
      }

      // Broadcast an event
      sseService.broadcast('test', { message: 'Hello all!' });

      // Verify all clients received the event
      clients.forEach(client => {
        expect(client.response.write).toHaveBeenCalledWith(
          expect.stringContaining('event: test')
        );
      });

      // Get stats
      expect(sseService.getClientCount()).toBe(3);

      // Cleanup
      clients.forEach(client => {
        sseService.removeClient(client.clientId);
      });

      expect(sseService.getClientCount()).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket disconnection gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      ws.on('open', () => {
        // Get initial client count
        const initialCount = wsService.getClientCount();
        expect(initialCount).toBeGreaterThan(0);
        
        // Close connection
        ws.close();
        
        // Verify client was removed
        setTimeout(() => {
          const finalCount = wsService.getClientCount();
          expect(finalCount).toBe(initialCount - 1);
          done();
        }, 100);
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should handle invalid WebSocket messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      ws.on('open', () => {
        // Send invalid JSON
        ws.send('invalid json{');
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          expect(message.data.message).toContain('Invalid message format');
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });
});