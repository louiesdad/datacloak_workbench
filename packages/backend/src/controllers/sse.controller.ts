/**
 * SSE Controller
 * Handles Server-Sent Events endpoints
 */

import { Request, Response } from 'express';
import { getSSEService } from '../services/sse.service';

export class SSEController {
  /**
   * Establish SSE connection
   */
  static async connect(req: Request, res: Response): Promise<void> {
    const sseService = getSSEService();
    
    // Get user ID from session or auth (placeholder)
    const userId = req.query.userId as string || undefined;
    
    // Add client and keep connection open
    const clientId = sseService.addClient(res, userId);
    
    // Log connection
    console.log(`SSE client connected: ${clientId} (user: ${userId || 'anonymous'})`);
    
    // Keep the connection open
    req.on('close', () => {
      console.log(`SSE client disconnected: ${clientId}`);
    });
  }

  /**
   * Get SSE connection status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    const sseService = getSSEService();
    
    res.json({
      success: true,
      data: {
        connectedClients: sseService.getClientCount(),
        timestamp: new Date()
      }
    });
  }

  /**
   * Send test event (for debugging)
   */
  static async sendTestEvent(req: Request, res: Response): Promise<void> {
    const sseService = getSSEService();
    const { event, data } = req.body;
    
    sseService.broadcast({
      event: event || 'test',
      data: data || { message: 'Test event', timestamp: new Date() }
    });
    
    res.json({
      success: true,
      message: 'Test event sent',
      clientCount: sseService.getClientCount()
    });
  }
}