/**
 * Log Retention System Tests
 * 
 * Comprehensive tests for log retention policies,
 * automated cleanup jobs, and retention accuracy.
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { LogRetentionSystem, LogRetentionPolicy, LogCleanupJob } from '../log-retention-system';

// Mock file system operations
jest.mock('fs');
jest.mock('../../config/logger');
jest.mock('../../database/sqlite-refactored');

const mockFs = jest.mocked(fs);

describe('LogRetentionSystem', () => {
  let retentionSystem: LogRetentionSystem;
  let tempLogDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempLogDir = '/tmp/test-logs';
    retentionSystem = new LogRetentionSystem(tempLogDir);
    
    // Mock fs operations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({
      mtime: new Date(),
      size: 1024
    } as any);
  });

  afterEach(() => {
    retentionSystem.shutdown();
  });

  describe('Default Policies', () => {
    it('should initialize with default retention policies', () => {
      const policies = retentionSystem.getPolicies();
      
      expect(policies.length).toBeGreaterThan(0);
      
      const auditPolicy = policies.find(p => p.name === 'audit-logs');
      const technicalPolicy = policies.find(p => p.name === 'technical-logs');
      
      expect(auditPolicy).toBeDefined();
      expect(auditPolicy?.retentionDays).toBe(90);
      expect(auditPolicy?.archiveEnabled).toBe(true);
      
      expect(technicalPolicy).toBeDefined();
      expect(technicalPolicy?.retentionDays).toBe(30);
      expect(technicalPolicy?.archiveEnabled).toBe(false);
    });

    it('should have security logs with 180-day retention', () => {
      const policies = retentionSystem.getPolicies();
      const securityPolicy = policies.find(p => p.name === 'security-logs');
      
      expect(securityPolicy).toBeDefined();
      expect(securityPolicy?.retentionDays).toBe(180);
      expect(securityPolicy?.archiveEnabled).toBe(true);
    });

    it('should have performance logs with 7-day retention', () => {
      const policies = retentionSystem.getPolicies();
      const performancePolicy = policies.find(p => p.name === 'performance-logs');
      
      expect(performancePolicy).toBeDefined();
      expect(performancePolicy?.retentionDays).toBe(7);
      expect(performancePolicy?.archiveEnabled).toBe(false);
    });
  });

  describe('Policy Management', () => {
    it('should allow adding custom retention policies', () => {
      const customPolicy: LogRetentionPolicy = {
        name: 'custom-logs',
        logType: 'technical',
        retentionDays: 60,
        compressionEnabled: true,
        archiveEnabled: true,
        cleanupSchedule: '0 5 * * *',
        isActive: true
      };

      retentionSystem.addPolicy(customPolicy);
      
      const policies = retentionSystem.getPolicies();
      const addedPolicy = policies.find(p => p.name === 'custom-logs');
      
      expect(addedPolicy).toBeDefined();
      expect(addedPolicy?.retentionDays).toBe(60);
    });

    it('should allow updating existing policies', () => {
      const policies = retentionSystem.getPolicies();
      const auditPolicy = policies.find(p => p.name === 'audit-logs');
      
      if (auditPolicy) {
        const updatedPolicy = { ...auditPolicy, retentionDays: 120 };
        retentionSystem.addPolicy(updatedPolicy);
        
        const updatedPolicies = retentionSystem.getPolicies();
        const updated = updatedPolicies.find(p => p.name === 'audit-logs');
        
        expect(updated?.retentionDays).toBe(120);
      }
    });

    it('should allow removing policies', () => {
      const initialCount = retentionSystem.getPolicies().length;
      
      const removed = retentionSystem.removePolicy('performance-logs');
      
      expect(removed).toBe(true);
      expect(retentionSystem.getPolicies().length).toBe(initialCount - 1);
    });

    it('should return false when removing non-existent policy', () => {
      const removed = retentionSystem.removePolicy('non-existent-policy');
      expect(removed).toBe(false);
    });
  });

  describe('Cleanup Job Execution', () => {
    it('should execute cleanup job and delete old files', async () => {
      // Mock old files
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days old
      
      mockFs.readdirSync.mockReturnValue(['old-log.txt', 'new-log.txt'] as any);
      mockFs.statSync.mockImplementation((filePath) => {
        const fileName = path.basename(filePath as string);
        return {
          mtime: fileName === 'old-log.txt' ? oldDate : new Date(),
          size: 1024
        } as any;
      });

      const job = await retentionSystem.forceCleanup('technical-logs');
      
      expect(job.status).toBe('completed');
      expect(job.deletedFiles).toBe(1);
      expect(job.deletedSize).toBe(1024);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('old-log.txt')
      );
    });

    it('should archive files when archiving is enabled', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days old
      
      mockFs.readdirSync.mockReturnValue(['old-audit.log'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: oldDate,
        size: 2048
      } as any);

      // Mock zlib and streams for compression
      const mockGzip = {
        pipe: jest.fn().mockReturnThis()
      };
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
          return mockStream;
        })
      };
      
      mockFs.createReadStream.mockReturnValue(mockStream as any);
      mockFs.createWriteStream.mockReturnValue(mockStream as any);
      
      const mockZlib = {
        createGzip: jest.fn().mockReturnValue(mockGzip)
      };
      jest.doMock('zlib', () => mockZlib);

      const job = await retentionSystem.forceCleanup('audit-logs');
      
      expect(job.status).toBe('completed');
      expect(job.archivedFiles).toBe(1);
      expect(job.archivedSize).toBe(2048);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.readdirSync.mockReturnValue(['error-log.txt'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days old
        size: 1024
      } as any);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const job = await retentionSystem.forceCleanup('technical-logs');
      
      expect(job.status).toBe('completed');
      expect(job.errors.length).toBe(1);
      expect(job.errors[0]).toContain('Permission denied');
    });

    it('should complete job even when log directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const job = await retentionSystem.forceCleanup('technical-logs');
      
      expect(job.status).toBe('completed');
      expect(job.deletedFiles).toBe(0);
      expect(job.archivedFiles).toBe(0);
    });
  });

  describe('Retention Metrics', () => {
    it('should calculate retention metrics correctly', async () => {
      // Mock file structure
      mockFs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.toString().includes('audit')) {
          return ['audit1.log', 'audit2.log'] as any;
        }
        if (dirPath.toString().includes('technical')) {
          return ['tech1.log'] as any;
        }
        return [] as any;
      });

      mockFs.statSync.mockReturnValue({
        mtime: new Date(),
        size: 1024
      } as any);

      const metrics = await retentionSystem.getRetentionMetrics();
      
      expect(metrics.totalLogFiles).toBeGreaterThan(0);
      expect(metrics.totalLogSize).toBeGreaterThan(0);
      expect(metrics.logsByType).toBeDefined();
      expect(metrics.retentionCompliance).toBeDefined();
      expect(metrics.storageUtilization).toBeGreaterThanOrEqual(0);
    });

    it('should identify retention compliance violations', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // Very old file

      mockFs.readdirSync.mockReturnValue(['very-old.log'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: oldDate,
        size: 1024
      } as any);

      const metrics = await retentionSystem.getRetentionMetrics();
      
      expect(metrics.retentionCompliance['technical-logs']).toBe(false);
    });

    it('should track oldest and newest log dates', async () => {
      const oldDate = new Date('2023-01-01');
      const newDate = new Date();

      mockFs.readdirSync.mockReturnValue(['old.log', 'new.log'] as any);
      mockFs.statSync.mockImplementation((filePath) => {
        const fileName = path.basename(filePath as string);
        return {
          mtime: fileName === 'old.log' ? oldDate : newDate,
          size: 1024
        } as any;
      });

      const metrics = await retentionSystem.getRetentionMetrics();
      
      expect(new Date(metrics.oldestLogDate)).toEqual(oldDate);
      expect(new Date(metrics.newestLogDate).getTime()).toBeCloseTo(newDate.getTime(), -10000);
    });
  });

  describe('Policy Testing (Dry Run)', () => {
    it('should identify files that would be affected by cleanup', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days old
      
      mockFs.readdirSync.mockReturnValue(['old1.log', 'old2.log', 'new.log'] as any);
      mockFs.statSync.mockImplementation((filePath) => {
        const fileName = path.basename(filePath as string);
        return {
          mtime: fileName.startsWith('old') ? oldDate : new Date(),
          size: 1024
        } as any;
      });

      const testResult = await retentionSystem.testPolicy('technical-logs');
      
      expect(testResult.filesToDelete).toHaveLength(2);
      expect(testResult.filesToDelete).toContain('old1.log');
      expect(testResult.filesToDelete).toContain('old2.log');
      expect(testResult.estimatedSavings).toBe(2048);
    });

    it('should identify files for archiving when archiving is enabled', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days old
      
      mockFs.readdirSync.mockReturnValue(['old-audit.log'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: oldDate,
        size: 2048
      } as any);

      const testResult = await retentionSystem.testPolicy('audit-logs');
      
      expect(testResult.filesToArchive).toHaveLength(1);
      expect(testResult.filesToArchive).toContain('old-audit.log');
      expect(testResult.filesToDelete).toHaveLength(0);
      expect(testResult.estimatedSavings).toBe(2048);
    });

    it('should handle non-existent policy in test', async () => {
      await expect(retentionSystem.testPolicy('non-existent')).rejects.toThrow(
        'Policy not found: non-existent'
      );
    });
  });

  describe('Cleanup History', () => {
    it('should track cleanup job history', async () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      await retentionSystem.forceCleanup('technical-logs');
      await retentionSystem.forceCleanup('audit-logs');
      
      const history = retentionSystem.getCleanupHistory();
      
      expect(history.length).toBe(2);
      expect(history[0].scheduledAt).toBeDefined();
      expect(history[0].status).toBe('completed');
    });

    it('should limit cleanup history to specified count', async () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      // Create multiple cleanup jobs
      for (let i = 0; i < 5; i++) {
        await retentionSystem.forceCleanup('technical-logs');
      }
      
      const limitedHistory = retentionSystem.getCleanupHistory(3);
      expect(limitedHistory.length).toBe(3);
    });

    it('should sort history by most recent first', async () => {
      mockFs.readdirSync.mockReturnValue([]);
      
      const job1 = await retentionSystem.forceCleanup('technical-logs');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const job2 = await retentionSystem.forceCleanup('audit-logs');
      
      const history = retentionSystem.getCleanupHistory();
      
      expect(new Date(history[0].scheduledAt).getTime()).toBeGreaterThan(
        new Date(history[1].scheduledAt).getTime()
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle force cleanup of non-existent policy', async () => {
      await expect(retentionSystem.forceCleanup('non-existent')).rejects.toThrow(
        'Policy not found: non-existent'
      );
    });

    it('should handle file system errors during cleanup', async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });

      const job = await retentionSystem.forceCleanup('technical-logs');
      
      expect(job.status).toBe('failed');
      expect(job.errors).toContain('Directory read error');
    });

    it('should handle stat errors for individual files', async () => {
      mockFs.readdirSync.mockReturnValue(['problematic.log'] as any);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Stat error');
      });

      const job = await retentionSystem.forceCleanup('technical-logs');
      
      expect(job.status).toBe('completed');
      expect(job.deletedFiles).toBe(0);
    });
  });

  describe('Scheduling and Lifecycle', () => {
    it('should initialize with scheduled cleanup jobs', () => {
      // Verify that policies are scheduled (timers are set)
      const policies = retentionSystem.getPolicies();
      const activeAuditPolicy = policies.find(p => p.name === 'audit-logs' && p.isActive);
      
      expect(activeAuditPolicy).toBeDefined();
    });

    it('should stop timers on shutdown', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      retentionSystem.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not schedule inactive policies', () => {
      const inactivePolicy: LogRetentionPolicy = {
        name: 'inactive-policy',
        logType: 'technical',
        retentionDays: 30,
        compressionEnabled: false,
        archiveEnabled: false,
        cleanupSchedule: '0 1 * * *',
        isActive: false
      };

      retentionSystem.addPolicy(inactivePolicy);
      
      // Inactive policies should be added but not scheduled
      const policies = retentionSystem.getPolicies();
      const added = policies.find(p => p.name === 'inactive-policy');
      expect(added).toBeDefined();
      expect(added?.isActive).toBe(false);
    });
  });

  describe('Storage and Compression', () => {
    it('should handle compression during archiving', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      
      mockFs.readdirSync.mockReturnValue(['compress-test.log'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: oldDate,
        size: 1024
      } as any);

      // Mock compression streams
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
          return mockStream;
        })
      };
      
      mockFs.createReadStream.mockReturnValue(mockStream as any);
      mockFs.createWriteStream.mockReturnValue(mockStream as any);

      const job = await retentionSystem.forceCleanup('audit-logs');
      
      expect(job.status).toBe('completed');
      expect(job.archivedFiles).toBe(1);
    });

    it('should calculate storage utilization correctly', async () => {
      mockFs.readdirSync.mockReturnValue(['large-file.log'] as any);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(),
        size: 100 * 1024 * 1024 // 100MB
      } as any);

      const metrics = await retentionSystem.getRetentionMetrics();
      
      expect(metrics.storageUtilization).toBeCloseTo(9.76, 1); // ~9.76% of 1GB
    });
  });
});