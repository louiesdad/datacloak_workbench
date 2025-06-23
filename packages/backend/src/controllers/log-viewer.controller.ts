import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getSQLiteConnection } from '../database/sqlite-refactored';
import { AppError } from '../middleware/error.middleware';
import { Readable } from 'stream';
import archiver from 'archiver';

export class LogViewerController {
  private logsDirectory: string;
  
  constructor() {
    this.logsDirectory = path.join(__dirname, '../../logs');
  }

  /**
   * Get application logs with filtering and pagination
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        logType = 'combined',
        level,
        startDate,
        endDate,
        search,
        limit = 100,
        offset = 0
      } = req.query;

      const logFile = this.getLogFilePath(logType as string);
      
      if (!fs.existsSync(logFile)) {
        res.json({ logs: [], total: 0 });
        return;
      }

      const logs = await this.readLogsWithFilters({
        logFile,
        level: level as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        search: search as string,
        limit: Number(limit),
        offset: Number(offset)
      });

      res.json(logs);
    } catch (error) {
      throw new AppError('Failed to retrieve logs', 500, 'LOG_READ_ERROR');
    }
  }

  /**
   * Stream logs in real-time using Server-Sent Events
   */
  async streamLogs(req: Request, res: Response): Promise<void> {
    const { logType = 'combined' } = req.query;
    const logFile = this.getLogFilePath(logType as string);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Watch for file changes
    let tail: any;
    try {
      const Tail = require('tail').Tail;
      tail = new Tail(logFile);

      tail.on('line', (data: string) => {
        res.write(`data: ${JSON.stringify({ log: data, timestamp: new Date() })}\n\n`);
      });

      tail.on('error', (error: any) => {
        console.error('Tail error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Log streaming error' })}\n\n`);
      });

      // Clean up on client disconnect
      req.on('close', () => {
        if (tail) {
          tail.unwatch();
        }
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to start log streaming' })}\n\n`);
      res.end();
    }
  }

  /**
   * Download log files as a zip archive
   */
  async downloadLogs(req: Request, res: Response): Promise<void> {
    try {
      const { types = 'all' } = req.query;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=logs-${new Date().toISOString()}.zip`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      const logTypes = types === 'all' 
        ? ['combined', 'error', 'exceptions', 'rejections', 'performance']
        : (types as string).split(',');

      for (const type of logTypes) {
        const logFile = this.getLogFilePath(type);
        if (fs.existsSync(logFile)) {
          archive.file(logFile, { name: `${type}.log` });
        }
      }

      await archive.finalize();
    } catch (error) {
      throw new AppError('Failed to download logs', 500, 'LOG_DOWNLOAD_ERROR');
    }
  }

  /**
   * Clear old log files (with safety checks)
   */
  async clearLogs(req: Request, res: Response): Promise<void> {
    try {
      const { logType, olderThanDays = 30 } = req.body;
      
      if (!logType || logType === 'all') {
        throw new AppError('Must specify log type to clear', 400, 'INVALID_LOG_TYPE');
      }

      const logFile = this.getLogFilePath(logType);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(olderThanDays));

      // Create backup before clearing
      const backupPath = `${logFile}.backup-${Date.now()}`;
      await fs.promises.copyFile(logFile, backupPath);

      // Filter and rewrite log file
      const filteredLogs = await this.filterLogsByDate(logFile, cutoffDate);
      await fs.promises.writeFile(logFile, filteredLogs.join('\n'));

      res.json({
        success: true,
        message: `Cleared logs older than ${olderThanDays} days`,
        backupFile: backupPath
      });
    } catch (error) {
      throw new AppError('Failed to clear logs', 500, 'LOG_CLEAR_ERROR');
    }
  }

  /**
   * Get audit logs from database
   */
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        category,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const db = await getSQLiteConnection();
      
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(new Date(startDate as string).toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(new Date(endDate as string).toISOString());
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const logs = db.prepare(query).all(...params);
      
      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total').replace(/LIMIT.*$/, '');
      const { total } = db.prepare(countQuery).get(...params.slice(0, -2)) as { total: number };

      res.json({
        logs,
        total,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      throw new AppError('Failed to retrieve audit logs', 500, 'AUDIT_LOG_ERROR');
    }
  }

  /**
   * Export audit logs as CSV
   */
  async exportAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, category } = req.query;
      
      const db = await getSQLiteConnection();
      
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(new Date(startDate as string).toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(new Date(endDate as string).toISOString());
      }

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      query += ' ORDER BY created_at DESC';

      const logs = db.prepare(query).all(...params);

      // Convert to CSV
      const csv = this.convertToCSV(logs);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString()}.csv`);
      res.send(csv);
    } catch (error) {
      throw new AppError('Failed to export audit logs', 500, 'AUDIT_EXPORT_ERROR');
    }
  }

  // Helper methods

  private getLogFilePath(logType: string): string {
    const validLogTypes = ['combined', 'error', 'exceptions', 'rejections', 'performance'];
    if (!validLogTypes.includes(logType)) {
      throw new AppError('Invalid log type', 400, 'INVALID_LOG_TYPE');
    }
    return path.join(this.logsDirectory, `${logType}.log`);
  }

  private async readLogsWithFilters(options: {
    logFile: string;
    level?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ logs: any[]; total: number }> {
    const logs: any[] = [];
    let total = 0;
    let skipped = 0;

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(options.logFile);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const log = JSON.parse(line);
          
          // Apply filters
          if (options.level && log.level !== options.level) return;
          if (options.startDate && new Date(log.timestamp) < options.startDate) return;
          if (options.endDate && new Date(log.timestamp) > options.endDate) return;
          if (options.search && !JSON.stringify(log).toLowerCase().includes(options.search.toLowerCase())) return;

          total++;

          if (skipped >= options.offset && logs.length < options.limit) {
            logs.push(log);
          } else {
            skipped++;
          }
        } catch (e) {
          // Skip malformed log entries
        }
      });

      rl.on('close', () => resolve({ logs, total }));
      rl.on('error', reject);
    });
  }

  private async filterLogsByDate(logFile: string, cutoffDate: Date): Promise<string[]> {
    const filteredLogs: string[] = [];

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(logFile);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const log = JSON.parse(line);
          if (new Date(log.timestamp) >= cutoffDate) {
            filteredLogs.push(line);
          }
        } catch (e) {
          // Keep non-JSON logs
          filteredLogs.push(line);
        }
      });

      rl.on('close', () => resolve(filteredLogs));
      rl.on('error', reject);
    });
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }
}