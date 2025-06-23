import { v4 as uuidv4 } from 'uuid';
import { Factory, TestDataOptions } from './types';

export interface TestSecurityAudit {
  id: string;
  fileProcessed: string;
  piiItemsDetected: number;
  maskingAccuracy: number;
  encryptionStatus: 'enabled' | 'disabled';
  complianceScore: number;
  violations: string[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSecurityEvent {
  id: string;
  type: 'pii_detected' | 'masking_applied' | 'audit_completed' | 'violation_found';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  source: string;
  createdAt: string;
}

export interface TestComplianceAudit {
  auditId: string;
  overallScore: number;
  overallStatus: 'compliant' | 'non_compliant' | 'needs_review';
  gdprScore: number;
  ccpaScore: number;
  hipaaScore: number;
  violationsCount: number;
  recommendationsCount: number;
  createdAt: string;
}

class SecurityAuditFactory implements Factory<TestSecurityAudit> {
  create(options: TestDataOptions = {}): TestSecurityAudit {
    const id = uuidv4();
    const now = new Date().toISOString();
    const piiCount = options.overrides?.piiItemsDetected ?? Math.floor(Math.random() * 10);
    
    return {
      id,
      fileProcessed: options.overrides?.fileProcessed || `test-file-${id.slice(0, 8)}.csv`,
      piiItemsDetected: piiCount,
      maskingAccuracy: options.overrides?.maskingAccuracy ?? Math.random() * 0.2 + 0.8, // 0.8-1.0
      encryptionStatus: options.overrides?.encryptionStatus || 'enabled',
      complianceScore: options.overrides?.complianceScore ?? Math.max(50, 100 - piiCount * 5),
      violations: options.overrides?.violations || this.generateViolations(piiCount),
      recommendations: options.overrides?.recommendations || this.generateRecommendations(piiCount),
      createdAt: now,
      updatedAt: now,
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestSecurityAudit[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestSecurityAudit> = {}): TestSecurityAudit {
    return this.create({ overrides });
  }

  createHighRisk(): TestSecurityAudit {
    return this.create({
      overrides: {
        piiItemsDetected: 15,
        maskingAccuracy: 0.6,
        complianceScore: 45,
        encryptionStatus: 'disabled' as const,
        violations: [
          'High PII exposure detected',
          'Encryption not enabled',
          'Inadequate data masking'
        ],
        recommendations: [
          'Enable encryption immediately',
          'Implement stronger data masking',
          'Review PII handling procedures'
        ]
      }
    });
  }

  createCompliant(): TestSecurityAudit {
    return this.create({
      overrides: {
        piiItemsDetected: 0,
        maskingAccuracy: 1.0,
        complianceScore: 98,
        encryptionStatus: 'enabled' as const,
        violations: [],
        recommendations: ['Continue current security practices']
      }
    });
  }

  private generateViolations(piiCount: number): string[] {
    const violations = [];
    if (piiCount > 5) violations.push('High PII exposure detected');
    if (piiCount > 10) violations.push('Critical data privacy violation');
    if (Math.random() > 0.7) violations.push('Insufficient access controls');
    return violations;
  }

  private generateRecommendations(piiCount: number): string[] {
    const recommendations = [];
    if (piiCount > 0) recommendations.push('Implement data masking');
    if (piiCount > 5) recommendations.push('Review data collection practices');
    if (piiCount > 10) recommendations.push('Conduct immediate security review');
    recommendations.push('Regular compliance monitoring');
    return recommendations;
  }
}

class SecurityEventFactory implements Factory<TestSecurityEvent> {
  create(options: TestDataOptions = {}): TestSecurityEvent {
    const id = uuidv4();
    const types = ['pii_detected', 'masking_applied', 'audit_completed', 'violation_found'] as const;
    const severities = ['low', 'medium', 'high', 'critical'] as const;
    
    const type = options.overrides?.type || types[Math.floor(Math.random() * types.length)];
    
    return {
      id,
      type,
      severity: options.overrides?.severity || this.inferSeverity(type),
      details: options.overrides?.details || this.generateDetails(type),
      source: options.overrides?.source || 'test-source',
      createdAt: new Date().toISOString(),
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestSecurityEvent[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestSecurityEvent> = {}): TestSecurityEvent {
    return this.create({ overrides });
  }

  private inferSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'violation_found': return 'high';
      case 'pii_detected': return 'medium';
      case 'audit_completed': return 'low';
      case 'masking_applied': return 'low';
      default: return 'medium';
    }
  }

  private generateDetails(type: string): Record<string, any> {
    switch (type) {
      case 'pii_detected':
        return {
          fieldName: 'email',
          piiType: 'email_address',
          confidence: 0.95
        };
      case 'masking_applied':
        return {
          fieldName: 'ssn',
          maskingType: 'hash',
          success: true
        };
      case 'audit_completed':
        return {
          auditId: uuidv4(),
          score: 85,
          duration: '2.3s'
        };
      case 'violation_found':
        return {
          violationType: 'data_exposure',
          severity: 'high',
          affected_records: 150
        };
      default:
        return {};
    }
  }
}

class ComplianceAuditFactory implements Factory<TestComplianceAudit> {
  create(options: TestDataOptions = {}): TestComplianceAudit {
    const auditId = uuidv4();
    const violationsCount = options.overrides?.violationsCount ?? Math.floor(Math.random() * 5);
    const overallScore = options.overrides?.overallScore ?? Math.max(60, 100 - violationsCount * 10);
    
    return {
      auditId,
      overallScore,
      overallStatus: options.overrides?.overallStatus || this.inferStatus(overallScore),
      gdprScore: options.overrides?.gdprScore ?? overallScore + Math.floor(Math.random() * 10) - 5,
      ccpaScore: options.overrides?.ccpaScore ?? overallScore + Math.floor(Math.random() * 10) - 5,
      hipaaScore: options.overrides?.hipaaScore ?? overallScore + Math.floor(Math.random() * 10) - 5,
      violationsCount,
      recommendationsCount: options.overrides?.recommendationsCount ?? violationsCount + 1,
      createdAt: new Date().toISOString(),
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestComplianceAudit[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestComplianceAudit> = {}): TestComplianceAudit {
    return this.create({ overrides });
  }

  private inferStatus(score: number): 'compliant' | 'non_compliant' | 'needs_review' {
    if (score >= 85) return 'compliant';
    if (score >= 70) return 'needs_review';
    return 'non_compliant';
  }
}

// Export factory instances
export const securityAuditFactory = new SecurityAuditFactory();
export const securityEventFactory = new SecurityEventFactory();
export const complianceAuditFactory = new ComplianceAuditFactory();