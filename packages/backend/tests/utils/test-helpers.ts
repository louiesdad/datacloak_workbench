import { TestDatabaseFactory } from './database-factory';
import { MockFactory } from './mock-factory';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TestHelpers {
  static async withTestDatabase<T>(
    testFn: (db: any) => Promise<T>,
    name: string = 'test'
  ): Promise<T> {
    const db = TestDatabaseFactory.createInMemory(name);
    try {
      return await testFn(db);
    } finally {
      TestDatabaseFactory.cleanup(name);
    }
  }

  static async withMockRequest<T>(
    testFn: (req: any, res: any, next: any) => Promise<T>,
    requestOverrides: any = {}
  ): Promise<T> {
    const req = MockFactory.createRequest(requestOverrides);
    const res = MockFactory.createResponse();
    const next = MockFactory.createNextFunction();
    
    return await testFn(req, res, next);
  }

  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  static async createTempFile(content: string, extension: string = 'txt'): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp-test');
    await fs.mkdir(tempDir, { recursive: true });
    
    const filename = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
    const filepath = path.join(tempDir, filename);
    
    await fs.writeFile(filepath, content);
    return filepath;
  }

  static async cleanupTempFiles(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp-test');
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  static expectErrorResponse(res: any, statusCode: number, errorCode?: string) {
    expect(res.statusCode).toBe(statusCode);
    expect(res.jsonData).toHaveProperty('error');
    
    if (errorCode) {
      expect(res.jsonData.error).toHaveProperty('code', errorCode);
    }
  }

  static expectSuccessResponse(res: any, statusCode: number = 200) {
    expect(res.statusCode).toBe(statusCode);
    expect(res.jsonData).toBeDefined();
    expect(res.jsonData).not.toHaveProperty('error');
  }

  static mockEnvironment(overrides: Record<string, string>) {
    const original = { ...process.env };
    
    Object.assign(process.env, overrides);
    
    return {
      restore: () => {
        // Clear all overrides
        Object.keys(overrides).forEach(key => {
          if (original[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = original[key];
          }
        });
      }
    };
  }

  static async measurePerformance<T>(
    fn: () => Promise<T>,
    label: string = 'Operation'
  ): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    console.log(`${label} took ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }

  static createMockService<T>(methods: string[]): T {
    const mock: any = {};
    
    methods.forEach(method => {
      mock[method] = jest.fn();
    });
    
    return mock as T;
  }

  static async assertThrowsAsync(
    fn: () => Promise<any>,
    expectedError?: string | RegExp | typeof Error
  ): Promise<void> {
    let thrown = false;
    
    try {
      await fn();
    } catch (error) {
      thrown = true;
      
      if (expectedError) {
        if (typeof expectedError === 'string') {
          expect(error.message).toContain(expectedError);
        } else if (expectedError instanceof RegExp) {
          expect(error.message).toMatch(expectedError);
        } else {
          expect(error).toBeInstanceOf(expectedError);
        }
      }
    }
    
    expect(thrown).toBe(true);
  }

  static createSpyObject<T>(obj: T, methods: (keyof T)[]): T {
    const spied = { ...obj };
    
    methods.forEach(method => {
      if (typeof obj[method] === 'function') {
        (spied as any)[method] = jest.fn(obj[method] as any);
      }
    });
    
    return spied;
  }

  static async runConcurrent<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }
    
    await Promise.all(executing);
    return results;
  }
}