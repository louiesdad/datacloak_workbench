import { config } from '../../src/config/env';

describe('Config', () => {
  it('should have default values', () => {
    expect(config.port).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
    expect(config.database.sqlite.path).toBeDefined();
    expect(config.database.duckdb.path).toBeDefined();
  });

  it('should identify test environment', () => {
    expect(config.isTest).toBe(true);
    expect(config.isDevelopment).toBe(false);
    expect(config.isProduction).toBe(false);
  });

  it('should have database configuration', () => {
    expect(config.database.sqlite.path).toContain(':memory:');
    expect(config.database.duckdb.path).toContain(':memory:');
  });
});