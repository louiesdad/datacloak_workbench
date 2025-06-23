import { BackgroundTaskService, TaskConfig, TaskContext, TaskExecution } from '../background-task.service';
import { JobQueueService } from '../job-queue.service';
import { getCacheService } from '../cache.service';
import * as cron from 'node-cron';

// Mock dependencies
jest.mock('../cache.service');
jest.mock('../job-queue.service');
jest.mock('node-cron');

// Mock process event handlers
const originalOn = process.on;
let mockExitHandlers: any = {};

describe('BackgroundTaskService', () => {
  let service: BackgroundTaskService;
  let mockJobQueue: jest.Mocked<JobQueueService>;
  let mockCache: any;
  let mockCronTask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExitHandlers = {};
    
    // Mock process.on to capture handlers
    process.on = jest.fn((event: string, handler: any) => {
      mockExitHandlers[event] = handler;
      return process;
    }) as any;
    
    // Reset cron mock
    mockCronTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn()
    };
    
    (cron.schedule as jest.Mock).mockReturnValue(mockCronTask);
    (cron.validate as jest.Mock).mockReturnValue(true);
    
    // Mock cache
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true)
    };
    (getCacheService as jest.Mock).mockReturnValue(mockCache);
    
    // Mock job queue
    mockJobQueue = new JobQueueService() as jest.Mocked<JobQueueService>;
    
    service = new BackgroundTaskService(mockJobQueue);
  });

  afterEach(() => {
    // Restore process.on
    process.on = originalOn;
  });

  describe('registerTask', () => {
    const mockHandler = jest.fn().mockResolvedValue({ success: true });
    
    const validConfig: TaskConfig = {
      name: 'test-task',
      schedule: '*/5 * * * *', // Every 5 minutes
      handler: mockHandler,
      enabled: true
    };

    test('should register task successfully', () => {
      const taskId = service.registerTask(validConfig);
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(cron.schedule).toHaveBeenCalledWith(
        validConfig.schedule,
        expect.any(Function),
        expect.objectContaining({ timezone: undefined })
      );
    });

    test('should start task if enabled', () => {
      service.registerTask(validConfig);
      
      expect(cron.schedule).toHaveBeenCalled();
    });

    test('should not start task if disabled', () => {
      const disabledConfig = { ...validConfig, enabled: false };
      const taskId = service.registerTask(disabledConfig);
      
      // Task should be registered but not running
      const status = service.getTaskStatus(taskId);
      expect(status).toBeDefined();
      expect(status!.running).toBe(false);
    });

    test('should validate cron pattern', () => {
      (cron.validate as jest.Mock).mockReturnValue(false);
      
      expect(() => {
        service.registerTask({
          ...validConfig,
          schedule: 'invalid-cron'
        });
      }).toThrow('Invalid cron pattern');
    });

    test('should emit task:registered event', () => {
      const eventSpy = jest.fn();
      service.on('task:registered', eventSpy);
      
      const taskId = service.registerTask(validConfig);
      
      expect(eventSpy).toHaveBeenCalledWith({
        taskId,
        name: validConfig.name,
        schedule: validConfig.schedule
      });
    });

    test('should register task with timezone', () => {
      const configWithTimezone = {
        ...validConfig,
        timezone: 'America/New_York'
      };
      
      service.registerTask(configWithTimezone);
      
      expect(cron.schedule).toHaveBeenCalledWith(
        validConfig.schedule,
        expect.any(Function),
        expect.objectContaining({ timezone: 'America/New_York' })
      );
    });

    test('should register task with metadata', () => {
      const configWithMetadata = {
        ...validConfig,
        metadata: { priority: 'high', category: 'maintenance' }
      };
      
      const taskId = service.registerTask(configWithMetadata);
      const status = service.getTaskStatus(taskId);
      
      expect(status?.task.metadata).toEqual(configWithMetadata.metadata);
    });
  });

  describe('registerTasks', () => {
    test('should register multiple tasks', () => {
      const configs: TaskConfig[] = [
        {
          name: 'task-1',
          schedule: '0 * * * *',
          handler: jest.fn()
        },
        {
          name: 'task-2',
          schedule: '*/30 * * * *',
          handler: jest.fn()
        }
      ];
      
      const taskIds = service.registerTasks(configs);
      
      expect(taskIds).toHaveLength(2);
      expect(taskIds[0]).toBeDefined();
      expect(taskIds[1]).toBeDefined();
      expect(taskIds[0]).not.toBe(taskIds[1]);
    });
  });

  describe('unregisterTask', () => {
    test('should unregister existing task', () => {
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '*/5 * * * *',
        handler: jest.fn()
      });
      
      const result = service.unregisterTask(taskId);
      
      expect(result).toBe(true);
      expect(mockCronTask.stop).toHaveBeenCalled();
      expect(service.getTaskStatus(taskId)).toBeNull();
    });

    test('should return false for non-existent task', () => {
      const result = service.unregisterTask('non-existent');
      expect(result).toBe(false);
    });

    test('should emit task:unregistered event', () => {
      const eventSpy = jest.fn();
      service.on('task:unregistered', eventSpy);
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '*/5 * * * *',
        handler: jest.fn()
      });
      
      service.unregisterTask(taskId);
      
      expect(eventSpy).toHaveBeenCalledWith({ taskId });
    });
  });

  describe('task control', () => {
    let taskId: string;
    
    beforeEach(() => {
      taskId = service.registerTask({
        name: 'test-task',
        schedule: '*/5 * * * *',
        handler: jest.fn(),
        enabled: false // Start disabled
      });
    });

    test('should start specific task', () => {
      const result = service.startTask(taskId);
      
      expect(result).toBe(true);
    });

    test('should stop specific task', () => {
      service.startTask(taskId);
      const result = service.stopTask(taskId);
      
      expect(result).toBe(true);
      expect(mockCronTask.stop).toHaveBeenCalled();
    });

    test('should return false for non-existent task', () => {
      expect(service.startTask('non-existent')).toBe(false);
      expect(service.stopTask('non-existent')).toBe(false);
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      // Register multiple tasks
      service.registerTask({
        name: 'task-1',
        schedule: '0 * * * *',
        handler: jest.fn()
      });
      
      service.registerTask({
        name: 'task-2',
        schedule: '*/30 * * * *',
        handler: jest.fn()
      });
    });

    test('should start all tasks', () => {
      const eventSpy = jest.fn();
      service.on('tasks:started', eventSpy);
      
      service.startAll();
      
      expect(eventSpy).toHaveBeenCalledWith({ count: 2 });
    });

    test('should stop all tasks', () => {
      const eventSpy = jest.fn();
      service.on('tasks:stopped', eventSpy);
      
      service.stopAll();
      
      expect(mockCronTask.stop).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith({ count: 2 });
    });
  });

  describe('executeTask', () => {
    test('should execute task immediately', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ executed: true });
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      const execution = await service.executeTask(taskId);
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          taskName: 'test-task',
          executionId: expect.any(String),
          startTime: expect.any(Date)
        })
      );
      
      expect(execution.status).toBe('completed');
      expect(execution.result).toEqual({ executed: true });
    });

    test('should handle task execution failure', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Task failed'));
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      const execution = await service.executeTask(taskId);
      
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('Task failed');
    });

    test('should handle task timeout', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { executed: true };
      });
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler,
        maxExecutionTime: 100
      });
      
      const execution = await service.executeTask(taskId);
      
      expect(execution.status).toBe('timeout');
      expect(execution.error).toBe('Task timeout');
    });

    test('should throw error for non-existent task', async () => {
      await expect(service.executeTask('non-existent')).rejects.toThrow('Task not found');
    });

    test('should prevent concurrent execution', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { executed: true };
      });
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      // Start first execution
      const promise1 = service.executeTask(taskId);
      
      // Try to start second execution
      await expect(service.executeTask(taskId)).rejects.toThrow('Task already executing');
      
      // Wait for first to complete
      await promise1;
    });

    test('should provide context to handler', async () => {
      let capturedContext: TaskContext | null = null;
      const mockHandler = jest.fn().mockImplementation(async (context: TaskContext) => {
        capturedContext = context;
        return { executed: true };
      });
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler,
        metadata: { priority: 'high' }
      });
      
      await service.executeTask(taskId);
      
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.taskId).toBe(taskId);
      expect(capturedContext!.taskName).toBe('test-task');
      expect(capturedContext!.metadata).toEqual({ priority: 'high' });
      expect(capturedContext!.cache).toBeDefined();
      expect(capturedContext!.jobQueue).toBeDefined();
    });
  });

  describe('task status and monitoring', () => {
    test('should get task status', () => {
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '*/15 * * * *',
        handler: jest.fn()
      });
      
      const status = service.getTaskStatus(taskId);
      
      expect(status).toBeDefined();
      expect(status!.task.name).toBe('test-task');
      expect(status!.running).toBe(true);
    });

    test('should return null for non-existent task', () => {
      const status = service.getTaskStatus('non-existent');
      expect(status).toBeNull();
    });

    test('should get all tasks', () => {
      service.registerTask({
        name: 'task-1',
        schedule: '0 * * * *',
        handler: jest.fn()
      });
      
      service.registerTask({
        name: 'task-2',
        schedule: '*/30 * * * *',
        handler: jest.fn(),
        enabled: false
      });
      
      const tasks = service.getAllTasks();
      
      expect(tasks).toHaveLength(2);
      expect(tasks[0].config.name).toBe('task-1');
      expect(tasks[0].running).toBe(true);
      expect(tasks[1].config.name).toBe('task-2');
      expect(tasks[1].running).toBe(false);
    });
  });

  describe('execution history', () => {
    test('should record task execution', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      await service.executeTask(taskId);
      
      expect(mockCache.set).toHaveBeenCalledWith(
        `task:history:${taskId}`,
        expect.arrayContaining([
          expect.objectContaining({
            taskId,
            status: 'completed',
            result: { success: true }
          })
        ]),
        { ttl: 86400 }
      );
    });

    test('should get task history', async () => {
      const taskId = 'test-task-id';
      const mockHistory: TaskExecution[] = [
        {
          executionId: 'exec-1',
          taskId,
          taskName: 'test-task',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          duration: 1000
        },
        {
          executionId: 'exec-2',
          taskId,
          taskName: 'test-task',
          startTime: new Date(),
          endTime: new Date(),
          status: 'failed',
          error: 'Test error',
          duration: 500
        }
      ];
      
      mockCache.get.mockResolvedValue(mockHistory);
      
      const history = await service.getTaskHistory(taskId);
      
      expect(history).toEqual(mockHistory);
      expect(mockCache.get).toHaveBeenCalledWith(`task:history:${taskId}`);
    });

    test('should limit history results', async () => {
      const taskId = 'test-task-id';
      const mockHistory = Array(20).fill(null).map((_, i) => ({
        executionId: `exec-${i}`,
        taskId,
        taskName: 'test-task',
        startTime: new Date(),
        status: 'completed'
      }));
      
      mockCache.get.mockResolvedValue(mockHistory);
      
      const history = await service.getTaskHistory(taskId, 5);
      
      expect(history).toHaveLength(5);
    });
  });

  describe('task statistics', () => {
    test('should calculate task statistics', async () => {
      const taskId = 'test-task-id';
      const mockHistory: TaskExecution[] = [
        {
          executionId: 'exec-1',
          taskId,
          taskName: 'test-task',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          duration: 1000
        },
        {
          executionId: 'exec-2',
          taskId,
          taskName: 'test-task',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          duration: 1500
        },
        {
          executionId: 'exec-3',
          taskId,
          taskName: 'test-task',
          startTime: new Date(),
          endTime: new Date(),
          status: 'failed',
          duration: 500
        }
      ];
      
      // Mock getTaskHistory
      jest.spyOn(service, 'getTaskHistory').mockResolvedValue(mockHistory);
      
      const stats = await service.getTaskStats(taskId);
      
      expect(stats).toBeDefined();
      expect(stats!.totalExecutions).toBe(3);
      expect(stats!.successfulExecutions).toBe(2);
      expect(stats!.failedExecutions).toBe(1);
      expect(stats!.averageDuration).toBe(1000); // (1000 + 1500 + 500) / 3
    });

    test('should return null for task with no history', async () => {
      jest.spyOn(service, 'getTaskHistory').mockResolvedValue([]);
      
      const stats = await service.getTaskStats('no-history-task');
      expect(stats).toBeNull();
    });
  });

  describe('cleanup', () => {
    test('should clean up old execution history', async () => {
      // Set up execution history
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: jest.fn()
      });
      
      // Add some mock history
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const recentDate = new Date();
      
      const mockHistory = [
        { executionId: '1', taskId, startTime: oldDate, status: 'completed' as const, taskName: 'test' },
        { executionId: '2', taskId, startTime: oldDate, status: 'completed' as const, taskName: 'test' },
        { executionId: '3', taskId, startTime: recentDate, status: 'completed' as const, taskName: 'test' }
      ];
      
      // Manually set history
      (service as any).executionHistory.set(taskId, mockHistory);
      
      const cleaned = await service.cleanupHistory();
      
      expect(cleaned).toBe(2);
      expect(mockCache.set).toHaveBeenCalledWith(
        `task:history:${taskId}`,
        expect.arrayContaining([
          expect.objectContaining({ executionId: '3' })
        ]),
        { ttl: 86400 }
      );
    });
  });

  describe('cron validation', () => {
    test('should validate cron patterns', () => {
      (cron.validate as jest.Mock).mockReturnValue(true);
      expect(BackgroundTaskService.validateCronPattern('*/5 * * * *')).toBe(true);
      
      (cron.validate as jest.Mock).mockReturnValue(false);
      expect(BackgroundTaskService.validateCronPattern('invalid')).toBe(false);
    });

    test('should get next execution time', () => {
      const nextTime = BackgroundTaskService.getNextExecutionTime('*/5 * * * *');
      expect(nextTime).toBeInstanceOf(Date);
    });

    test('should return null for invalid pattern', () => {
      (cron.validate as jest.Mock).mockReturnValue(false);
      const nextTime = BackgroundTaskService.getNextExecutionTime('invalid');
      expect(nextTime).toBeNull();
    });
  });

  describe('shutdown', () => {
    test('should shutdown gracefully', async () => {
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: jest.fn()
      });
      
      const eventSpy = jest.fn();
      service.on('shutdown', eventSpy);
      
      await service.shutdown();
      
      expect(mockCronTask.stop).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should wait for running tasks', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { executed: true };
      });
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      // Start execution
      const execPromise = service.executeTask(taskId);
      
      // Shutdown should wait
      const shutdownPromise = service.shutdown();
      
      await Promise.all([execPromise, shutdownPromise]);
      
      expect(mockHandler).toHaveBeenCalled();
    });

    test('should handle SIGTERM and SIGINT', () => {
      expect(mockExitHandlers.SIGTERM).toBeDefined();
      expect(mockExitHandlers.SIGINT).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('should emit task:executed event on completion', async () => {
      const eventSpy = jest.fn();
      service.on('task:executed', eventSpy);
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: jest.fn().mockResolvedValue({ done: true })
      });
      
      await service.executeTask(taskId);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          status: 'completed'
        })
      );
    });

    test('should handle handler errors gracefully', async () => {
      const mockHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: mockHandler
      });
      
      const execution = await service.executeTask(taskId);
      
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('Handler error');
    });
  });

  describe('retry logic', () => {
    test('should emit retry event on failure with retry enabled', async () => {
      const eventSpy = jest.fn();
      
      const taskId = service.registerTask({
        name: 'test-task',
        schedule: '0 * * * *',
        handler: jest.fn().mockRejectedValue(new Error('Task failed')),
        retryOnFailure: true
      });
      
      // Listen to retry event on the task
      const task = (service as any).tasks.get(taskId);
      task.on('task:retry', eventSpy);
      
      await service.executeTask(taskId);
      
      expect(eventSpy).toHaveBeenCalledWith({
        taskId,
        error: 'Task failed'
      });
    });
  });

  describe('scheduled execution', () => {
    test('should execute task on schedule', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ scheduled: true });
      let scheduledFunction: Function;
      
      // Capture the scheduled function
      (cron.schedule as jest.Mock).mockImplementation((pattern, fn) => {
        scheduledFunction = fn;
        return mockCronTask;
      });
      
      service.registerTask({
        name: 'scheduled-task',
        schedule: '*/5 * * * *',
        handler: mockHandler
      });
      
      // Simulate cron trigger
      await scheduledFunction!();
      
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});