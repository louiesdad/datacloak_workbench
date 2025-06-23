import request from 'supertest';
import express from 'express';

// Mock dependencies
const mockSecretManagerService = {
  getInstance: jest.fn().mockReturnThis(),
  setSecret: jest.fn(),
  rotateSecret: jest.fn(),
  deleteSecret: jest.fn(),
  getAccessLog: jest.fn(),
  exportAccessLog: jest.fn(),
  setupRotationSchedule: jest.fn(),
  clearCache: jest.fn(),
};

const mockSecretValidator = {
  validateSecret: jest.fn(),
  generateSecureSecret: jest.fn(),
};

const mockSecretUtils = {
  isSecretKey: jest.fn(),
  getSecretPolicy: jest.fn(),
};

const mockConfigService = {
  getInstance: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

const mockCreateLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock authentication middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  req.user = { id: 'test-user', role: 'admin' };
  next();
});

const mockRequireAdmin = jest.fn((req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

jest.mock('../../services/secret-manager.service', () => ({
  SecretManagerService: {
    getInstance: () => mockSecretManagerService
  }
}));

jest.mock('../../config/secrets', () => ({
  SecretValidator: mockSecretValidator,
  secretUtils: mockSecretUtils
}));

jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: () => mockConfigService
  }
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAdmin: mockRequireAdmin
}));

jest.mock('../../config/logger', () => ({
  createLogger: mockCreateLogger
}));

import secretsRoutes from '../secrets.routes';

