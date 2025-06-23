import winston from 'winston';
import path from 'path';

// Enhanced logger configuration with performance tracking and debugging capabilities
const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Custom format for enhanced debugging
const debugFormat = winston.format.printf(({ level, message, timestamp, stack, duration, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]`;
  
  // Add correlation ID if available
  if (meta.correlationId) {
    log += ` [${meta.correlationId}]`;
  }
  
  // Add component/service info
  if (meta.component) {
    log += ` [${meta.component}]`;
  }
  
  log += `: ${message}`;
  
  // Add performance timing if available
  if (duration !== undefined) {
    log += ` (${duration}ms)`;
  }
  
  // Add stack trace for errors
  if (stack) {
    log += `\n${stack}`;
  }
  
  // Add additional metadata
  const metaKeys = Object.keys(meta).filter(key => 
    !['service', 'component', 'correlationId', 'timestamp', 'level', 'message'].includes(key)
  );
  
  if (metaKeys.length > 0) {
    const metaStr = metaKeys.map(key => `${key}=${JSON.stringify(meta[key])}`).join(' ');
    log += ` | ${metaStr}`;
  }
  
  return log;
});

// Create transports array based on environment
const transports: winston.transport[] = [
  // Console transport for development and general logging
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      debugFormat
    )
  })
];

// Add file transports in production or when LOG_TO_FILE is enabled
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // General application logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'application.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5
    })
  );
  
  // Error-only logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  );
  
  // Performance logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'performance.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format((info) => {
          // Only log performance-related entries
          if (info.component === 'performance' || info.duration !== undefined) {
            return info;
          }
          return false;
        })()
      ),
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 3
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: { 
    service: 'datacloak-backend',
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown'
  },
  transports,
  // Enhanced error handling
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        debugFormat
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        debugFormat
      )
    })
  ]
});

// Enhanced logger interface with performance tracking
interface EnhancedLogger extends winston.Logger {
  performance: (message: string, startTime: number, meta?: any) => void;
  database: (message: string, meta?: any) => void;
  redis: (message: string, meta?: any) => void;
  queue: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  api: (message: string, meta?: any) => void;
  customStartTimer: (label: string) => () => void;
}

// Add performance logging method
(logger as any).performance = function(message: string, startTime: number, meta: any = {}) {
  const duration = Date.now() - startTime;
  this.info(message, {
    component: 'performance',
    duration,
    ...meta
  });
};

// Add component-specific logging methods
(logger as any).database = function(message: string, meta: any = {}) {
  this.info(message, { component: 'database', ...meta });
};

(logger as any).redis = function(message: string, meta: any = {}) {
  this.info(message, { component: 'redis', ...meta });
};

(logger as any).queue = function(message: string, meta: any = {}) {
  this.info(message, { component: 'queue', ...meta });
};

(logger as any).security = function(message: string, meta: any = {}) {
  this.info(message, { component: 'security', ...meta });
};

(logger as any).api = function(message: string, meta: any = {}) {
  this.info(message, { component: 'api', ...meta });
};

// Add timer utility for performance measurements
(logger as any).customStartTimer = function(label: string) {
  const startTime = Date.now();
  return () => {
    const duration = Date.now() - startTime;
    this.performance(`${label} completed`, startTime, { label, duration });
  };
};

export default logger as EnhancedLogger;

// Export utility functions for correlation tracking
export const withCorrelationId = (correlationId: string) => {
  return logger.child({ correlationId });
};

export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};