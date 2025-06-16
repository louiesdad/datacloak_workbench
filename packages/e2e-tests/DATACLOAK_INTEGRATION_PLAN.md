# DataCloak Integration Plan for Sentiment Workbench

## Executive Summary

DataCloak's features will fundamentally transform the workbench from a mock privacy tool to a production-ready privacy-preserving sentiment analysis platform. The integration requires architectural changes to support DataCloak's streaming, LLM integration, and configuration requirements.

## Key DataCloak Features Impact

### 1. 🔍 Automatic PII Detection
**Current State**: Basic regex patterns in SecurityService
**With DataCloak**: 
- ML-powered pattern detection with confidence scoring
- Replace entire SecurityService mock with DataCloak's detection
- Benefit: Real PII detection instead of simple pattern matching

### 2. ⚡ High Performance Streaming
**Current State**: Load entire files into memory
**With DataCloak**:
- Configurable streaming (8KB-4MB chunks)
- Process 20+ GB datasets with minimal memory
- **Required Changes**:
  ```typescript
  // Current approach in WorkflowManager
  const content = await readFile(path);
  
  // DataCloak approach
  const stream = datacloak.createFileStream(path, {
    chunkSize: '1MB',
    parallel: true
  });
  ```

### 3. 🤖 LLM Integration with Rate Limiting
**Current State**: Direct OpenAI calls without rate limiting
**With DataCloak**:
- Built-in rate limiting (3 req/s)
- Retry-After support
- **Configuration Challenge**: OpenAI API key handling

## OpenAI API Key Configuration Strategy

### Option 1: Environment Variable Pass-Through
```typescript
// Backend configuration
interface DataCloakConfig {
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  rateLimitPerSecond: 3,
  enableDryRun: process.env.NODE_ENV === 'development'
}

// Initialize DataCloak with config
const datacloak = new DataCloak({
  llm: {
    provider: 'openai',
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
    rateLimit: config.rateLimitPerSecond
  }
});
```

### Option 2: Configuration File Approach
```yaml
# datacloak.config.yaml
llm:
  provider: openai
  api_key_env: OPENAI_API_KEY  # Reference env var
  model: gpt-3.5-turbo
  rate_limit: 3

pii_detection:
  confidence_threshold: 0.8
  patterns:
    - email
    - phone
    - ssn
    - credit_card

streaming:
  default_chunk_size: 1MB
  max_chunk_size: 4MB
```

### Option 3: Dynamic Configuration API
```typescript
// Allow runtime configuration updates
app.post('/api/v1/admin/datacloak/config', async (req, res) => {
  const { openaiApiKey, model, rateLimitPerSecond } = req.body;
  
  // Update DataCloak configuration
  await datacloak.updateConfig({
    llm: {
      apiKey: openaiApiKey,
      model: model,
      rateLimit: rateLimitPerSecond
    }
  });
});
```

## Recommended Architecture Changes

### 1. Replace Mock Services with DataCloak Native Functions

```typescript
// Before: Mock SecurityService
class SecurityService {
  async detectPII(text: string) {
    // Basic regex patterns
  }
}

// After: DataCloak Integration
class DataCloakService {
  async detectPII(text: string) {
    const result = await datacloak.detectPII(text, {
      patterns: ['email', 'phone', 'ssn', 'credit_card'],
      confidenceThreshold: 0.8,
      returnPositions: true
    });
    return result.detections;
  }
}
```

### 2. Implement Streaming File Processing

```typescript
// New FileProcessingService using DataCloak
class FileProcessingService {
  async processLargeCSV(filePath: string, options: ProcessOptions) {
    const stream = datacloak.createCSVStream(filePath, {
      chunkSize: options.chunkSize || '1MB',
      parallel: options.parallel || true,
      skipHeader: true
    });

    stream.on('chunk', async (chunk) => {
      // Process chunk with PII detection
      const masked = await datacloak.maskPII(chunk);
      
      // Send to sentiment analysis
      const sentiment = await datacloak.analyzeSentiment(masked, {
        model: 'gpt-3.5-turbo',
        batchSize: 100
      });
    });
  }
}
```

### 3. Integrate DataCloak's LLM Features

```typescript
// Sentiment Analysis with DataCloak
class DataCloakSentimentService {
  async analyzeSentiment(text: string, options: AnalysisOptions) {
    // DataCloak handles:
    // - PII masking before sending to LLM
    // - Rate limiting (3 req/s)
    // - Retry logic with backoff
    // - Token optimization
    
    const result = await datacloak.llm.analyze({
      text: text,
      task: 'sentiment_analysis',
      model: options.model || 'gpt-3.5-turbo',
      includeConfidence: true,
      preserveOriginal: true
    });

    return {
      sentiment: result.sentiment,
      score: result.score,
      confidence: result.confidence,
      piiMasked: result.piiDetected,
      tokensUsed: result.usage.totalTokens
    };
  }
}
```

