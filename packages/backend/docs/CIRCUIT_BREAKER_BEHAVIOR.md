# Circuit Breaker Expected Behavior Documentation

## Overview
This document outlines the expected behavior patterns for circuit breakers in the DataCloak Sentiment Workbench, particularly for external service integrations like OpenAI and DataCloak services.

## Circuit Breaker States

### 1. CLOSED State (Normal Operation)
- **Expected**: All requests pass through to the external service
- **Actual**: Requests are executed normally with standard error handling
- **Metrics**: Failures and successes are tracked for threshold calculations

### 2. OPEN State (Service Protection)
- **Expected**: Requests fail immediately without calling the external service
- **Actual**: 
  - If `fallbackFunction` is configured: Returns fallback response
  - If no fallback: Throws `CircuitBreakerOpenError` with status 503
- **Metrics**: No requests are sent to the failing service

### 3. HALF_OPEN State (Recovery Testing)
- **Expected**: Limited requests are allowed through to test service recovery
- **Actual**: 
  - First `successThreshold` requests are attempted
  - Success → Circuit closes (returns to CLOSED)
  - Failure → Circuit re-opens immediately

## Threshold Behaviors

### Failure Threshold
- **Expected**: Circuit opens after `failureThreshold` consecutive failures
- **Actual**: Default is 5 failures
- **Test Expectation**: Mock should simulate failures to trigger state transition

### Success Threshold  
- **Expected**: Circuit closes after `successThreshold` successes in HALF_OPEN
- **Actual**: Default is 2 successes
- **Test Expectation**: Mock should allow successes to test recovery

### Error Percentage Threshold
- **Expected**: Circuit opens when error rate exceeds `errorThresholdPercentage`
- **Actual**: Default is 50% after minimum `volumeThreshold` requests
- **Test Expectation**: Tests should verify percentage-based opening

## Timeout Behaviors

### Request Timeout
- **Expected**: Individual requests timeout after `timeout` milliseconds
- **Actual**: Default is 10000ms (10 seconds)
- **Test Expectation**: Tests should use shorter timeouts (100-500ms) for speed

### Reset Timeout
- **Expected**: Circuit attempts recovery after `resetTimeout` in OPEN state
- **Actual**: Default is 30000ms (30 seconds)
- **Test Expectation**: Tests should use shorter reset timeouts (100-1000ms)

## Service-Specific Behaviors

### OpenAI Service Circuit Breaker
```typescript
// Expected behavior in tests
mockCircuitBreaker.execute.mockImplementation(async (fn) => {
  // Normal case: just execute the function
  return await fn();
});

// Simulating circuit open
mockCircuitBreaker.execute.mockRejectedValue(
  new AppError('Circuit breaker is OPEN', 503)
);
```

### DataCloak Service Circuit Breaker
```typescript
// Expected behavior
- Protects against DataCloak FFI failures
- Falls back to error responses when circuit opens
- Maintains service availability even when DataCloak is down
```

## Test Expectations

### 1. State Transition Tests
```typescript
// Test should verify:
- CLOSED → OPEN after failures
- OPEN → HALF_OPEN after reset timeout
- HALF_OPEN → CLOSED after successes
- HALF_OPEN → OPEN after failure
```

### 2. Fallback Function Tests
```typescript
// When circuit is OPEN:
expect(result).toBe(fallbackResponse);
expect(externalService).not.toHaveBeenCalled();
```

### 3. Metrics Tracking Tests
```typescript
// Verify metrics are updated correctly:
expect(metrics.state).toBe(CircuitState.OPEN);
expect(metrics.failures).toBe(5);
expect(metrics.errorPercentage).toBeGreaterThan(50);
```

### 4. Integration Tests
```typescript
// OpenAI Service should:
- Execute requests through circuit breaker
- Handle circuit open state gracefully
- Track metrics separately from API status
- Reset circuit breaker when needed
```

## Common Test Patterns

### Mocking Circuit Breaker in Tests
```typescript
const mockCircuitBreaker = {
  execute: jest.fn().mockImplementation(async (fn) => await fn()),
  getMetrics: jest.fn().mockReturnValue({
    state: CircuitState.CLOSED,
    failures: 0,
    successes: 10,
    totalRequests: 10,
    errorPercentage: 0
  }),
  reset: jest.fn(),
  forceOpen: jest.fn(),
  forceClose: jest.fn()
};
```

### Testing Circuit Breaker Open Behavior
```typescript
it('should handle circuit breaker open state', async () => {
  mockCircuitBreaker.execute.mockRejectedValue(
    new AppError('Circuit breaker is OPEN', 503)
  );
  
  await expect(service.callExternalAPI()).rejects.toThrow('Circuit breaker is OPEN');
});
```

### Testing Recovery Behavior
```typescript
it('should handle circuit breaker failure and recovery', async () => {
  let callCount = 0;
  mockCircuitBreaker.execute.mockImplementation(async (fn) => {
    callCount++;
    if (callCount <= 2) {
      throw new Error('Service unavailable');
    }
    return await fn();
  });
  
  // First calls fail
  await expect(service.call()).rejects.toThrow();
  await expect(service.call()).rejects.toThrow();
  
  // Third call succeeds (recovery)
  const result = await service.call();
  expect(result).toBeDefined();
});
```

## Best Practices

1. **Always test both success and failure paths**
2. **Use appropriate timeouts for test environments**
3. **Verify fallback behavior when configured**
4. **Test metric tracking and state transitions**
5. **Ensure circuit breaker doesn't mask real errors**
6. **Test recovery scenarios to ensure resilience**

## Debugging Circuit Breaker Issues

If circuit breaker tests are failing:
1. Check mock implementation matches expected behavior
2. Verify timeout values are appropriate for tests
3. Ensure state transitions are tested in correct order
4. Check if fallback functions are properly configured
5. Verify error types and status codes match expectations