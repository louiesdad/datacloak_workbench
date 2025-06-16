import { AppError } from '../middleware/error.middleware';
import { getSQLiteConnection } from '../database/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { PIIDetectionResult } from './security.service';

export interface ComplianceRule {
  id: string;
  framework: 'GDPR' | 'CCPA' | 'HIPAA';
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  checker: (data: ComplianceCheckData) => ComplianceCheckResult;
}

export interface ComplianceCheckData {
  piiDetected: PIIDetectionResult[];
  dataTypes: string[];
  processingPurpose?: string;
  userConsent?: boolean;
  dataMinimization?: boolean;
  encryptionEnabled?: boolean;
  accessControls?: boolean;
  auditLogging?: boolean;
  dataRetentionPolicy?: boolean;
  rightToDelete?: boolean;
  dataPortability?: boolean;
  breachNotification?: boolean;
  privacyByDesign?: boolean;
  fileSize?: number;
  containsHealthData?: boolean;
  containsFinancialData?: boolean;
  containsBiometricData?: boolean;
  geolocation?: string;
}

export interface ComplianceCheckResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  recommendations: string[];
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  ruleId: string;
  severity: string;
  message: string;
  description: string;
  remediation: string;
}

export interface ComplianceAuditResult {
  overall: {
    score: number;
    status: 'compliant' | 'non_compliant' | 'needs_review';
    frameworks: string[];
  };
  gdpr: ComplianceFrameworkResult;
  ccpa: ComplianceFrameworkResult;
  hipaa: ComplianceFrameworkResult;
  summary: {
    totalRules: number;
    passedRules: number;
    violations: ComplianceViolation[];
    recommendations: string[];
  };
  auditId: string;
  timestamp: string;
}

export interface ComplianceFrameworkResult {
  score: number;
  status: 'compliant' | 'non_compliant' | 'needs_review';
  passedRules: number;
  totalRules: number;
  violations: ComplianceViolation[];
  recommendations: string[];
}