### 4. Utilize DataCloak's Production Features

```typescript
// Enable monitoring and dry-run mode
const datacloak = new DataCloak({
  monitoring: {
    enabled: true,
    endpoint: '/metrics'
  },
  dryRun: process.env.NODE_ENV === 'development',
  security: {
    redosProtection: true,
    validatorBased: true,
    luhnValidation: true
  }
});

// Exit code testing for CI/CD
datacloak.test.runValidation().then(exitCode => {
  if (exitCode !== 0) {
    console.error('DataCloak validation failed');
    process.exit(exitCode);
  }
});
```

## Migration Plan

### Phase 1: Core Integration (Week 1-2)
1. Add DataCloak as dependency
2. Create DataCloakService wrapper
3. Configure OpenAI API key passing
4. Replace mock PII detection

### Phase 2: Streaming Implementation (Week 3-4)
1. Implement streaming file processor
2. Update WorkflowManager for chunks
3. Add progress tracking for large files
4. Test with 20GB+ datasets

### Phase 3: LLM Integration (Week 5-6)
1. Replace mock sentiment analysis
2. Implement rate-limited batch processing
3. Add retry logic and monitoring
4. Configure model selection

### Phase 4: Production Features (Week 7-8)
1. Enable comprehensive monitoring
2. Implement dry-run mode for testing
3. Add benchmark tests
4. Configure multi-language support

## Configuration Recommendations

### 1. Environment Variables
```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
DATACLOAK_CHUNK_SIZE=1MB
DATACLOAK_RATE_LIMIT=3
DATACLOAK_DRY_RUN=false
DATACLOAK_MONITORING=true
```

### 2. DataCloak Configuration
```typescript
// config/datacloak.ts
export const datacloakConfig = {
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    rateLimit: parseInt(process.env.DATACLOAK_RATE_LIMIT || '3')
  },
  streaming: {
    defaultChunkSize: process.env.DATACLOAK_CHUNK_SIZE || '1MB',
    parallel: true
  },
  security: {
    patterns: ['email', 'phone', 'ssn', 'credit_card', 'ip_address'],
    confidenceThreshold: 0.8,
    redosProtection: true
  },
  monitoring: {
    enabled: process.env.DATACLOAK_MONITORING === 'true',
    endpoint: '/api/v1/metrics/datacloak'
  },
  dryRun: process.env.DATACLOAK_DRY_RUN === 'true'
};
```

### 3. Frontend Configuration UI
```typescript
// Add admin panel for DataCloak configuration
<DataCloakConfig>
  <ConfigSection title="LLM Settings">
    <Input 
      label="OpenAI API Key" 
      type="password"
      value={config.openaiApiKey}
      onChange={updateApiKey}
    />
    <Select
      label="Model"
      options={['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']}
      value={config.model}
      onChange={updateModel}
    />
  </ConfigSection>
  
  <ConfigSection title="Performance">
    <Slider
      label="Chunk Size"
      min="8KB"
      max="4MB"
      value={config.chunkSize}
      onChange={updateChunkSize}
    />
    <Toggle
      label="Parallel Processing"
      checked={config.parallel}
      onChange={updateParallel}
    />
  </ConfigSection>
</DataCloakConfig>
```

## Benefits of Full Integration

1. **Real Privacy Protection**: Actual PII detection and masking vs mock regex
2. **Production Scale**: Handle 20GB+ files vs current memory limitations
3. **Cost Optimization**: Built-in rate limiting prevents API overages
4. **Developer Experience**: Dry-run mode, comprehensive testing, benchmarks
5. **Multi-Language**: FFI bindings enable Python integration
6. **Remote Processing**: gRPC support for distributed architecture

## Risks and Mitigations

1. **API Key Security**: Store in secure vault, never in code
2. **Rate Limit Impacts**: Queue system for burst traffic
3. **Large File Processing**: Implement progress indicators
4. **Cost Management**: Monitor token usage, set limits

## Conclusion

DataCloak integration will transform the Sentiment Workbench from a proof-of-concept to a production-ready privacy-preserving analytics platform. The key is proper configuration management, especially for the OpenAI API key, and leveraging DataCloak's streaming capabilities for large-scale processing.