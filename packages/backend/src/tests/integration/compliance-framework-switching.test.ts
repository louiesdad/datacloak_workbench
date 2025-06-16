import { enhancedDataCloak, ComplianceFramework } from '../../services/enhanced-datacloak.service';
import { complianceService } from '../../services/compliance.service';
import { AppError } from '../../middleware/error.middleware';

describe('Compliance Framework Switching Integration Tests', () => {
  beforeAll(async () => {
    // Initialize the enhanced DataCloak service
    await enhancedDataCloak.initialize();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Framework Configuration Switching', () => {
    it('should switch from GENERAL to HIPAA framework and apply appropriate rules', async () => {
      // Start with GENERAL framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GENERAL);
      expect(enhancedDataCloak.getComplianceFramework()).toBe(ComplianceFramework.GENERAL);

      // Test data with medical information
      const testText = 'Patient John Doe, MRN123456, email: john.doe@hospital.com, SSN: 123-45-6789';

      // Perform risk assessment with GENERAL framework
      const generalAssessment = await enhancedDataCloak.assessDataRisk([testText]);
      
      // Switch to HIPAA framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      expect(enhancedDataCloak.getComplianceFramework()).toBe(ComplianceFramework.HIPAA);

      // Perform risk assessment with HIPAA framework
      const hipaaAssessment = await enhancedDataCloak.assessDataRisk([testText]);

      // HIPAA should detect medical record numbers and apply stricter rules
      expect(hipaaAssessment.overall_risk).toBe('critical'); // Medical data requires critical handling
      expect(hipaaAssessment.compliance_status.frameworks).toContain('HIPAA');
      expect(hipaaAssessment.recommendations).toContainEqual(
        expect.stringContaining('encryption')
      );

      // Risk score should be higher under HIPAA due to medical data
      expect(hipaaAssessment.risk_score).toBeGreaterThan(generalAssessment.risk_score);
    });

    it('should switch from HIPAA to PCI_DSS and change detection priorities', async () => {
      // Start with HIPAA framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);

      const financialTestText = 'Payment card: 4532-1234-5678-9012, Account: 123456789012, Customer: john@bank.com';

      // Switch to PCI_DSS framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.PCI_DSS);
      expect(enhancedDataCloak.getComplianceFramework()).toBe(ComplianceFramework.PCI_DSS);

      // Perform risk assessment with PCI_DSS framework
      const pciAssessment = await enhancedDataCloak.assessDataRisk([financialTestText]);

      // PCI_DSS should prioritize financial data
      expect(pciAssessment.compliance_status.frameworks).toContain('PCI-DSS');
      expect(pciAssessment.pii_detected.financial).toBeGreaterThan(0);
      expect(pciAssessment.recommendations).toContainEqual(
        expect.stringContaining('field-level masking')
      );
    });

    it('should switch from PCI_DSS to GDPR and apply privacy-focused rules', async () => {
      // Start with PCI_DSS framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.PCI_DSS);

      const gdprTestText = 'EU citizen data: email user@company.eu, phone +33-1-234-567, IP: 192.168.1.100';

      // Switch to GDPR framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GDPR);
      expect(enhancedDataCloak.getComplianceFramework()).toBe(ComplianceFramework.GDPR);

      // Perform risk assessment with GDPR framework
      const gdprAssessment = await enhancedDataCloak.assessDataRisk([gdprTestText]);

      // GDPR should focus on personal data protection
      expect(gdprAssessment.compliance_status.frameworks).toContain('GDPR');
      expect(gdprAssessment.geographic_context.cross_border_transfer).toBeDefined();
      expect(gdprAssessment.recommendations).toContainEqual(
        expect.stringContaining('audit logging')
      );
    });
  });

  describe('Framework-Specific Pattern Detection', () => {
    it('should apply HIPAA-specific patterns when framework is switched', async () => {
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);

      const medicalTexts = [
        'Patient MRN987654 diagnosed with condition',
        'Medical record number: MED123456',
        'Healthcare ID: HC-789012'
      ];

      const assessments = await Promise.all(
        medicalTexts.map(text => enhancedDataCloak.assessDataRisk([text]))
      );

      // All should detect medical-specific patterns
      assessments.forEach(assessment => {
        expect(assessment.pii_detected.medical).toBeGreaterThan(0);
        expect(assessment.applicable_regulations).toContain('HIPAA');
      });
    });

    it('should apply PCI_DSS-specific patterns for financial data', async () => {
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.PCI_DSS);

      const financialTexts = [
        'Credit card: 5555-4444-3333-2222',
        'Bank account: DE89370400440532013000', // IBAN
        'Account number: 1234567890123456'
      ];

      const assessments = await Promise.all(
        financialTexts.map(text => enhancedDataCloak.assessDataRisk([text]))
      );

      // All should detect financial-specific patterns
      assessments.forEach(assessment => {
        expect(assessment.pii_detected.financial).toBeGreaterThan(0);
        expect(assessment.applicable_regulations).toContain('PCI-DSS');
      });
    });

    it('should apply GDPR-specific patterns for personal data', async () => {
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GDPR);

      const personalTexts = [
        'EU driver license: AB123456789',
        'Passport: P123456789',
        'Personal email: citizen@gmail.com'
      ];

      const assessments = await Promise.all(
        personalTexts.map(text => enhancedDataCloak.assessDataRisk([text]))
      );

      // All should be evaluated under GDPR rules
      assessments.forEach(assessment => {
        expect(assessment.applicable_regulations).toContain('GDPR');
        expect(assessment.geographic_context).toBeDefined();
      });
    });
  });

  describe('Confidence Threshold Adjustments', () => {
    it('should adjust detection sensitivity based on framework requirements', async () => {
      const testText = 'Email: user@company.com, Phone: 555-123-4567';

      // Test with low confidence threshold (GENERAL framework)
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GENERAL);
      await enhancedDataCloak.updateConfidenceThreshold(0.5);

      const lowThresholdAssessment = await enhancedDataCloak.assessDataRisk([testText]);

      // Test with high confidence threshold (HIPAA framework)
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      await enhancedDataCloak.updateConfidenceThreshold(0.9);

      const highThresholdAssessment = await enhancedDataCloak.assessDataRisk([testText]);

      // Higher threshold should result in fewer detections or higher confidence scores
      expect(highThresholdAssessment.confidence_distribution.high)
        .toBeGreaterThanOrEqual(lowThresholdAssessment.confidence_distribution.high);
    });

    it('should validate confidence threshold bounds', async () => {
      await expect(
        enhancedDataCloak.updateConfidenceThreshold(-0.1)
      ).rejects.toThrow(AppError);

      await expect(
        enhancedDataCloak.updateConfidenceThreshold(1.1)
      ).rejects.toThrow(AppError);

      // Valid thresholds should work
      await expect(
        enhancedDataCloak.updateConfidenceThreshold(0.0)
      ).resolves.not.toThrow();

      await expect(
        enhancedDataCloak.updateConfidenceThreshold(1.0)
      ).resolves.not.toThrow();
    });
  });

  describe('Custom Pattern Management Across Frameworks', () => {
    it('should maintain custom patterns when switching frameworks', async () => {
      // Add a custom pattern
      const patternId = await enhancedDataCloak.addCustomPattern({
        name: 'Employee ID',
        pattern: 'EMP[0-9]{6}',
        confidence: 0.9,
        risk_level: 'medium',
        compliance_frameworks: [ComplianceFramework.HIPAA, ComplianceFramework.GDPR],
        description: 'Employee identification number',
        enabled: true,
        priority: 50
      });

      // Switch frameworks and verify pattern persists
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      let patterns = enhancedDataCloak.getCustomPatterns();
      expect(patterns.find(p => p.id === patternId)).toBeDefined();

      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GDPR);
      patterns = enhancedDataCloak.getCustomPatterns();
      expect(patterns.find(p => p.id === patternId)).toBeDefined();

      // Clean up
      await enhancedDataCloak.removeCustomPattern(patternId);
    });

    it('should apply framework-specific custom patterns correctly', async () => {
      // Add HIPAA-specific pattern
      const hipaaPatternId = await enhancedDataCloak.addCustomPattern({
        name: 'Hospital ID',
        pattern: 'HOSP[0-9]{4}',
        confidence: 0.85,
        risk_level: 'high',
        compliance_frameworks: [ComplianceFramework.HIPAA],
        description: 'Hospital identification number',
        enabled: true,
        priority: 80
      });

      // Add PCI_DSS-specific pattern
      const pciPatternId = await enhancedDataCloak.addCustomPattern({
        name: 'Merchant ID',
        pattern: 'MERCH[0-9]{8}',
        confidence: 0.85,
        risk_level: 'high',
        compliance_frameworks: [ComplianceFramework.PCI_DSS],
        description: 'Merchant identification number',
        enabled: true,
        priority: 80
      });

      const testText = 'Hospital: HOSP1234, Merchant: MERCH12345678';

      // Test with HIPAA framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      const hipaaAssessment = await enhancedDataCloak.assessDataRisk([testText]);

      // Test with PCI_DSS framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.PCI_DSS);
      const pciAssessment = await enhancedDataCloak.assessDataRisk([testText]);

      // Both should detect their respective patterns
      expect(hipaaAssessment.risk_score).toBeGreaterThan(0);
      expect(pciAssessment.risk_score).toBeGreaterThan(0);

      // Clean up
      await enhancedDataCloak.removeCustomPattern(hipaaPatternId);
      await enhancedDataCloak.removeCustomPattern(pciPatternId);
    });
  });

  describe('Framework Switching Performance', () => {
    it('should switch frameworks quickly without significant performance impact', async () => {
      const frameworks = [
        ComplianceFramework.GENERAL,
        ComplianceFramework.HIPAA,
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.GDPR
      ];

      const switchTimes: number[] = [];

      for (const framework of frameworks) {
        const startTime = Date.now();
        await enhancedDataCloak.updateComplianceFramework(framework);
        const endTime = Date.now();
        
        switchTimes.push(endTime - startTime);
        expect(enhancedDataCloak.getComplianceFramework()).toBe(framework);
      }

      // Framework switching should be fast (< 100ms per switch)
      switchTimes.forEach(time => {
        expect(time).toBeLessThan(100);
      });

      const averageTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
      expect(averageTime).toBeLessThan(50); // Average should be very fast
    });

    it('should maintain consistent performance across framework switches', async () => {
      const testText = 'User data: john@company.com, phone: 555-123-4567, SSN: 123-45-6789';
      const frameworks = [ComplianceFramework.HIPAA, ComplianceFramework.GDPR, ComplianceFramework.PCI_DSS];
      
      const assessmentTimes: number[] = [];

      for (const framework of frameworks) {
        await enhancedDataCloak.updateComplianceFramework(framework);
        
        const startTime = Date.now();
        await enhancedDataCloak.assessDataRisk([testText]);
        const endTime = Date.now();
        
        assessmentTimes.push(endTime - startTime);
      }

      // All assessments should complete in reasonable time
      assessmentTimes.forEach(time => {
        expect(time).toBeLessThan(1000); // < 1 second
      });

      // Performance should be consistent across frameworks
      const maxTime = Math.max(...assessmentTimes);
      const minTime = Math.min(...assessmentTimes);
      expect(maxTime - minTime).toBeLessThan(500); // Variation should be < 500ms
    });
  });

  describe('Integration with Compliance Service', () => {
    it('should synchronize framework changes between services', async () => {
      // Change framework in enhanced service
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);

      // Test data that should trigger HIPAA compliance check
      const checkData = {
        piiDetected: [
          {
            type: 'medical_record_number',
            value: 'MRN123456',
            position: { start: 0, end: 9 },
            confidence: 0.95,
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
        rightToDelete: false,
        dataPortability: false,
        breachNotification: true,
        privacyByDesign: true,
        containsHealthData: true,
        geolocation: 'US'
      };

      const auditResult = await complianceService.performComplianceAudit(checkData);

      // Should evaluate under HIPAA rules
      expect(auditResult.overall.frameworks).toContain('HIPAA');
      expect(auditResult.hipaa.score).toBeDefined();
    });

    it('should handle framework mismatches gracefully', async () => {
      // Set enhanced service to one framework
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.PCI_DSS);

      // Test with data more suitable for different framework
      const testText = 'Medical record: MRN123456, Patient: John Doe';
      const assessment = await enhancedDataCloak.assessDataRisk([testText]);

      // Should still process but may show warnings or recommendations
      expect(assessment).toBeDefined();
      expect(assessment.risk_score).toBeGreaterThan(0);
    });
  });

  describe('Event Emission and Monitoring', () => {
    it('should emit events when frameworks are switched', async () => {
      const events: any[] = [];
      
      enhancedDataCloak.on('compliance_framework_changed', (event) => {
        events.push(event);
      });

      // Switch frameworks
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GDPR);

      expect(events).toHaveLength(2);
      expect(events[0].framework).toBe(ComplianceFramework.HIPAA);
      expect(events[1].framework).toBe(ComplianceFramework.GDPR);

      // Clean up listener
      enhancedDataCloak.removeAllListeners('compliance_framework_changed');
    });

    it('should emit events when confidence thresholds are changed', async () => {
      const events: any[] = [];
      
      enhancedDataCloak.on('confidence_threshold_changed', (event) => {
        events.push(event);
      });

      // Change threshold
      await enhancedDataCloak.updateConfidenceThreshold(0.7);
      await enhancedDataCloak.updateConfidenceThreshold(0.9);

      expect(events).toHaveLength(2);
      expect(events[0].threshold).toBe(0.7);
      expect(events[1].threshold).toBe(0.9);

      // Clean up listener
      enhancedDataCloak.removeAllListeners('confidence_threshold_changed');
    });
  });

  describe('Error Handling in Framework Switching', () => {
    it('should handle invalid framework gracefully', async () => {
      await expect(
        enhancedDataCloak.updateComplianceFramework('INVALID_FRAMEWORK' as any)
      ).rejects.toThrow();

      // Service should remain in previous valid state
      const currentFramework = enhancedDataCloak.getComplianceFramework();
      expect(Object.values(ComplianceFramework)).toContain(currentFramework);
    });

    it('should maintain service functionality after failed framework switch', async () => {
      // Set to known good state
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GDPR);
      
      // Attempt invalid switch
      try {
        await enhancedDataCloak.updateComplianceFramework('INVALID' as any);
      } catch (error) {
        // Expected to fail
      }

      // Service should still work
      const testText = 'Test email: user@company.com';
      const assessment = await enhancedDataCloak.assessDataRisk([testText]);
      
      expect(assessment).toBeDefined();
      expect(assessment.risk_score).toBeGreaterThanOrEqual(0);
    });
  });
});