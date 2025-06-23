import { RiskAssessmentService } from '../risk-assessment.service';
import { ComplianceFramework } from '../enhanced-datacloak.service';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  describe('initialization', () => {
    it('should initialize risk assessment service', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RiskAssessmentService);
    });
  });

  describe('performRiskAssessment', () => {
    const mockData = {
      records: [
        { name: 'John Doe', email: 'john@example.com', ssn: '123-45-6789' },
        { name: 'Jane Smith', email: 'jane@example.com', phone: '555-0123' }
      ],
      metadata: {
        source: 'test',
        dataType: 'customer_records',
        jurisdiction: ['US', 'EU'],
        processingPurpose: 'analytics'
      }
    };

    it('should perform comprehensive risk assessment', async () => {
      const result = await service.performRiskAssessment(mockData);

      expect(result).toBeDefined();
      expect(result.assessmentId).toBeDefined();
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.overallRiskScore).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toMatch(/low|medium|high|critical/);
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.riskFactors).toBeInstanceOf(Array);
    });

    it('should identify GDPR violations for EU data', async () => {
      const result = await service.performRiskAssessment(mockData);

      expect(result.geographicAssessment.gdprApplicable).toBe(true);
      expect(result.complianceStatus[ComplianceFramework.GDPR]).toBeDefined();
    });

    it('should classify data sensitivity correctly', async () => {
      const result = await service.performRiskAssessment(mockData);

      expect(result.dataSensitivity.classification).toMatch(/confidential|restricted/);
      expect(result.dataSensitivity.sensitivityScore).toBeGreaterThan(50);
      expect(result.dataSensitivity.categories).toContain('PII');
    });

    it('should generate immediate actions for high-risk data', async () => {
      const highRiskData = {
        ...mockData,
        records: [
          { name: 'Test', ccn: '4111111111111111', ssn: '123-45-6789' }
        ]
      };

      const result = await service.performRiskAssessment(highRiskData);

      expect(result.immediateActions.length).toBeGreaterThan(0);
      expect(result.riskLevel).toMatch(/high|critical/);
    });

    it('should emit risk events for monitoring', async () => {
      const riskDetectedHandler = jest.fn();
      service.on('risk:detected', riskDetectedHandler);

      await service.performRiskAssessment(mockData);

      expect(riskDetectedHandler).toHaveBeenCalled();
    });

    it('should handle empty data gracefully', async () => {
      const emptyData = {
        records: [],
        metadata: mockData.metadata
      };

      const result = await service.performRiskAssessment(emptyData);

      expect(result.overallRiskScore).toBe(0);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('assessGeographicRisk', () => {
    it('should assess high risk for cross-border transfers', async () => {
      const assessment = await service.assessGeographicRisk(['US', 'EU', 'CN']);

      expect(assessment.crossBorderTransfer).toBe(true);
      expect(assessment.riskScore).toBeGreaterThan(50);
      expect(assessment.transferRestrictions.length).toBeGreaterThan(0);
    });

    it('should identify GDPR requirements for EU jurisdictions', async () => {
      const assessment = await service.assessGeographicRisk(['DE', 'FR']);

      expect(assessment.gdprApplicable).toBe(true);
      expect(assessment.additionalRegulations).toContain('GDPR');
    });

    it('should assess low risk for single jurisdiction', async () => {
      const assessment = await service.assessGeographicRisk(['US']);

      expect(assessment.crossBorderTransfer).toBe(false);
      expect(assessment.riskScore).toBeLessThan(30);
    });
  });

  describe('classifyDataSensitivity', () => {
    it('should classify financial data as restricted', async () => {
      const fields = ['credit_card', 'bank_account', 'ssn'];
      const classification = await service.classifyDataSensitivity(fields, 100);

      expect(classification.classification).toBe('restricted');
      expect(classification.sensitivityScore).toBeGreaterThan(80);
      expect(classification.categories).toContain('Financial');
    });

    it('should classify basic PII as confidential', async () => {
      const fields = ['name', 'email', 'phone'];
      const classification = await service.classifyDataSensitivity(fields, 100);

      expect(classification.classification).toBe('confidential');
      expect(classification.categories).toContain('PII');
    });

    it('should classify public data correctly', async () => {
      const fields = ['company_name', 'product_name'];
      const classification = await service.classifyDataSensitivity(fields, 100);

      expect(classification.classification).toBe('public');
      expect(classification.sensitivityScore).toBeLessThan(30);
    });
  });

  describe('detectComplianceViolations', () => {
    const mockAssessment = {
      records: [{ name: 'Test', email: 'test@test.com', ssn: '123-45-6789' }],
      frameworks: [ComplianceFramework.GDPR, ComplianceFramework.HIPAA],
      dataSensitivity: {
        classification: 'restricted' as const,
        categories: ['PII', 'Medical']
      }
    };

    it('should detect GDPR violations', async () => {
      const violations = await service.detectComplianceViolations(mockAssessment);

      const gdprViolations = violations.filter(v => v.framework === ComplianceFramework.GDPR);
      expect(gdprViolations.length).toBeGreaterThan(0);
    });

    it('should detect HIPAA violations for medical data', async () => {
      const medicalData = {
        ...mockAssessment,
        records: [{ patient_id: '123', diagnosis: 'Test', medication: 'Test' }]
      };

      const violations = await service.detectComplianceViolations(medicalData);

      const hipaaViolations = violations.filter(v => v.framework === ComplianceFramework.HIPAA);
      expect(hipaaViolations.length).toBeGreaterThan(0);
      expect(hipaaViolations[0].severity).toMatch(/high|critical/);
    });

    it('should provide remediation steps', async () => {
      const violations = await service.detectComplianceViolations(mockAssessment);

      expect(violations[0].remediation).toBeDefined();
      expect(violations[0].remediation.steps.length).toBeGreaterThan(0);
      expect(violations[0].remediation.timeframe).toBeDefined();
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate weighted risk score', () => {
      const factors = [
        { weight: 0.5, score: 80 },
        { weight: 0.3, score: 60 },
        { weight: 0.2, score: 40 }
      ];

      const score = service.calculateRiskScore(factors);

      expect(score).toBe(66); // (0.5*80 + 0.3*60 + 0.2*40)
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases', () => {
      expect(service.calculateRiskScore([])).toBe(0);
      expect(service.calculateRiskScore([{ weight: 1, score: 100 }])).toBe(100);
    });
  });

  describe('generateMitigationPlan', () => {
    const mockAssessment = {
      assessmentId: 'test-123',
      overallRiskScore: 75,
      riskLevel: 'high' as const,
      violations: [
        {
          id: 'v1',
          framework: ComplianceFramework.GDPR,
          severity: 'high' as const,
          requiresImmediateAction: true,
          remediation: {
            steps: ['Implement encryption', 'Update privacy policy'],
            timeframe: '30 days',
            cost: 'medium' as const
          }
        }
      ],
      immediateActions: ['Encrypt PII data'],
      shortTermActions: ['Implement access controls'],
      longTermActions: ['Regular compliance audits']
    };

    it('should generate comprehensive mitigation plan', async () => {
      const plan = await service.generateMitigationPlan(mockAssessment as any);

      expect(plan.planId).toBeDefined();
      expect(plan.riskAssessmentId).toBe('test-123');
      expect(plan.priority).toBe('immediate');
      expect(plan.actions.length).toBeGreaterThan(0);
    });

    it('should prioritize immediate actions', async () => {
      const plan = await service.generateMitigationPlan(mockAssessment as any);

      const immediateActions = plan.actions.filter(a => a.priority === 'immediate');
      expect(immediateActions.length).toBeGreaterThan(0);
      expect(immediateActions[0].timeline).toContain('immediately');
    });

    it('should estimate costs', async () => {
      const plan = await service.generateMitigationPlan(mockAssessment as any);

      expect(plan.estimatedCost).toBeGreaterThan(0);
      expect(plan.costBreakdown).toBeDefined();
    });
  });

  describe('monitorRiskTrends', () => {
    it('should track risk trends over time', async () => {
      // Perform multiple assessments
      const assessments = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.performRiskAssessment({
          records: [{ name: `Test ${i}`, email: `test${i}@test.com` }],
          metadata: { source: 'test', jurisdiction: ['US'] }
        });
        assessments.push(result);
      }

      const trends = await service.getRiskTrends('1d');

      expect(trends).toBeDefined();
      expect(trends.dataPoints.length).toBeGreaterThan(0);
      expect(trends.averageRisk).toBeDefined();
      expect(trends.trend).toMatch(/increasing|decreasing|stable/);
    });
  });

  describe('exportRiskReport', () => {
    it('should export risk assessment report', async () => {
      const assessment = await service.performRiskAssessment({
        records: [{ name: 'Test', email: 'test@test.com' }],
        metadata: { source: 'test', jurisdiction: ['US'] }
      });

      const report = await service.exportRiskReport(assessment.assessmentId, 'json');

      expect(report).toBeDefined();
      expect(report.format).toBe('json');
      expect(report.data).toBeDefined();
    });

    it('should support multiple export formats', async () => {
      const assessment = await service.performRiskAssessment({
        records: [{ name: 'Test', email: 'test@test.com' }],
        metadata: { source: 'test', jurisdiction: ['US'] }
      });

      const formats = ['json', 'csv', 'pdf'];
      for (const format of formats) {
        const report = await service.exportRiskReport(assessment.assessmentId, format);
        expect(report.format).toBe(format);
      }
    });
  });

  describe('getRiskRecommendations', () => {
    it('should provide actionable recommendations based on risk level', async () => {
      const recommendations = await service.getRiskRecommendations('high', ['PII', 'Financial']);

      expect(recommendations).toBeDefined();
      expect(recommendations.immediate.length).toBeGreaterThan(0);
      expect(recommendations.shortTerm.length).toBeGreaterThan(0);
      expect(recommendations.longTerm.length).toBeGreaterThan(0);
    });

    it('should prioritize recommendations by severity', async () => {
      const recommendations = await service.getRiskRecommendations('critical', ['Medical']);

      expect(recommendations.immediate[0].priority).toBe('critical');
      expect(recommendations.immediate.length).toBeGreaterThan(recommendations.longTerm.length);
    });
  });

  describe('validateMitigationImplementation', () => {
    it('should validate mitigation measures', async () => {
      const mitigationPlan = {
        planId: 'test-plan',
        actions: [
          { id: 'a1', description: 'Implement encryption', status: 'completed' },
          { id: 'a2', description: 'Update policies', status: 'in_progress' }
        ]
      };

      const validation = await service.validateMitigationImplementation(mitigationPlan as any);

      expect(validation.completionRate).toBe(50);
      expect(validation.remainingActions).toBe(1);
      expect(validation.isComplete).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid data gracefully', async () => {
      await expect(service.performRiskAssessment(null as any))
        .rejects.toThrow('Invalid data for risk assessment');
    });

    it('should handle missing metadata', async () => {
      const result = await service.performRiskAssessment({
        records: [{ name: 'Test' }],
        metadata: {} as any
      });

      expect(result).toBeDefined();
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('caching and performance', () => {
    it('should cache risk assessments', async () => {
      const data = {
        records: [{ name: 'Test', email: 'test@test.com' }],
        metadata: { source: 'test', jurisdiction: ['US'] }
      };

      const result1 = await service.performRiskAssessment(data);
      const result2 = await service.performRiskAssessment(data);

      // Should return cached result for identical data
      expect(result2.assessmentId).not.toBe(result1.assessmentId);
      expect(result2.assessmentMetadata.processingTime)
        .toBeLessThan(result1.assessmentMetadata.processingTime);
    });
  });
});