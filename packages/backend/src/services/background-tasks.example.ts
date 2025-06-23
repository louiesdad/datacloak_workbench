/**
 * Example background tasks configuration
 */

import { BackgroundTaskService, TaskConfig } from './background-task.service';
import { JobQueueService } from './job-queue.service';
import { getCacheService } from './cache.service';
import { getDuckDBConnection, getSQLiteConnection } from '../database';
import { SentimentService } from './sentiment.service';
import { SecurityService } from './security.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Initialize background task service with example tasks
 */
export function initializeBackgroundTasks(): BackgroundTaskService {
  const jobQueue = new JobQueueService();
  const taskService = new BackgroundTaskService(jobQueue);

  // Define tasks
  const tasks: TaskConfig[] = [
    // 1. Database cleanup task - runs daily at 2 AM
    {
      name: 'database-cleanup',
      schedule: '0 2 * * *', // Daily at 2 AM
      handler: async (context) => {
        const db = await getSQLiteConnection();
        
        // Clean up old sessions
        const deletedSessions = db.prepare(
          'DELETE FROM sessions WHERE created_at < ?'
        ).run(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        
        // Clean up orphaned data
        const deletedOrphans = db.prepare(
          'DELETE FROM data_entries WHERE dataset_id NOT IN (SELECT id FROM datasets)'
        ).run();
        
        // Vacuum database
        db.prepare('VACUUM').run();
        
        return {
          deletedSessions: deletedSessions.changes,
          deletedOrphans: deletedOrphans.changes,
          timestamp: new Date()
        };
      },
      metadata: {
        category: 'maintenance',
        priority: 'low'
      }
    },

    // 2. Cache warming task - runs every 30 minutes
    {
      name: 'cache-warmer',
      schedule: '*/30 * * * *', // Every 30 minutes
      handler: async (context) => {
        const cache = context.cache;
        const db = await getSQLiteConnection();
        
        // Warm frequently accessed data
        const popularDatasets = db.prepare(
          'SELECT * FROM datasets ORDER BY access_count DESC LIMIT 20'
        ).all();
        
        let warmed = 0;
        for (const dataset of popularDatasets as any[]) {
          await cache.set(`dataset:${dataset.id}`, dataset, { ttl: 1800 });
          warmed++;
        }
        
        // Warm configuration
        const config = db.prepare('SELECT * FROM config').all();
        await cache.set('app:config', config, { ttl: 3600 });
        
        return {
          warmedDatasets: warmed,
          warmedConfig: true,
          timestamp: new Date()
        };
      },
      maxExecutionTime: 60000, // 1 minute timeout
      metadata: {
        category: 'performance',
        priority: 'medium'
      }
    },

    // 3. Security audit task - runs every 6 hours
    {
      name: 'security-audit',
      schedule: '0 */6 * * *', // Every 6 hours
      handler: async (context) => {
        const securityService = new SecurityService();
        const db = await getSQLiteConnection();
        
        // Audit recent uploads
        const recentUploads = db.prepare(
          'SELECT * FROM datasets WHERE created_at > ?'
        ).all(new Date(Date.now() - 6 * 60 * 60 * 1000));
        
        const auditResults: any[] = [];
        for (const upload of recentUploads as any[]) {
          try {
            const result = await securityService.scanDataset(upload.id);
            auditResults.push({
              datasetId: upload.id,
              piiDetected: result.piiItemsDetected > 0,
              complianceScore: result.complianceScore
            });
          } catch (error) {
            auditResults.push({
              datasetId: upload.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        // Store audit results
        await context.cache.set('security:last-audit', {
          timestamp: new Date(),
          results: auditResults
        }, { ttl: 86400 });
        
        return {
          audited: auditResults.length,
          issues: auditResults.filter(r => r.piiDetected).length
        };
      },
      retryOnFailure: true,
      retryAttempts: 2,
      metadata: {
        category: 'security',
        priority: 'high'
      }
    },

    // 4. Metrics collection task - runs every 5 minutes
    {
      name: 'metrics-collector',
      schedule: '*/5 * * * *', // Every 5 minutes
      handler: async (context) => {
        const cache = context.cache;
        const stats = await cache.getStats();
        
        // Collect system metrics
        const metrics = {
          timestamp: new Date(),
          cache: {
            hitRate: stats.hitRate,
            missRate: stats.misses / (stats.totalOperations || 1),
            hits: stats.hits,
            misses: stats.misses
          },
          jobs: await context.jobQueue.getStats(),
          memory: process.memoryUsage(),
          uptime: process.uptime()
        };
        
        // Store in time series format
        const key = `metrics:${new Date().toISOString().slice(0, 13)}`; // Hour bucket
        const existing = await cache.get<any[]>(key) || [];
        existing.push(metrics);
        
        await cache.set(key, existing, { ttl: 86400 }); // Keep for 24 hours
        
        return {
          collected: true,
          timestamp: metrics.timestamp
        };
      },
      metadata: {
        category: 'monitoring',
        priority: 'medium'
      }
    },

    // 5. Backup task - runs daily at 3 AM
    {
      name: 'database-backup',
      schedule: '0 3 * * *', // Daily at 3 AM
      handler: async (context) => {
        const db = await getSQLiteConnection();
        const backupDir = path.join(process.cwd(), 'backups');
        
        // Ensure backup directory exists
        await fs.mkdir(backupDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
        
        // Perform backup (simplified - in production use proper backup tools)
        const tables = ['datasets', 'sessions', 'config', 'audit_logs'];
        let backupData = '';
        
        for (const table of tables) {
          const data = db.prepare(`SELECT * FROM ${table}`).all();
          backupData += `-- Table: ${table}\n`;
          backupData += JSON.stringify(data, null, 2);
          backupData += '\n\n';
        }
        
        await fs.writeFile(backupFile, backupData);
        
        // Clean old backups (keep last 7)
        const files = await fs.readdir(backupDir);
        const backupFiles = files
          .filter(f => f.startsWith('backup-'))
          .sort()
          .reverse();
        
        for (let i = 7; i < backupFiles.length; i++) {
          await fs.unlink(path.join(backupDir, backupFiles[i]));
        }
        
        return {
          backupFile,
          size: (await fs.stat(backupFile)).size,
          tablesBackedUp: tables.length,
          oldBackupsDeleted: Math.max(0, backupFiles.length - 7)
        };
      },
      maxExecutionTime: 300000, // 5 minutes
      metadata: {
        category: 'backup',
        priority: 'high'
      }
    },

    // 6. Sentiment analysis batch processor - runs every hour
    {
      name: 'sentiment-batch-processor',
      schedule: '0 * * * *', // Every hour
      handler: async (context) => {
        const db = await getSQLiteConnection();
        const sentimentService = new SentimentService();
        
        // Find unprocessed texts
        const unprocessed = db.prepare(
          'SELECT * FROM texts WHERE sentiment_score IS NULL LIMIT 100'
        ).all();
        
        if (unprocessed.length === 0) {
          return { processed: 0 };
        }
        
        // Create batch job
        const jobId = await context.jobQueue.addJob('sentiment_analysis_batch', {
          texts: unprocessed.map((r: any) => r.content),
          ids: unprocessed.map((r: any) => r.id)
        }, {
          priority: 'low'
        });
        
        return {
          jobId,
          scheduled: unprocessed.length,
          timestamp: new Date()
        };
      },
      metadata: {
        category: 'processing',
        priority: 'medium'
      }
    },

    // 7. Health check task - runs every minute
    {
      name: 'health-check',
      schedule: '* * * * *', // Every minute
      handler: async (context) => {
        const checks = {
          database: false,
          cache: false,
          jobQueue: false,
          timestamp: new Date()
        };
        
        // Check database
        try {
          const db = await getSQLiteConnection();
          db.prepare('SELECT 1');
          checks.database = true;
        } catch (error) {
          console.error('Database health check failed:', error);
        }
        
        // Check cache
        try {
          await context.cache.set('health:check', Date.now(), { ttl: 60 });
          const value = await context.cache.get('health:check');
          checks.cache = value !== null;
        } catch (error) {
          console.error('Cache health check failed:', error);
        }
        
        // Check job queue
        try {
          const stats = await context.jobQueue.getStats();
          checks.jobQueue = stats.total >= 0;
        } catch (error) {
          console.error('Job queue health check failed:', error);
        }
        
        // Store health status
        await context.cache.set('health:status', checks, { ttl: 120 });
        
        // Alert if any service is down
        if (!checks.database || !checks.cache || !checks.jobQueue) {
          console.error('Health check failed:', checks);
          // In production, send alert/notification
        }
        
        return checks;
      },
      maxExecutionTime: 30000, // 30 seconds
      metadata: {
        category: 'monitoring',
        priority: 'critical'
      }
    },

    // 8. Log rotation task - runs daily at 1 AM
    {
      name: 'log-rotation',
      schedule: '0 1 * * *', // Daily at 1 AM
      handler: async (context) => {
        const logsDir = path.join(process.cwd(), 'logs');
        
        try {
          const files = await fs.readdir(logsDir);
          const logFiles = files.filter(f => f.endsWith('.log'));
          
          let rotated = 0;
          for (const file of logFiles) {
            const filePath = path.join(logsDir, file);
            const stats = await fs.stat(filePath);
            
            // Rotate if file is larger than 100MB
            if (stats.size > 100 * 1024 * 1024) {
              const timestamp = new Date().toISOString().slice(0, 10);
              const rotatedPath = path.join(logsDir, `${file}.${timestamp}`);
              
              await fs.rename(filePath, rotatedPath);
              await fs.writeFile(filePath, ''); // Create new empty file
              
              // Compress old log
              // In production, use proper compression
              
              rotated++;
            }
          }
          
          // Delete logs older than 30 days
          let deleted = 0;
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          
          for (const file of files) {
            if (file.includes('.log.')) {
              const filePath = path.join(logsDir, file);
              const stats = await fs.stat(filePath);
              
              if (stats.mtime.getTime() < thirtyDaysAgo) {
                await fs.unlink(filePath);
                deleted++;
              }
            }
          }
          
          return {
            rotated,
            deleted,
            timestamp: new Date()
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          };
        }
      },
      metadata: {
        category: 'maintenance',
        priority: 'low'
      }
    }
  ];

  // Register all tasks
  const taskIds = taskService.registerTasks(tasks);
  
  console.log(`Registered ${taskIds.length} background tasks`);

  // Set up monitoring
  taskService.on('task:executed', (execution) => {
    console.log(`Task ${execution.taskName} completed with status ${execution.status}`);
  });

  taskService.on('task:error', (error) => {
    console.error('Task error:', error);
  });

  return taskService;
}

/**
 * Example of dynamically scheduling tasks
 */
export async function scheduleDataProcessing(
  taskService: BackgroundTaskService,
  datasetId: string,
  processAt: Date
): Promise<string> {
  // Calculate cron pattern for specific time
  const minutes = processAt.getMinutes();
  const hours = processAt.getHours();
  const day = processAt.getDate();
  const month = processAt.getMonth() + 1;
  
  const cronPattern = `${minutes} ${hours} ${day} ${month} *`;
  
  const taskId = taskService.registerTask({
    name: `process-dataset-${datasetId}`,
    schedule: cronPattern,
    handler: async (context) => {
      // Process the dataset
      const jobId = await context.jobQueue.addJob('file_processing', {
        datasetId,
        processingType: 'analyze'
      }, {
        priority: 'high'
      });
      
      // Unregister this one-time task
      taskService.unregisterTask(context.taskId);
      
      return {
        jobId,
        datasetId,
        processedAt: new Date()
      };
    },
    metadata: {
      datasetId,
      scheduledFor: processAt
    }
  });
  
  return taskId;
}

/**
 * Example usage
 */
async function example() {
  // Initialize service
  const taskService = initializeBackgroundTasks();
  
  // Get task status
  const tasks = taskService.getAllTasks();
  console.log('Active tasks:', tasks.map(t => t.config.name));
  
  // Execute a task immediately
  const healthCheck = tasks.find(t => t.config.name === 'health-check');
  if (healthCheck) {
    const result = await taskService.executeTask(healthCheck.taskId);
    console.log('Health check result:', result);
  }
  
  // Get task statistics
  const metricsTask = tasks.find(t => t.config.name === 'metrics-collector');
  if (metricsTask) {
    const stats = await taskService.getTaskStats(metricsTask.taskId);
    console.log('Metrics collector stats:', stats);
  }
  
  // Schedule a one-time task
  const scheduledTaskId = await scheduleDataProcessing(
    taskService,
    'dataset-123',
    new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
  );
  console.log('Scheduled processing task:', scheduledTaskId);
  
  // Clean up old history
  const cleaned = await taskService.cleanupHistory();
  console.log(`Cleaned ${cleaned} old execution records`);
}