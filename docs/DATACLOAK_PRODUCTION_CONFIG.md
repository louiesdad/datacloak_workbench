# DataCloak Production Configuration Guide

This guide covers the production configuration options for the DataCloak Sentiment Workbench, focusing on security, performance, and monitoring features.

## Environment Variables

### Core Configuration
```bash
# DataCloak Core Settings
DATACLOAK_API_KEY=your_api_key_here
DATACLOAK_API_ENDPOINT=https://api.datacloak.example.com
DATACLOAK_TIMEOUT=30000
DATACLOAK_RETRY_ATTEMPTS=3
```

### Production Security Features

#### ReDoS Protection
```bash
# Enable Regular Expression Denial of Service protection
DATACLOAK_REDOS_PROTECTION=true
DATACLOAK_REGEX_TIMEOUT=1000  # Max regex execution time in ms
DATACLOAK_MAX_TEXT_LENGTH=100000  # Max text length to process
```

#### Email Validation Options
```bash
# Email validation strategy
DATACLOAK_EMAIL_VALIDATION=validator  # Options: regex, validator, hybrid

# regex: Standard regex pattern matching (fastest)
# validator: Enhanced validation with domain checks (recommended)
# hybrid: Both regex and domain validation (most accurate)
```

#### Credit Card Validation
```bash
# Credit card validation strategy
DATACLOAK_CC_VALIDATION=luhn  # Options: basic, luhn, full

# basic: Simple pattern matching
# luhn: Luhn algorithm validation (recommended for production)
# full: Luhn + issuer validation (most secure)
```

#### Performance Mode
```bash
# Performance optimization strategy
DATACLOAK_PERFORMANCE_MODE=balanced  # Options: fast, accurate, balanced

# fast: Optimized for speed, may sacrifice some accuracy
# accurate: Optimized for accuracy, may be slower
# balanced: Best balance of speed and accuracy (recommended)
```

#### Monitoring
```bash
# Enable comprehensive monitoring and logging
DATACLOAK_MONITORING=true
```

## Performance Targets

### Production Performance Requirements
- **PII Detection**: <100ms per record
- **Text Masking**: <50ms per operation
- **Batch Processing**: 1000+ records efficiently
- **Memory Usage**: <512MB for standard workloads

### Performance Testing
```javascript
// Run performance tests
const dataCloak = require('./datacloak.service');
const results = await dataCloak.runPerformanceTest(10000);
console.log('Performance Results:', results);
```

## Security Configuration

### PII Detection Settings
- **ReDoS Protection**: Enabled with 1-second timeout
- **Email Validation**: Enhanced domain checking
- **Credit Card Validation**: Luhn algorithm verification
- **Text Length Limits**: 100KB maximum per request

### Monitoring Features
When `DATACLOAK_MONITORING=true`:
- Performance metrics logging
- PII detection statistics
- Slow operation alerts (>100ms warning)
- Memory usage tracking

## Production Deployment Checklist

### Before Deployment
- [ ] Set all required environment variables
- [ ] Enable ReDoS protection (`DATACLOAK_REDOS_PROTECTION=true`)
- [ ] Configure email validation (`DATACLOAK_EMAIL_VALIDATION=validator`)
- [ ] Enable Luhn validation (`DATACLOAK_CC_VALIDATION=luhn`)
- [ ] Enable monitoring (`DATACLOAK_MONITORING=true`)
- [ ] Set performance mode (`DATACLOAK_PERFORMANCE_MODE=balanced`)

### Testing
- [ ] Run performance tests with 10,000 records
- [ ] Verify <100ms average processing time per record
- [ ] Test ReDoS protection with malicious regex patterns
- [ ] Validate credit card detection accuracy
- [ ] Test email validation with various formats

### Monitoring Setup
- [ ] Configure log aggregation for DataCloak metrics
- [ ] Set up alerts for slow operations (>100ms)
- [ ] Monitor memory usage trends
- [ ] Track PII detection rates and accuracy

## Example Production Configuration

```bash
# Production .env file
NODE_ENV=production

# DataCloak Production Configuration
DATACLOAK_API_KEY=prod_key_abc123
DATACLOAK_API_ENDPOINT=https://api.datacloak.prod.com
DATACLOAK_TIMEOUT=30000
DATACLOAK_RETRY_ATTEMPTS=3

# Security Features
DATACLOAK_REDOS_PROTECTION=true
DATACLOAK_EMAIL_VALIDATION=validator
DATACLOAK_CC_VALIDATION=luhn
DATACLOAK_MONITORING=true

# Performance Settings
DATACLOAK_PERFORMANCE_MODE=balanced
DATACLOAK_MAX_TEXT_LENGTH=100000
DATACLOAK_REGEX_TIMEOUT=1000

# OpenAI Integration
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=150
OPENAI_TEMPERATURE=0.1
OPENAI_TIMEOUT=30000
```

## Performance Optimization Tips

### For High-Volume Production
1. **Enable Caching**: Use Redis for PII detection results
2. **Batch Processing**: Process multiple texts in batches
3. **Rate Limiting**: Implement proper rate limiting for API calls
4. **Load Balancing**: Distribute requests across multiple instances

### Memory Optimization
1. **Text Length Limits**: Set appropriate `DATACLOAK_MAX_TEXT_LENGTH`
2. **Regex Timeouts**: Use `DATACLOAK_REGEX_TIMEOUT` to prevent runaway regex
3. **Monitoring**: Enable monitoring to track memory usage patterns

## Troubleshooting

### Common Issues

#### Slow Performance
- Check if ReDoS protection is triggering (look for timeout warnings)
- Verify text length is within limits
- Consider adjusting performance mode to "fast"

#### High Memory Usage
- Reduce `DATACLOAK_MAX_TEXT_LENGTH`
- Enable monitoring to identify memory leaks
- Check for excessive caching

#### False Positives in PII Detection
- Adjust email validation strategy
- Fine-tune credit card validation (use "full" mode)
- Review confidence thresholds

### Debug Mode
For debugging, temporarily set:
```bash
DATACLOAK_MONITORING=true
LOG_LEVEL=debug
```

## Security Considerations

### Data Protection
- All PII is masked before sentiment analysis
- Original text is only preserved when explicitly requested
- Masked data maintains format for usability

### Compliance
- GDPR: PII is detected and masked automatically
- CCPA: Personal data handling is logged and auditable
- SOC 2: Comprehensive logging and monitoring available

## API Performance Limits

### Rate Limits
- PII Detection: 100 requests/minute per API key
- Sentiment Analysis: 60 requests/minute per API key
- Batch Processing: 10 batches/minute per API key

### Payload Limits
- Maximum text length: 100KB (configurable)
- Maximum batch size: 1000 records
- Maximum file size for audit: 50MB

## Support and Monitoring

### Health Checks
```javascript
// Check DataCloak service health
const health = await dataCloak.getStats();
console.log('DataCloak Status:', health);
```

### Performance Monitoring
```javascript
// Run performance tests
const perfResults = await dataCloak.runPerformanceTest(1000);
console.log('Performance:', perfResults);
```

For additional support or issues with production deployment, refer to the DataCloak documentation or contact support.