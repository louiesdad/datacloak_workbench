# Test Environment Configuration

This document describes the test environment configuration for the DataCloak Sentiment Workbench backend.

## Overview

Test environment configuration is managed through:
1. `.env.test` file - Contains all test-specific environment variables
2. `src/config/test-env.ts` - Validates and manages test configuration
3. `tests/setup.ts` - Loads configuration before tests run

## Environment Variables

### Required Variables

These variables MUST be set for tests to run:

- `NODE_ENV=test` - Identifies test environment
- `JWT_SECRET` - Secret key for JWT token generation (test value)
- `ADMIN_PASSWORD` - Admin password for authentication tests

### Database Configuration

- `SQLITE_DB_PATH=:memory:` - Use in-memory SQLite for fast tests
- `DATABASE_URL=sqlite::memory:` - Database connection string
- `SKIP_DUCKDB=true` - Skip DuckDB initialization in tests
- `DISABLE_FILE_LOGGING=true` - Disable file logging for tests

### Service Configuration

- `REDIS_ENABLED=false` - Disable Redis in tests (use memory cache)
- `CACHE_TYPE=memory` - Use in-memory cache for tests
- `DATACLOAK_USE_MOCK=true` - Use mock DataCloak service
- `OPENAI_API_KEY=sk-test-*` - Test API key (not real)

### Feature Flags

- `ENABLE_HOT_RELOAD=false` - Disable hot reload in tests
- `ENABLE_CONFIG_API=false` - Disable config API in tests
- `ENABLE_WEBSOCKET=true` - Enable WebSocket for integration tests
- `ENABLE_SSE=true` - Enable Server-Sent Events for tests

## Setup

1. Copy `.env.test.example` to `.env.test`
2. Modify values as needed for your test environment
3. Run tests: `npm test`

## Validation

The test environment is validated automatically when tests start:
- Required variables are checked
- Production values are detected and warned
- Missing directories are created

## Best Practices

1. **Never use production values** in test environment
2. **Use in-memory databases** for speed
3. **Disable external services** unless testing integrations
4. **Mock expensive operations** (AI APIs, etc.)
5. **Keep configuration minimal** - only what's needed

## Troubleshooting

### Missing Variables Error
```
Test environment validation failed:
  - Missing required variable: JWT_SECRET
```
**Solution**: Add the missing variable to `.env.test`

### Production Values Warning
```
Using production OpenAI API key in tests
```
**Solution**: Use test values (e.g., `sk-test-*`) instead

### Database Connection Errors
```
SQLite pool not initialized
```
**Solution**: Ensure `SQLITE_DB_PATH=:memory:` is set

## CI/CD Configuration

For CI/CD environments, set variables through:
- GitHub Actions: Repository secrets
- CircleCI: Project environment variables
- Jenkins: Credentials plugin

Example GitHub Actions:
```yaml
env:
  NODE_ENV: test
  JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
  ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
```