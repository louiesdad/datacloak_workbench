# Critical Fixes - Priority Order

## Immediate Blockers (Fix First)

### 1. Test Infrastructure (dev01-001, dev01-002)
**Why Critical**: Nothing can be tested without this
```typescript
// Current Issue: Jest configuration using deprecated globals
// Fix: Update jest.config.js transform configuration
// Impact: Blocking ALL test development
```

### 2. TypeScript Compilation Errors
**Why Critical**: Services can't be tested if they don't compile
```typescript
// Priority Services with Errors:
// - risk-assessment.service.ts: Duplicate function implementations
// - insights.service.ts: Duplicate function implementations  
// - connection-status.service.ts: Database type errors
// - Multiple controllers: Type 'never' assignment errors
```

### 3. Database Initialization (dev02-001)
**Why Critical**: Most services depend on database
```typescript
// Current Issue: SQLite using random memory databases
// Fix: Use consistent :memory: database for tests
// Impact: Tests failing with connection errors
```

## High Priority Fixes (This Week)

### 4. Service Dependencies
**Why Important**: Circular dependencies prevent proper mocking
```typescript
// Circular dependency examples:
// DataService ↔ DataCloakService
// SentimentService ↔ JobQueueService
// Fix: Introduce interfaces and dependency injection
```

### 5. Mock Implementations
**Why Important**: External services need proper mocks
```typescript
// Missing/Incomplete Mocks:
// - Redis (partially fixed)
// - DataCloak FFI
// - OpenAI API
// - WebSocket
```

### 6. Configuration Management (dev01-005)
**Why Important**: Tests need isolated configuration
```typescript
// Issues:
// - Hot reload during tests
// - Singleton state persistence
// - Environment variable conflicts
```

## Code Smells to Fix

### 7. Error Handling
```typescript
// Before:
try {
  // code
} catch (error) {
  console.error(error);
  throw error; // Lost stack trace
}

// After:
try {
  // code
} catch (error) {
  throw new AppError('Specific error message', 500, 'ERROR_CODE', error);
}
```

### 8. Async/Await Patterns
```typescript
// Before:
function processData(callback) {
  db.query('SELECT...', (err, results) => {
    if (err) callback(err);
    else callback(null, results);
  });
}

// After:
async function processData(): Promise<Results> {
  return await db.query('SELECT...');
}
```

### 9. Type Safety
```typescript
// Before:
function processItem(item: any) {
  return item.value * 2;
}

// After:
interface Item {
  value: number;
}
function processItem(item: Item): number {
  return item.value * 2;
}
```

## Architectural Improvements

### 10. Service Interfaces
```typescript
// Create interfaces for all services
interface IDataService {
  uploadFile(file: Express.Multer.File): Promise<DataFile>;
  getFileById(id: string): Promise<DataFile | null>;
  deleteFile(id: string): Promise<boolean>;
}
```

### 11. Dependency Injection
```typescript
// Before:
class SentimentService {
  constructor() {
    this.openai = new OpenAIService(config);
    this.cache = getCacheService();
  }
}

// After:
class SentimentService {
  constructor(
    private openai: IOpenAIService,
    private cache: ICacheService
  ) {}
}
```

### 12. Event Type Safety
```typescript
// Before:
eventEmitter.emit('job:complete', { jobId, result });

// After:
interface JobCompleteEvent {
  jobId: string;
  result: ProcessingResult;
}
eventEmitter.emit<JobCompleteEvent>('job:complete', { jobId, result });
```

## Testing Patterns to Implement

### 13. Test Factories
```typescript
// Create factories for common test data
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-id',
  email: 'test@example.com',
  role: 'user',
  ...overrides
});
```

### 14. Mock Builders
```typescript
// Builder pattern for complex mocks
export class MockServiceBuilder {
  private service: Partial<IDataService> = {};
  
  withUploadFile(impl?: jest.Mock) {
    this.service.uploadFile = impl || jest.fn();
    return this;
  }
  
  build(): jest.Mocked<IDataService> {
    return this.service as jest.Mocked<IDataService>;
  }
}
```

### 15. Integration Test Helpers
```typescript
// Database test utilities
export async function withTestDatabase<T>(
  fn: (db: Database) => Promise<T>
): Promise<T> {
  const db = await createTestDatabase();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}
```

## Performance Optimizations

### 16. Batch Operations
```typescript
// Before:
for (const item of items) {
  await processItem(item);
}

// After:
await Promise.all(
  items.map(item => processItem(item))
);
// Or with concurrency limit:
await pLimit(5)(items.map(item => () => processItem(item)));
```

### 17. Caching Strategy
```typescript
// Implement cache-aside pattern
async function getWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = await cache.get(key);
  if (cached) return cached;
  
  const fresh = await fetcher();
  await cache.set(key, fresh, ttl);
  return fresh;
}
```

## Documentation Requirements

### 18. Service Documentation
```typescript
/**
 * Handles sentiment analysis using OpenAI API
 * 
 * @example
 * ```typescript
 * const result = await sentimentService.analyze({
 *   text: "I love this product!",
 *   model: "gpt-3.5-turbo"
 * });
 * ```
 * 
 * @throws {RateLimitError} When API rate limit exceeded
 * @throws {OpenAIError} When API request fails
 */
export class SentimentService {
  // ...
}
```

### 19. API Documentation
```typescript
/**
 * @api {post} /api/sentiment/analyze Analyze sentiment
 * @apiName AnalyzeSentiment
 * @apiGroup Sentiment
 * 
 * @apiParam {String} text Text to analyze
 * @apiParam {String} [model="gpt-3.5-turbo"] OpenAI model
 * 
 * @apiSuccess {String} sentiment Detected sentiment
 * @apiSuccess {Number} confidence Confidence score
 */
```

### 20. Error Code Documentation
```typescript
export enum ErrorCodes {
  // Authentication Errors (1000-1999)
  AUTH_INVALID_TOKEN = 'AUTH_001',
  AUTH_EXPIRED_TOKEN = 'AUTH_002',
  
  // Data Errors (2000-2999)
  DATA_NOT_FOUND = 'DATA_001',
  DATA_INVALID_FORMAT = 'DATA_002',
  
  // External Service Errors (3000-3999)
  OPENAI_RATE_LIMIT = 'EXT_001',
  DATACLOAK_UNAVAILABLE = 'EXT_002',
}
```