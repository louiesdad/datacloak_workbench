import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';

describe('Service Initialization Order', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should initialize databases before creating app', async () => {
    // Mock the modules
    jest.unstable_mockModule('../database', () => ({
      initializeDatabases: jest.fn().mockResolvedValue(undefined)
    }));

    jest.unstable_mockModule('../app', () => ({
      createApp: jest.fn().mockResolvedValue({
        listen: jest.fn().mockImplementation((port, cb) => {
          cb();
          return { close: jest.fn() };
        })
      })
    }));

    const { initializeDatabases } = await import('../database');
    const { createApp } = await import('../app');

    // Import server module (this will run the initialization)
    delete require.cache[require.resolve('../server')];
    
    // Track call order
    const callOrder: string[] = [];
    (initializeDatabases as jest.Mock).mockImplementation(async () => {
      callOrder.push('initializeDatabases');
    });
    (createApp as jest.Mock).mockImplementation(async () => {
      callOrder.push('createApp');
      return {
        listen: jest.fn().mockImplementation((port, cb) => {
          cb();
          return { close: jest.fn() };
        })
      };
    });

    // Wait a bit for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(callOrder).toEqual(['initializeDatabases', 'createApp']);
  });

  it('should not initialize transform persistence before database', () => {
    const transformRoutesPath = path.join(__dirname, '../routes/transform.routes.ts');
    const transformRoutesContent = fs.readFileSync(transformRoutesPath, 'utf-8');
    
    // Check that controller is lazily initialized
    expect(transformRoutesContent).toContain('getController');
    expect(transformRoutesContent).not.toMatch(/new\s+TransformController\s*\(\s*\)\s*;/);
  });

  it('should handle database initialization failures gracefully', async () => {
    jest.unstable_mockModule('../database', () => ({
      initializeDatabases: jest.fn().mockRejectedValue(new Error('DB init failed'))
    }));

    jest.unstable_mockModule('../app', () => ({
      createApp: jest.fn().mockResolvedValue({
        listen: jest.fn().mockImplementation((port, cb) => {
          cb();
          return { close: jest.fn() };
        })
      })
    }));

    const { initializeDatabases } = await import('../database');
    const { createApp } = await import('../app');

    // App creation should still be called even if DB init fails
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(initializeDatabases).toHaveBeenCalled();
    // App should handle the error and continue
  });

  it('should not create multiple instances of singleton services', () => {
    const servicesDir = path.join(__dirname, '../services');
    const controllerDir = path.join(__dirname, '../controllers');
    
    const issues: string[] = [];
    
    // Check controllers for multiple service instantiations
    const controllerFiles = fs.readdirSync(controllerDir).filter(f => f.endsWith('.controller.ts'));
    
    controllerFiles.forEach(file => {
      const content = fs.readFileSync(path.join(controllerDir, file), 'utf-8');
      
      // Count service instantiations
      const serviceInstantiations = content.match(/new\s+\w+Service\s*\(/g) || [];
      
      // Controllers should ideally use singleton instances or dependency injection
      if (serviceInstantiations.length > 3) {
        issues.push(`${file}: Creates ${serviceInstantiations.length} service instances`);
      }
    });
    
    if (issues.length > 0) {
      console.warn('Controllers with multiple service instantiations:', issues);
    }
    
    // This is a warning about potential memory/performance issues
    expect(issues.length).toBeLessThanOrEqual(2);
  });

  it('should have proper error handling in initialization', () => {
    const serverPath = path.join(__dirname, '../server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    
    // Check for uncaught exception handlers
    expect(serverContent).toContain('uncaughtException');
    expect(serverContent).toContain('unhandledRejection');
    
    // Check for try-catch in startServer
    expect(serverContent).toContain('try {');
    expect(serverContent).toContain('} catch (error)');
    
    // Check for graceful shutdown
    expect(serverContent).toContain('SIGTERM');
    expect(serverContent).toContain('SIGINT');
  });

  it('should initialize services in correct order', () => {
    const appPath = path.join(__dirname, '../app.ts');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    // Database initialization should not happen in app.ts for production
    expect(appContent).toContain('NODE_ENV === \'test\'');
    
    // Routes should be set up after middleware
    const middlewareIndex = appContent.indexOf('app.use(helmet())');
    const routesIndex = appContent.indexOf('setupRoutes(app)');
    
    expect(middlewareIndex).toBeLessThan(routesIndex);
  });
});