describe('Secrets Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/secrets', secretsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env = {
      ...process.env,
      API_KEY: 'test-api-key',
      DB_PASSWORD: 'test-db-password',
      JWT_SECRET: 'test-jwt-secret'
    };

    // Setup default mocks
    mockConfigService.get.mockImplementation((key) => {
      if (key === 'ENABLE_SECRET_MANAGEMENT_API') return true;
      return undefined;
    });

    mockSecretUtils.isSecretKey.mockImplementation((key) => {
      return key.endsWith('_KEY') || key.endsWith('_SECRET') || key.endsWith('_PASSWORD');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      const response = await request(app)
        .get('/secrets/secrets')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should require admin role', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user', role: 'user' };
        next();
      });

      const response = await request(app)
        .get('/secrets/secrets')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should check if secret management is enabled', async () => {
      mockConfigService.get.mockReturnValue(false);

      const response = await request(app)
        .get('/secrets/secrets')
        .set('Authorization', 'Bearer admin-token')
        .expect(403);

      expect(response.body.error).toBe('Secret management API is disabled');
    });
  });

  describe('GET /secrets/secrets', () => {
    it('should list all secret keys', async () => {
      mockSecretUtils.isSecretKey.mockReturnValue(true);
      mockSecretUtils.getSecretPolicy.mockImplementation((key) => {
        if (key === 'API_KEY') return { minLength: 32, maxLength: 128 };
        return null;
      });

      const response = await request(app)
        .get('/secrets/secrets')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveProperty('provider', 'env');
      expect(response.body).toHaveProperty('secrets');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.secrets)).toBe(true);
    });

    it('should support provider query parameter', async () => {
      const response = await request(app)
        .get('/secrets/secrets?provider=vault')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.provider).toBe('vault');
    });

    it('should handle errors gracefully', async () => {
      mockSecretUtils.isSecretKey.mockImplementation(() => {
        throw new Error('Secret utils error');
      });

      const response = await request(app)
        .get('/secrets/secrets')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to list secrets');
    });
  });

  describe('GET /secrets/secrets/:key/metadata', () => {
    it('should get secret metadata', async () => {
      mockSecretUtils.getSecretPolicy.mockReturnValue({
        minLength: 32,
        maxLength: 128,
        rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
        complexity: { requireUppercase: true }
      });

      const response = await request(app)
        .get('/secrets/secrets/API_KEY/metadata')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveProperty('key', 'API_KEY');
      expect(response.body).toHaveProperty('exists', true);
      expect(response.body).toHaveProperty('policy');
      expect(response.body.policy).toHaveProperty('rotationIntervalDays', 30);
    });

    it('should validate secret key format', async () => {
      const response = await request(app)
        .get('/secrets/secrets/invalid-key-123/metadata')
        .set('Authorization', 'Bearer admin-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid secret key format');
    });

    it('should handle secrets without policies', async () => {
      mockSecretUtils.getSecretPolicy.mockReturnValue(null);

      const response = await request(app)
        .get('/secrets/secrets/API_KEY/metadata')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.policy).toBeNull();
    });
  });

  describe('POST /secrets/secrets/validate', () => {
    it('should validate secret successfully', async () => {
      mockSecretValidator.validateSecret.mockReturnValue({
        valid: true,
        errors: []
      });

      const response = await request(app)
        .post('/secrets/secrets/validate')
        .set('Authorization', 'Bearer admin-token')
        .send({
          key: 'API_KEY',
          value: 'valid-secret-value-123'
        })
        .expect(200);

      expect(response.body).toEqual({
        key: 'API_KEY',
        valid: true,
        errors: []
      });
    });

    it('should return validation errors', async () => {
      mockSecretValidator.validateSecret.mockReturnValue({
        valid: false,
        errors: ['Secret too short', 'Missing uppercase letters']
      });

      const response = await request(app)
        .post('/secrets/secrets/validate')
        .set('Authorization', 'Bearer admin-token')
        .send({
          key: 'API_KEY',
          value: 'weak'
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toHaveLength(2);
    });

    it('should require key and value', async () => {
      const response = await request(app)
        .post('/secrets/secrets/validate')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Key and value are required');
    });
  });

  describe('POST /secrets/secrets/generate', () => {
    it('should generate secure secret', async () => {
      const generatedSecret = 'generated-secure-secret-123';
      mockSecretValidator.generateSecureSecret.mockReturnValue(generatedSecret);
      mockSecretValidator.validateSecret.mockReturnValue({
        valid: true,
        errors: []
      });

      const response = await request(app)
        .post('/secrets/secrets/generate')
        .set('Authorization', 'Bearer admin-token')
        .send({ key: 'API_KEY' })
        .expect(200);

      expect(response.body).toEqual({
        key: 'API_KEY',
        value: generatedSecret,
        valid: true,
        length: generatedSecret.length
      });
    });

    it('should require key parameter', async () => {
      const response = await request(app)
        .post('/secrets/secrets/generate')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Key is required');
    });

    it('should handle generation errors', async () => {
      mockSecretValidator.generateSecureSecret.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      const response = await request(app)
        .post('/secrets/secrets/generate')
        .set('Authorization', 'Bearer admin-token')
        .send({ key: 'API_KEY' })
        .expect(500);

      expect(response.body.error).toBe('Failed to generate secret');
    });
  });

  describe('PUT /secrets/secrets/:key', () => {
    it('should update secret successfully', async () => {
      mockSecretValidator.validateSecret.mockReturnValue({
        valid: true,
        errors: []
      });
      mockSecretManagerService.setSecret.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          value: 'new-secret-value',
          confirmKey: 'API_KEY'
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Secret updated successfully',
        key: 'API_KEY'
      });
      expect(mockSecretManagerService.setSecret).toHaveBeenCalledWith(
        'API_KEY',
        'new-secret-value',
        expect.any(Object),
        'test-user'
      );
    });

    it('should require confirmation key match', async () => {
      const response = await request(app)
        .put('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          value: 'new-secret-value',
          confirmKey: 'WRONG_KEY'
        })
        .expect(400);

      expect(response.body.error).toBe('Confirmation key does not match');
    });

    it('should validate secret value', async () => {
      mockSecretValidator.validateSecret.mockReturnValue({
        valid: false,
        errors: ['Secret too weak']
      });

      const response = await request(app)
        .put('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          value: 'weak-secret',
          confirmKey: 'API_KEY'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid secret value');
      expect(response.body.details).toEqual(['Secret too weak']);
    });
  });

  describe('POST /secrets/secrets/:key/rotate', () => {
    it('should rotate secret successfully', async () => {
      const newSecret = 'rotated-secret-value-123';
      mockSecretManagerService.rotateSecret.mockResolvedValue(newSecret);

      const response = await request(app)
        .post('/secrets/secrets/API_KEY/rotate')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Secret rotated successfully',
        key: 'API_KEY',
        length: newSecret.length
      });
      expect(mockSecretManagerService.rotateSecret).toHaveBeenCalledWith('API_KEY', 'test-user');
    });

    it('should handle rotation errors', async () => {
      mockSecretManagerService.rotateSecret.mockRejectedValue(new Error('Rotation failed'));

      const response = await request(app)
        .post('/secrets/secrets/API_KEY/rotate')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to rotate secret');
    });
  });

  describe('DELETE /secrets/secrets/:key', () => {
    it('should delete secret successfully', async () => {
      mockSecretManagerService.deleteSecret.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          confirmKey: 'API_KEY',
          confirmAction: 'DELETE'
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Secret deleted successfully',
        key: 'API_KEY'
      });
      expect(mockSecretManagerService.deleteSecret).toHaveBeenCalledWith('API_KEY', 'test-user');
    });

    it('should require proper confirmation', async () => {
      const response = await request(app)
        .delete('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          confirmKey: 'WRONG_KEY',
          confirmAction: 'DELETE'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid confirmation');
    });

    it('should require DELETE confirmation action', async () => {
      const response = await request(app)
        .delete('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          confirmKey: 'API_KEY',
          confirmAction: 'WRONG_ACTION'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid confirmation');
    });
  });

  describe('GET /secrets/secrets/audit/access', () => {
    it('should get access audit log', async () => {
      const mockLog = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          secretKey: 'API_KEY',
          operation: 'read',
          accessedBy: 'user1',
          success: true
        },
        {
          timestamp: '2024-01-01T01:00:00Z',
          secretKey: 'DB_PASSWORD',
          operation: 'update',
          accessedBy: 'user2',
          success: true
        }
      ];

      mockSecretManagerService.getAccessLog.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/secrets/secrets/audit/access')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        count: 2,
        entries: mockLog
      });
    });

    it('should support filtering by secret key', async () => {
      const filteredLog = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          secretKey: 'API_KEY',
          operation: 'read',
          accessedBy: 'user1'
        }
      ];

      mockSecretManagerService.getAccessLog.mockReturnValue(filteredLog);

      const response = await request(app)
        .get('/secrets/secrets/audit/access?secretKey=API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockSecretManagerService.getAccessLog).toHaveBeenCalledWith({
        secretKey: 'API_KEY'
      });
    });

    it('should support multiple filters', async () => {
      mockSecretManagerService.getAccessLog.mockReturnValue([]);

      const response = await request(app)
        .get('/secrets/secrets/audit/access?secretKey=API_KEY&accessedBy=user1&operation=read')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockSecretManagerService.getAccessLog).toHaveBeenCalledWith({
        secretKey: 'API_KEY',
        accessedBy: 'user1',
        operation: 'read'
      });
    });

    it('should limit results to 100 entries', async () => {
      const largeLog = Array(150).fill(null).map((_, i) => ({
        timestamp: '2024-01-01T00:00:00Z',
        secretKey: `KEY_${i}`,
        operation: 'read'
      }));

      mockSecretManagerService.getAccessLog.mockReturnValue(largeLog);

      const response = await request(app)
        .get('/secrets/secrets/audit/access')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.count).toBe(150);
      expect(response.body.entries).toHaveLength(100);
    });
  });

  describe('GET /secrets/secrets/audit/export', () => {
    it('should export audit log', async () => {
      const exportData = JSON.stringify({
        exportedAt: '2024-01-01T00:00:00Z',
        entries: [
          { timestamp: '2024-01-01T00:00:00Z', secretKey: 'API_KEY', operation: 'read' }
        ]
      });

      mockSecretManagerService.exportAccessLog.mockResolvedValue(exportData);

      const response = await request(app)
        .get('/secrets/secrets/audit/export')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json');
      expect(response.headers['content-disposition']).toBe('attachment; filename="secret-audit-log.json"');
      expect(response.text).toBe(exportData);
    });

    it('should handle export errors', async () => {
      mockSecretManagerService.exportAccessLog.mockRejectedValue(new Error('Export failed'));

      const response = await request(app)
        .get('/secrets/secrets/audit/export')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to export audit log');
    });
  });

  describe('GET /secrets/secrets/rotation/status', () => {
    it('should get rotation status', async () => {
      mockSecretUtils.isSecretKey.mockImplementation((key) => {
        return ['API_KEY', 'DB_PASSWORD', 'JWT_SECRET'].includes(key);
      });

      mockSecretUtils.getSecretPolicy.mockImplementation((key) => {
        if (key === 'API_KEY') {
          return { rotationInterval: 30 * 24 * 60 * 60 * 1000 }; // 30 days
        }
        return null;
      });

      const response = await request(app)
        .get('/secrets/secrets/rotation/status')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveProperty('secrets');
      expect(response.body).toHaveProperty('totalSecrets');
      expect(response.body).toHaveProperty('rotationEnabledCount');
      expect(response.body.secrets).toHaveLength(1); // Only API_KEY has rotation enabled
    });
  });

  describe('POST /secrets/secrets/:key/rotation/enable', () => {
    it('should enable rotation for secret', async () => {
      mockSecretManagerService.setupRotationSchedule.mockReturnValue(undefined);

      const response = await request(app)
        .post('/secrets/secrets/API_KEY/rotation/enable')
        .set('Authorization', 'Bearer admin-token')
        .send({ intervalDays: 30 })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Rotation schedule enabled',
        key: 'API_KEY',
        intervalDays: 30
      });
      expect(mockSecretManagerService.setupRotationSchedule).toHaveBeenCalledWith(
        'API_KEY',
        30 * 24 * 60 * 60 * 1000
      );
    });

    it('should validate interval days', async () => {
      const response = await request(app)
        .post('/secrets/secrets/API_KEY/rotation/enable')
        .set('Authorization', 'Bearer admin-token')
        .send({ intervalDays: 0 })
        .expect(400);

      expect(response.body.error).toBe('Interval days must be at least 1');
    });
  });

  describe('POST /secrets/secrets/cache/clear', () => {
    it('should clear secret cache', async () => {
      mockSecretManagerService.clearCache.mockReturnValue(undefined);

      const response = await request(app)
        .post('/secrets/secrets/cache/clear')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Secret cache cleared successfully'
      });
      expect(mockSecretManagerService.clearCache).toHaveBeenCalled();
    });

    it('should handle cache clear errors', async () => {
      mockSecretManagerService.clearCache.mockImplementation(() => {
        throw new Error('Cache clear failed');
      });

      const response = await request(app)
        .post('/secrets/secrets/cache/clear')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to clear cache');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockSecretManagerService.getAccessLog.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/secrets/secrets/audit/access')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to get audit log');
    });

    it('should handle missing user context', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = undefined;
        next();
      });

      mockSecretManagerService.rotateSecret.mockResolvedValue('new-secret');

      const response = await request(app)
        .post('/secrets/secrets/API_KEY/rotate')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockSecretManagerService.rotateSecret).toHaveBeenCalledWith('API_KEY', 'admin');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/secrets/secrets/validate')
        .set('Authorization', 'Bearer admin-token')
        .type('json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Security', () => {
    it('should not expose secret values in responses', async () => {
      const response = await request(app)
        .get('/secrets/secrets/API_KEY/metadata')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).not.toHaveProperty('value');
      expect(JSON.stringify(response.body)).not.toContain('test-api-key');
    });

    it('should require strong confirmation for destructive operations', async () => {
      const response = await request(app)
        .delete('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({ confirmKey: 'API_KEY' }) // Missing confirmAction
        .expect(400);

      expect(response.body.error).toBe('Invalid confirmation');
    });

    it('should log all operations', async () => {
      mockSecretManagerService.setSecret.mockResolvedValue(undefined);
      mockSecretValidator.validateSecret.mockReturnValue({ valid: true });

      await request(app)
        .put('/secrets/secrets/API_KEY')
        .set('Authorization', 'Bearer admin-token')
        .send({
          value: 'new-secret-value',
          confirmKey: 'API_KEY'
        })
        .expect(200);

      // Verify logger was called
      expect(mockCreateLogger).toHaveBeenCalledWith('secrets-routes');
    });
  });
});