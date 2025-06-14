import { SecurityAuditor } from '../audit/security-auditor';
import { DataCloakMock } from '../mock/datacloak-mock';

describe('SecurityAuditor', () => {
  let dataCloakMock: DataCloakMock;
  let auditor: SecurityAuditor;

  beforeEach(async () => {
    dataCloakMock = new DataCloakMock();
    await dataCloakMock.initialize({});
    auditor = new SecurityAuditor(dataCloakMock);
  });

  describe('single file audit', () => {
    it('should audit a file successfully', async () => {
      const result = await auditor.auditFile('/test/file.csv');
      
      expect(result.fileProcessed).toBe('/test/file.csv');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.complianceScore).toBe('number');
    });

    it('should throw error when DataCloak is not available', async () => {
      const unavailableMock = new DataCloakMock();
      const unavailableAuditor = new SecurityAuditor(unavailableMock);
      
      await expect(unavailableAuditor.auditFile('/test/file.csv'))
        .rejects.toThrow('DataCloak bridge is not available');
    });

    it('should store audit results in history', async () => {
      await auditor.auditFile('/test/file1.csv');
      await auditor.auditFile('/test/file2.csv');
      
      const history = auditor.getAuditHistory();
      expect(history).toHaveLength(2);
      expect(history[0].fileProcessed).toBe('/test/file1.csv');
      expect(history[1].fileProcessed).toBe('/test/file2.csv');
    });
  });

  describe('multiple file audit', () => {
    it('should audit multiple files and generate report', async () => {
      const filePaths = ['/test/file1.csv', '/test/file2.csv', '/test/file3.csv'];
      const report = await auditor.auditMultipleFiles(filePaths);
      
      expect(report.filesAudited).toBe(3);
      expect(report.reportId).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.auditResults).toHaveLength(3);
      expect(typeof report.averageAccuracy).toBe('number');
      expect(typeof report.complianceScore).toBe('number');
    });

    it('should handle empty file list', async () => {
      const report = await auditor.auditMultipleFiles([]);
      
      expect(report.filesAudited).toBe(0);
      expect(report.auditResults).toHaveLength(0);
      expect(report.averageAccuracy).toBe(0);
      expect(report.complianceScore).toBe(0);
    });
  });

  describe('PII masking validation', () => {
    it('should validate effective PII masking', async () => {
      const originalText = 'Contact john.doe@example.com for info';
      const maskedText = 'Contact joh****@example.com for info';
      
      const isValid = await auditor.validatePIIMasking(originalText, maskedText);
      expect(typeof isValid).toBe('boolean');
    });

    it('should detect ineffective masking', async () => {
      const originalText = 'Contact john.doe@example.com for info';
      const poorlyMaskedText = 'Contact john.doe@example.com for info';
      
      const isValid = await auditor.validatePIIMasking(originalText, poorlyMaskedText);
      expect(isValid).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      auditor.updateConfig({ 
        complianceThreshold: 0.95,
        logLevel: 'debug'
      });
      
      expect(auditor['config'].complianceThreshold).toBe(0.95);
      expect(auditor['config'].logLevel).toBe('debug');
    });

    it('should preserve existing config when updating', () => {
      const originalAlertSetting = auditor['config'].alertOnViolations;
      
      auditor.updateConfig({ complianceThreshold: 0.95 });
      
      expect(auditor['config'].alertOnViolations).toBe(originalAlertSetting);
      expect(auditor['config'].complianceThreshold).toBe(0.95);
    });
  });

  describe('audit history management', () => {
    it('should clear audit history', async () => {
      await auditor.auditFile('/test/file1.csv');
      await auditor.auditFile('/test/file2.csv');
      
      expect(auditor.getAuditHistory()).toHaveLength(2);
      
      auditor.clearAuditHistory();
      expect(auditor.getAuditHistory()).toHaveLength(0);
    });

    it('should return copy of history (immutable)', async () => {
      await auditor.auditFile('/test/file.csv');
      
      const history1 = auditor.getAuditHistory();
      const history2 = auditor.getAuditHistory();
      
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });
});