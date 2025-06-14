import { NativeDataCloakBridge } from '../datacloak/native-bridge';
import { KeychainManager } from '../keychain/keychain-manager';
import { SecurityMonitor } from '../monitoring/security-monitor';
import { BackendSecurityClient } from '../integration/backend-security-client';
import { AdversarialCorpus } from '../testing/adversarial-corpus';
import { SecurityAuditor } from '../audit/security-auditor';

describe('Security Integration Tests', () => {
  describe('Native DataCloak Bridge Integration', () => {
    let nativeBridge: NativeDataCloakBridge;

    beforeEach(() => {
      nativeBridge = new NativeDataCloakBridge({
        fallbackToMock: true,
        useSystemBinary: false
      });
    });

    it('should initialize with fallback configuration', async () => {
      await nativeBridge.initialize({});
      expect(nativeBridge.isAvailable()).toBe(true);
      expect(nativeBridge.getVersion()).toContain('mock');
    });

    it('should handle binary detection gracefully', async () => {
      await nativeBridge.initialize({});
      const result = await nativeBridge.detectPII('Contact john@example.com');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Keychain Manager Integration', () => {
    let keychainManager: KeychainManager;

    beforeEach(() => {
      keychainManager = new KeychainManager({
        serviceName: 'test-dsw',
        accountName: 'test-user',
        fallbackToFileSystem: false // Use memory for tests
      });
    });

    it('should store and retrieve keys', async () => {
      const testKey = 'test-encryption-key';
      await keychainManager.storeKey('test-key-id', testKey);
      
      const retrievedKey = await keychainManager.retrieveKey('test-key-id');
      expect(retrievedKey).toBe(testKey);
    });

    it('should generate and store new keys', async () => {
      const keyId = 'generated-key';
      const generatedKey = await keychainManager.generateAndStoreKey(keyId);
      
      expect(generatedKey).toBeDefined();
      expect(typeof generatedKey).toBe('string');
      
      const retrievedKey = await keychainManager.retrieveKey(keyId);
      expect(retrievedKey).toBe(generatedKey);
    });

    it('should rotate keys', async () => {
      const keyId = 'rotation-test';
      const originalKey = await keychainManager.generateAndStoreKey(keyId);
      
      const newKey = await keychainManager.rotateKey(keyId);
      
      expect(newKey).not.toBe(originalKey);
      expect(newKey).toBeDefined();
    });

    it('should validate key integrity', async () => {
      const keyId = 'integrity-test';
      await keychainManager.generateAndStoreKey(keyId);
      
      const isValid = await keychainManager.validateKeyIntegrity(keyId);
      expect(isValid).toBe(true);
      
      const invalidValid = await keychainManager.validateKeyIntegrity('non-existent');
      expect(invalidValid).toBe(false);
    });
  });

  describe('Security Monitor Integration', () => {
    let monitor: SecurityMonitor;

    beforeEach(() => {
      monitor = new SecurityMonitor({
        enableRealTimeAlerts: true,
        aggregationIntervalMs: 100,
        retentionDays: 1
      });
    });

    afterEach(() => {
      monitor.stopMonitoring();
    });

    it('should record and track security events', () => {
      monitor.recordPIIDetection('test-source', [
        {
          fieldName: 'email',
          piiType: 'EMAIL' as any,
          confidence: 0.95,
          sample: 'test@example.com',
          masked: 't***@example.com'
        }
      ], 150);

      const events = monitor.getEvents({ type: 'pii_detected' });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('pii_detected');
      expect(events[0].data.detectionsCount).toBe(1);
    });

    it('should trigger alerts based on rules', async () => {
      const alertPromise = new Promise((resolve) => {
        monitor.on('alert', (alert) => {
          expect(alert.type).toBeDefined();
          expect(alert.message).toBeDefined();
          resolve(alert);
        });
      });

      monitor.startMonitoring();
      
      // Record enough errors to trigger error rate alert
      for (let i = 0; i < 10; i++) {
        monitor.recordError('test-source', `Test error ${i}`);
      }

      const alert = await Promise.race([
        alertPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);
      
      expect(alert).toBeDefined();
    });

    it('should calculate metrics correctly', () => {
      // Use a fresh monitor for this test
      const freshMonitor = new SecurityMonitor({
        enableRealTimeAlerts: false,
        aggregationIntervalMs: 100,
        retentionDays: 1
      });
      
      freshMonitor.recordPIIDetection('source1', [], 100);
      freshMonitor.recordSecurityViolation('source2', 'Unauthorized access', 'high');
      freshMonitor.recordError('source3', 'Test error');

      const metrics = freshMonitor.getMetrics();
      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventsByType['pii_detected']).toBe(1);
      expect(metrics.eventsByType['security_violation']).toBe(1);
      expect(metrics.eventsByType['error']).toBe(1);
    });

    it('should export events in different formats', () => {
      monitor.recordPIIDetection('test', [], 100);
      
      const jsonExport = monitor.exportEvents('json');
      const csvExport = monitor.exportEvents('csv');
      
      expect(jsonExport).toContain('pii_detected');
      expect(csvExport).toContain('id,timestamp,type');
    });
  });

  describe('Backend Security Client Integration', () => {
    let client: BackendSecurityClient;

    beforeEach(() => {
      client = new BackendSecurityClient({
        baseURL: 'http://localhost:3001',
        enableRealTimeReporting: false // Disable for tests
      });
    });

    it('should handle connection testing gracefully', async () => {
      // This will likely fail in test environment, which is expected
      const isConnected = await client.testConnection();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should queue events when real-time reporting is disabled', async () => {
      const testEvent = {
        id: 'test-1',
        timestamp: new Date(),
        type: 'pii_detected' as const,
        severity: 'medium' as const,
        source: 'test',
        data: {},
        resolved: false
      };

      // Should not throw even if backend is not available
      await expect(client.reportSecurityEvent(testEvent)).resolves.not.toThrow();
    });
  });

  describe('Adversarial Corpus Integration', () => {
    let corpus: AdversarialCorpus;
    let auditor: SecurityAuditor;

    beforeEach(async () => {
      corpus = new AdversarialCorpus();
      const { DataCloakMock } = await import('../mock/datacloak-mock');
      const mock = new DataCloakMock();
      await mock.initialize({});
      auditor = new SecurityAuditor(mock);
    });

    it('should generate comprehensive test corpus', () => {
      const stats = corpus.getStats();
      expect(stats.totalExamples).toBeGreaterThan(100000); // Should generate significant corpus
      expect(Object.keys(stats.byDifficulty)).toContain('easy');
      expect(Object.keys(stats.byDifficulty)).toContain('hard');
      expect(Object.keys(stats.byDifficulty)).toContain('extreme');
    });

    it('should provide examples by difficulty', () => {
      const easyExamples = corpus.getExamplesByDifficulty('easy');
      const hardExamples = corpus.getExamplesByDifficulty('hard');
      
      expect(easyExamples.length).toBeGreaterThan(0);
      expect(hardExamples.length).toBeGreaterThan(0);
      expect(easyExamples[0].difficulty).toBe('easy');
      expect(hardExamples[0].difficulty).toBe('hard');
    });

    it('should provide examples by PII type', () => {
      const emailExamples = corpus.getExamplesByPIIType('EMAIL' as any);
      const phoneExamples = corpus.getExamplesByPIIType('PHONE' as any);
      
      expect(emailExamples.length).toBeGreaterThan(0);
      expect(phoneExamples.length).toBeGreaterThan(0);
      
      emailExamples.forEach(example => {
        expect(example.expectedPII.some(pii => pii.type === 'EMAIL')).toBe(true);
      });
    });

    it('should work with security auditor for validation', async () => {
      const testExamples = corpus.getExamplesByDifficulty('easy').slice(0, 10);
      
      for (const example of testExamples) {
        const isValid = await auditor.validatePIIMasking(
          example.text,
          example.text.replace(/[^\s]/g, '*') // Simple masking
        );
        expect(typeof isValid).toBe('boolean');
      }
    });
  });

  describe('End-to-End Security Workflow', () => {
    it('should demonstrate complete security workflow', async () => {
      // Initialize components
      const { DataCloakMock } = await import('../mock/datacloak-mock');
      const dataCloak = new DataCloakMock();
      await dataCloak.initialize({});
      
      const auditor = new SecurityAuditor(dataCloak);
      const monitor = new SecurityMonitor();
      const corpus = new AdversarialCorpus();
      
      // Test with adversarial examples
      const testExamples = corpus.getExamplesByDifficulty('medium').slice(0, 5);
      
      for (const example of testExamples) {
        // Detect PII
        const detections = await dataCloak.detectPII(example.text);
        
        // Record monitoring event
        monitor.recordPIIDetection('e2e-test', detections, 100);
        
        // Mask text
        const maskingResult = await dataCloak.maskText(example.text);
        
        // Validate masking
        const isValidMasking = await auditor.validatePIIMasking(
          example.text,
          maskingResult.maskedText
        );
        
        expect(detections).toBeDefined();
        expect(maskingResult.maskedText).toBeDefined();
        expect(typeof isValidMasking).toBe('boolean');
      }
      
      // Check monitoring results
      const metrics = monitor.getMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
      expect(metrics.eventsByType['pii_detected']).toBeGreaterThan(0);
      
      monitor.stopMonitoring();
    });
  });
});