import { Request, Response } from 'express';
import { connectionStatusService } from '../services/connection-status.service';
import { AppError } from '../middleware/error.middleware';

export class ConnectionStatusController {
  async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = connectionStatusService.getStatus();
      
      return res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting connection status:', error);
      throw new AppError('Failed to get connection status', 500, 'CONNECTION_STATUS_ERROR');
    }
  }

  async getUptime(req: Request, res: Response): Promise<Response> {
    try {
      const uptime = connectionStatusService.getUptime();
      const uptimeSeconds = Math.floor(uptime / 1000);
      
      return res.json({
        success: true,
        data: {
          uptime: uptime,
          uptimeSeconds: uptimeSeconds,
          uptimeFormatted: this.formatUptime(uptimeSeconds)
        }
      });
    } catch (error) {
      console.error('Error getting uptime:', error);
      throw new AppError('Failed to get uptime', 500, 'UPTIME_ERROR');
    }
  }

  async getLatency(req: Request, res: Response): Promise<Response> {
    try {
      const latency = connectionStatusService.getLatency();
      
      return res.json({
        success: true,
        data: {
          latency: latency,
          status: latency !== null ? (latency < 100 ? 'excellent' : latency < 500 ? 'good' : 'poor') : 'unknown'
        }
      });
    } catch (error) {
      console.error('Error getting latency:', error);
      throw new AppError('Failed to get latency', 500, 'LATENCY_ERROR');
    }
  }

  async getConnectionCount(req: Request, res: Response): Promise<Response> {
    try {
      const connectionCount = connectionStatusService.getConnectionCount();
      
      return res.json({
        success: true,
        data: {
          connectionCount: connectionCount,
          isActive: connectionCount > 0
        }
      });
    } catch (error) {
      console.error('Error getting connection count:', error);
      throw new AppError('Failed to get connection count', 500, 'CONNECTION_COUNT_ERROR');
    }
  }

  async getHealthCheck(req: Request, res: Response): Promise<Response> {
    try {
      const isHealthy = connectionStatusService.isHealthy();
      const status = connectionStatusService.getStatus();
      
      return res.json({
        success: true,
        data: {
          healthy: isHealthy,
          status: status.serverStatus,
          timestamp: new Date().toISOString(),
          services: status.services
        }
      });
    } catch (error) {
      console.error('Error checking health:', error);
      throw new AppError('Failed to check health', 500, 'HEALTH_CHECK_ERROR');
    }
  }

  async forceStatusCheck(req: Request, res: Response): Promise<Response> {
    try {
      await connectionStatusService.forceStatusCheck();
      const status = connectionStatusService.getStatus();
      
      return res.json({
        success: true,
        message: 'Status check completed',
        data: status
      });
    } catch (error) {
      console.error('Error forcing status check:', error);
      throw new AppError('Failed to force status check', 500, 'FORCE_CHECK_ERROR');
    }
  }

  async clearErrors(req: Request, res: Response): Promise<Response> {
    try {
      connectionStatusService.clearErrors();
      
      return res.json({
        success: true,
        message: 'Errors cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing errors:', error);
      throw new AppError('Failed to clear errors', 500, 'CLEAR_ERRORS_ERROR');
    }
  }

  async getDetailedStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = connectionStatusService.getStatus();
      
      // Add additional computed fields
      const detailedStatus = {
        ...status,
        uptimeFormatted: this.formatUptime(Math.floor(status.uptime / 1000)),
        latencyStatus: status.latency !== null ? 
          (status.latency < 100 ? 'excellent' : status.latency < 500 ? 'good' : 'poor') : 'unknown',
        servicesHealthy: Object.values(status.services).filter(s => 
          s === 'connected' || s === 'running'
        ).length,
        servicesTotal: Object.keys(status.services).length,
        hasErrors: status.errors.length > 0,
        recentErrors: status.errors.slice(-10), // Last 10 errors
        timestamp: new Date().toISOString()
      };
      
      return res.json({
        success: true,
        data: detailedStatus
      });
    } catch (error) {
      console.error('Error getting detailed status:', error);
      throw new AppError('Failed to get detailed status', 500, 'DETAILED_STATUS_ERROR');
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}

export const connectionStatusController = new ConnectionStatusController();