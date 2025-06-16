import { complianceService, ComplianceCheckData } from '../../services/compliance.service';
import { AppError } from '../../middleware/error.middleware';

describe('ComplianceService', () => {
  beforeEach(() => {
    // Reset any static state
    jest.clearAllMocks();
  });

  describe('performComplianceAudit', () => {
    it('should perform a complete GDPR compliance audit', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.95,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email', 'name'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'EU'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.auditId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.overall.frameworks).toContain('GDPR');
      expect(result.overall.score).toBeGreaterThan(0);
      expect(result.overall.score).toBeLessThanOrEqual(100);

      // Should have GDPR-specific assessment
      expect(result.gdpr).toBeDefined();
      expect(result.gdpr.totalRules).toBe(6);
      expect(result.gdpr.passedRules).toBeLessThanOrEqual(6);
      expect(result.gdpr.score).toBeGreaterThan(0);
    });

    it('should identify GDPR violations for missing consent', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.95,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email'],
        processingPurpose: 'marketing',
        userConsent: false, // Missing consent
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'EU'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.gdpr.violations).toContainEqual(
        expect.objectContaining({
          ruleId: 'gdpr-001',
          severity: 'critical',
          message: expect.stringContaining('consent')
        })
      );
      expect(result.gdpr.score).toBeLessThan(80); // Should fail due to missing consent
    });

    it('should perform HIPAA compliance assessment for health data', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'medical_record_number',
            value: 'MRN123456',
            position: { start: 0, end: 9 },
            confidence: 0.92,
            pattern: 'mrn',
            piiType: 'medical'
          }
        ],
        dataTypes: ['medical_record'],
        processingPurpose: 'healthcare',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: false, // Not applicable for HIPAA
        dataPortability: false, // Not applicable for HIPAA
        breachNotification: true,
        privacyByDesign: true,
        containsHealthData: true,
        geolocation: 'US'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.hipaa).toBeDefined();
      expect(result.hipaa.totalRules).toBe(5);
      expect(result.overall.frameworks).toContain('HIPAA');
      
      // Should pass HIPAA requirements
      expect(result.hipaa.score).toBeGreaterThan(80);
    });

    it('should identify HIPAA violations for inadequate PHI protection', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'medical_record_number',
            value: 'MRN123456',
            position: { start: 0, end: 9 },
            confidence: 0.92,
            pattern: 'mrn',
            piiType: 'medical'
          }
        ],
        dataTypes: ['medical_record'],
        processingPurpose: 'healthcare',
        userConsent: true,
        dataMinimization: false, // Violates minimum necessary
        encryptionEnabled: false, // Missing encryption
        accessControls: false, // Missing access controls
        auditLogging: false, // Missing audit logging
        dataRetentionPolicy: true,
        rightToDelete: false,
        dataPortability: false,
        breachNotification: true,
        privacyByDesign: false,
        containsHealthData: true,
        geolocation: 'US'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.hipaa.violations.length).toBeGreaterThan(0);
      expect(result.hipaa.violations).toContainEqual(
        expect.objectContaining({
          ruleId: 'hipaa-001',
          severity: 'critical'
        })
      );
      expect(result.hipaa.score).toBeLessThan(60); // Should fail due to multiple violations
    });

    it('should perform CCPA compliance assessment', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.95,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email', 'name'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'CA' // California
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.ccpa).toBeDefined();
      expect(result.ccpa.totalRules).toBe(4);
      expect(result.overall.frameworks).toContain('CCPA');
      expect(result.ccpa.score).toBeGreaterThan(0);
    });

    it('should handle empty PII detection results', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [],
        dataTypes: [],
        processingPurpose: 'analytics',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      expect(result.overall.score).toBeGreaterThan(90); // Should score high with no PII
      expect(result.summary.violations.length).toBe(0);
    });

    it('should calculate overall compliance score correctly', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.95,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'EU'
      };

      const result = await complianceService.performComplianceAudit(checkData);

      // Overall score should be weighted average of framework scores
      const expectedScore = Math.round(
        (result.gdpr.score + result.ccpa.score + result.hipaa.score) / 3
      );
      
      expect(Math.abs(result.overall.score - expectedScore)).toBeLessThan(5); // Allow small variance
    });
  });

  describe('calculateComplianceScore', () => {
    it('should calculate compliance score based on current audit state', async () => {
      const score = await complianceService.calculateComplianceScore();

      expect(score.overallScore).toBeDefined();
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      expect(score.frameworkScores).toBeDefined();
      expect(score.violations).toBeDefined();
    });
  });

  describe('getAuditHistory', () => {
    it('should return audit history with proper structure', async () => {
      const history = await complianceService.getAuditHistory();

      expect(Array.isArray(history)).toBe(true);
      
      if (history.length > 0) {
        const audit = history[0];
        expect(audit).toHaveProperty('timestamp');
        expect(audit).toHaveProperty('score');
        expect(audit).toHaveProperty('framework');
        expect(audit.score).toBeGreaterThanOrEqual(0);
        expect(audit.score).toBeLessThanOrEqual(100);
      }
    });

    it('should handle empty audit history gracefully', async () => {
      // Mock empty history scenario
      const history = await complianceService.getAuditHistory();
      
      expect(Array.isArray(history)).toBe(true);
      // Should not throw error even if empty
    });
  });

  describe('Framework-specific rule evaluation', () => {
    describe('GDPR Rules', () => {
      it('should evaluate GDPR-001 (Lawful Basis) correctly', async () => {
        const withConsent: ComplianceCheckData = {
          piiDetected: [{ type: 'email', value: 'test@email.com', position: { start: 0, end: 14 }, confidence: 0.9, pattern: 'email', piiType: 'email' }],
          dataTypes: ['email'],
          processingPurpose: 'marketing',
          userConsent: true,
          dataMinimization: true,
          encryptionEnabled: true,
          accessControls: true,
          auditLogging: true,
          dataRetentionPolicy: true,
          rightToDelete: true,
          dataPortability: true,
          breachNotification: true,
          privacyByDesign: true,
          geolocation: 'EU'
        };

        const result = await complianceService.performComplianceAudit(withConsent);
        const gdprRule001 = result.gdpr.violations.find(v => v.ruleId === 'gdpr-001');
        expect(gdprRule001).toBeUndefined(); // Should pass

        // Test without consent
        const withoutConsent = { ...withConsent, userConsent: false };
        const result2 = await complianceService.performComplianceAudit(withoutConsent);
        const violation = result2.gdpr.violations.find(v => v.ruleId === 'gdpr-001');
        expect(violation).toBeDefined();
        expect(violation?.severity).toBe('critical');
      });

      it('should evaluate GDPR-002 (Data Minimization) correctly', async () => {
        const checkData: ComplianceCheckData = {
          piiDetected: [{ type: 'email', value: 'test@email.com', position: { start: 0, end: 14 }, confidence: 0.9, pattern: 'email', piiType: 'email' }],
          dataTypes: ['email'],
          processingPurpose: 'marketing',
          userConsent: true,
          dataMinimization: false, // Violates data minimization
          encryptionEnabled: true,
          accessControls: true,
          auditLogging: true,
          dataRetentionPolicy: true,
          rightToDelete: true,
          dataPortability: true,
          breachNotification: true,
          privacyByDesign: true,
          geolocation: 'EU'
        };

        const result = await complianceService.performComplianceAudit(checkData);
        const violation = result.gdpr.violations.find(v => v.ruleId === 'gdpr-002');
        expect(violation).toBeDefined();
        expect(violation?.severity).toBe('high');
      });
    });

    describe('HIPAA Rules', () => {
      it('should evaluate HIPAA-001 (PHI Safeguards) correctly', async () => {
        const checkData: ComplianceCheckData = {
          piiDetected: [{ type: 'medical_record_number', value: 'MRN123', position: { start: 0, end: 6 }, confidence: 0.9, pattern: 'mrn', piiType: 'medical' }],
          dataTypes: ['medical_record'],
          processingPurpose: 'healthcare',
          userConsent: true,
          dataMinimization: true,
          encryptionEnabled: false, // Missing encryption for PHI
          accessControls: true,
          auditLogging: true,
          dataRetentionPolicy: true,
          rightToDelete: false,
          dataPortability: false,
          breachNotification: true,
          privacyByDesign: true,
          containsHealthData: true,
          geolocation: 'US'
        };

        const result = await complianceService.performComplianceAudit(checkData);
        const violation = result.hipaa.violations.find(v => v.ruleId === 'hipaa-001');
        expect(violation).toBeDefined();
        expect(violation?.severity).toBe('critical');
      });
    });

    describe('CCPA Rules', () => {
      it('should evaluate CCPA-001 (Right to Know) correctly', async () => {
        const checkData: ComplianceCheckData = {
          piiDetected: [{ type: 'email', value: 'test@email.com', position: { start: 0, end: 14 }, confidence: 0.9, pattern: 'email', piiType: 'email' }],
          dataTypes: ['email'],
          processingPurpose: 'marketing',
          userConsent: true,
          dataMinimization: true,
          encryptionEnabled: true,
          accessControls: false, // Missing access controls for right to know
          auditLogging: true,
          dataRetentionPolicy: true,
          rightToDelete: true,
          dataPortability: true,
          breachNotification: true,
          privacyByDesign: true,
          geolocation: 'CA'
        };

        const result = await complianceService.performComplianceAudit(checkData);
        const violation = result.ccpa.violations.find(v => v.ruleId === 'ccpa-001');
        expect(violation).toBeDefined();
        expect(violation?.severity).toBe('high');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid compliance check data', async () => {
      const invalidData = null as any;

      await expect(
        complianceService.performComplianceAudit(invalidData)
      ).rejects.toThrow(AppError);
    });

    it('should handle malformed PII detection results', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: null as any,
            value: 'test@email.com',
            position: { start: 0, end: 14 },
            confidence: 0.9,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US'
      };

      // Should handle gracefully and not crash
      const result = await complianceService.performComplianceAudit(checkData);
      expect(result).toBeDefined();
    });

    it('should validate geolocation input', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [],
        dataTypes: [],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: '' // Invalid geolocation
      };

      const result = await complianceService.performComplianceAudit(checkData);
      expect(result.overall.score).toBeLessThan(100); // Should impact score
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of PII detections efficiently', async () => {
      const largePiiArray = Array.from({ length: 1000 }, (_, i) => ({
        type: 'email',
        value: `user${i}@company.com`,
        position: { start: i * 20, end: i * 20 + 16 },
        confidence: 0.9,
        pattern: 'email',
        piiType: 'email'
      }));

      const checkData: ComplianceCheckData = {
        piiDetected: largePiiArray,
        dataTypes: ['email'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US'
      };

      const startTime = Date.now();
      const result = await complianceService.performComplianceAudit(checkData);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain consistent scoring across repeated audits', async () => {
      const checkData: ComplianceCheckData = {
        piiDetected: [
          {
            type: 'email',
            value: 'test@email.com',
            position: { start: 0, end: 14 },
            confidence: 0.9,
            pattern: 'email',
            piiType: 'email'
          }
        ],
        dataTypes: ['email'],
        processingPurpose: 'marketing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US'
      };

      const results = await Promise.all([
        complianceService.performComplianceAudit(checkData),
        complianceService.performComplianceAudit(checkData),
        complianceService.performComplianceAudit(checkData)
      ]);

      const scores = results.map(r => r.overall.score);
      expect(scores[0]).toBe(scores[1]);
      expect(scores[1]).toBe(scores[2]);
    });
  });
});