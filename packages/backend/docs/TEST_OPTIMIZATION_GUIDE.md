# Test Timeout Optimization Guide

## Overview
This guide provides strategies and tools to reduce test execution time from 2+ minutes to under 30 seconds.

## Current Issues
- Global test timeout: 30 seconds (too high for most tests)
- Sequential test execution (`maxWorkers: 1`)
- Long waits in tests (1-5 seconds for timeouts)
- Inefficient retry mechanisms
- Synchronous database operations

## Optimization Strategies

### 1. Use Optimized Jest Configuration

Replace `jest.config.js` with `jest.config.optimized.js` for:
- Parallel test execution (`maxWorkers: 50%`)
- Categorized test timeouts (unit: 5s, integration: 10s, e2e: 15s)
- Test grouping by type

```bash
# Run with optimized config
npm test -- --config jest.config.optimized.js
```

### 2. Import Timeout Constants

Use the `TEST_TIMEOUTS` constants instead of hardcoded values:

```typescript
import { TEST_TIMEOUTS } from '../test-utils/timeout-optimization';

// Instead of:
await new Promise(resolve => setTimeout(resolve, 1000));

// Use:
await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.MEDIUM));
```

### 3. Optimize Common Patterns

#### Database Connection Timeouts
```typescript
// Before: 5000ms timeout
const db = await connectWithTimeout(5000);

// After: Use TEST_TIMEOUTS.DATABASE (1500ms)
const db = await connectWithTimeout(TEST_TIMEOUTS.DATABASE);
```

#### Circuit Breaker Reset
```typescript
// Before: 30 second reset timeout
const breaker = new CircuitBreaker({
  resetTimeout: 30000
});

// After: 100-200ms for tests
const breaker = new CircuitBreaker({
  resetTimeout: TEST_TIMEOUTS.CIRCUIT_BREAKER_RESET
});
```

#### Job Queue Waiting
```typescript
// Before: Wait 10+ seconds for job
await jobQueue.waitForJob(jobId, 10000);

// After: 1-2 seconds max
await jobQueue.waitForJob(jobId, TEST_TIMEOUTS.JOB_COMPLETION);
```

### 4. Use Optimization Utilities

#### Wait for Conditions
```typescript
import { waitForCondition } from '../test-utils/timeout-optimization';

// Instead of polling with fixed delays
await waitForCondition(
  () => cache.has('key'),
  { timeout: TEST_TIMEOUTS.CACHE_EXPIRY }
);
```

#### Time-sensitive Tests
```typescript
import { TimeController } from '../test-utils/timeout-optimization';

const timeController = new TimeController();

// Mock delays for instant execution
timeController.mockDelays();
await service.delayedOperation(); // Executes immediately
timeController.restoreDelays();
```

#### Performance Monitoring
```typescript
import { TestPerformance } from '../test-utils/timeout-optimization';

await TestPerformance.measure('database-setup', async () => {
  await initializeDatabase();
}, 1000); // Warns if takes > 1 second
```

### 5. Run Optimization Script

Automatically optimize timeouts in existing tests:

```bash
# Preview changes (dry run)
node scripts/optimize-test-timeouts.js

# Apply optimizations
node scripts/optimize-test-timeouts.js --apply
```

### 6. Enable Test Parallelization

For safe parallel execution:

1. **Isolate Database Tests**: Use unique database names
```typescript
const dbName = `test_${process.pid}_${Date.now()}`;
```

2. **Isolate Redis Tests**: Use different key prefixes
```typescript
const keyPrefix = `test:${process.pid}:`;
```

3. **Avoid Port Conflicts**: Use dynamic ports
```typescript
const port = 3000 + parseInt(process.env.JEST_WORKER_ID || '0');
```

### 7. Skip Slow Tests in CI

For quick feedback loops:

```typescript
import { skipSlowTests } from '../test-utils/timeout-optimization';

skipSlowTests(); // Enables global.slowTest and global.slowDescribe

slowTest('performance intensive operation', async () => {
  // Skipped when QUICK_TEST=true
});
```

Run quick tests:
```bash
QUICK_TEST=true npm test
```

## Performance Targets

### Unit Tests
- Target: < 100ms per test
- Timeout: 5 seconds max
- Strategy: Mock all external dependencies

### Integration Tests  
- Target: < 500ms per test
- Timeout: 10 seconds max
- Strategy: Use in-memory databases, mock network calls

### E2E Tests
- Target: < 2 seconds per test
- Timeout: 15 seconds max
- Strategy: Parallel execution, shared setup

### Performance Tests
- Target: < 5 seconds per test
- Timeout: 20 seconds max
- Strategy: Run separately, use sampling

## Monitoring Test Performance

### Generate Performance Report
```bash
# Run tests with timing
npm test -- --verbose --detectOpenHandles 2>&1 | tee test-performance.log

# Analyze slow tests
grep -E "✓.*\([0-9]{4,} ms\)" test-performance.log | sort -k2 -nr
```

### Set CI Timeout Limits
```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test
  timeout-minutes: 5  # Fail if tests take > 5 minutes
```

## Common Optimizations

### 1. Replace Long Sleeps
```typescript
// ❌ Bad
await new Promise(resolve => setTimeout(resolve, 5000));

// ✅ Good  
await waitForCondition(() => service.isReady());
```

### 2. Use Fake Timers
```typescript
// ❌ Bad
test('waits for cache expiry', async () => {
  await cache.set('key', 'value', { ttl: 60 });
  await new Promise(resolve => setTimeout(resolve, 61000));
  expect(await cache.has('key')).toBe(false);
});

// ✅ Good
test('waits for cache expiry', () => {
  jest.useFakeTimers();
  cache.set('key', 'value', { ttl: 60 });
  jest.advanceTimersByTime(61000);
  expect(cache.has('key')).toBe(false);
  jest.useRealTimers();
});
```

### 3. Batch Operations
```typescript
// ❌ Bad
for (const item of items) {
  await database.insert(item);
}

// ✅ Good
await database.batchInsert(items);
```

### 4. Mock Slow Operations
```typescript
import { OperationMocker } from '../test-utils/timeout-optimization';

beforeAll(() => {
  OperationMocker.mockNetworkOperations();
  OperationMocker.mockDatabaseOperations();
});
```

## Debugging Slow Tests

### Find Slowest Tests
```bash
# Add --verbose flag
npm test -- --verbose | grep -E "\([0-9]{3,} ms\)" | sort -t'(' -k2 -nr | head -20
```

### Profile Test Suite
```bash
# Generate timing information
npm test -- --logHeapUsage --detectOpenHandles
```

### Identify Bottlenecks
1. Check for missing `await` statements
2. Look for synchronous file I/O
3. Find unnecessary delays
4. Check for real network calls
5. Look for large data processing

## Best Practices

1. **Always use environment-aware timeouts**
2. **Mock external dependencies in unit tests**
3. **Use in-memory databases for integration tests**
4. **Run tests in parallel when possible**
5. **Keep test data minimal**
6. **Clean up resources properly**
7. **Use beforeAll/afterAll for expensive setup**
8. **Avoid setTimeout in tests**
9. **Use fake timers for time-dependent tests**
10. **Monitor and track test performance**

## Results

Following these optimizations should achieve:
- ✅ Total test time: < 30 seconds
- ✅ Unit tests: < 5 seconds total
- ✅ Integration tests: < 15 seconds total  
- ✅ E2E tests: < 10 seconds total
- ✅ Parallel execution enabled
- ✅ No flaky tests due to timeouts