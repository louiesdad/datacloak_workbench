import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Regression Prevention Tests', () => {
  describe('Transform Routes Lazy Loading', () => {
    it('should not instantiate TransformController at module load time', () => {
      const transformRoutesPath = path.join(__dirname, '../routes/transform.routes.ts');
      const content = fs.readFileSync(transformRoutesPath, 'utf-8');
      
      // Should use lazy loading pattern
      expect(content).toContain('getController');
      
      // Should not have direct instantiation at module level
      const hasDirectInstantiation = /const\s+transformController\s*=\s*new\s+TransformController\s*\(\s*\)/.test(content);
      expect(hasDirectInstantiation).toBe(false);
    });
  });

  describe('Configuration Access Patterns', () => {
    it('should use correct config keys in system health controller', () => {
      const healthControllerPath = path.join(__dirname, '../controllers/system-health.controller.ts');
      const content = fs.readFileSync(healthControllerPath, 'utf-8');
      
      // Should use uppercase config keys
      expect(content).toContain('DATACLOAK_ENABLED');
      expect(content).toContain('REDIS_ENABLED');
      expect(content).toContain('OPENAI_API_KEY');
      expect(content).toContain('OPENAI_MODEL');
      
      // Should not use dot notation for config access
      expect(content).not.toContain('config.datacloak');
      expect(content).not.toContain('config.redis');
      expect(content).not.toContain('config.openai.apiKey');
      expect(content).not.toContain('config.openai.model');
    });
  });

  describe('Connection Status Service Import', () => {
    it('should import connectionStatusService as singleton instance', () => {
      const healthControllerPath = path.join(__dirname, '../controllers/system-health.controller.ts');
      const content = fs.readFileSync(healthControllerPath, 'utf-8');
      
      // Should import the singleton instance (lowercase)
      expect(content).toContain('import { connectionStatusService }');
      
      // Should not import as class
      expect(content).not.toContain('import { ConnectionStatusService }');
      
      // Should not try to create instance
      expect(content).not.toContain('ConnectionStatusService.getInstance()');
      expect(content).not.toContain('new ConnectionStatusService()');
    });
  });

  describe('Console Override', () => {
    it('should have console override as first import in server.ts', () => {
      const serverPath = path.join(__dirname, '../server.ts');
      const content = fs.readFileSync(serverPath, 'utf-8');
      const lines = content.split('\n');
      
      // Find first non-empty, non-comment line
      let firstCodeLine = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          firstCodeLine = trimmed;
          break;
        }
      }
      
      expect(firstCodeLine).toContain("import './console-override'");
    });
  });

  describe('Database Initialization', () => {
    it('should only initialize databases in server.ts, not in app.ts', () => {
      const appPath = path.join(__dirname, '../app.ts');
      const content = fs.readFileSync(appPath, 'utf-8');
      
      // Should have conditional initialization for tests only
      expect(content).toContain("process.env.NODE_ENV === 'test'");
      
      // Should check for conditional initialization pattern
      const initPattern = /if.*NODE_ENV.*test.*\{[^}]*initializeDatabases/s.test(content);
      expect(initPattern).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should have global error handlers in server.ts', () => {
      const serverPath = path.join(__dirname, '../server.ts');
      const content = fs.readFileSync(serverPath, 'utf-8');
      
      // Should handle uncaught exceptions
      expect(content).toContain("process.on('uncaughtException'");
      
      // Should handle unhandled rejections
      expect(content).toContain("process.on('unhandledRejection'");
      
      // Should have proper error handling in startServer
      expect(content).toContain('startServer().catch');
    });
  });

  describe('Connection Pool Configuration', () => {
    it('should have appropriate timeouts for different environments', () => {
      const poolPath = path.join(__dirname, '../database/sqlite-pool.ts');
      const content = fs.readFileSync(poolPath, 'utf-8');
      
      // Should have environment-specific timeout
      expect(content).toMatch(/isTestEnvironment\s*\?\s*5000\s*:\s*30000/);
      
      // Should have sufficient max connections
      expect(content).toMatch(/maxConnections.*\|\|\s*10/);
    });
  });

  describe('Service Patterns', () => {
    it('should use withSQLiteConnection pattern in realtime sentiment feed service', () => {
      const servicePath = path.join(__dirname, '../services/realtime-sentiment-feed.service.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      
      // Should import withSQLiteConnection
      expect(content).toContain('import { withSQLiteConnection }');
      
      // Should use withSQLiteConnection in methods
      expect(content).toContain('withSQLiteConnection(async (db)');
      
      // Should not have direct getSQLiteConnection calls without proper handling
      const hasDirectCall = /getSQLiteConnection\(\)(?!.*finally)/s.test(content);
      expect(hasDirectCall).toBe(false);
    });
  });
});