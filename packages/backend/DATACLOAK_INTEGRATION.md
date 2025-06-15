# DataCloak Integration Guide

## Overview

This backend integrates with [DataCloak](https://github.com/louiesdad/datacloak), a high-performance Rust-based data obfuscation library designed for privacy-preserving LLM interactions.

## What is DataCloak?

DataCloak is a Rust library that provides:
- **Automatic PII Detection**: Uses machine learning to detect sensitive data
- **High-Performance Processing**: Streams 20+ GB datasets at ~130 MB/s
- **LLM Integration**: Rate-limited batch processing for OpenAI/Claude/etc.
- **Multi-Language Support**: Available as Rust library, Python bindings, and gRPC service

## Integration Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────────┐
│   User      │────▶│   Backend    │────▶│DataCloak│────▶│   OpenAI     │
│   Input     │     │   Service    │     │ (Rust)  │     │     API      │
└─────────────┘     └──────────────┘     └─────────┘     └──────────────┘
                           │                    │                 │
                           ▼                    ▼                 ▼
                    ┌──────────────┐     ┌─────────┐     ┌──────────────┐
                    │ Original Text│     │Obfuscated│    │  Sentiment   │
                    │   with PII   │     │  Text    │    │   Result     │
                    └──────────────┘     └─────────┘     └──────────────┘
```

## Implementation Details

### 1. Security Service (`security.service.ts`)
- Uses `NativeDataCloakBridge` from `@dsw/security` package
- Attempts to find DataCloak binary on system
- Falls back to TypeScript mock implementation if binary not found

### 2. DataCloak Integration Service (`datacloak-integration.service.ts`)
- Orchestrates the secure sentiment analysis flow
- Handles obfuscation mapping for accurate de-obfuscation
- Provides error handling and fallback mechanisms

### 3. Sentiment Service (`sentiment.service.ts`)
- Integrates DataCloak flow for OpenAI models
- Maintains backward compatibility with basic analysis
- Tracks processing metrics and PII detection

## Installation Options

### Option 1: Use Mock Implementation (Default)
No additional setup required. The system automatically uses the TypeScript mock implementation.

### Option 2: Install DataCloak Binary

#### macOS
```bash
# Download from releases or build from source
git clone https://github.com/louiesdad/datacloak.git
cd datacloak
cargo build --release
sudo cp target/release/datacloak /usr/local/bin/
```

#### Linux
```bash
# Similar to macOS
git clone https://github.com/louiesdad/datacloak.git
cd datacloak
cargo build --release
sudo cp target/release/datacloak /usr/bin/
```

#### Windows
```powershell
# Build from source
git clone https://github.com/louiesdad/datacloak.git
cd datacloak
cargo build --release
# Copy datacloak.exe to C:\Program Files\DataCloak\
```

### Option 3: Use Docker Container
```bash
docker run -p 8080:8080 datacloak/datacloak:latest
```

## Configuration

### Environment Variables
```env
# Optional: Path to DataCloak binary
DATACLOAK_BINARY_PATH=/usr/local/bin/datacloak

# Optional: Use system-installed DataCloak
DATACLOAK_USE_SYSTEM_BINARY=true

# Optional: Disable fallback to mock
DATACLOAK_FALLBACK_TO_MOCK=false
```

### Programmatic Configuration
```typescript
const dataCloakBridge = new NativeDataCloakBridge({
  binaryPath: '/custom/path/to/datacloak',
  useSystemBinary: true,
  fallbackToMock: true,
  timeout: 30000,
  retryAttempts: 3
});
```

## API Endpoints

### Test DataCloak Integration
```bash
GET /api/v1/sentiment/datacloak/test
```

### Get DataCloak Statistics
```bash
GET /api/v1/sentiment/datacloak/stats
```

### Analyze Sentiment with DataCloak
```bash
POST /api/v1/sentiment/analyze
{
  "text": "Contact John Doe at john.doe@example.com",
  "enablePIIMasking": true,
  "model": "gpt-3.5-turbo"
}
```

## Security Flow Example

1. **Input Text**: "Contact John Doe at john.doe@example.com or 555-123-4567"

2. **DataCloak Detection**:
   - Detects: Name (John Doe), Email, Phone Number
   - Confidence: 95%, 99%, 98%

3. **Obfuscated Text**: "Contact [NAME] at [EMAIL] or [PHONE]"

4. **OpenAI Analysis**: Sentiment analysis on obfuscated text

5. **Final Result**:
   ```json
   {
     "sentiment": "neutral",
     "score": 0.1,
     "confidence": 0.85,
     "piiDetected": true,
     "piiItemsFound": 3,
     "obfuscationMap": [
       {
         "original": "John Doe",
         "obfuscated": "[NAME]",
         "piiType": "NAME"
       }
     ]
   }
   ```

## Performance Considerations

- **Mock Implementation**: ~1ms per text
- **Native DataCloak**: ~5-10ms per text (includes ML inference)
- **Batch Processing**: Recommended for large datasets
- **Rate Limiting**: 3 requests/second to LLM APIs

## Troubleshooting

### DataCloak Binary Not Found
- Check installation path
- Verify binary permissions (`chmod +x datacloak`)
- Enable fallback to mock: `fallbackToMock: true`

### Performance Issues
- Use batch processing for multiple texts
- Adjust chunk size for large datasets
- Consider using gRPC service for better performance

### PII Detection Accuracy
- Mock implementation uses regex patterns
- Native DataCloak uses ML models for better accuracy
- Adjust confidence thresholds as needed

## Future Enhancements

1. **gRPC Integration**: Direct integration with DataCloak gRPC service
2. **Custom PII Patterns**: Support for organization-specific patterns
3. **Caching**: Cache obfuscation mappings for repeated content
4. **Metrics**: Prometheus metrics for monitoring

## References

- [DataCloak GitHub Repository](https://github.com/louiesdad/datacloak)
- [DataCloak Documentation](https://github.com/louiesdad/datacloak#readme)
- [Security Package Documentation](../security/README.md)