# Integration Test Framework

This directory contains the integration test framework for the DataCloak Sentiment Workbench backend.

## Overview

Integration tests verify that multiple components work together correctly. Unlike unit tests which test individual components in isolation, integration tests:

- Start real servers and services
- Test API endpoints end-to-end
- Verify service coordination
- Test error handling across components
- Validate performance under load

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run with coverage
npm run test:integration:coverage

# Run in watch mode
npm run test:integration:watch

# Run a specific test file
npm run test:integration -- example.integration.test.ts
```

## Writing Integration Tests

### Basic Structure

```typescript
import { startTestServer, stopTestServer, TestServer } from '../utils/integration-helpers';

describe('My Integration Test', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({
      initializeWebSocket: true,
      initializeSSE: true,
      initializeDatabase: true
    });
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  it('should test something', async () => {
    // Your test here
  });
});
```

### Available Helpers

#### `startTestServer(options)`
Starts a test server with optional services:
- `initializeWebSocket`: Start WebSocket service
- `initializeSSE`: Start Server-Sent Events service
- `initializeDatabase`: Initialize database connections
- `port`: Specific port (default: random)

#### `stopTestServer(server)`
Properly shuts down all services and connections.

#### `waitFor(condition, timeout, interval)`
Wait for a condition to be true:
```typescript
await waitFor(() => service.isReady(), 5000);
```

#### `createTestDatabase(name)`
Create an isolated test database.

#### `resetServices()`
Reset all services to clean state between tests.

#### `runIsolatedTest(name, testFn, options)`
Run a test in complete isolation with automatic setup/teardown.

### Custom Matchers

#### `toEventuallyEqual(expected, timeout)`
Wait for a value to eventually equal expected:
```typescript
await expect(() => service.getStatus()).toEventuallyEqual('ready', 5000);
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in `afterAll`
3. **Timeouts**: Use appropriate timeouts for async operations
4. **Real Services**: Test with real services when possible
5. **Error Cases**: Test both success and failure scenarios

## Test Categories

### API Integration Tests
Test full API request/response cycles including authentication, validation, and data processing.

### Service Coordination Tests
Verify that services communicate correctly (e.g., cache, database, queue).

### WebSocket Integration Tests
Test real-time communication features.

### Performance Integration Tests
Test system behavior under load.

### Error Recovery Tests
Verify system resilience and error handling.

## Debugging

```bash
# Run with debugging
npm run test:debug -- --config jest.integration.config.js

# Run single test with verbose output
npm run test:integration -- --verbose example.integration.test.ts
```

## CI/CD Considerations

Integration tests run sequentially (`maxWorkers: 1`) to avoid resource conflicts. They have longer timeouts (30s default) to accommodate service startup times.