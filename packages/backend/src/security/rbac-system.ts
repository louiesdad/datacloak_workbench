/**
 * Role-Based Access Control (RBAC) System
 * 
 * Implements comprehensive role-based access control with
 * admin, analyst, and viewer roles, permission checks,
 * and audit trail access control.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../middleware/error.middleware';

export type Role = 'admin' | 'analyst' | 'viewer';
export type Resource = 'datasets' | 'sentiment' | 'analytics' | 'users' | 'audit' | 'config' | 'exports' | 'jobs';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'download' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  resource: Resource;
  actions: Action[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'owner';
  value: any;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: any;
  sessionId?: string;
}

export interface AccessContext {
  user: User;
  resource: Resource;
  action: Action;
  resourceId?: string;
  data?: any;
  ipAddress: string;
  userAgent: string;
}

export class RBACSystem {
  private rolePermissions: Map<Role, Permission[]>;
  private auditLog: AuditLogEntry[];
  private sessionStore: Map<string, { userId: string; expiresAt: number }>;

  constructor() {
    this.rolePermissions = new Map();
    this.auditLog = [];
    this.sessionStore = new Map();
    this.initializeRolePermissions();
    this.setupAuditLogCleanup();
  }

  /**
   * Initialize default role permissions
   */
  private initializeRolePermissions(): void {
    // Admin permissions - full access to everything
    const adminPermissions: Permission[] = [
      { resource: 'datasets', actions: ['create', 'read', 'update', 'delete', 'admin'] },
      { resource: 'sentiment', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'analytics', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'admin'] },
      { resource: 'audit', actions: ['read', 'admin'] },
      { resource: 'config', actions: ['read', 'update', 'admin'] },
      { resource: 'exports', actions: ['create', 'read', 'download', 'delete'] },
      { resource: 'jobs', actions: ['create', 'read', 'update', 'delete', 'execute'] }
    ];

    // Analyst permissions - can analyze data and manage their own work
    const analystPermissions: Permission[] = [
      { resource: 'datasets', actions: ['create', 'read', 'update'] },
      { resource: 'sentiment', actions: ['create', 'read', 'execute'] },
      { resource: 'analytics', actions: ['read', 'execute'] },
      { resource: 'users', actions: ['read'], conditions: [{ field: 'id', operator: 'owner', value: 'self' }] },
      { resource: 'audit', actions: ['read'], conditions: [{ field: 'userId', operator: 'owner', value: 'self' }] },
      { resource: 'config', actions: ['read'] },
      { resource: 'exports', actions: ['create', 'read', 'download'] },
      { resource: 'jobs', actions: ['create', 'read', 'execute'] }
    ];

    // Viewer permissions - read-only access to results
    const viewerPermissions: Permission[] = [
      { resource: 'datasets', actions: ['read'] },
      { resource: 'sentiment', actions: ['read'] },
      { resource: 'analytics', actions: ['read'] },
      { resource: 'users', actions: ['read'], conditions: [{ field: 'id', operator: 'owner', value: 'self' }] },
      { resource: 'audit', actions: ['read'], conditions: [{ field: 'userId', operator: 'owner', value: 'self' }] },
      { resource: 'config', actions: ['read'] },
      { resource: 'exports', actions: ['read', 'download'] },
      { resource: 'jobs', actions: ['read'] }
    ];

    this.rolePermissions.set('admin', adminPermissions);
    this.rolePermissions.set('analyst', analystPermissions);
    this.rolePermissions.set('viewer', viewerPermissions);
  }

  /**
   * Check if user has permission for specific action
   */
  async checkPermission(context: AccessContext): Promise<boolean> {
    try {
      const { user, resource, action, resourceId, data } = context;

      // Check if user is active
      if (!user.isActive) {
        await this.logAuditEntry({
          ...context,
          success: false,
          details: { reason: 'User account is not active' }
        });
        return false;
      }

      // Get role permissions
      const rolePermissions = this.rolePermissions.get(user.role);
      if (!rolePermissions) {
        await this.logAuditEntry({
          ...context,
          success: false,
          details: { reason: 'Invalid user role' }
        });
        return false;
      }

      // Find matching permission
      const permission = rolePermissions.find(p => p.resource === resource);
      if (!permission) {
        await this.logAuditEntry({
          ...context,
          success: false,
          details: { reason: 'No permission found for resource' }
        });
        return false;
      }

      // Check if action is allowed
      if (!permission.actions.includes(action)) {
        await this.logAuditEntry({
          ...context,
          success: false,
          details: { reason: 'Action not permitted' }
        });
        return false;
      }

      // Check conditions if any
      if (permission.conditions && permission.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(
          permission.conditions,
          context
        );
        
        if (!conditionsMet) {
          await this.logAuditEntry({
            ...context,
            success: false,
            details: { reason: 'Permission conditions not met' }
          });
          return false;
        }
      }

      // Log successful access
      await this.logAuditEntry({
        ...context,
        success: true
      });

      return true;
    } catch (error) {
      logger.error('Permission check failed:', error);
      await this.logAuditEntry({
        ...context,
        success: false,
        details: { error: error.message }
      });
      return false;
    }
  }

  /**
   * Evaluate permission conditions
   */
  private async evaluateConditions(
    conditions: PermissionCondition[],
    context: AccessContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single permission condition
   */
  private async evaluateCondition(
    condition: PermissionCondition,
    context: AccessContext
  ): Promise<boolean> {
    const { field, operator, value } = condition;
    const { user, resourceId, data } = context;

    let fieldValue: any;

    // Get field value based on context
    switch (field) {
      case 'id':
        fieldValue = resourceId;
        break;
      case 'userId':
        fieldValue = data?.userId || resourceId;
        break;
      case 'ownerId':
        fieldValue = data?.ownerId;
        break;
      default:
        fieldValue = data?.[field];
    }

    // Evaluate condition
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      
      case 'not_equals':
        return fieldValue !== value;
      
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      
      case 'owner':
        // Special case for owner checks
        if (value === 'self') {
          return fieldValue === user.id || user.id === resourceId;
        }
        return fieldValue === value;
      
      default:
        return false;
    }
  }

  /**
   * Express middleware for permission checking
   */
  requirePermission(resource: Resource, action: Action) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = req.user as User;
        if (!user) {
          throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }

        const context: AccessContext = {
          user,
          resource,
          action,
          resourceId: req.params.id,
          data: req.body,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown'
        };

        const hasPermission = await this.checkPermission(context);
        
        if (!hasPermission) {
          throw new AppError(
            `Insufficient permissions to ${action} ${resource}`,
            403,
            'INSUFFICIENT_PERMISSIONS'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware to require specific role
   */
  requireRole(requiredRole: Role) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as User;
        if (!user) {
          throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }

        if (user.role !== requiredRole) {
          throw new AppError(
            `Access denied. Role '${requiredRole}' required`,
            403,
            'INSUFFICIENT_ROLE'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware to require any of specified roles
   */
  requireAnyRole(roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as User;
        if (!user) {
          throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }

        if (!roles.includes(user.role)) {
          throw new AppError(
            `Access denied. One of roles [${roles.join(', ')}] required`,
            403,
            'INSUFFICIENT_ROLE'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Log audit entry
   */
  private async logAuditEntry(context: AccessContext & { success: boolean; details?: any }): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      userId: context.user.id,
      username: context.user.username,
      action: context.action,
      resource: context.resource,
      resourceId: context.resourceId,
      timestamp: new Date().toISOString(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: context.success,
      details: context.details,
      sessionId: (context as any).sessionId
    };

    this.auditLog.push(entry);

    // Log to structured logger
    logger.info('RBAC Audit Entry', entry);

    // Trigger alerts for failed access attempts
    if (!context.success) {
      this.handleFailedAccess(entry);
    }
  }

  /**
   * Handle failed access attempts
   */
  private handleFailedAccess(entry: AuditLogEntry): void {
    // Count recent failed attempts from same user/IP
    const recentWindow = Date.now() - 15 * 60 * 1000; // 15 minutes
    const recentFailures = this.auditLog.filter(log =>
      !log.success &&
      (log.userId === entry.userId || log.ipAddress === entry.ipAddress) &&
      new Date(log.timestamp).getTime() >= recentWindow
    );

    if (recentFailures.length >= 5) {
      logger.warn('Multiple failed access attempts detected', {
        userId: entry.userId,
        ipAddress: entry.ipAddress,
        attempts: recentFailures.length,
        timeWindow: '15 minutes'
      });
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters: {
    userId?: string;
    resource?: Resource;
    action?: Action;
    success?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: AuditLogEntry[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    let filteredLogs = [...this.auditLog];

    // Apply filters
    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }
    
    if (filters.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
    }
    
    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    
    if (filters.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === filters.success);
    }
    
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() >= startTime);
    }
    
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() <= endTime);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    return {
      data: paginatedLogs,
      pagination: {
        page,
        pageSize,
        total: filteredLogs.length,
        totalPages: Math.ceil(filteredLogs.length / pageSize)
      }
    };
  }

  /**
   * Get user permissions
   */
  getUserPermissions(role: Role): Permission[] {
    return this.rolePermissions.get(role) || [];
  }

  /**
   * Add custom permission to role
   */
  addRolePermission(role: Role, permission: Permission): void {
    const existing = this.rolePermissions.get(role) || [];
    
    // Check if permission for resource already exists
    const existingIndex = existing.findIndex(p => p.resource === permission.resource);
    
    if (existingIndex !== -1) {
      // Merge actions
      const existingPermission = existing[existingIndex];
      const mergedActions = [...new Set([...existingPermission.actions, ...permission.actions])];
      existing[existingIndex] = { ...permission, actions: mergedActions };
    } else {
      existing.push(permission);
    }
    
    this.rolePermissions.set(role, existing);
  }

  /**
   * Remove permission from role
   */
  removeRolePermission(role: Role, resource: Resource): void {
    const existing = this.rolePermissions.get(role) || [];
    const filtered = existing.filter(p => p.resource !== resource);
    this.rolePermissions.set(role, filtered);
  }

  /**
   * Get access statistics
   */
  getAccessStatistics(): {
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    accessesByRole: Record<Role, number>;
    accessesByResource: Record<Resource, number>;
    recentFailures: number;
  } {
    const total = this.auditLog.length;
    const successful = this.auditLog.filter(log => log.success).length;
    const failed = total - successful;
    
    const accessesByRole: Record<Role, number> = { admin: 0, analyst: 0, viewer: 0 };
    const accessesByResource: Record<Resource, number> = {
      datasets: 0, sentiment: 0, analytics: 0, users: 0,
      audit: 0, config: 0, exports: 0, jobs: 0
    };
    
    for (const log of this.auditLog) {
      // Note: We'd need to track role in audit log for accurate stats
      accessesByResource[log.resource as Resource] = (accessesByResource[log.resource as Resource] || 0) + 1;
    }
    
    // Count recent failures (last hour)
    const recentWindow = Date.now() - 60 * 60 * 1000;
    const recentFailures = this.auditLog.filter(log =>
      !log.success && new Date(log.timestamp).getTime() >= recentWindow
    ).length;
    
    return {
      totalAccesses: total,
      successfulAccesses: successful,
      failedAccesses: failed,
      accessesByRole,
      accessesByResource,
      recentFailures
    };
  }

  /**
   * Setup audit log cleanup
   */
  private setupAuditLogCleanup(): void {
    // Clean up audit logs older than 90 days every day
    setInterval(() => {
      const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
      const originalLength = this.auditLog.length;
      
      this.auditLog = this.auditLog.filter(log =>
        new Date(log.timestamp).getTime() >= cutoffTime
      );
      
      const removed = originalLength - this.auditLog.length;
      if (removed > 0) {
        logger.info(`RBAC audit log cleanup: removed ${removed} entries older than 90 days`);
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rbac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const rbacSystem = new RBACSystem();