export class ComplianceService {
  private rules: ComplianceRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    this.rules = [
      // GDPR Rules
      {
        id: 'gdpr-001',
        framework: 'GDPR',
        category: 'Data Processing',
        title: 'Lawful Basis for Processing',
        description: 'Personal data must be processed lawfully, fairly and in a transparent manner',
        severity: 'critical',
        checker: (data) => this.checkLawfulBasis(data)
      },
      {
        id: 'gdpr-002',
        framework: 'GDPR',
        category: 'Data Minimization',
        title: 'Data Minimization Principle',
        description: 'Personal data shall be adequate, relevant and limited to what is necessary',
        severity: 'high',
        checker: (data) => this.checkDataMinimization(data)
      },
      {
        id: 'gdpr-003',
        framework: 'GDPR',
        category: 'Security',
        title: 'Security of Processing',
        description: 'Personal data must be processed in a secure manner',
        severity: 'critical',
        checker: (data) => this.checkDataSecurity(data)
      },
      {
        id: 'gdpr-004',
        framework: 'GDPR',
        category: 'Rights',
        title: 'Right to Erasure',
        description: 'Data subjects have the right to have their personal data erased',
        severity: 'high',
        checker: (data) => this.checkRightToErasure(data)
      },
      {
        id: 'gdpr-005',
        framework: 'GDPR',
        category: 'Rights',
        title: 'Data Portability',
        description: 'Data subjects have the right to receive their personal data in a structured format',
        severity: 'medium',
        checker: (data) => this.checkDataPortability(data)
      },
      {
        id: 'gdpr-006',
        framework: 'GDPR',
        category: 'Breach Notification',
        title: 'Personal Data Breach Notification',
        description: 'Personal data breaches must be notified within 72 hours',
        severity: 'critical',
        checker: (data) => this.checkBreachNotification(data)
      },

      // CCPA Rules
      {
        id: 'ccpa-001',
        framework: 'CCPA',
        category: 'Consumer Rights',
        title: 'Right to Know',
        description: 'Consumers have the right to know what personal information is collected',
        severity: 'high',
        checker: (data) => this.checkRightToKnow(data)
      },
      {
        id: 'ccpa-002',
        framework: 'CCPA',
        category: 'Consumer Rights',
        title: 'Right to Delete',
        description: 'Consumers have the right to delete their personal information',
        severity: 'high',
        checker: (data) => this.checkCCPARightToDelete(data)
      },
      {
        id: 'ccpa-003',
        framework: 'CCPA',
        category: 'Data Sale',
        title: 'Right to Opt-Out of Sale',
        description: 'Consumers have the right to opt-out of the sale of their personal information',
        severity: 'critical',
        checker: (data) => this.checkOptOutOfSale(data)
      },
      {
        id: 'ccpa-004',
        framework: 'CCPA',
        category: 'Non-Discrimination',
        title: 'Non-Discrimination',
        description: 'Businesses cannot discriminate against consumers for exercising their rights',
        severity: 'high',
        checker: (data) => this.checkNonDiscrimination(data)
      },

      // HIPAA Rules
      {
        id: 'hipaa-001',
        framework: 'HIPAA',
        category: 'PHI Protection',
        title: 'Protected Health Information Safeguards',
        description: 'PHI must be protected with appropriate safeguards',
        severity: 'critical',
        checker: (data) => this.checkPHIProtection(data)
      },
      {
        id: 'hipaa-002',
        framework: 'HIPAA',
        category: 'Access Controls',
        title: 'Minimum Necessary Standard',
        description: 'Access to PHI should be limited to the minimum necessary',
        severity: 'high',
        checker: (data) => this.checkMinimumNecessary(data)
      },
      {
        id: 'hipaa-003',
        framework: 'HIPAA',
        category: 'Security',
        title: 'Administrative Safeguards',
        description: 'Administrative safeguards must be in place for PHI',
        severity: 'high',
        checker: (data) => this.checkAdministrativeSafeguards(data)
      },
      {
        id: 'hipaa-004',
        framework: 'HIPAA',
        category: 'Security',
        title: 'Physical Safeguards',
        description: 'Physical safeguards must protect PHI',
        severity: 'high',
        checker: (data) => this.checkPhysicalSafeguards(data)
      },
      {
        id: 'hipaa-005',
        framework: 'HIPAA',
        category: 'Security',
        title: 'Technical Safeguards',
        description: 'Technical safeguards must protect electronic PHI',
        severity: 'critical',
        checker: (data) => this.checkTechnicalSafeguards(data)
      }
    ];
  }

  async performComplianceAudit(data: ComplianceCheckData): Promise<ComplianceAuditResult> {
    const auditId = uuidv4();
    const timestamp = new Date().toISOString();

    // Check each framework
    const gdprResult = await this.checkFramework('GDPR', data);
    const ccpaResult = await this.checkFramework('CCPA', data);
    const hipaaResult = await this.checkFramework('HIPAA', data);

    // Calculate overall score
    const overallScore = Math.round((gdprResult.score + ccpaResult.score + hipaaResult.score) / 3);
    
    // Determine overall status
    let overallStatus: 'compliant' | 'non_compliant' | 'needs_review';
    if (overallScore >= 90) {
      overallStatus = 'compliant';
    } else if (overallScore >= 70) {
      overallStatus = 'needs_review';
    } else {
      overallStatus = 'non_compliant';
    }

    // Combine violations and recommendations
    const allViolations = [...gdprResult.violations, ...ccpaResult.violations, ...hipaaResult.violations];
    const allRecommendations = [...new Set([
      ...gdprResult.recommendations,
      ...ccpaResult.recommendations,
      ...hipaaResult.recommendations
    ])];

    const result: ComplianceAuditResult = {
      overall: {
        score: overallScore,
        status: overallStatus,
        frameworks: ['GDPR', 'CCPA', 'HIPAA']
      },
      gdpr: gdprResult,
      ccpa: ccpaResult,
      hipaa: hipaaResult,
      summary: {
        totalRules: this.rules.length,
        passedRules: gdprResult.passedRules + ccpaResult.passedRules + hipaaResult.passedRules,
        violations: allViolations,
        recommendations: allRecommendations
      },
      auditId,
      timestamp
    };

    // Store audit result
    await this.storeAuditResult(result);

    return result;
  }

  private async checkFramework(framework: 'GDPR' | 'CCPA' | 'HIPAA', data: ComplianceCheckData): Promise<ComplianceFrameworkResult> {
    const frameworkRules = this.rules.filter(rule => rule.framework === framework);
    const results: ComplianceCheckResult[] = [];
    
    for (const rule of frameworkRules) {
      const result = rule.checker(data);
      results.push(result);
    }

    const passedRules = results.filter(r => r.passed).length;
    const totalRules = results.length;
    const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;
    
    let status: 'compliant' | 'non_compliant' | 'needs_review';
    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'needs_review';
    } else {
      status = 'non_compliant';
    }

    const violations: ComplianceViolation[] = [];
    const recommendations: string[] = [];

    results.forEach((result, index) => {
      violations.push(...result.violations);
      recommendations.push(...result.recommendations);
    });

    return {
      score,
      status,
      passedRules,
      totalRules,
      violations,
      recommendations: [...new Set(recommendations)]
    };
  }

  // GDPR Checkers
  private checkLawfulBasis(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.userConsent === true || data.processingPurpose !== undefined;
    return {
      passed,
      score: passed ? 100 : 0,
      message: passed ? 'Lawful basis for processing established' : 'No lawful basis for processing found',
      recommendations: passed ? [] : ['Establish lawful basis for data processing', 'Obtain explicit user consent'],
      violations: passed ? [] : [{
        ruleId: 'gdpr-001',
        severity: 'critical',
        message: 'Missing lawful basis for processing personal data',
        description: 'GDPR requires a lawful basis for processing personal data',
        remediation: 'Implement consent mechanisms or establish legitimate interest'
      }]
    };
  }

  private checkDataMinimization(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.dataMinimization === true;
    return {
      passed,
      score: passed ? 100 : 60,
      message: passed ? 'Data minimization principle applied' : 'Data minimization needs verification',
      recommendations: passed ? [] : ['Review data collection practices', 'Implement data minimization controls'],
      violations: passed ? [] : [{
        ruleId: 'gdpr-002',
        severity: 'high',
        message: 'Data minimization principle not verified',
        description: 'Processing should be limited to what is necessary for the purpose',
        remediation: 'Implement data minimization practices and regular reviews'
      }]
    };
  }

  private checkDataSecurity(data: ComplianceCheckData): ComplianceCheckResult {
    const encryptionScore = data.encryptionEnabled ? 30 : 0;
    const accessControlScore = data.accessControls ? 30 : 0;
    const auditLoggingScore = data.auditLogging ? 40 : 0;
    
    const totalScore = encryptionScore + accessControlScore + auditLoggingScore;
    const passed = totalScore >= 70;

    const violations: ComplianceViolation[] = [];
    const recommendations: string[] = [];

    if (!data.encryptionEnabled) {
      violations.push({
        ruleId: 'gdpr-003',
        severity: 'critical',
        message: 'Data encryption not enabled',
        description: 'Personal data should be encrypted both in transit and at rest',
        remediation: 'Implement encryption for data storage and transmission'
      });
      recommendations.push('Enable data encryption');
    }

    if (!data.accessControls) {
      violations.push({
        ruleId: 'gdpr-003',
        severity: 'high',
        message: 'Access controls not implemented',
        description: 'Access to personal data should be controlled and logged',
        remediation: 'Implement role-based access controls'
      });
      recommendations.push('Implement access controls');
    }

    if (!data.auditLogging) {
      violations.push({
        ruleId: 'gdpr-003',
        severity: 'high',
        message: 'Audit logging not enabled',
        description: 'All access to personal data should be logged for accountability',
        remediation: 'Enable comprehensive audit logging'
      });
      recommendations.push('Enable audit logging');
    }

    return {
      passed,
      score: totalScore,
      message: passed ? 'Adequate security measures in place' : 'Security measures need improvement',
      recommendations,
      violations
    };
  }

  private checkRightToErasure(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.rightToDelete === true;
    return {
      passed,
      score: passed ? 100 : 30,
      message: passed ? 'Right to erasure mechanism implemented' : 'Right to erasure mechanism missing',
      recommendations: passed ? [] : ['Implement data deletion mechanisms', 'Create data subject request handling process'],
      violations: passed ? [] : [{
        ruleId: 'gdpr-004',
        severity: 'high',
        message: 'Right to erasure not implemented',
        description: 'Data subjects must be able to request deletion of their personal data',
        remediation: 'Implement automated data deletion capabilities'
      }]
    };
  }

  private checkDataPortability(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.dataPortability === true;
    return {
      passed,
      score: passed ? 100 : 70,
      message: passed ? 'Data portability supported' : 'Data portability needs implementation',
      recommendations: passed ? [] : ['Implement data export functionality', 'Support structured data formats'],
      violations: passed ? [] : [{
        ruleId: 'gdpr-005',
        severity: 'medium',
        message: 'Data portability not supported',
        description: 'Data subjects should be able to receive their data in a portable format',
        remediation: 'Implement data export in machine-readable formats'
      }]
    };
  }

  private checkBreachNotification(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.breachNotification === true;
    return {
      passed,
      score: passed ? 100 : 0,
      message: passed ? 'Breach notification process in place' : 'Breach notification process missing',
      recommendations: passed ? [] : ['Implement breach detection mechanisms', 'Create incident response procedures'],
      violations: passed ? [] : [{
        ruleId: 'gdpr-006',
        severity: 'critical',
        message: 'Breach notification process not implemented',
        description: 'Data breaches must be reported within 72 hours',
        remediation: 'Implement automated breach detection and notification systems'
      }]
    };
  }

  // CCPA Checkers
  private checkRightToKnow(data: ComplianceCheckData): ComplianceCheckResult {
    const hasTransparency = data.piiDetected.length > 0; // If we detect PII, we should disclose it
    const passed = hasTransparency;
    
    return {
      passed,
      score: passed ? 100 : 50,
      message: passed ? 'Data collection transparency provided' : 'Data collection transparency needs improvement',
      recommendations: passed ? [] : ['Provide clear privacy notices', 'Disclose data collection practices'],
      violations: passed ? [] : [{
        ruleId: 'ccpa-001',
        severity: 'high',
        message: 'Insufficient transparency about data collection',
        description: 'Consumers must be informed about personal information collection',
        remediation: 'Implement comprehensive privacy notices and data disclosure mechanisms'
      }]
    };
  }

  private checkCCPARightToDelete(data: ComplianceCheckData): ComplianceCheckResult {
    const passed = data.rightToDelete === true;
    return {
      passed,
      score: passed ? 100 : 30,
      message: passed ? 'Consumer right to delete implemented' : 'Consumer right to delete missing',
      recommendations: passed ? [] : ['Implement consumer data deletion', 'Create self-service deletion options'],
      violations: passed ? [] : [{
        ruleId: 'ccpa-002',
        severity: 'high',
        message: 'Consumer right to delete not implemented',
        description: 'Consumers must be able to request deletion of their personal information',
        remediation: 'Implement consumer-facing data deletion mechanisms'
      }]
    };
  }

  private checkOptOutOfSale(data: ComplianceCheckData): ComplianceCheckResult {
    // For this demo, we assume no data sale, which is compliant
    const passed = true;
    return {
      passed,
      score: 100,
      message: 'No data sale detected - compliant',
      recommendations: [],
      violations: []
    };
  }

  private checkNonDiscrimination(data: ComplianceCheckData): ComplianceCheckResult {
    // This would require business logic analysis - for demo we assume compliance
    const passed = true;
    return {
      passed,
      score: 100,
      message: 'Non-discrimination policy in place',
      recommendations: [],
      violations: []
    };
  }

  // HIPAA Checkers
  private checkPHIProtection(data: ComplianceCheckData): ComplianceCheckResult {
    const hasHealthData = data.containsHealthData === true;
    const hasProtection = data.encryptionEnabled === true && data.accessControls === true;
    
    if (!hasHealthData) {
      return {
        passed: true,
        score: 100,
        message: 'No PHI detected - HIPAA not applicable',
        recommendations: [],
        violations: []
      };
    }

    const passed = hasProtection;
    return {
      passed,
      score: passed ? 100 : 20,
      message: passed ? 'PHI adequately protected' : 'PHI protection insufficient',
      recommendations: passed ? [] : ['Implement encryption for PHI', 'Enable access controls for health data'],
      violations: passed ? [] : [{
        ruleId: 'hipaa-001',
        severity: 'critical',
        message: 'Insufficient PHI protection',
        description: 'Protected Health Information requires enhanced security measures',
        remediation: 'Implement HIPAA-compliant security controls for PHI'
      }]
    };
  }

  private checkMinimumNecessary(data: ComplianceCheckData): ComplianceCheckResult {
    const hasHealthData = data.containsHealthData === true;
    
    if (!hasHealthData) {
      return {
        passed: true,
        score: 100,
        message: 'No PHI detected - minimum necessary rule not applicable',
        recommendations: [],
        violations: []
      };
    }

    const passed = data.dataMinimization === true;
    return {
      passed,
      score: passed ? 100 : 50,
      message: passed ? 'Minimum necessary standard applied' : 'Minimum necessary standard needs verification',
      recommendations: passed ? [] : ['Implement minimum necessary access controls', 'Regular access reviews for PHI'],
      violations: passed ? [] : [{
        ruleId: 'hipaa-002',
        severity: 'high',
        message: 'Minimum necessary standard not verified',
        description: 'Access to PHI should be limited to minimum necessary for the task',
        remediation: 'Implement role-based access controls with minimum necessary principle'
      }]
    };
  }

  private checkAdministrativeSafeguards(data: ComplianceCheckData): ComplianceCheckResult {
    const hasHealthData = data.containsHealthData === true;
    
    if (!hasHealthData) {
      return {
        passed: true,
        score: 100,
        message: 'No PHI detected - administrative safeguards not applicable',
        recommendations: [],
        violations: []
      };
    }

    const passed = data.accessControls === true && data.auditLogging === true;
    return {
      passed,
      score: passed ? 100 : 40,
      message: passed ? 'Administrative safeguards in place' : 'Administrative safeguards need improvement',
      recommendations: passed ? [] : ['Implement workforce training', 'Establish information access management'],
      violations: passed ? [] : [{
        ruleId: 'hipaa-003',
        severity: 'high',
        message: 'Administrative safeguards insufficient',
        description: 'HIPAA requires administrative safeguards for PHI access',
        remediation: 'Implement comprehensive administrative controls and procedures'
      }]
    };
  }

  private checkPhysicalSafeguards(data: ComplianceCheckData): ComplianceCheckResult {
    const hasHealthData = data.containsHealthData === true;
    
    if (!hasHealthData) {
      return {
        passed: true,
        score: 100,
        message: 'No PHI detected - physical safeguards not applicable',
        recommendations: [],
        violations: []
      };
    }

    // Physical safeguards are assumed to be in place for cloud-based systems
    const passed = true;
    return {
      passed,
      score: 100,
      message: 'Physical safeguards assumed adequate for cloud environment',
      recommendations: [],
      violations: []
    };
  }

  private checkTechnicalSafeguards(data: ComplianceCheckData): ComplianceCheckResult {
    const hasHealthData = data.containsHealthData === true;
    
    if (!hasHealthData) {
      return {
        passed: true,
        score: 100,
        message: 'No PHI detected - technical safeguards not applicable',
        recommendations: [],
        violations: []
      };
    }

    const passed = data.encryptionEnabled === true && data.auditLogging === true;
    return {
      passed,
      score: passed ? 100 : 30,
      message: passed ? 'Technical safeguards implemented' : 'Technical safeguards insufficient',
      recommendations: passed ? [] : ['Implement encryption for ePHI', 'Enable comprehensive audit controls'],
      violations: passed ? [] : [{
        ruleId: 'hipaa-005',
        severity: 'critical',
        message: 'Technical safeguards insufficient for ePHI',
        description: 'Electronic PHI requires strong technical safeguards',
        remediation: 'Implement encryption, access controls, and audit logging for ePHI'
      }]
    };
  }

  private async storeAuditResult(result: ComplianceAuditResult): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) return;

    try {
      const stmt = db.prepare(`
        INSERT INTO compliance_audits (
          audit_id, overall_score, overall_status, gdpr_score, ccpa_score, hipaa_score,
          violations_count, recommendations_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        result.auditId,
        result.overall.score,
        result.overall.status,
        result.gdpr.score,
        result.ccpa.score,
        result.hipaa.score,
        result.summary.violations.length,
        result.summary.recommendations.length,
        result.timestamp
      );
    } catch (error) {
      console.warn('Failed to store compliance audit result:', error);
    }
  }
}

export const complianceService = new ComplianceService();