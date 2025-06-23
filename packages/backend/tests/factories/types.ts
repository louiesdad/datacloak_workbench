/**
 * Common types for test factories
 */

export interface TestDataOptions {
  seed?: number;
  count?: number;
  overrides?: Record<string, any>;
}

export interface Factory<T> {
  create(options?: TestDataOptions): T;
  createMany(count: number, options?: TestDataOptions): T[];
  build(overrides?: Partial<T>): T;
}