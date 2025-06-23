import { describe, test, expect } from 'vitest';

describe('Simple Test', () => {
  test('basic math should work', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('basic string test', () => {
    expect('hello').toBe('hello');
  });
});