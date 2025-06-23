import * as winston from 'winston';
import { ILogger } from '../container/interfaces';

export class LoggerService implements ILogger {
  private logger: winston.Logger;
  private defaultMeta: any = {};

  constructor(private config?: any) {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    let logLevel = 'info';
    try {
      logLevel = this.config?.get('LOG_LEVEL') || process.env.LOG_LEVEL || 'info';
    } catch (error) {
      logLevel = process.env.LOG_LEVEL || 'info';
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    // Create format
    const format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Create console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    );

    const transports: winston.transport[] = [];

    // Don't log to console in test environment
    if (!isTest) {
      transports.push(
        new winston.transports.Console({
          format: isDevelopment ? consoleFormat : format,
          level: logLevel
        })
      );
    }

    // Add file transports in non-test environments
    if (!isTest) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format,
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format,
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    if (!isTest) {
      this.logger.exceptions.handle(
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      );

      this.logger.rejections.handle(
        new winston.transports.File({ filename: 'logs/rejections.log' })
      );
    }
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, { ...this.defaultMeta, ...meta });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, { ...this.defaultMeta, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, { ...this.defaultMeta, ...meta });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, { ...this.defaultMeta, ...meta });
  }

  child(meta: any): ILogger {
    const childLogger = new LoggerService(this.config);
    childLogger.defaultMeta = { ...this.defaultMeta, ...meta };
    return childLogger;
  }

  // Additional utility methods
  profile(id: string): void {
    this.logger.profile(id);
  }

  startTimer(): winston.Profiler {
    return this.logger.startTimer();
  }

  setLevel(level: string): void {
    this.logger.level = level;
  }

  // Winston logger access for advanced usage
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}