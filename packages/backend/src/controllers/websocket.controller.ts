import { Request, Response } from 'express';
import { websocketService } from '../services/websocket.service';
import { ApiResponse } from '../types/api';

export class WebSocketController {
  /**
   * Get WebSocket server status and metrics
   */
  async getStatus(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const clients = websocketService.getAllClients();
      const clientData = Array.from(clients.entries()).map(([id, client]) => ({
        id,
        userId: client.userId,
        isAlive: client.isAlive,
        lastActivity: client.lastActivity,
        subscriptions: Array.from(client.subscriptions),
      }));

      res.json({
        success: true,
        data: {
          status: 'active',
          clientCount: websocketService.getClientCount(),
          clients: clientData,
          serverTime: new Date(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'WS_STATUS_ERROR',
          message: 'Failed to get WebSocket status',
        },
      });
    }
  }

  /**
   * Send a message to a specific client
   */
  async sendToClient(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const { clientId } = req.params;
      const { type, data } = req.body;

      const sent = websocketService.sendToClient(clientId, {
        type,
        data,
      });

      if (sent) {
        res.json({
          success: true,
          data: { sent: true, clientId },
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_NOT_FOUND',
            message: 'Client not found or not connected',
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send message',
        },
      });
    }
  }

  /**
   * Broadcast a message to all clients or filtered by criteria
   */
  async broadcast(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const { type, data, userId, topic } = req.body;

      const sentCount = websocketService.broadcast(
        { type, data },
        { userId, topic }
      );

      res.json({
        success: true,
        data: {
          sentCount,
          totalClients: websocketService.getClientCount(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BROADCAST_ERROR',
          message: 'Failed to broadcast message',
        },
      });
    }
  }

  /**
   * Disconnect a specific client
   */
  async disconnectClient(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const { clientId } = req.params;
      const { reason } = req.body;

      const disconnected = websocketService.disconnectClient(clientId, reason);

      if (disconnected) {
        res.json({
          success: true,
          data: { disconnected: true, clientId },
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_NOT_FOUND',
            message: 'Client not found',
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'DISCONNECT_ERROR',
          message: 'Failed to disconnect client',
        },
      });
    }
  }
}

export const websocketController = new WebSocketController();