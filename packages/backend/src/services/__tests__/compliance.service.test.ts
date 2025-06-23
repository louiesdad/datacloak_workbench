import { ComplianceService } from '../compliance.service';
import { getSQLiteConnection } from '../../database/sqlite-refactored';
import { AppError } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('../../database/sqlite-refactored');

const mockSQLiteConnection = {
  prepare: jest.fn(),
  close: jest.fn()
};

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSQLiteConnection as jest.Mock).mockReturnValue(mockSQLiteConnection);
    service = new ComplianceService();
  });

  describe('initialization', () => {
    it('should initialize with compliance rules', () => {
      expect(service).toBeDefined();
      const rules = service.getComplianceRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.framework === 'GDPR')).toBe(true);
      expect(rules.some(rule => rule.framework === 'CCPA')).toBe(true);
      expect(rules.some(rule => rule.framework === 'HIPAA')).toBe(true);
    });
  });

  describe('performComplianceAudit', () => {
    const mockCheckData = {
      piiDetected: [
        { type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' },
        { type: 'PHONE', value: '555-1234', confidence: 0.9, piiType: 'PHONE' }
      ],
      dataTypes: ['personal', 'contact'],
      encryptionEnabled: true,
      accessControls: true,
      auditLogging: false,
      dataRetentionPolicy: true,
      rightToDelete: true,
      dataPortability: true,
      breachNotification: true,
      privacyByDesign: true,
      userConsent: true,
      dataMinimization: true
    };

    it('should perform compliance audit for all frameworks', async () => {
      const result = await service.performComplianceAudit(mockCheckData);

      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('gdpr');
      expect(result).toHaveProperty('ccpa');
      expect(result).toHaveProperty('hipaa');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('auditId');
      expect(result).toHaveProperty('timestamp');
    });

    it('should calculate overall compliance score', async () => {
      const result = await service.performComplianceAudit(mockCheckData);

      expect(result.overall.score).toBeGreaterThanOrEqual(0);
      expect(result.overall.score).toBeLessThanOrEqual(100);
      expect(result.overall.frameworks).toEqual(['GDPR', 'CCPA', 'HIPAA']);
    });

    it('should identify compliance violations', async () => {
      const nonCompliantData = {
        ...mockCheckData,
        encryptionEnabled: false,
        accessControls: false,
        userConsent: false
      };

      const result = await service.performComplianceAudit(nonCompliantData);

      expect(result.summary.violations.length).toBeGreaterThan(0);
      expect(result.overall.status).toBe('non_compliant');
    });

    it('should provide recommendations', async () => {
      const result = await service.performComplianceAudit(mockCheckData);

      expect(result.summary.recommendations).toBeDefined();
      expect(Array.isArray(result.summary.recommendations)).toBe(true);
    });

    it('should handle partial compliance', async () => {
      const partialData = {
        ...mockCheckData,
        auditLogging: false,
        breachNotification: false
      };

      const result = await service.performComplianceAudit(partialData);

      expect(result.overall.status).toBe('needs_review');
      expect(result.overall.score).toBeGreaterThan(50);
      expect(result.overall.score).toBeLessThan(80);
    });
  });

  describe('checkGDPRCompliance', () => {
    it('should check GDPR specific requirements', () => {
      const data = {
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true
      };

      const result = service.checkGDPRCompliance(data);

      expect(result.score).toBeGreaterThan(80);
      expect(result.status).toBe('compliant');
    });

    it('should fail GDPR compliance without user consent', () => {
      const data = {
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        userConsent: false,
        dataMinimization: true,
        encryptionEnabled: true
      };

      const result = service.checkGDPRCompliance(data);

      expect(result.score).toBeLessThan(70);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.message.includes('consent'))).toBe(true);
    });

    it('should require data minimization for GDPR', () => {
      const data = {
        piiDetected: Array(20).fill({ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }),
        dataTypes: ['personal', 'sensitive', 'health', 'financial'],
        userConsent: true,
        dataMinimization: false
      };

      const result = service.checkGDPRCompliance(data);

      expect(result.violations.some(v => v.message.includes('minimization'))).toBe(true);
    });
  });

  describe('checkCCPACompliance', () => {
    it('should check CCPA specific requirements', () => {
      const data = {
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US-CA'
      };

      const result = service.checkCCPACompliance(data);

      expect(result.score).toBeGreaterThan(70);
      expect(result.status).toBe('compliant');
    });

    it('should require opt-out mechanism for CCPA', () => {
      const data = {
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        rightToDelete: false,
        dataPortability: false
      };

      const result = service.checkCCPACompliance(data);

      expect(result.violations.some(v => v.message.includes('Right to delete'))).toBe(true);
      expect(result.violations.some(v => v.message.includes('Data portability'))).toBe(true);
    });
  });

  describe('checkHIPAACompliance', () => {
    it('should check HIPAA specific requirements for health data', () => {
      const data = {
        piiDetected: [{ type: 'SSN', value: '***-**-1234', confidence: 0.95, piiType: 'SSN' }],
        dataTypes: ['health', 'medical'],
        containsHealthData: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true
      };

      const result = service.checkHIPAACompliance(data);

      expect(result.score).toBeGreaterThan(80);
      expect(result.status).toBe('compliant');
    });

    it('should require encryption for HIPAA', () => {
      const data = {
        piiDetected: [{ type: 'SSN', value: '***-**-1234', confidence: 0.95, piiType: 'SSN' }],
        dataTypes: ['health'],
        containsHealthData: true,
        encryptionEnabled: false,
        accessControls: true
      };

      const result = service.checkHIPAACompliance(data);

      expect(result.violations.some(v => v.message.includes('Encryption'))).toBe(true);
      expect(result.severity).toContain('critical');
    });

    it('should require audit logging for HIPAA', () => {
      const data = {
        piiDetected: [],
        dataTypes: ['health'],
        containsHealthData: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: false
      };

      const result = service.checkHIPAACompliance(data);

      expect(result.violations.some(v => v.message.includes('Audit logging'))).toBe(true);
    });

    it('should return not applicable for non-health data', () => {
      const data = {
        piiDetected: [],
        dataTypes: ['personal'],
        containsHealthData: false
      };

      const result = service.checkHIPAACompliance(data);

      expect(result.score).toBe(100);
      expect(result.recommendations).toContain('HIPAA compliance is not applicable for non-health data');
    });
  });

  describe('generateComplianceReport', () => {
    beforeEach(() => {
      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn(),
        all: jest.fn()
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);
    });

    it('should generate compliance report', async () => {
      const datasetId = 'test-dataset-123';
      const auditResult = await service.performComplianceAudit({
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        encryptionEnabled: true,
        userConsent: true
      });

      const report = await service.generateComplianceReport(datasetId, auditResult);

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('datasetId', datasetId);
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('frameworks');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('generatedAt');
    });

    it('should store report in database', async () => {
      const datasetId = 'test-dataset-123';
      const auditResult = await service.performComplianceAudit({
        piiDetected: [],
        dataTypes: ['personal']
      });

      await service.generateComplianceReport(datasetId, auditResult);

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO compliance_reports')
      );
    });

    it('should handle database errors', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      const auditResult = await service.performComplianceAudit({
        piiDetected: [],
        dataTypes: ['personal']
      });

      await expect(service.generateComplianceReport('dataset-123', auditResult))
        .rejects.toThrow(new AppError('Database connection not available', 500, 'DB_ERROR'));
    });
  });

  describe('getComplianceHistory', () => {
    beforeEach(() => {
      const mockReports = [
        {
          id: '1',
          datasetId: 'dataset-1',
          overallScore: 85,
          overallStatus: 'compliant',
          gdprScore: 90,
          gdprStatus: 'compliant',
          ccpaScore: 85,
          ccpaStatus: 'compliant',
          hipaaScore: 80,
          hipaaStatus: 'compliant',
          violationCount: 2,
          generatedAt: '2024-01-01'
        },
        {
          id: '2',
          datasetId: 'dataset-2',
          overallScore: 65,
          overallStatus: 'needs_review',
          gdprScore: 60,
          gdprStatus: 'non_compliant',
          ccpaScore: 70,
          ccpaStatus: 'needs_review',
          hipaaScore: 65,
          hipaaStatus: 'needs_review',
          violationCount: 5,
          generatedAt: '2024-01-02'
        }
      ];

      const countStmt = { get: jest.fn().mockReturnValue({ total: 2 }) };
      const dataStmt = { all: jest.fn().mockReturnValue(mockReports) };

      mockSQLiteConnection.prepare.mockImplementation((sql) => {
        if (sql.includes('COUNT(*)')) return countStmt;
        return dataStmt;
      });
    });

    it('should return paginated compliance history', async () => {
      const result = await service.getComplianceHistory(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by dataset ID', async () => {
      await service.getComplianceHistory(1, 10, 'dataset-1');

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE dataset_id = ?')
      );
    });

    it('should handle database errors', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(service.getComplianceHistory())
        .rejects.toThrow(new AppError('Database connection not available', 500, 'DB_ERROR'));
    });
  });

  describe('getLatestComplianceReport', () => {
    it('should return latest report for dataset', async () => {
      const mockReport = {
        id: '1',
        datasetId: 'dataset-1',
        overallScore: 85,
        overallStatus: 'compliant',
        generatedAt: '2024-01-01'
      };

      const mockStmt = { get: jest.fn().mockReturnValue(mockReport) };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getLatestComplianceReport('dataset-1');

      expect(result).toEqual(mockReport);
      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY generated_at DESC LIMIT 1')
      );
    });

    it('should return null if no report exists', async () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getLatestComplianceReport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('recommendSecurityMeasures', () => {
    it('should recommend encryption for sensitive data', () => {
      const checkData = {
        piiDetected: [
          { type: 'SSN', value: '***', confidence: 0.95, piiType: 'SSN' },
          { type: 'CREDIT_CARD', value: '****', confidence: 0.9, piiType: 'CREDIT_CARD' }
        ],
        dataTypes: ['financial', 'personal'],
        encryptionEnabled: false
      };

      const recommendations = service.recommendSecurityMeasures(checkData);

      expect(recommendations).toContain('Implement end-to-end encryption for sensitive data');
      expect(recommendations).toContain('Use field-level encryption for highly sensitive fields (SSN, credit cards)');
    });

    it('should recommend access controls', () => {
      const checkData = {
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        accessControls: false
      };

      const recommendations = service.recommendSecurityMeasures(checkData);

      expect(recommendations).toContain('Implement role-based access control (RBAC)');
    });

    it('should recommend data minimization for excessive data', () => {
      const checkData = {
        piiDetected: Array(15).fill({ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }),
        dataTypes: ['personal', 'sensitive', 'health', 'financial', 'biometric'],
        dataMinimization: false
      };

      const recommendations = service.recommendSecurityMeasures(checkData);

      expect(recommendations).toContain('Review data collection practices - minimize personal data collection');
      expect(recommendations).toContain('Implement data classification and tagging system');
    });

    it('should recommend monitoring for large datasets', () => {
      const checkData = {
        piiDetected: [],
        dataTypes: ['personal'],
        fileSize: 500 * 1024 * 1024, // 500MB
        auditLogging: false
      };

      const recommendations = service.recommendSecurityMeasures(checkData);

      expect(recommendations).toContain('Enable comprehensive audit logging for all data access');
      expect(recommendations).toContain('Implement real-time monitoring for large dataset operations');
    });
  });

  describe('compliance rule checks', () => {
    it('should check lawful basis for processing', () => {
      const rule = service.getComplianceRules().find(r => r.id === 'gdpr-001');
      expect(rule).toBeDefined();

      const result = rule!.checker({
        piiDetected: [{ type: 'EMAIL', value: 'test@example.com', confidence: 0.95, piiType: 'EMAIL' }],
        dataTypes: ['personal'],
        userConsent: true,
        processingPurpose: 'marketing'
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should check data security measures', () => {
      const rule = service.getComplianceRules().find(r => r.title.includes('Data Security'));
      expect(rule).toBeDefined();

      const result = rule!.checker({
        piiDetected: [],
        dataTypes: ['personal'],
        encryptionEnabled: true,
        accessControls: true
      });

      expect(result.passed).toBe(true);
    });

    it('should check data subject rights', () => {
      const rule = service.getComplianceRules().find(r => r.title.includes('Data Subject Rights'));
      expect(rule).toBeDefined();

      const result = rule!.checker({
        piiDetected: [],
        dataTypes: ['personal'],
        rightToDelete: true,
        dataPortability: true
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data gracefully', async () => {
      const result = await service.performComplianceAudit({
        piiDetected: [],
        dataTypes: []
      });

      expect(result.overall.score).toBe(100);
      expect(result.overall.status).toBe('compliant');
    });

    it('should handle unknown data types', async () => {
      const result = await service.performComplianceAudit({
        piiDetected: [],
        dataTypes: ['unknown', 'custom']
      });

      expect(result).toBeDefined();
      expect(result.summary.recommendations).toContain('Review and classify unknown data types');
    });

    it('should prioritize critical violations', async () => {
      const result = await service.performComplianceAudit({
        piiDetected: [{ type: 'SSN', value: '***', confidence: 0.95, piiType: 'SSN' }],
        dataTypes: ['health'],
        containsHealthData: true,
        encryptionEnabled: false,
        accessControls: false,
        auditLogging: false
      });

      const criticalViolations = result.summary.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBeGreaterThan(0);
      expect(result.overall.status).toBe('non_compliant');
    });
  });
});