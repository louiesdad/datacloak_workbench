# OpenAI Configuration Troubleshooting Guide

This guide helps resolve common OpenAI API integration issues in the DataCloak Sentiment Workbench.

## Table of Contents
- [Common Errors](#common-errors)
- [Authentication Issues](#authentication-issues)
- [Environment Variable Conflicts](#environment-variable-conflicts)
- [Rate Limiting](#rate-limiting)
- [Circuit Breaker Recovery](#circuit-breaker-recovery)
- [API Key Management](#api-key-management)
- [Debugging Steps](#debugging-steps)

## Common Errors

### 401 Unauthorized Error

**Symptoms:**
```
Error: Request failed with status code 401
{
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

**Common Causes:**
1. Invalid API key format
2. Expired API key
3. Environment variable conflicts
4. Wrong API key in configuration

**Solutions:**
See [Authentication Issues](#authentication-issues) section.

### 429 Rate Limit Error

**Symptoms:**
```
Error: Request failed with status code 429
{
  "error": {
    "message": "Rate limit reached",
    "type": "rate_limit_error"
  }
}
```

**Solutions:**
- Reduce concurrency in batch processing
- Implement backoff strategy
- Check your OpenAI tier limits

### 500/503 Service Errors

**Symptoms:**
- Intermittent failures
- "Service temporarily unavailable"
- Timeout errors

**Solutions:**
- Circuit breaker will automatically handle recovery
- Check OpenAI status page
- Increase timeout values

## Authentication Issues

### 1. Verify API Key Format

OpenAI API keys should:
- Start with `sk-`
- Be 48+ characters long
- Contain only alphanumeric characters

**Check your key:**
```bash
# Display key format (safely)
echo $OPENAI_API_KEY | sed 's/\(sk-....\).*/\1.../'

# Verify key length
echo -n $OPENAI_API_KEY | wc -c
```

### 2. Test API Key Directly

```bash
# Test with curl
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should return list of models if valid
```

### 3. Check Key Permissions

Ensure your API key has permissions for:
- `model.read`
- `model.request`
- Chat completions endpoint access

## Environment Variable Conflicts

### Issue: Shell Variable Overriding .env File

**Problem:**
Shell environment variables take precedence over `.env` file settings.

**Diagnosis:**
```bash
# Check shell environment
echo $OPENAI_API_KEY

# Check .env file
grep OPENAI_API_KEY .env

# Check loaded configuration
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY?.substring(0,10) + '...');"
```

**Solutions:**

1. **Unset Shell Variable (Recommended):**
```bash
unset OPENAI_API_KEY
npm run dev
```

2. **Use .env.local:**
```bash
# Create .env.local (higher priority than .env)
echo "OPENAI_API_KEY=your-actual-key" > .env.local
```

3. **Force .env Loading:**
```javascript
// In your app startup
require('dotenv').config({ override: true });
```

### Issue: config.json Overriding Environment

**Problem:**
Test or default keys in `config.json` override real keys.

**Check:**
```bash
grep -i openai config.json
```

**Solution:**
Remove hardcoded keys from `config.json`:
```json
{
  "openai": {
    "model": "gpt-3.5-turbo",
    "maxTokens": 500
    // Remove: "apiKey": "sk-test..."
  }
}
```

## Rate Limiting

### Understanding Your Limits

| Tier | RPM | TPM | Concurrent | Recommended Settings |
|------|-----|-----|------------|---------------------|
| Free | 3 | 40K | 1-2 | `concurrency: 1` |
| Tier 1 | 60 | 60K | 5-8 | `concurrency: 5` |
| Tier 2 | 500 | 80K | 10-20 | `concurrency: 10` |
| Tier 3 | 3000 | 160K | 50-100 | `concurrency: 20` |

### Configure Rate Limiting

```javascript
// In your batch processing
const options = {
  concurrency: 5,  // Adjust based on tier
  rateLimit: {
    maxRequests: 50,  // Per minute
    windowMs: 60000
  },
  retryOptions: {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2
  }
};
```

### Monitor Rate Limit Headers

```javascript
// Log rate limit info
response.headers['x-ratelimit-limit']
response.headers['x-ratelimit-remaining']
response.headers['x-ratelimit-reset']
```

## Circuit Breaker Recovery

### Understanding Circuit States

1. **CLOSED** - Normal operation
2. **OPEN** - Failing, rejecting requests
3. **HALF_OPEN** - Testing recovery

### Manual Circuit Breaker Management

```bash
# Check circuit breaker status
curl http://localhost:3001/api/v1/monitoring/circuit-breakers

# Force reset (admin only)
curl -X POST http://localhost:3001/api/v1/admin/circuit-breakers/openai/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Configuration

```env
# Circuit breaker settings
CIRCUIT_BREAKER_TIMEOUT=30000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
```

## API Key Management

### Best Practices

1. **Never commit API keys:**
```bash
# Add to .gitignore
.env
.env.local
*.key
```

2. **Use environment-specific keys:**
```bash
# .env.development
OPENAI_API_KEY=sk-dev-...

# .env.production
OPENAI_API_KEY=sk-prod-...
```

3. **Rotate keys regularly:**
- Set expiration reminders
- Use key versioning
- Update all environments

### Secure Storage Options

1. **Environment Variables:**
```bash
# Set in shell profile
export OPENAI_API_KEY="sk-..."
```

2. **Secret Management Services:**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault

3. **Encrypted Files:**
```bash
# Encrypt .env file
openssl enc -aes-256-cbc -in .env -out .env.enc
```

## Debugging Steps

### 1. Enable Debug Logging

```bash
# Run with debug logging
DEBUG=openai:*,datacloak:* npm run dev
```

### 2. Test OpenAI Service Directly

```javascript
// Create test script: test-openai.js
require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function test() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 10
    });
    console.log('Success:', response.choices[0].message);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

test();
```

### 3. Check Configuration Loading

```javascript
// Create diagnostic script: check-config.js
require('dotenv').config();

console.log('Environment Check:');
console.log('=================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 7));
console.log('Key suffix:', process.env.OPENAI_API_KEY?.slice(-6));
console.log('Key length:', process.env.OPENAI_API_KEY?.length);

// Check for common issues
if (process.env.OPENAI_API_KEY?.includes('test')) {
  console.warn('⚠️  Key contains "test" - might be a placeholder!');
}
if (process.env.OPENAI_API_KEY?.length < 40) {
  console.warn('⚠️  Key seems too short!');
}
```

### 4. Network Diagnostics

```bash
# Test OpenAI connectivity
curl -I https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check DNS resolution
nslookup api.openai.com

# Test with different DNS
curl --dns-servers 8.8.8.8 https://api.openai.com/v1/models
```

### 5. Common Fix Checklist

- [ ] Verify API key is valid and active
- [ ] Check for environment variable conflicts
- [ ] Remove test keys from config files
- [ ] Ensure no spaces or quotes in API key
- [ ] Verify network connectivity to OpenAI
- [ ] Check rate limits and tier
- [ ] Review circuit breaker status
- [ ] Test with minimal script first
- [ ] Check for proxy/firewall issues

## Error Resolution Flowchart

```
401 Error?
├─ Yes → Check API Key
│   ├─ Invalid format? → Get new key
│   ├─ Environment conflict? → Unset shell var
│   └─ Config override? → Remove from config.json
│
└─ No → 429 Error?
    ├─ Yes → Reduce concurrency
    │   └─ Check rate limits
    │
    └─ No → 5xx Error?
        ├─ Yes → Wait for circuit breaker
        └─ No → Check debug logs
```

## Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Status Page](https://status.openai.com)
- [API Key Management Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)