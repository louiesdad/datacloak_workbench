import { Request, Response } from 'express';
import { websocketController } from '../websocket.controller';
import { websocketService } from '../../services/websocket.service';

// Mock the websocket service
jest.mock('../../services/websocket.service', () => ({
  websocketService: {
    getAllClients: jest.fn(),
    getClientCount: jest.fn(),
    sendToClient: jest.fn(),
    broadcast: jest.fn(),
    disconnectClient: jest.fn(),
    getClientInfo: jest.fn()
  }
}));

describe('WebSocketController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    
    mockRequest = {
      params: {},
      body: {}
    };
    
    mockResponse = {
      json: jsonMock,
      status: statusMock
    };
    
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return WebSocket server status', async () => {
      const mockClients = new Map([
        ['client1', {
          id: 'client1',
          userId: 'user123',
          isAlive: true,
          lastActivity: new Date(),
          subscriptions: new Set(['global', 'sentiment'])
        }],
        ['client2', {
          id: 'client2',
          userId: null,
          isAlive: true,
          lastActivity: new Date(),
          subscriptions: new Set(['global'])
        }]
      ]);

      (websocketService.getAllClients as jest.Mock).mockReturnValue(mockClients);
      (websocketService.getClientCount as jest.Mock).mockReturnValue(2);

      await websocketController.getStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'active',
          clientCount: 2,
          clients: expect.arrayContaining([
            expect.objectContaining({
              id: 'client1',
              userId: 'user123',
              isAlive: true,
              subscriptions: ['global', 'sentiment']
            }),
            expect.objectContaining({
              id: 'client2',
              userId: null,
              isAlive: true,
              subscriptions: ['global']
            })
          ]),
          serverTime: expect.any(Date)
        }
      });
    });

    it('should handle errors when getting status', async () => {
      (websocketService.getAllClients as jest.Mock).mockImplementation(() => {
        throw new Error('Service error');
      });

      await websocketController.getStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'WS_STATUS_ERROR',
          message: 'Failed to get WebSocket status'
        }
      });
    });
  });

  describe('sendToClient', () => {
    it('should send message to specific client successfully', async () => {
      mockRequest.params = { clientId: 'client123' };
      mockRequest.body = { type: 'notification', data: { message: 'Hello' } };

      (websocketService.sendToClient as jest.Mock).mockReturnValue(true);

      await websocketController.sendToClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.sendToClient).toHaveBeenCalledWith('client123', {
        type: 'notification',
        data: { message: 'Hello' }
      });

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { sent: true, clientId: 'client123' }
      });
    });

    it('should return 404 when client not found', async () => {
      mockRequest.params = { clientId: 'non-existent' };
      mockRequest.body = { type: 'notification', data: { message: 'Hello' } };

      (websocketService.sendToClient as jest.Mock).mockReturnValue(false);

      await websocketController.sendToClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found or not connected'
        }
      });
    });

    it('should handle errors when sending to client', async () => {
      mockRequest.params = { clientId: 'client123' };
      mockRequest.body = { type: 'notification', data: { message: 'Hello' } };

      (websocketService.sendToClient as jest.Mock).mockImplementation(() => {
        throw new Error('Send error');
      });

      await websocketController.sendToClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send message'
        }
      });
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all clients', async () => {
      mockRequest.body = {
        type: 'announcement',
        data: { text: 'System update' }
      };

      (websocketService.broadcast as jest.Mock).mockReturnValue(5);
      (websocketService.getClientCount as jest.Mock).mockReturnValue(8);

      await websocketController.broadcast(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.broadcast).toHaveBeenCalledWith(
        { type: 'announcement', data: { text: 'System update' } },
        { userId: undefined, topic: undefined }
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          sentCount: 5,
          totalClients: 8
        }
      });
    });

    it('should broadcast to specific topic', async () => {
      mockRequest.body = {
        type: 'sentiment_update',
        data: { sentiment: 'positive' },
        topic: 'sentiment'
      };

      (websocketService.broadcast as jest.Mock).mockReturnValue(3);
      (websocketService.getClientCount as jest.Mock).mockReturnValue(10);

      await websocketController.broadcast(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.broadcast).toHaveBeenCalledWith(
        { type: 'sentiment_update', data: { sentiment: 'positive' } },
        { userId: undefined, topic: 'sentiment' }
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          sentCount: 3,
          totalClients: 10
        }
      });
    });

    it('should broadcast to specific user', async () => {
      mockRequest.body = {
        type: 'user_notification',
        data: { message: 'Personal message' },
        userId: 'user123'
      };

      (websocketService.broadcast as jest.Mock).mockReturnValue(1);
      (websocketService.getClientCount as jest.Mock).mockReturnValue(10);

      await websocketController.broadcast(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.broadcast).toHaveBeenCalledWith(
        { type: 'user_notification', data: { message: 'Personal message' } },
        { userId: 'user123', topic: undefined }
      );
    });

    it('should handle broadcast errors', async () => {
      mockRequest.body = {
        type: 'announcement',
        data: { text: 'System update' }
      };

      (websocketService.broadcast as jest.Mock).mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      await websocketController.broadcast(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BROADCAST_ERROR',
          message: 'Failed to broadcast message'
        }
      });
    });
  });

  describe('disconnectClient', () => {
    it('should disconnect client successfully', async () => {
      mockRequest.params = { clientId: 'client123' };
      mockRequest.body = { reason: 'Maintenance' };

      (websocketService.disconnectClient as jest.Mock).mockReturnValue(true);

      await websocketController.disconnectClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.disconnectClient).toHaveBeenCalledWith(
        'client123',
        'Maintenance'
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { disconnected: true, clientId: 'client123' }
      });
    });

    it('should disconnect client without reason', async () => {
      mockRequest.params = { clientId: 'client123' };
      mockRequest.body = {};

      (websocketService.disconnectClient as jest.Mock).mockReturnValue(true);

      await websocketController.disconnectClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(websocketService.disconnectClient).toHaveBeenCalledWith(
        'client123',
        undefined
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { disconnected: true, clientId: 'client123' }
      });
    });

    it('should return 404 when client not found', async () => {
      mockRequest.params = { clientId: 'non-existent' };
      mockRequest.body = { reason: 'Not found' };

      (websocketService.disconnectClient as jest.Mock).mockReturnValue(false);

      await websocketController.disconnectClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CLIENT_NOT_FOUND',
          message: 'Client not found'
        }
      });
    });

    it('should handle disconnect errors', async () => {
      mockRequest.params = { clientId: 'client123' };
      mockRequest.body = { reason: 'Error test' };

      (websocketService.disconnectClient as jest.Mock).mockImplementation(() => {
        throw new Error('Disconnect error');
      });

      await websocketController.disconnectClient(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DISCONNECT_ERROR',
          message: 'Failed to disconnect client'
        }
      });
    });
  });
});