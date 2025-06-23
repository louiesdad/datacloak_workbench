/**
 * RBAC System Tests
 * 
 * Comprehensive tests for role-based access control,
 * permission enforcement, and audit trail functionality.
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { RBACSystem, User, Role, Permission, AccessContext } from '../rbac-system';
import { AppError } from '../../middleware/error.middleware';

// Mock logger
jest.mock('../../config/logger');

describe('RBACSystem', () => {
  let rbacSystem: RBACSystem;
  let mockUser: User;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    rbacSystem = new RBACSystem();
    
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@company.com',
      role: 'analyst',
      permissions: [],
      isActive: true,
      lastLogin: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    mockRequest = {
      user: mockUser,
      params: { id: 'resource-123' },
      body: { name: 'test' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('Role Permissions', () => {
    it('should have default permissions for all roles', () => {
      const adminPermissions = rbacSystem.getUserPermissions('admin');
      const analystPermissions = rbacSystem.getUserPermissions('analyst');
      const viewerPermissions = rbacSystem.getUserPermissions('viewer');

      expect(adminPermissions.length).toBeGreaterThan(0);
      expect(analystPermissions.length).toBeGreaterThan(0);
      expect(viewerPermissions.length).toBeGreaterThan(0);
    });

    it('should give admin full access to all resources', () => {
      const adminPermissions = rbacSystem.getUserPermissions('admin');
      
      expect(adminPermissions.some(p => p.resource === 'users' && p.actions.includes('admin'))).toBe(true);
      expect(adminPermissions.some(p => p.resource === 'datasets' && p.actions.includes('delete'))).toBe(true);
      expect(adminPermissions.some(p => p.resource === 'audit' && p.actions.includes('admin'))).toBe(true);
    });

    it('should restrict analyst permissions appropriately', () => {
      const analystPermissions = rbacSystem.getUserPermissions('analyst');
      
      expect(analystPermissions.some(p => p.resource === 'users' && p.actions.includes('admin'))).toBe(false);
      expect(analystPermissions.some(p => p.resource === 'datasets' && p.actions.includes('create'))).toBe(true);
      expect(analystPermissions.some(p => p.resource === 'datasets' && p.actions.includes('delete'))).toBe(false);
    });

    it('should give viewer read-only access', () => {
      const viewerPermissions = rbacSystem.getUserPermissions('viewer');
      
      for (const permission of viewerPermissions) {
        expect(permission.actions.every(action => ['read', 'download'].includes(action))).toBe(true);
      }
    });
  });

  describe('Permission Checking', () => {
    it('should allow valid permissions', async () => {
      const context: AccessContext = {
        user: { ...mockUser, role: 'admin' },
        resource: 'datasets',
        action: 'create',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(true);
    });

    it('should deny invalid permissions', async () => {
      const context: AccessContext = {
        user: { ...mockUser, role: 'viewer' },
        resource: 'datasets',
        action: 'delete',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(false);
    });

    it('should deny access for inactive users', async () => {
      const context: AccessContext = {
        user: { ...mockUser, isActive: false },
        resource: 'datasets',
        action: 'read',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(false);
    });

    it('should enforce owner conditions for self-access', async () => {
      const context: AccessContext = {
        user: mockUser,
        resource: 'audit',
        action: 'read',
        resourceId: mockUser.id, // Accessing own audit logs
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(true);
    });

    it('should deny access to other users audit logs for non-admin', async () => {
      const context: AccessContext = {
        user: mockUser,
        resource: 'audit',
        action: 'read',
        resourceId: 'other-user-123', // Accessing someone else's audit logs
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Express Middleware', () => {
    it('should allow access with valid permissions', () => {
      const middleware = rbacSystem.requirePermission('datasets', 'read');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access without authentication', () => {
      const middleware = rbacSystem.requirePermission('datasets', 'read');
      const unauthenticatedRequest = { ...mockRequest, user: undefined };
      
      expect(() => {
        middleware(unauthenticatedRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should deny access with insufficient permissions', async () => {
      const middleware = rbacSystem.requirePermission('users', 'admin');
      const viewerUser = { ...mockUser, role: 'viewer' as Role };
      const requestWithViewer = { ...mockRequest, user: viewerUser };

      await expect(async () => {
        middleware(requestWithViewer as Request, mockResponse as Response, mockNext);
      }).rejects.toThrow(AppError);
    });

    it('should enforce role requirements', () => {
      const middleware = rbacSystem.requireRole('admin');
      
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(AppError);
      
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow any of specified roles', () => {
      const middleware = rbacSystem.requireAnyRole(['analyst', 'admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    it('should log successful access attempts', async () => {
      const context: AccessContext = {
        user: { ...mockUser, role: 'admin' },
        resource: 'datasets',
        action: 'create',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      await rbacSystem.checkPermission(context);

      const auditLogs = await rbacSystem.getAuditLogs({});
      expect(auditLogs.data.length).toBeGreaterThan(0);
      expect(auditLogs.data[0].success).toBe(true);
      expect(auditLogs.data[0].userId).toBe(mockUser.id);
      expect(auditLogs.data[0].action).toBe('create');
      expect(auditLogs.data[0].resource).toBe('datasets');
    });

    it('should log failed access attempts', async () => {
      const context: AccessContext = {
        user: { ...mockUser, role: 'viewer' },
        resource: 'datasets',
        action: 'delete',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      await rbacSystem.checkPermission(context);

      const auditLogs = await rbacSystem.getAuditLogs({ success: false });
      expect(auditLogs.data.length).toBeGreaterThan(0);
      expect(auditLogs.data[0].success).toBe(false);
      expect(auditLogs.data[0].details?.reason).toBeDefined();
    });

    it('should filter audit logs by user', async () => {
      // Create some audit entries
      await rbacSystem.checkPermission({
        user: mockUser,
        resource: 'datasets',
        action: 'read',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const auditLogs = await rbacSystem.getAuditLogs({ userId: mockUser.id });
      expect(auditLogs.data.every(log => log.userId === mockUser.id)).toBe(true);
    });

    it('should filter audit logs by resource and action', async () => {
      await rbacSystem.checkPermission({
        user: { ...mockUser, role: 'admin' },
        resource: 'datasets',
        action: 'create',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const auditLogs = await rbacSystem.getAuditLogs({ 
        resource: 'datasets', 
        action: 'create' 
      });
      
      expect(auditLogs.data.every(log => 
        log.resource === 'datasets' && log.action === 'create'
      )).toBe(true);
    });

    it('should paginate audit logs correctly', async () => {
      // Create multiple audit entries
      for (let i = 0; i < 5; i++) {
        await rbacSystem.checkPermission({
          user: mockUser,
          resource: 'datasets',
          action: 'read',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent'
        });
      }

      const page1 = await rbacSystem.getAuditLogs({ page: 1, pageSize: 3 });
      const page2 = await rbacSystem.getAuditLogs({ page: 2, pageSize: 3 });

      expect(page1.data.length).toBeLessThanOrEqual(3);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.pageSize).toBe(3);
      expect(page2.pagination.page).toBe(2);
    });

    it('should filter audit logs by date range', async () => {
      const startDate = new Date().toISOString();
      
      await rbacSystem.checkPermission({
        user: mockUser,
        resource: 'datasets',
        action: 'read',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const auditLogs = await rbacSystem.getAuditLogs({ 
        startDate,
        endDate: new Date().toISOString()
      });

      expect(auditLogs.data.every(log => 
        new Date(log.timestamp).getTime() >= new Date(startDate).getTime()
      )).toBe(true);
    });
  });

  describe('Custom Permissions', () => {
    it('should allow adding custom permissions to roles', () => {
      const customPermission: Permission = {
        resource: 'datasets',
        actions: ['export'],
        conditions: [{ field: 'ownerId', operator: 'equals', value: 'user-123' }]
      };

      rbacSystem.addRolePermission('analyst', customPermission);

      const analystPermissions = rbacSystem.getUserPermissions('analyst');
      const datasetPermission = analystPermissions.find(p => p.resource === 'datasets');
      
      expect(datasetPermission?.actions).toContain('export');
    });

    it('should allow removing permissions from roles', () => {
      rbacSystem.removeRolePermission('viewer', 'datasets');

      const viewerPermissions = rbacSystem.getUserPermissions('viewer');
      expect(viewerPermissions.find(p => p.resource === 'datasets')).toBeUndefined();
    });

    it('should merge actions when adding permission for existing resource', () => {
      const existingPermissions = rbacSystem.getUserPermissions('analyst');
      const datasetPermission = existingPermissions.find(p => p.resource === 'datasets');
      const originalActions = datasetPermission?.actions || [];

      const additionalPermission: Permission = {
        resource: 'datasets',
        actions: ['admin']
      };

      rbacSystem.addRolePermission('analyst', additionalPermission);

      const updatedPermissions = rbacSystem.getUserPermissions('analyst');
      const updatedDatasetPermission = updatedPermissions.find(p => p.resource === 'datasets');
      
      expect(updatedDatasetPermission?.actions).toEqual(
        expect.arrayContaining([...originalActions, 'admin'])
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide access statistics', async () => {
      // Create some access attempts
      await rbacSystem.checkPermission({
        user: { ...mockUser, role: 'admin' },
        resource: 'datasets',
        action: 'create',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      await rbacSystem.checkPermission({
        user: { ...mockUser, role: 'viewer' },
        resource: 'datasets',
        action: 'delete', // This should fail
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const stats = rbacSystem.getAccessStatistics();
      
      expect(stats.totalAccesses).toBeGreaterThan(0);
      expect(stats.successfulAccesses).toBeGreaterThan(0);
      expect(stats.failedAccesses).toBeGreaterThan(0);
      expect(typeof stats.accessesByResource).toBe('object');
    });

    it('should track recent failures', async () => {
      // Create a failed access attempt
      await rbacSystem.checkPermission({
        user: { ...mockUser, role: 'viewer' },
        resource: 'users',
        action: 'admin',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      const stats = rbacSystem.getAccessStatistics();
      expect(stats.recentFailures).toBeGreaterThan(0);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate equals condition correctly', async () => {
      const context: AccessContext = {
        user: mockUser,
        resource: 'users',
        action: 'read',
        resourceId: mockUser.id,
        data: { id: mockUser.id },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(true);
    });

    it('should evaluate in condition correctly', async () => {
      // Add a custom permission with 'in' condition
      const customPermission: Permission = {
        resource: 'datasets',
        actions: ['read'],
        conditions: [{ field: 'category', operator: 'in', value: ['public', 'shared'] }]
      };

      rbacSystem.addRolePermission('viewer', customPermission);

      const context: AccessContext = {
        user: { ...mockUser, role: 'viewer' },
        resource: 'datasets',
        action: 'read',
        data: { category: 'public' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(true);
    });

    it('should evaluate owner condition for self-access', async () => {
      const context: AccessContext = {
        user: mockUser,
        resource: 'users',
        action: 'read',
        resourceId: mockUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user roles gracefully', async () => {
      const context: AccessContext = {
        user: { ...mockUser, role: 'invalid_role' as Role },
        resource: 'datasets',
        action: 'read',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(false);
    });

    it('should handle missing user in middleware gracefully', () => {
      const middleware = rbacSystem.requirePermission('datasets', 'read');
      const requestWithoutUser = { ...mockRequest, user: undefined };
      
      expect(() => {
        middleware(requestWithoutUser as Request, mockResponse as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should log permission check errors', async () => {
      // Force an error by passing malformed context
      const context = {
        user: null,
        resource: 'datasets',
        action: 'read',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      } as any;

      const hasPermission = await rbacSystem.checkPermission(context);
      expect(hasPermission).toBe(false);
    });
  });
});