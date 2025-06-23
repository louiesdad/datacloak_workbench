# Secret Management Guide

## Overview

The DataCloak Sentiment Workbench includes a comprehensive secret management system that provides:

- Centralized secret storage and retrieval
- Multiple provider support (Environment, AWS, Azure, HashiCorp Vault)
- Automatic secret rotation
- Access auditing and logging
- Secret validation and policy enforcement
- CLI and API interfaces

## Configuration

### Environment Variables

```bash
# Secret Provider (env, aws, azure, vault)
SECRET_PROVIDER=env

# Cache Configuration
SECRET_CACHE_TTL=3600              # Cache TTL in seconds
SECRET_ACCESS_LOG_SIZE=10000       # Max audit log entries

# Rotation Configuration
SECRET_ROTATION_ENABLED=false      # Enable automatic rotation
SECRET_ROTATION_NOTIFY_DAYS=7      # Days before rotation to notify

# API Access
ENABLE_SECRET_MANAGEMENT_API=false # Enable REST API endpoints
```

### Provider-Specific Configuration

#### AWS Secrets Manager
```bash
SECRET_PROVIDER=aws
AWS_REGION=us-east-1
AWS_SECRET_PREFIX=datacloak/
```

#### Azure Key Vault
```bash
SECRET_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://myvault.vault.azure.net/
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
```

#### HashiCorp Vault
```bash
SECRET_PROVIDER=vault
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=your-vault-token
VAULT_PATH=secret/datacloak
```

## Secret Policies

The system enforces policies for different secret types:

### JWT_SECRET
- Minimum length: 64 characters
- Rotation interval: 90 days
- Character set: Base64

### SESSION_SECRET
- Minimum length: 64 characters
- Rotation interval: 30 days
- Character set: Base64

### CONFIG_ENCRYPTION_KEY
- Fixed length: 32 characters
- Rotation interval: 1 year
- Character set: Base64

### ADMIN_PASSWORD
- Minimum length: 16 characters
- Maximum length: 128 characters
- Rotation interval: 90 days
- Complexity requirements:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (@$!%*?&)

## CLI Usage

### Initialize Secrets
```bash
npm run secrets:init
# or
./scripts/manage-secrets.ts init --environment production
```

### List Secrets
```bash
npm run secrets:list
# or
./scripts/manage-secrets.ts list
```

### Validate Secrets
```bash
npm run secrets:validate
# or
./scripts/manage-secrets.ts validate
```

### Generate Secret
```bash
npm run secrets:generate JWT_SECRET
# or
./scripts/manage-secrets.ts generate JWT_SECRET --save
```

### Rotate Secret
```bash
npm run secrets:rotate JWT_SECRET
# or
./scripts/manage-secrets.ts rotate JWT_SECRET --force
```

### Check Rotation Status
```bash
npm run secrets:rotation-status
# or
./scripts/manage-secrets.ts rotation-status
```

### Export Audit Log
```bash
npm run secrets:export-audit
# or
./scripts/manage-secrets.ts export-audit --output audit.json
```

### Interactive Mode
```bash
npm run secrets:interactive
# or
./scripts/manage-secrets.ts interactive
```

## API Usage

When `ENABLE_SECRET_MANAGEMENT_API` is enabled, the following endpoints are available:

### List Secrets
```http
GET /api/secrets
Authorization: Bearer <token>
```

### Get Secret Metadata
```http
GET /api/secrets/:key/metadata
Authorization: Bearer <token>
```

### Validate Secret
```http
POST /api/secrets/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "JWT_SECRET",
  "value": "your-secret-value"
}
```

### Generate Secret
```http
POST /api/secrets/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "JWT_SECRET"
}
```

### Update Secret
```http
PUT /api/secrets/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "new-secret-value",
  "confirmKey": "JWT_SECRET"
}
```

### Rotate Secret
```http
POST /api/secrets/:key/rotate
Authorization: Bearer <token>
```

### Delete Secret
```http
DELETE /api/secrets/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirmKey": "JWT_SECRET",
  "confirmAction": "DELETE"
}
```

### Get Audit Log
```http
GET /api/secrets/audit/access?secretKey=JWT_SECRET
Authorization: Bearer <token>
```

### Export Audit Log
```http
GET /api/secrets/audit/export
Authorization: Bearer <token>
```

## Programmatic Usage

