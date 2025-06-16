import { Request, Response } from 'express';
import { complianceService, ComplianceCheckData } from '../services/compliance.service';
import { AppError } from '../middleware/error.middleware';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ComplianceController {
  async getDashboard(req: Request, res: Response): Promise<Response> {
    try {
      // For demo purposes, create a sample compliance check data
      const sampleData: ComplianceCheckData = {
        piiDetected: [
          { type: 'email', value: 'example@email.com', position: { start: 0, end: 17 }, confidence: 0.95, pattern: 'email', piiType: 'email' },
          { type: 'phone', value: '123-456-7890', position: { start: 0, end: 12 }, confidence: 0.88, pattern: 'phone', piiType: 'phone' }
        ],
        dataTypes: ['email', 'phone', 'name'],
        processingPurpose: 'sentiment analysis',
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
        fileSize: 1024000, // 1MB
        containsHealthData: false,
        containsFinancialData: false,
        containsBiometricData: false,
        geolocation: 'US'
      };

      const auditResult = await complianceService.performComplianceAudit(sampleData);

      const dashboard = {
        overview: {
          overallScore: auditResult.overall.score,
          status: auditResult.overall.status,
          frameworks: auditResult.overall.frameworks,
          lastAuditDate: auditResult.timestamp,
          criticalViolations: auditResult.summary.violations.filter(v => v.severity === 'critical').length,
          totalViolations: auditResult.summary.violations.length
        },
        frameworks: {
          gdpr: {
            name: 'GDPR',
            score: auditResult.gdpr.score,
            status: auditResult.gdpr.status,
            passedRules: auditResult.gdpr.passedRules,
            totalRules: auditResult.gdpr.totalRules,
            violations: auditResult.gdpr.violations.length,
            criticalViolations: auditResult.gdpr.violations.filter(v => v.severity === 'critical').length
          },
          ccpa: {
            name: 'CCPA',
            score: auditResult.ccpa.score,
            status: auditResult.ccpa.status,
            passedRules: auditResult.ccpa.passedRules,
            totalRules: auditResult.ccpa.totalRules,
            violations: auditResult.ccpa.violations.length,
            criticalViolations: auditResult.ccpa.violations.filter(v => v.severity === 'critical').length
          },
          hipaa: {
            name: 'HIPAA',
            score: auditResult.hipaa.score,
            status: auditResult.hipaa.status,
            passedRules: auditResult.hipaa.passedRules,
            totalRules: auditResult.hipaa.totalRules,
            violations: auditResult.hipaa.violations.length,
            criticalViolations: auditResult.hipaa.violations.filter(v => v.severity === 'critical').length
          }
        },
        recentViolations: auditResult.summary.violations.slice(0, 10),
        recommendations: auditResult.summary.recommendations.slice(0, 10),
        auditInfo: {
          auditId: auditResult.auditId,
          timestamp: auditResult.timestamp,
          totalRules: auditResult.summary.totalRules,
          passedRules: auditResult.summary.passedRules
        }
      };

      return res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Error getting compliance dashboard:', error);
      throw new AppError('Failed to get compliance dashboard', 500, 'COMPLIANCE_DASHBOARD_ERROR');
    }
  }

  async performAudit(req: Request, res: Response): Promise<Response> {
    try {
      const checkData: ComplianceCheckData = req.body;

      // Perform the compliance audit
      const auditResult = await complianceService.performComplianceAudit(checkData);

      return res.json({
        success: true,
        data: auditResult
      });
    } catch (error) {
      console.error('Error performing compliance audit:', error);
      throw new AppError('Failed to perform compliance audit', 500, 'COMPLIANCE_AUDIT_ERROR');
    }
  }

  async getFrameworkDetails(req: Request, res: Response): Promise<Response> {
    try {
      const { framework } = req.params;
      
      if (!['GDPR', 'CCPA', 'HIPAA'].includes(framework)) {
        throw new AppError('Invalid framework specified', 400, 'INVALID_FRAMEWORK');
      }

      // Create sample data for framework-specific analysis
      const sampleData: ComplianceCheckData = {
        piiDetected: [],
        dataTypes: ['email', 'name'],
        processingPurpose: 'analysis',
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
        containsHealthData: framework === 'HIPAA',
        containsFinancialData: false,
        containsBiometricData: false,
        geolocation: 'US'
      };

      const auditResult = await complianceService.performComplianceAudit(sampleData);
      
      let frameworkResult;
      switch (framework) {
        case 'GDPR':
          frameworkResult = auditResult.gdpr;
          break;
        case 'CCPA':
          frameworkResult = auditResult.ccpa;
          break;
        case 'HIPAA':
          frameworkResult = auditResult.hipaa;
          break;
        default:
          throw new AppError('Invalid framework', 400, 'INVALID_FRAMEWORK');
      }

      return res.json({
        success: true,
        data: {
          framework: framework,
          ...frameworkResult,
          auditId: auditResult.auditId,
          timestamp: auditResult.timestamp
        }
      });
    } catch (error) {
      console.error('Error getting framework details:', error);
      throw new AppError('Failed to get framework details', 500, 'FRAMEWORK_DETAILS_ERROR');
    }
  }

  async downloadAuditReport(req: Request, res: Response): Promise<void> {
    try {
      const { format = 'pdf', framework = 'all' } = req.query;
      const { datasetId } = req.params;

      // Get compliance data
      const sampleData: ComplianceCheckData = {
        piiDetected: [
          { type: 'email', value: 'user@company.com', position: { start: 0, end: 16 }, confidence: 0.95, pattern: 'email', piiType: 'email' },
          { type: 'phone', value: '555-123-4567', position: { start: 0, end: 12 }, confidence: 0.88, pattern: 'phone', piiType: 'phone' },
          { type: 'ssn', value: '***-**-6789', position: { start: 0, end: 11 }, confidence: 0.92, pattern: 'ssn', piiType: 'ssn' }
        ],
        dataTypes: ['email', 'phone', 'name', 'address'],
        processingPurpose: 'sentiment analysis and customer insights',
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
        fileSize: 5024000,
        containsHealthData: false,
        containsFinancialData: false,
        containsBiometricData: false,
        geolocation: 'US'
      };

      const auditResult = await complianceService.performComplianceAudit(sampleData);
      const auditHistory = await complianceService.getAuditHistory();
      
      if (format === 'pdf') {
        const pdfContent = await this.generatePDFReport(auditResult, auditHistory, framework as string);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-audit-${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdfContent);
      } else if (format === 'excel') {
        const excelContent = await this.generateExcelReport(auditResult, auditHistory, framework as string);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-audit-${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(excelContent);
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="compliance-audit-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
          auditResult,
          auditHistory,
          generatedAt: new Date().toISOString()
        });
      } else {
        res.status(400).json({ error: 'Invalid format. Use pdf, excel, or json' });
      }
    } catch (error) {
      console.error('Error generating audit report:', error);
      res.status(500).json({ error: 'Failed to generate audit report' });
    }
  }

  private async generatePDFReport(auditResult: any, auditHistory: any[], framework: string): Promise<Buffer> {
    // Create a simple PDF report using HTML-like structure
    const frameworks = framework === 'all' ? ['GDPR', 'CCPA', 'HIPAA'] : [framework.toUpperCase()];
    
    let pdfContent = `COMPLIANCE AUDIT REPORT
${'='.repeat(50)}

`;
    pdfContent += `Generated: ${new Date().toLocaleDateString()}
`;
    pdfContent += `Audit ID: ${auditResult.auditId}\n\n`;
    
    pdfContent += `OVERALL COMPLIANCE SCORE: ${auditResult.overall.score}%\n`;
    pdfContent += `Status: ${auditResult.overall.status}\n\n`;
    
    pdfContent += `FRAMEWORK COMPLIANCE\n${'-'.repeat(30)}\n`;
    frameworks.forEach(fw => {
      const fwLower = fw.toLowerCase();
      const fwResult = auditResult[fwLower];
      if (fwResult) {
        pdfContent += `${fw}: ${fwResult.score}% (${fwResult.status})\n`;
        pdfContent += `  Rules Passed: ${fwResult.passedRules}/${fwResult.totalRules}\n`;
        pdfContent += `  Violations: ${fwResult.violations.length}\n\n`;
      }
    });
    
    pdfContent += `\nVIOLATIONS SUMMARY\n${'-'.repeat(30)}\n`;
    const violations = auditResult.summary.violations.slice(0, 10);
    if (violations.length > 0) {
      violations.forEach((v: any) => {
        pdfContent += `• [${v.severity.toUpperCase()}] ${v.message}\n`;
        pdfContent += `  Rule: ${v.ruleId}\n`;
        pdfContent += `  Remediation: ${v.remediation}\n\n`;
      });
    } else {
      pdfContent += 'No violations found\n\n';
    }
    
    pdfContent += `\nRECOMMENDATIONS\n${'-'.repeat(30)}\n`;
    auditResult.summary.recommendations.slice(0, 5).forEach((rec: string) => {
      pdfContent += `• ${rec}\n`;
    });
    
    pdfContent += `\n\nAUDIT HISTORY (Last 5)\n${'-'.repeat(30)}\n`;
    auditHistory.slice(0, 5).forEach((audit: any) => {
      pdfContent += `${new Date(audit.timestamp).toLocaleDateString()} - Score: ${audit.score}%\n`;
    });
    
    return Buffer.from(pdfContent, 'utf-8');
  }

  private async generateExcelReport(auditResult: any, auditHistory: any[], framework: string): Promise<Buffer> {
    // Create a CSV format that Excel can open
    const frameworks = framework === 'all' ? ['GDPR', 'CCPA', 'HIPAA'] : [framework.toUpperCase()];
    
    let csvContent = 'Section,Category,Item,Value,Status\n';
    
    // Overall Summary
    csvContent += `"Summary","Overall","Compliance Score","${auditResult.overall.score}%","${auditResult.overall.status}"\n`;
    csvContent += `"Summary","Overall","Audit ID","${auditResult.auditId}",""\n`;
    csvContent += `"Summary","Overall","Timestamp","${auditResult.timestamp}",""\n`;
    
    // Framework Scores
    frameworks.forEach(fw => {
      const fwLower = fw.toLowerCase();
      const fwResult = auditResult[fwLower];
      if (fwResult) {
        csvContent += `"Framework","${fw}","Score","${fwResult.score}%","${fwResult.status}"\n`;
        csvContent += `"Framework","${fw}","Rules Passed","${fwResult.passedRules}/${fwResult.totalRules}",""\n`;
        csvContent += `"Framework","${fw}","Violations","${fwResult.violations.length}",""\n`;
      }
    });
    
    // Violations
    csvContent += '\n"Violations","Rule ID","Severity","Message","Remediation"\n';
    auditResult.summary.violations.forEach((v: any) => {
      csvContent += `"Violation","${v.ruleId}","${v.severity}","${v.message}","${v.remediation}"\n`;
    });
    
    // Recommendations
    csvContent += '\n"Recommendations","Priority","Action","",""\n';
    auditResult.summary.recommendations.forEach((rec: string, index: number) => {
      const priority = index < 3 ? 'High' : index < 6 ? 'Medium' : 'Low';
      csvContent += `"Recommendation","${priority}","${rec}","",""\n`;
    });
    
    // Audit History
    csvContent += '\n"Audit History","Date","Score","Framework","Status"\n';
    auditHistory.forEach((audit: any) => {
      const status = audit.score >= 80 ? 'PASSED' : 'FAILED';
      csvContent += `"History","${new Date(audit.timestamp).toLocaleDateString()}","${audit.score}%","${audit.framework || 'All'}","${status}"\n`;
    });
    
    return Buffer.from(csvContent, 'utf-8');
  }

  async generateAuditReport(req: Request, res: Response): Promise<Response> {
    try {
      const { format = 'json' } = req.query;
      
      // Create comprehensive sample data for audit report
      const sampleData: ComplianceCheckData = {
        piiDetected: [
          { type: 'email', value: 'user@company.com', position: { start: 0, end: 16 }, confidence: 0.95, pattern: 'email', piiType: 'email' },
          { type: 'phone', value: '555-123-4567', position: { start: 0, end: 12 }, confidence: 0.88, pattern: 'phone', piiType: 'phone' },
          { type: 'ssn', value: '123-45-6789', position: { start: 0, end: 11 }, confidence: 0.92, pattern: 'ssn', piiType: 'ssn' }
        ],
        dataTypes: ['email', 'phone', 'name', 'address'],
        processingPurpose: 'sentiment analysis and customer insights',
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
        fileSize: 5024000, // 5MB
        containsHealthData: false,
        containsFinancialData: false,
        containsBiometricData: false,
        geolocation: 'US'
      };

      const auditResult = await complianceService.performComplianceAudit(sampleData);

      const report = {
        executiveSummary: {
          auditDate: auditResult.timestamp,
          auditId: auditResult.auditId,
          overallScore: auditResult.overall.score,
          overallStatus: auditResult.overall.status,
          frameworksAssessed: auditResult.overall.frameworks,
          totalViolations: auditResult.summary.violations.length,
          criticalViolations: auditResult.summary.violations.filter(v => v.severity === 'critical').length,
          recommendationsCount: auditResult.summary.recommendations.length
        },
        frameworkResults: {
          gdpr: {
            score: auditResult.gdpr.score,
            status: auditResult.gdpr.status,
            compliance: `${auditResult.gdpr.passedRules}/${auditResult.gdpr.totalRules} rules passed`,
            keyViolations: auditResult.gdpr.violations.filter(v => v.severity === 'critical' || v.severity === 'high'),
            topRecommendations: auditResult.gdpr.recommendations.slice(0, 3)
          },
          ccpa: {
            score: auditResult.ccpa.score,
            status: auditResult.ccpa.status,
            compliance: `${auditResult.ccpa.passedRules}/${auditResult.ccpa.totalRules} rules passed`,
            keyViolations: auditResult.ccpa.violations.filter(v => v.severity === 'critical' || v.severity === 'high'),
            topRecommendations: auditResult.ccpa.recommendations.slice(0, 3)
          },
          hipaa: {
            score: auditResult.hipaa.score,
            status: auditResult.hipaa.status,
            compliance: `${auditResult.hipaa.passedRules}/${auditResult.hipaa.totalRules} rules passed`,
            keyViolations: auditResult.hipaa.violations.filter(v => v.severity === 'critical' || v.severity === 'high'),
            topRecommendations: auditResult.hipaa.recommendations.slice(0, 3)
          }
        },
        detailedFindings: {
          criticalViolations: auditResult.summary.violations.filter(v => v.severity === 'critical'),
          highPriorityViolations: auditResult.summary.violations.filter(v => v.severity === 'high'),
          mediumPriorityViolations: auditResult.summary.violations.filter(v => v.severity === 'medium'),
          lowPriorityViolations: auditResult.summary.violations.filter(v => v.severity === 'low')
        },
        actionPlan: {
          immediateActions: auditResult.summary.recommendations.filter((_, index) => index < 5),
          shortTermActions: auditResult.summary.recommendations.filter((_, index) => index >= 5 && index < 10),
          longTermActions: auditResult.summary.recommendations.filter((_, index) => index >= 10)
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0',
          assessmentMethod: 'Automated compliance scanning with DataCloak Sentiment Workbench',
          nextAssessmentRecommended: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days from now
        }
      };

      if (format === 'csv') {
        // Convert to CSV format for download
        let csvContent = 'Framework,Rule ID,Severity,Status,Message,Remediation\n';
        
        auditResult.summary.violations.forEach(violation => {
          const frameworkName = violation.ruleId.split('-')[0].toUpperCase();
          csvContent += `"${frameworkName}","${violation.ruleId}","${violation.severity}","Open","${violation.message}","${violation.remediation}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=compliance-audit-${auditResult.auditId}.csv`);
        return res.send(csvContent);
      }

      // JSON format (default)
      res.setHeader('Content-Type', 'application/json');
      if (req.query.download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename=compliance-audit-${auditResult.auditId}.json`);
      }

      return res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating audit report:', error);
      throw new AppError('Failed to generate audit report', 500, 'AUDIT_REPORT_ERROR');
    }
  }

  async getComplianceHealth(req: Request, res: Response): Promise<Response> {
    try {
      // Quick health check of compliance systems
      const health = {
        complianceService: {
          status: 'healthy',
          lastCheck: new Date().toISOString()
        },
        frameworks: {
          gdpr: { enabled: true, rulesCount: 6 },
          ccpa: { enabled: true, rulesCount: 4 },
          hipaa: { enabled: true, rulesCount: 5 }
        },
        auditCapabilities: {
          automated: true,
          realTime: true,
          reporting: true,
          export: true
        },
        lastAudit: null, // Would be populated from database
        nextScheduledAudit: null // Would be populated from scheduling system
      };

      return res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error checking compliance health:', error);
      throw new AppError('Failed to check compliance health', 500, 'COMPLIANCE_HEALTH_ERROR');
    }
  }

  async getComplianceRules(req: Request, res: Response): Promise<Response> {
    try {
      const { framework } = req.query;
      
      // This would typically fetch rules from the service
      // For now, return a structure representing available rules
      const rules = {
        gdpr: [
          { id: 'gdpr-001', title: 'Lawful Basis for Processing', category: 'Data Processing', severity: 'critical' },
          { id: 'gdpr-002', title: 'Data Minimization Principle', category: 'Data Minimization', severity: 'high' },
          { id: 'gdpr-003', title: 'Security of Processing', category: 'Security', severity: 'critical' },
          { id: 'gdpr-004', title: 'Right to Erasure', category: 'Rights', severity: 'high' },
          { id: 'gdpr-005', title: 'Data Portability', category: 'Rights', severity: 'medium' },
          { id: 'gdpr-006', title: 'Personal Data Breach Notification', category: 'Breach Notification', severity: 'critical' }
        ],
        ccpa: [
          { id: 'ccpa-001', title: 'Right to Know', category: 'Consumer Rights', severity: 'high' },
          { id: 'ccpa-002', title: 'Right to Delete', category: 'Consumer Rights', severity: 'high' },
          { id: 'ccpa-003', title: 'Right to Opt-Out of Sale', category: 'Data Sale', severity: 'critical' },
          { id: 'ccpa-004', title: 'Non-Discrimination', category: 'Non-Discrimination', severity: 'high' }
        ],
        hipaa: [
          { id: 'hipaa-001', title: 'Protected Health Information Safeguards', category: 'PHI Protection', severity: 'critical' },
          { id: 'hipaa-002', title: 'Minimum Necessary Standard', category: 'Access Controls', severity: 'high' },
          { id: 'hipaa-003', title: 'Administrative Safeguards', category: 'Security', severity: 'high' },
          { id: 'hipaa-004', title: 'Physical Safeguards', category: 'Security', severity: 'high' },
          { id: 'hipaa-005', title: 'Technical Safeguards', category: 'Security', severity: 'critical' }
        ]
      };

      const result = framework ? { [framework as string]: rules[framework as keyof typeof rules] } : rules;

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting compliance rules:', error);
      throw new AppError('Failed to get compliance rules', 500, 'COMPLIANCE_RULES_ERROR');
    }
  }
}

export const complianceController = new ComplianceController();