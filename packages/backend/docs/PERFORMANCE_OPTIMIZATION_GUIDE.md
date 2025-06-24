# Performance Optimization Guide

This guide covers various strategies and features to optimize the performance of the DataCloak Sentiment Workbench API.

## Table of Contents
- [Parallel Processing](#parallel-processing)
- [Caching Strategies](#caching-strategies)
- [Progressive Processing](#progressive-processing)
- [Database Optimization](#database-optimization)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)

## Parallel Processing

### Overview
Parallel processing allows multiple sentiment analysis requests to be processed simultaneously, dramatically reducing total processing time for batch operations.

### When to Use
- Batch processing of 10+ texts
- OpenAI model analysis (gpt-3.5-turbo, gpt-4)
- Time-sensitive bulk operations
- High-throughput scenarios

### Configuration

```javascript
// Enable parallel processing (default: true)
{
  "texts": ["text1", "text2", "..."],
  "model": "gpt-3.5-turbo",
  "useParallel": true
}
```

### Advanced Configuration

```javascript
// Custom parallel processing settings
const batchService = new OpenAIBatchService(openaiService);
const result = await batchService.analyzeLargeBatch(texts, {
  concurrency: 10,      // Increase concurrent requests (default: 5)
  chunkSize: 100,       // Larger chunks for better throughput
  retryAttempts: 3,     // More retries for reliability
  timeout: 45000,       // Longer timeout for complex texts
  rateLimit: {
    maxRequests: 100,   // Adjust based on your OpenAI tier
    windowMs: 60000
  }
});
```

### Performance Benchmarks

| Operation | Sequential | Parallel (5 concurrent) | Parallel (10 concurrent) |
|-----------|------------|------------------------|--------------------------|
| 10 texts  | 15-20s     | 3-4s                   | 2-3s                     |
| 50 texts  | 75-100s    | 15-20s                 | 8-12s                    |
| 100 texts | 150-200s   | 30-40s                 | 15-25s                   |
| 500 texts | 750-1000s  | 150-200s               | 75-125s                  |

## Caching Strategies

### 1. Response Caching
Automatically caches sentiment analysis results for 1 hour:

```javascript
// First request: ~1000ms
await analyzeSentiment("Great product!");

// Subsequent requests: ~2ms (cached)
await analyzeSentiment("Great product!");
```

### 2. Cache Configuration

```env
# .env configuration
CACHE_ENABLED=true
CACHE_TYPE=memory        # or 'redis' for distributed caching
CACHE_DEFAULT_TTL=3600   # 1 hour
CACHE_MAX_MEMORY=104857600  # 100MB
```

### 3. Cache Management

```bash
# View cache statistics
curl http://localhost:3001/api/v1/cache/stats

# Clear specific cache entries
curl -X DELETE http://localhost:3001/api/v1/cache/pattern/sentiment:*

# Clear all cache
curl -X POST http://localhost:3001/api/v1/cache/clear
```

## Progressive Processing

### Overview
Get results as they're processed rather than waiting for the entire batch.

### Implementation

```javascript
// Using Server-Sent Events (SSE)
const eventSource = new EventSource('/api/v1/sentiment/stream/batch');

eventSource.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log(`Processed: ${result.text} - ${result.sentiment}`);
};

// Using WebSocket
const ws = new WebSocket('ws://localhost:3001/ws');
ws.send(JSON.stringify({
  type: 'sentiment_batch',
  data: { texts: largeTextArray }
}));

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  updateProgressBar(update.progress);
};
```

### Progressive Processing Modes

```javascript
// Quick preview (70% accuracy, instant results)
const preview = await processProgressive(dataset, { mode: 'quick' });

// Balanced sampling (85% accuracy, fast results)
const balanced = await processProgressive(dataset, { mode: 'balanced' });

// Thorough analysis (95% accuracy, slower)
const thorough = await processProgressive(dataset, { mode: 'thorough' });
```

## Database Optimization

### 1. Connection Pooling

```javascript
// SQLite pool configuration
const poolConfig = {
  maxConnections: 20,     // Increased for parallel processing
  idleTimeoutMs: 60000,   // Keep connections alive longer
  acquireTimeoutMs: 30000 // Timeout for acquiring connection
};
```

### 2. Batch Inserts

```javascript
// Efficient batch storage
db.transaction(() => {
  for (const result of results) {
    stmt.run(result.text, result.sentiment, result.score, result.confidence);
  }
})();
```

### 3. Indexing Strategy

```sql
-- Key indexes for performance
CREATE INDEX idx_sentiment_created_at ON sentiment_analyses(created_at);
CREATE INDEX idx_sentiment_customer_id ON sentiment_analyses(customer_id);
CREATE INDEX idx_sentiment_sentiment ON sentiment_analyses(sentiment);
```

## Rate Limiting

### OpenAI Rate Limits

| Tier | Requests/min | Tokens/min | Recommended Concurrency |
|------|--------------|------------|------------------------|
| Free | 3            | 40,000     | 1-2                    |
| Tier 1 | 60          | 60,000     | 5-8                    |
| Tier 2 | 500         | 80,000     | 10-20                  |
| Tier 3 | 3,000       | 160,000    | 50-100                 |

### Configuration

```javascript
// Adjust rate limiting based on your tier
const rateLimitConfig = {
  maxRequests: 50,      // Requests per window
  windowMs: 60000,      // 1 minute window
  concurrency: 5        // Parallel requests
};
```

## Best Practices

### 1. Batch Size Optimization
- **Small batches (1-10)**: Use default settings
- **Medium batches (10-100)**: Increase concurrency to 10
- **Large batches (100-1000)**: Use chunk processing with 50-100 per chunk
- **Very large (1000+)**: Consider job queue with progress tracking

### 2. Model Selection
- **gpt-3.5-turbo**: Best price/performance ratio
- **gpt-4**: Higher accuracy but slower and more expensive
- **basic**: Instant results for simple sentiment detection

### 3. Error Handling
```javascript
// Implement retry logic
const results = await batchAnalyze(texts, {
  retryAttempts: 3,
  retryDelay: 1000,
  onError: (error, index) => {
    console.error(`Failed text ${index}:`, error);
    // Log to monitoring system
  }
});
```

### 4. Monitoring
```javascript
// Track performance metrics
const metrics = {
  totalRequests: 0,
  avgResponseTime: 0,
  errorRate: 0,
  cacheHitRate: 0
};

// Use built-in monitoring endpoints
const stats = await fetch('/api/v1/monitoring/metrics');
```

### 5. Cost Optimization
- Enable caching to reduce duplicate API calls
- Use progressive processing for large datasets
- Batch similar requests together
- Monitor token usage with `/api/v1/openai/stats`

## Example: Optimized Batch Processing Pipeline

```javascript
class OptimizedSentimentProcessor {
  constructor() {
    this.cache = new Map();
    this.batchSize = 50;
    this.concurrency = 10;
  }

  async processLargeDataset(texts) {
    // 1. Check cache first
    const uncachedTexts = texts.filter(text => !this.cache.has(text));
    
    // 2. Process in optimized batches
    const results = [];
    for (let i = 0; i < uncachedTexts.length; i += this.batchSize) {
      const batch = uncachedTexts.slice(i, i + this.batchSize);
      
      // 3. Use parallel processing
      const batchResults = await this.processBatch(batch, {
        useParallel: true,
        concurrency: this.concurrency
      });
      
      // 4. Update cache
      batchResults.forEach((result, idx) => {
        this.cache.set(batch[idx], result);
      });
      
      results.push(...batchResults);
      
      // 5. Progress update
      const progress = ((i + batch.length) / uncachedTexts.length) * 100;
      console.log(`Progress: ${progress.toFixed(1)}%`);
    }
    
    // 6. Combine with cached results
    return texts.map(text => 
      this.cache.get(text) || results.find(r => r.text === text)
    );
  }
}
```

## Troubleshooting Performance Issues

### 1. Slow Response Times
- Check OpenAI API status
- Verify rate limits aren't being hit
- Increase timeout values
- Enable caching

### 2. High Error Rates
- Reduce concurrency
- Increase retry attempts
- Check for malformed input texts
- Monitor circuit breaker status

### 3. Memory Issues
- Reduce batch sizes
- Clear cache periodically
- Use Redis for distributed caching
- Monitor memory usage with `/api/v1/monitoring/health`

### 4. Database Bottlenecks
- Increase connection pool size
- Add appropriate indexes
- Use batch inserts
- Consider DuckDB for analytics queries