### Basic Usage
```typescript
import { SecretManagerService } from './services/secret-manager.service';

const secretManager = SecretManagerService.getInstance();

// Get a secret
const jwtSecret = await secretManager.getSecret('JWT_SECRET');

// Set a secret
await secretManager.setSecret('API_KEY', 'new-api-key-value');

// Rotate a secret
const newValue = await secretManager.rotateSecret('JWT_SECRET');

// Delete a secret
await secretManager.deleteSecret('TEMP_SECRET');
```

### Access Logging
```typescript
// Get access log
const log = secretManager.getAccessLog({
  secretKey: 'JWT_SECRET',
  operation: 'read',
  startDate: new Date('2024-01-01')
});

// Export full audit log
const auditJson = await secretManager.exportAccessLog();
```

### Secret Validation
```typescript
import { SecretValidator, secretUtils } from './config/secrets';

// Validate a secret
const validation = SecretValidator.validateSecret('JWT_SECRET', 'my-secret');
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Generate a secure secret
const newSecret = SecretValidator.generateSecureSecret('JWT_SECRET');

// Check if rotation is needed
const shouldRotate = SecretValidator.shouldRotate(
  'JWT_SECRET', 
  lastRotatedDate
);

// Get days until rotation
const daysRemaining = SecretValidator.getDaysUntilRotation(
  'JWT_SECRET',
  lastRotatedDate
);
```

### Rotation Scheduling
```typescript
// Set up automatic rotation
secretManager.setupRotationSchedule(
  'JWT_SECRET',
  90 * 24 * 60 * 60 * 1000 // 90 days
);

// Monitor rotation events
secretManager.on('secret:rotated', ({ key, provider }) => {
  console.log(`Secret ${key} was rotated using ${provider}`);
});

secretManager.on('secret:rotation-failed', ({ key, error }) => {
  console.error(`Failed to rotate ${key}:`, error);
});
```

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env` files for local development
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **Use appropriate secret providers**
   - Development: Environment variables
   - Production: AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault

3. **Enable rotation**
   - Set up automatic rotation for critical secrets
   - Monitor rotation notifications
   - Test rotation procedures regularly

4. **Audit access**
   - Regularly review audit logs
   - Set up alerts for suspicious access patterns
   - Export and archive audit logs

5. **Validate secrets**
   - Run validation before deployment
   - Use the CLI or API to ensure compliance
   - Implement pre-commit hooks for validation

6. **Principle of least privilege**
   - Limit secret access to necessary services
   - Use different secrets for different environments
   - Rotate secrets after employee departures

## Troubleshooting

### Secret not found
```
Error: Secret 'MY_SECRET' not found in environment
```
- Ensure the secret is set in your environment
- Check the secret provider configuration
- Verify the secret key format (uppercase with underscores)

### Validation failures
```
Error: Secret must be at least 64 characters long
```
- Use the generate command to create compliant secrets
- Check the policy requirements for the secret type
- Ensure special characters are properly escaped

### Rotation failures
```
Error: Failed to rotate secret
```
- Check provider permissions
- Verify network connectivity to external providers
- Review audit logs for detailed error information

### Cache issues
```
Error: Stale secret value
```
- Clear the cache: `secretManager.clearCache()`
- Reduce cache TTL for frequently changing secrets
- Disable caching for critical secrets

## Migration Guide

### From plain environment variables
1. Install and configure the secret management system
2. Run `npm run secrets:init` to generate secure values
3. Update your deployment scripts to use the secret manager
4. Enable rotation and monitoring

### Between providers
1. Export secrets from the current provider
2. Configure the new provider
3. Import secrets to the new provider
4. Update `SECRET_PROVIDER` configuration
5. Test thoroughly before switching production

## Integration Examples

### Docker
```dockerfile
# Use build arguments for non-sensitive config
ARG NODE_ENV=production

# Runtime secrets from environment
ENV SECRET_PROVIDER=aws
ENV AWS_REGION=us-east-1
```

### Kubernetes
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: datacloak-secrets
type: Opaque
stringData:
  JWT_SECRET: "generated-secret-value"
  SESSION_SECRET: "generated-secret-value"
```

### CI/CD (GitHub Actions)
```yaml
- name: Validate Secrets
  run: npm run secrets:validate
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

## Monitoring and Alerts

Set up monitoring for:
- Failed secret access attempts
- Approaching rotation deadlines
- Validation failures
- Provider connectivity issues
- Unusual access patterns

Example alert configuration:
```javascript
secretManager.on('secret:access', (access) => {
  if (!access.success) {
    // Send alert
    alerting.send({
      level: 'error',
      message: `Failed secret access: ${access.secretKey}`,
      metadata: access
    });
  }
});
```