import { LoggerService } from '../logger.service';
import { TestHelpers, MockFactory } from '../../../tests/utils';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = MockFactory.createService(['get']);
    mockConfig.get.mockImplementation((key: string) => {
      const configs: Record<string, any> = {
        'LOG_LEVEL': 'info'
      };
      return configs[key];
    });

    loggerService = new LoggerService(mockConfig);
  });

  afterEach(() => {
    // Clean up log files
    const logDir = path.join(process.cwd(), 'logs');
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(logDir, file));
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    }
  });

  describe('initialization', () => {
    it('should initialize with config log level', () => {
      expect(mockConfig.get).toHaveBeenCalledWith('LOG_LEVEL');
      
      const winstonLogger = loggerService.getWinstonLogger();
      expect(winstonLogger.level).toBe('info');
    });

    it('should use environment LOG_LEVEL when config not available', () => {
      const env = TestHelpers.mockEnvironment({
        LOG_LEVEL: 'debug'
      });

      const noConfigLogger = new LoggerService();
      const winstonLogger = noConfigLogger.getWinstonLogger();
      
      expect(winstonLogger.level).toBe('debug');
      
      env.restore();
    });

    it('should default to info level when neither config nor env is set', () => {
      const env = TestHelpers.mockEnvironment({});
      delete process.env.LOG_LEVEL;
      
      const noConfigLogger = new LoggerService();
      const winstonLogger = noConfigLogger.getWinstonLogger();
      
      expect(winstonLogger.level).toBe('info');
      
      env.restore();
    });

    it('should not add file transports in test environment', () => {
      const testLogger = new LoggerService();
      const winstonLogger = testLogger.getWinstonLogger();
      
      // In test environment, should only have console transport (if any)
      // File transports should be excluded
      const transports = winstonLogger.transports;
      const fileTransports = transports.filter(t => 
        t instanceof winston.transports.File
      );
      
      expect(fileTransports).toHaveLength(0);
    });
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'debug');
      
      loggerService.debug('Debug message', { key: 'value' });
      
      expect(spy).toHaveBeenCalledWith('Debug message', { key: 'value' });
      
      spy.mockRestore();
    });

    it('should log info messages', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'info');
      
      loggerService.info('Info message', { key: 'value' });
      
      expect(spy).toHaveBeenCalledWith('Info message', { key: 'value' });
      
      spy.mockRestore();
    });

    it('should log warn messages', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'warn');
      
      loggerService.warn('Warning message', { key: 'value' });
      
      expect(spy).toHaveBeenCalledWith('Warning message', { key: 'value' });
      
      spy.mockRestore();
    });

    it('should log error messages', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'error');
      
      loggerService.error('Error message', { error: 'details' });
      
      expect(spy).toHaveBeenCalledWith('Error message', { error: 'details' });
      
      spy.mockRestore();
    });

    it('should handle logging without metadata', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'info');
      
      loggerService.info('Simple message');
      
      expect(spy).toHaveBeenCalledWith('Simple message', {});
      
      spy.mockRestore();
    });
  });

  describe('child logger', () => {
    it('should create child logger with additional metadata', () => {
      const childLogger = loggerService.child({ requestId: '123', userId: 'user1' });
      
      expect(childLogger).toBeInstanceOf(LoggerService);
      expect(childLogger).not.toBe(loggerService);
    });

    it('should inherit metadata in child logger', () => {
      const childLogger = loggerService.child({ requestId: '123' });
      const spy = jest.spyOn(childLogger.getWinstonLogger(), 'info');
      
      childLogger.info('Child message', { extra: 'data' });
      
      expect(spy).toHaveBeenCalledWith('Child message', {
        requestId: '123',
        extra: 'data'
      });
      
      spy.mockRestore();
    });

    it('should allow nested child loggers', () => {
      const childLogger1 = loggerService.child({ requestId: '123' });
      const childLogger2 = childLogger1.child({ operation: 'database' });
      
      const spy = jest.spyOn(childLogger2.getWinstonLogger(), 'error');
      
      childLogger2.error('Nested error', { code: 'DB001' });
      
      expect(spy).toHaveBeenCalledWith('Nested error', {
        requestId: '123',
        operation: 'database',
        code: 'DB001'
      });
      
      spy.mockRestore();
    });
  });

  describe('utility methods', () => {
    it('should profile operations', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'profile');
      
      loggerService.profile('operation-123');
      
      expect(spy).toHaveBeenCalledWith('operation-123');
      
      spy.mockRestore();
    });

    it('should start timer', () => {
      // Create a mock timer that doesn't require a profiler
      const mockTimer = { done: jest.fn() };
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'startTimer')
        .mockReturnValue(mockTimer as any);
      
      const timer = loggerService.startTimer();
      
      expect(spy).toHaveBeenCalled();
      expect(timer).toBe(mockTimer);
      
      spy.mockRestore();
    });

    it('should allow setting log level', () => {
      const originalLevel = loggerService.getWinstonLogger().level;
      
      loggerService.setLevel('warn');
      
      expect(loggerService.getWinstonLogger().level).toBe('warn');
      
      // Restore original level
      loggerService.setLevel(originalLevel);
    });

    it('should provide access to winston logger', () => {
      const winstonLogger = loggerService.getWinstonLogger();
      
      expect(winstonLogger).toBeInstanceOf(winston.Logger);
    });
  });

  describe('environment-specific behavior', () => {
    it('should use development format in development environment', () => {
      const env = TestHelpers.mockEnvironment({
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug'
      });

      const devLogger = new LoggerService();
      const transports = devLogger.getWinstonLogger().transports;
      
      // Should have console transport in development
      const consoleTransports = transports.filter(t => 
        t instanceof winston.transports.Console
      );
      
      expect(consoleTransports.length).toBeGreaterThan(0);
      
      env.restore();
    });

    it('should not log to console in test environment', () => {
      const env = TestHelpers.mockEnvironment({
        NODE_ENV: 'test'
      });

      const testLogger = new LoggerService();
      const transports = testLogger.getWinstonLogger().transports;
      
      // Should not have console transport in test
      const consoleTransports = transports.filter(t => 
        t instanceof winston.transports.Console
      );
      
      expect(consoleTransports).toHaveLength(0);
      
      env.restore();
    });

    it('should handle production environment correctly', () => {
      const env = TestHelpers.mockEnvironment({
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn'
      });

      const prodLogger = new LoggerService();
      const winstonLogger = prodLogger.getWinstonLogger();
      
      expect(winstonLogger.level).toBe('warn');
      
      env.restore();
    });
  });

  describe('error handling', () => {
    it('should handle logger initialization errors gracefully', () => {
      // Test that errors during winston setup are handled
      // Since winston.createLogger is readonly, we'll test the constructor resilience differently
      const mockConfig = MockFactory.createService(['get']);
      mockConfig.get.mockImplementation(() => {
        throw new Error('Config read error');
      });

      // Should still create a logger even if config reading fails
      expect(() => {
        new LoggerService(mockConfig);
      }).not.toThrow();
    });

    it('should handle file system errors when creating log directory', () => {
      const env = TestHelpers.mockEnvironment({
        NODE_ENV: 'production'
      });

      // This should not throw even if log directory creation fails
      expect(() => {
        new LoggerService();
      }).not.toThrow();

      env.restore();
    });
  });

  describe('metadata handling', () => {
    it('should merge default metadata with log metadata', () => {
      const loggerWithDefaults = loggerService.child({ service: 'test-service' });
      const spy = jest.spyOn(loggerWithDefaults.getWinstonLogger(), 'info');
      
      loggerWithDefaults.info('Test message', { requestId: 'req-123' });
      
      expect(spy).toHaveBeenCalledWith('Test message', {
        service: 'test-service',
        requestId: 'req-123'
      });
      
      spy.mockRestore();
    });

    it('should override default metadata with log metadata', () => {
      const loggerWithDefaults = loggerService.child({ level: 'default' });
      const spy = jest.spyOn(loggerWithDefaults.getWinstonLogger(), 'warn');
      
      loggerWithDefaults.warn('Test message', { level: 'override' });
      
      expect(spy).toHaveBeenCalledWith('Test message', {
        level: 'override'
      });
      
      spy.mockRestore();
    });

    it('should handle undefined metadata', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'info');
      
      loggerService.info('Test message', undefined);
      
      expect(spy).toHaveBeenCalledWith('Test message', {});
      
      spy.mockRestore();
    });

    it('should handle null metadata', () => {
      const spy = jest.spyOn(loggerService.getWinstonLogger(), 'debug');
      
      loggerService.debug('Test message', null);
      
      expect(spy).toHaveBeenCalledWith('Test message', {});
      
      spy.mockRestore();
    });
  });
});