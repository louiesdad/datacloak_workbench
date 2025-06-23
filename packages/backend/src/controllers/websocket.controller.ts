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

  // Real-time Risk Assessment WebSocket Methods - TASK-201
  /**
   * Subscribe client to real-time risk assessment updates
   */
  async subscribeToRiskAssessments(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const { assessmentId, frameworks, riskThreshold } = req.body;
      const userId = req.user?.id; // Assuming auth middleware sets req.user

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      // Find client by userId
      const clients = websocketService.getAllClients();
      let clientId: string | null = null;
      
      for (const [id, client] of clients.entries()) {
        if (client.userId === userId) {
          clientId = id;
          break;
        }
      }

      if (!clientId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_NOT_FOUND',
            message: 'WebSocket client not found for user'
          }
        });
        return;
      }

      // Create subscription topic
      const subscriptionTopic = 'risk-assessment';
      const subscriptionId = `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Subscribe client to risk assessment updates
      const subscribed = websocketService.subscribeToTopic(clientId, subscriptionTopic, {
        assessmentId,
        frameworks: frameworks || ['all'],
        riskThreshold: riskThreshold || 0,
        subscriptionId
      });

      if (subscribed) {
        // Send confirmation message to client
        websocketService.sendToClient(clientId, {
          type: 'risk-assessment-subscription-confirmed',
          data: {
            subscriptionId,
            assessmentId,
            frameworks,
            riskThreshold,
            timestamp: new Date().toISOString()
          }
        });

        res.json({
          success: true,
          data: {
            subscribed: true,
            subscriptionId,
            clientId,
            filters: { assessmentId, frameworks, riskThreshold }
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_FAILED',
            message: 'Failed to subscribe to risk assessments'
          }
        });
      }
    } catch (error) {
      console.error('Error subscribing to risk assessments:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_ERROR',
          message: 'Internal error during subscription'
        }
      });
    }
  }

  /**
   * Unsubscribe client from risk assessment updates
   */
  async unsubscribeFromRiskAssessments(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      // Find client by userId
      const clients = websocketService.getAllClients();
      let clientId: string | null = null;
      
      for (const [id, client] of clients.entries()) {
        if (client.userId === userId) {
          clientId = id;
          break;
        }
      }

      if (!clientId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_NOT_FOUND',
            message: 'WebSocket client not found for user'
          }
        });
        return;
      }

      // Unsubscribe from risk assessment topic
      const unsubscribed = websocketService.unsubscribeFromTopic(clientId, 'risk-assessment');

      if (unsubscribed) {
        // Send confirmation message to client
        websocketService.sendToClient(clientId, {
          type: 'risk-assessment-unsubscription-confirmed',
          data: {
            timestamp: new Date().toISOString()
          }
        });

        res.json({
          success: true,
          data: {
            unsubscribed: true,
            clientId
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'UNSUBSCRIPTION_FAILED',
            message: 'Failed to unsubscribe from risk assessments'
          }
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from risk assessments:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UNSUBSCRIPTION_ERROR',
          message: 'Internal error during unsubscription'
        }
      });
    }
  }

  /**
   * Broadcast risk assessment update to subscribed clients
   */
  async broadcastRiskAssessmentUpdate(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const { assessmentId, riskScore, status, data } = req.body;

      const updateMessage = {
        type: 'risk-assessment-update',
        data: {
          assessmentId,
          riskScore,
          status,
          timestamp: new Date().toISOString(),
          riskLevel: this.getRiskLevel(riskScore),
          data: data || {}
        }
      };

      // Broadcast to all clients subscribed to risk assessments
      const sentCount = websocketService.broadcast(updateMessage, {
        topic: 'risk-assessment',
        filter: (client, subscription) => {
          // Filter based on subscription preferences
          if (subscription.data?.assessmentId && subscription.data.assessmentId !== assessmentId) {
            return false;
          }
          if (subscription.data?.riskThreshold && riskScore < subscription.data.riskThreshold) {
            return false;
          }
          return true;
        }
      });

      // Also send specific status updates for critical risk levels
      if (riskScore >= 80) {
        websocketService.broadcast({
          type: 'high-risk-alert',
          data: {
            assessmentId,
            riskScore,
            riskLevel: this.getRiskLevel(riskScore),
            message: `High risk detected: ${riskScore}% risk score`,
            timestamp: new Date().toISOString()
          }
        }, { topic: 'risk-assessment' });
      }

      res.json({
        success: true,
        data: {
          sentCount,
          assessmentId,
          riskScore,
          status,
          broadcastType: 'risk-assessment-update'
        }
      });
    } catch (error) {
      console.error('Error broadcasting risk assessment update:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BROADCAST_ERROR',
          message: 'Failed to broadcast risk assessment update'
        }
      });
    }
  }

  /**
   * Get active risk assessment subscriptions
   */
  async getActiveRiskSubscriptions(req: Request, res: Response<ApiResponse>): Promise<void> {
    try {
      const clients = websocketService.getAllClients();
      const subscriptions: any[] = [];

      for (const [clientId, client] of clients.entries()) {
        const riskSubscriptions = Array.from(client.subscriptions)
          .filter(sub => sub.startsWith('risk-assessment'))
          .map(sub => ({
            clientId,
            userId: client.userId,
            subscription: sub,
            subscriptionData: (client as any).subscriptionData?.[sub] || {},
            isAlive: client.isAlive,
            lastActivity: client.lastActivity
          }));
        
        subscriptions.push(...riskSubscriptions);
      }

      const summary = {
        totalSubscriptions: subscriptions.length,
        activeClients: subscriptions.filter(s => s.isAlive).length,
        subscriptionsByFramework: this.groupSubscriptionsByFramework(subscriptions),
        averageRiskThreshold: this.calculateAverageRiskThreshold(subscriptions)
      };

      res.json({
        success: true,
        data: {
          subscriptions,
          summary,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting active risk subscriptions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUBSCRIPTIONS_ERROR',
          message: 'Failed to get active risk subscriptions'
        }
      });
    }
  }

  // Helper methods for risk assessment functionality
  private getRiskLevel(score: number): string {
    if (score >= 95) return 'critical';
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private groupSubscriptionsByFramework(subscriptions: any[]): { [key: string]: number } {
    const groups: { [key: string]: number } = {};
    
    subscriptions.forEach(sub => {
      const frameworks = sub.subscriptionData.frameworks || ['all'];
      frameworks.forEach((framework: string) => {
        groups[framework] = (groups[framework] || 0) + 1;
      });
    });

    return groups;
  }

  private calculateAverageRiskThreshold(subscriptions: any[]): number {
    const thresholds = subscriptions
      .map(sub => sub.subscriptionData.riskThreshold || 0)
      .filter(threshold => threshold > 0);
    
    if (thresholds.length === 0) return 0;
    
    return thresholds.reduce((sum, threshold) => sum + threshold, 0) / thresholds.length;
  }
}

export const websocketController = new WebSocketController();