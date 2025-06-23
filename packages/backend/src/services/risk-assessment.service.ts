import { EventEmitter } from 'events';
import { AppError } from '../middleware/error.middleware';
import { ComplianceFramework } from './enhanced-datacloak.service';
import * as crypto from 'crypto';

// Risk Assessment Interfaces
export interface RiskFactor {
  id: string;
  name: string;
  category: 'data_sensitivity' | 'geographic' | 'compliance' | 'processing' | 'storage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number; // 0.0-1.0
  description: string;
  mitigation: string[];
}

export interface GeographicRiskAssessment {
  jurisdiction: string[];
  crossBorderTransfer: boolean;
  gdprApplicable: boolean;
  additionalRegulations: string[];
  riskScore: number; // 0-100
  transferRestrictions: string[];
  dataLocalizationRequirements: boolean;
}

export interface DataSensitivityClassification {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  sensitivityScore: number; // 0-100
  categories: string[];
  subjectRights: string[];
  processingRestrictions: string[];
  retentionRequirements: string;
}

export interface ComplianceViolation {
  id: string;
  framework: ComplianceFramework;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFields: string[];
  recommendation: string;
  requiresImmediateAction: boolean;
  potentialFines: string;
  remediation: {
    steps: string[];
    timeframe: string;
    cost: 'low' | 'medium' | 'high';
  };
}

export interface RiskAssessmentResult {
  assessmentId: string;
  timestamp: Date;
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Risk breakdown
  dataRisk: number;
  complianceRisk: number;
  geographicRisk: number;
  processingRisk: number;
  
  // Detailed assessments
  geographicAssessment: GeographicRiskAssessment;
  dataSensitivity: DataSensitivityClassification;
  violations: ComplianceViolation[];
  riskFactors: RiskFactor[];
  
  // Recommendations
  immediateActions: string[];
  shortTermActions: string[];
  longTermActions: string[];
  
  // Compliance status
  complianceStatus: {
    [key in ComplianceFramework]?: {
      compliant: boolean;
      score: number;
      gaps: string[];
      requirements: string[];
    };
  };
  
  // Metadata
  assessmentMetadata: {
    recordsAnalyzed: number;
    piiItemsFound: number;
    processingTime: number;
    assessmentMethod: string;
    confidence: number;
  };
}

export interface RiskMitigationPlan {
  planId: string;
  riskAssessmentId: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  estimatedCost: number;
  estimatedTimeframe: string;
  mitigationSteps: {
    step: string;
    responsible: string;
    deadline: Date;
    status: 'pending' | 'in_progress' | 'completed';
    dependencies: string[];
  }[];
  expectedRiskReduction: number; // 0-100
  successMetrics: string[];
}

export class RiskAssessmentService extends EventEmitter {
  private riskFactorDatabase: Map<string, RiskFactor>;
  private complianceRules: Map<ComplianceFramework, any>;
  private geographicRules: Map<string, any>;
  private initialized = false;
  private assessmentHistory: RiskAssessmentResult[] = [];

  constructor() {
    super();
    this.riskFactorDatabase = new Map();
    this.complianceRules = new Map();
    this.geographicRules = new Map();
    
    this.initializeRiskFactors();
    this.initializeComplianceRules();
    this.initializeGeographicRules();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.emit('initialized');
      this.initialized = true;
      console.log('Risk Assessment Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Risk Assessment Service:', error);
      throw new AppError('Failed to initialize Risk Assessment Service', 500, 'RISK_SERVICE_INIT_ERROR');
    }
  }

  /**
   * Comprehensive risk assessment with 0-100 scale scoring algorithm
   */
  async assessComprehensiveRisk(
    data: {
      piiDetections: any[];
      fieldData: { [fieldName: string]: any };
      processingContext: {
        purpose: string;
        jurisdiction: string[];
        storage: 'cloud' | 'on_premise' | 'hybrid';
        encryption: boolean;
        accessControls: boolean;
      };
      complianceFrameworks: ComplianceFramework[];
    }
  ): Promise<RiskAssessmentResult> {
    if (!this.initialized) await this.initialize();

    const assessmentId = this.generateAssessmentId();
    const startTime = Date.now();

    try {
      // Calculate individual risk components
      const dataRisk = this.calculateDataRisk(data.piiDetections, data.fieldData);
      const complianceRisk = this.calculateComplianceRisk(data.piiDetections, data.complianceFrameworks);
      const geographicRisk = this.calculateGeographicRisk(data.processingContext.jurisdiction, data.piiDetections);
      const processingRisk = this.calculateProcessingRisk(data.processingContext);

      // Calculate overall risk score (weighted combination)
      const overallRiskScore = this.calculateOverallRisk({
        dataRisk,
        complianceRisk,
        geographicRisk,
        processingRisk
      });

      // Detailed assessments
      const geographicAssessment = this.assessGeographicRiskPrivate(data.processingContext.jurisdiction);
      const dataSensitivity = this.classifyDataSensitivityPrivate(data.piiDetections, data.fieldData);
      const violations = this.detectComplianceViolationsPrivate(data.piiDetections, data.complianceFrameworks, data.processingContext);
      const riskFactors = this.identifyRiskFactors(data);

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        dataRisk,
        complianceRisk,
        geographicRisk,
        processingRisk,
        violations,
        riskFactors
      });

      // Assess compliance status for each framework
      const complianceStatus = this.assessComplianceStatus(data.complianceFrameworks, data.piiDetections, data.processingContext);

      const result: RiskAssessmentResult = {
        assessmentId,
        timestamp: new Date(),
        overallRiskScore,
        riskLevel: this.determineRiskLevel(overallRiskScore),
        
        dataRisk,
        complianceRisk,
        geographicRisk,
        processingRisk,
        
        geographicAssessment,
        dataSensitivity,
        violations,
        riskFactors,
        
        immediateActions: recommendations.immediate,
        shortTermActions: recommendations.shortTerm,
        longTermActions: recommendations.longTerm,
        
        complianceStatus,
        
        assessmentMetadata: {
          recordsAnalyzed: Object.keys(data.fieldData).length,
          piiItemsFound: data.piiDetections.length,
          processingTime: Date.now() - startTime,
          assessmentMethod: 'comprehensive',
          confidence: this.calculateAssessmentConfidence(data)
        }
      };

      this.emit('risk_assessment_completed', { assessmentId, riskLevel: result.riskLevel, score: overallRiskScore });
      
      return result;
    } catch (error) {
      console.error('Risk assessment failed:', error);
      throw new AppError('Risk assessment failed', 500, 'RISK_ASSESSMENT_ERROR');
    }
  }

  /**
   * Geographic risk analysis with cross-border transfer detection
   */
  private assessGeographicRiskPrivate(jurisdictions: string[]): GeographicRiskAssessment {
    const isEUJurisdiction = jurisdictions.some(j => ['EU', 'DE', 'FR', 'IT', 'ES', 'NL'].includes(j.toUpperCase()));
    const isUSJurisdiction = jurisdictions.includes('US');
    const isChinaJurisdiction = jurisdictions.includes('CN');
    const isMultiJurisdiction = jurisdictions.length > 1;

    let riskScore = 0;
    const transferRestrictions: string[] = [];
    let dataLocalizationRequirements = false;

    // Base risk calculation
    if (isMultiJurisdiction) {
      riskScore += 30;
      transferRestrictions.push('Multi-jurisdictional data processing requires additional safeguards');
    }

    if (isEUJurisdiction) {
      riskScore += 20;
      transferRestrictions.push('GDPR adequacy decision required for data transfers');
      if (jurisdictions.some(j => !['EU', 'DE', 'FR', 'IT', 'ES', 'NL'].includes(j.toUpperCase()))) {
        riskScore += 15;
        transferRestrictions.push('Standard Contractual Clauses (SCCs) required for EU data transfers');
      }
    }

    if (isChinaJurisdiction) {
      riskScore += 25;
      dataLocalizationRequirements = true;
      transferRestrictions.push('China data localization requirements apply');
      transferRestrictions.push('Cross-border data transfer approval may be required');
    }

    if (isUSJurisdiction && isEUJurisdiction) {
      riskScore += 10;
      transferRestrictions.push('EU-US data transfers require additional safeguards post-Schrems II');
    }

    return {
      jurisdiction: jurisdictions,
      crossBorderTransfer: isMultiJurisdiction,
      gdprApplicable: isEUJurisdiction,
      additionalRegulations: this.getApplicableRegulations(jurisdictions),
      riskScore: Math.min(100, riskScore),
      transferRestrictions,
      dataLocalizationRequirements
    };
  }

  /**
   * Data sensitivity classification system
   */
  private classifyDataSensitivityPrivate(piiDetections: any[], fieldData: any): DataSensitivityClassification {
    const criticalTypes = ['ssn', 'medical_record_number', 'credit_card', 'passport'];
    const sensitiveTypes = ['email', 'phone', 'drivers_license', 'bank_account'];
    
    let sensitivityScore = 0;
    const categories: string[] = [];
    const subjectRights: string[] = [];
    const processingRestrictions: string[] = [];

    // Analyze PII types
    const piiTypes = piiDetections.map(p => p.piiType);
    const hasCriticalPII = piiTypes.some(type => criticalTypes.includes(type));
    const hasSensitivePII = piiTypes.some(type => sensitiveTypes.includes(type));

    if (hasCriticalPII) {
      sensitivityScore += 60;
      categories.push('highly_sensitive');
      subjectRights.push('data_subject_access', 'right_to_erasure', 'data_portability');
      processingRestrictions.push('explicit_consent_required', 'purpose_limitation', 'data_minimization');
    }

    if (hasSensitivePII) {
      sensitivityScore += 30;
      categories.push('sensitive');
      subjectRights.push('data_subject_access', 'right_to_rectification');
      processingRestrictions.push('lawful_basis_required', 'purpose_limitation');
    }

    // Analyze data volume
    const recordCount = Object.keys(fieldData).length;
    if (recordCount > 10000) {
      sensitivityScore += 20;
      categories.push('large_scale_processing');
      processingRestrictions.push('dpia_required');
    } else if (recordCount > 1000) {
      sensitivityScore += 10;
    }

    // Determine classification
    let classification: 'public' | 'internal' | 'confidential' | 'restricted';
    if (sensitivityScore >= 80) classification = 'restricted';
    else if (sensitivityScore >= 60) classification = 'confidential';
    else if (sensitivityScore >= 30) classification = 'internal';
    else classification = 'public';

    return {
      classification,
      sensitivityScore: Math.min(100, sensitivityScore),
      categories,
      subjectRights,
      processingRestrictions,
      retentionRequirements: this.determineRetentionRequirements(piiTypes)
    };
  }

  /**
   * Automated violation detection and reporting
   */
  private detectComplianceViolationsPrivate(
    piiDetections: any[],
    frameworks: ComplianceFramework[],
    processingContext: any
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    for (const framework of frameworks) {
      const rules = this.complianceRules.get(framework);
      if (!rules) continue;

      // Check for framework-specific violations
      switch (framework) {
        case ComplianceFramework.HIPAA:
          violations.push(...this.checkHIPAAViolations(piiDetections, processingContext));
          break;
        case ComplianceFramework.PCI_DSS:
          violations.push(...this.checkPCIDSSViolations(piiDetections, processingContext));
          break;
        case ComplianceFramework.GDPR:
          violations.push(...this.checkGDPRViolations(piiDetections, processingContext));
          break;
      }
    }

    return violations;
  }

  /**
   * Recommendation engine for risk mitigation
   */
  private generateRecommendations(riskData: {
    dataRisk: number;
    complianceRisk: number;
    geographicRisk: number;
    processingRisk: number;
    violations: ComplianceViolation[];
    riskFactors: RiskFactor[];
  }): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions for critical issues
    if (riskData.dataRisk > 80) {
      immediate.push('Implement immediate access restrictions for high-risk data');
      immediate.push('Enable encryption for all PII fields');
    }

    if (riskData.complianceRisk > 70) {
      immediate.push('Conduct emergency compliance audit');
      immediate.push('Implement missing compliance controls');
    }

    const criticalViolations = riskData.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      immediate.push('Address critical compliance violations immediately');
      immediate.push('Notify legal and compliance teams');
    }

    // Short-term actions
    if (riskData.geographicRisk > 50) {
      shortTerm.push('Review and implement cross-border data transfer safeguards');
      shortTerm.push('Establish data localization procedures');
    }

    if (riskData.processingRisk > 60) {
      shortTerm.push('Enhance data processing security controls');
      shortTerm.push('Implement comprehensive audit logging');
    }

    // Long-term strategic actions
    longTerm.push('Establish ongoing privacy impact assessments');
    longTerm.push('Implement privacy by design principles');
    longTerm.push('Develop comprehensive data governance framework');

    if (riskData.riskFactors.length > 5) {
      longTerm.push('Conduct comprehensive risk management review');
    }

    return { immediate, shortTerm, longTerm };
  }

  // Risk calculation methods
  private calculateDataRisk(piiDetections: any[], fieldData: any): number {
    const criticalTypes = ['ssn', 'medical_record_number', 'credit_card', 'passport'];
    const sensitiveTypes = ['email', 'phone', 'drivers_license', 'bank_account'];
    
    let risk = 0;
    const piiTypes = piiDetections.map(p => p.piiType);
    
    // PII type severity
    const criticalCount = piiTypes.filter(type => criticalTypes.includes(type)).length;
    const sensitiveCount = piiTypes.filter(type => sensitiveTypes.includes(type)).length;
    
    risk += criticalCount * 25;
    risk += sensitiveCount * 15;
    
    // Volume multiplier
    const recordCount = Object.keys(fieldData).length;
    if (recordCount > 100000) risk += 20;
    else if (recordCount > 10000) risk += 15;
    else if (recordCount > 1000) risk += 10;
    
    return Math.min(100, risk);
  }

  private calculateComplianceRisk(piiDetections: any[], frameworks: ComplianceFramework[]): number {
    let risk = 0;
    
    for (const framework of frameworks) {
      const rules = this.complianceRules.get(framework);
      if (!rules) continue;
      
      const requiredPII = piiDetections.filter(p => rules.piiTypes.includes(p.piiType));
      if (requiredPII.length > 0) {
        // Framework applies - assess compliance gaps
        risk += this.assessFrameworkCompliance(framework, requiredPII);
      }
    }
    
    return Math.min(100, risk / frameworks.length);
  }

  private calculateGeographicRisk(jurisdictions: string[], piiDetections: any[]): number {
    if (jurisdictions.length <= 1) return 10; // Single jurisdiction baseline
    
    let risk = 30; // Multi-jurisdiction base risk
    
    // EU presence increases risk due to GDPR
    if (jurisdictions.some(j => ['EU', 'DE', 'FR', 'IT', 'ES'].includes(j.toUpperCase()))) {
      risk += 20;
    }
    
    // China presence increases risk due to data localization
    if (jurisdictions.includes('CN')) {
      risk += 25;
    }
    
    // High-risk PII in multi-jurisdiction context
    const criticalPII = piiDetections.filter(p => ['ssn', 'medical_record_number', 'credit_card'].includes(p.piiType));
    if (criticalPII.length > 0) {
      risk += 15;
    }
    
    return Math.min(100, risk);
  }

  private calculateProcessingRisk(context: any): number {
    let risk = 0;
    
    // Storage type risk
    if (context.storage === 'cloud') risk += 15;
    else if (context.storage === 'hybrid') risk += 10;
    
    // Security controls
    if (!context.encryption) risk += 25;
    if (!context.accessControls) risk += 20;
    
    // Processing purpose
    if (context.purpose === 'marketing') risk += 10;
    else if (context.purpose === 'research') risk += 5;
    
    return Math.min(100, risk);
  }

  private calculateOverallRisk(risks: {
    dataRisk: number;
    complianceRisk: number;
    geographicRisk: number;
    processingRisk: number;
  }): number {
    // Weighted combination of risk factors
    const weights = {
      dataRisk: 0.35,
      complianceRisk: 0.30,
      geographicRisk: 0.20,
      processingRisk: 0.15
    };
    
    return Math.round(
      risks.dataRisk * weights.dataRisk +
      risks.complianceRisk * weights.complianceRisk +
      risks.geographicRisk * weights.geographicRisk +
      risks.processingRisk * weights.processingRisk
    );
  }

  // Helper methods
  private generateAssessmentId(): string {
    return `RISK-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private calculateAssessmentConfidence(data: any): number {
    // Base confidence on data completeness and quality
    let confidence = 0.8;
    
    if (data.piiDetections.length > 0) confidence += 0.1;
    if (data.processingContext.encryption) confidence += 0.05;
    if (data.complianceFrameworks.length > 0) confidence += 0.05;
    
    return Math.min(1.0, confidence);
  }

  // Initialization methods
  private initializeRiskFactors(): void {
    // Initialize comprehensive risk factor database
    const factors: RiskFactor[] = [
      {
        id: 'unencrypted_storage',
        name: 'Unencrypted Data Storage',
        category: 'storage',
        severity: 'high',
        weight: 0.8,
        description: 'PII stored without encryption',
        mitigation: ['Implement encryption at rest', 'Use database-level encryption']
      },
      {
        id: 'cross_border_transfer',
        name: 'Cross-Border Data Transfer',
        category: 'geographic',
        severity: 'medium',
        weight: 0.6,
        description: 'Data transferred across jurisdictional boundaries',
        mitigation: ['Implement Standard Contractual Clauses', 'Assess adequacy decisions']
      },
      {
        id: 'large_scale_processing',
        name: 'Large Scale PII Processing',
        category: 'processing',
        severity: 'medium',
        weight: 0.7,
        description: 'Processing large volumes of personal data',
        mitigation: ['Conduct Data Protection Impact Assessment', 'Implement additional safeguards']
      }
    ];

    factors.forEach(factor => {
      this.riskFactorDatabase.set(factor.id, factor);
    });
  }

  private initializeComplianceRules(): void {
    // HIPAA Rules
    this.complianceRules.set(ComplianceFramework.HIPAA, {
      piiTypes: ['ssn', 'medical_record_number', 'email', 'phone', 'drivers_license'],
      requiredSafeguards: ['encryption', 'access_controls', 'audit_logging'],
      retentionPeriod: 2555, // 7 years
      fineRange: '$100,000 - $1,500,000'
    });

    // PCI-DSS Rules
    this.complianceRules.set(ComplianceFramework.PCI_DSS, {
      piiTypes: ['credit_card', 'bank_account'],
      requiredSafeguards: ['encryption', 'tokenization', 'network_security'],
      retentionPeriod: 365, // 1 year
      fineRange: '$5,000 - $500,000'
    });

    // GDPR Rules
    this.complianceRules.set(ComplianceFramework.GDPR, {
      piiTypes: ['email', 'phone', 'ssn', 'passport', 'drivers_license'],
      requiredSafeguards: ['lawful_basis', 'data_minimization', 'purpose_limitation'],
      retentionPeriod: null, // Varies by purpose
      fineRange: '4% of global revenue or €20 million'
    });
  }

  private initializeGeographicRules(): void {
    this.geographicRules.set('EU', {
      regulations: ['GDPR'],
      dataLocalization: false,
      transferRestrictions: true,
      adequacyRequired: true
    });

    this.geographicRules.set('CN', {
      regulations: ['PIPL', 'Cybersecurity Law'],
      dataLocalization: true,
      transferRestrictions: true,
      adequacyRequired: false
    });

    this.geographicRules.set('US', {
      regulations: ['CCPA', 'HIPAA', 'COPPA'],
      dataLocalization: false,
      transferRestrictions: false,
      adequacyRequired: false
    });
  }

  // Framework-specific violation checks
  private checkHIPAAViolations(piiDetections: any[], context: any): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    
    const medicalPII = piiDetections.filter(p => p.piiType === 'medical_record_number');
    if (medicalPII.length > 0 && !context.encryption) {
      violations.push({
        id: crypto.randomUUID(),
        framework: ComplianceFramework.HIPAA,
        violationType: 'unencrypted_phi',
        severity: 'critical',
        description: 'Protected Health Information (PHI) stored without encryption',
        affectedFields: medicalPII.map(p => p.fieldName),
        recommendation: 'Implement encryption for all PHI data',
        requiresImmediateAction: true,
        potentialFines: 'Up to $1.5 million per incident',
        remediation: {
          steps: ['Enable encryption at rest', 'Implement key management', 'Update access controls'],
          timeframe: '30 days',
          cost: 'medium'
        }
      });
    }

    return violations;
  }

  private checkPCIDSSViolations(piiDetections: any[], context: any): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    
    const cardData = piiDetections.filter(p => p.piiType === 'credit_card');
    if (cardData.length > 0 && !context.encryption) {
      violations.push({
        id: crypto.randomUUID(),
        framework: ComplianceFramework.PCI_DSS,
        violationType: 'unencrypted_card_data',
        severity: 'critical',
        description: 'Credit card data stored without encryption',
        affectedFields: cardData.map(p => p.fieldName),
        recommendation: 'Implement PCI-DSS compliant encryption or tokenization',
        requiresImmediateAction: true,
        potentialFines: 'Up to $500,000 plus card replacement costs',
        remediation: {
          steps: ['Implement encryption/tokenization', 'Establish secure key management', 'Regular security assessments'],
          timeframe: '90 days',
          cost: 'high'
        }
      });
    }

    return violations;
  }

  private checkGDPRViolations(piiDetections: any[], context: any): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    
    if (piiDetections.length > 0 && context.jurisdiction.includes('EU') && !context.lawfulBasis) {
      violations.push({
        id: crypto.randomUUID(),
        framework: ComplianceFramework.GDPR,
        violationType: 'no_lawful_basis',
        severity: 'high',
        description: 'Processing personal data without established lawful basis',
        affectedFields: piiDetections.map(p => p.fieldName),
        recommendation: 'Establish and document lawful basis for processing',
        requiresImmediateAction: true,
        potentialFines: '4% of global revenue or €20 million',
        remediation: {
          steps: ['Identify lawful basis', 'Update privacy notices', 'Obtain consent if required'],
          timeframe: '60 days',
          cost: 'medium'
        }
      });
    }

    return violations;
  }

  // Additional helper methods
  private assessFrameworkCompliance(framework: ComplianceFramework, piiDetections: any[]): number {
    // Simplified compliance assessment - would be more complex in reality
    const rules = this.complianceRules.get(framework);
    if (!rules) return 0;
    
    return Math.min(50, piiDetections.length * 10); // Basic gap assessment
  }

  private getApplicableRegulations(jurisdictions: string[]): string[] {
    const regulations: string[] = [];
    
    jurisdictions.forEach(jurisdiction => {
      const rules = this.geographicRules.get(jurisdiction);
      if (rules) {
        regulations.push(...rules.regulations);
      }
    });
    
    return [...new Set(regulations)]; // Remove duplicates
  }

  private determineRetentionRequirements(piiTypes: string[]): string {
    if (piiTypes.includes('medical_record_number')) return '7 years (HIPAA requirement)';
    if (piiTypes.includes('credit_card')) return '1 year maximum (PCI-DSS requirement)';
    return 'As required by business purpose and applicable law';
  }

  private identifyRiskFactors(data: any): RiskFactor[] {
    const factors: RiskFactor[] = [];
    
    if (!data.processingContext.encryption) {
      const factor = this.riskFactorDatabase.get('unencrypted_storage');
      if (factor) factors.push(factor);
    }
    
    if (data.processingContext.jurisdiction.length > 1) {
      const factor = this.riskFactorDatabase.get('cross_border_transfer');
      if (factor) factors.push(factor);
    }
    
    if (Object.keys(data.fieldData).length > 10000) {
      const factor = this.riskFactorDatabase.get('large_scale_processing');
      if (factor) factors.push(factor);
    }
    
    return factors;
  }

  private assessComplianceStatus(
    frameworks: ComplianceFramework[],
    piiDetections: any[],
    context: any
  ): any {
    const status: any = {};
    
    frameworks.forEach(framework => {
      const rules = this.complianceRules.get(framework);
      if (!rules) return;
      
      const relevantPII = piiDetections.filter(p => rules.piiTypes.includes(p.piiType));
      const hasViolations = relevantPII.length > 0 && !context.encryption;
      
      status[framework] = {
        compliant: !hasViolations,
        score: hasViolations ? 60 : 90,
        gaps: hasViolations ? ['Missing encryption'] : [],
        requirements: rules.requiredSafeguards
      };
    });
    
    return status;
  }

  /**
   * Assess geographic risk based on jurisdictions
   */
  async assessGeographicRisk(jurisdictions: string[]): Promise<GeographicRiskAssessment> {
    const crossBorderTransfer = jurisdictions.length > 1;
    const gdprApplicable = jurisdictions.some(j => 
      ['EU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'SE', 'DK', 'FI', 'AT', 'IE', 'PT', 'GR', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'CY', 'LU', 'MT'].includes(j)
    );
    
    const additionalRegulations = this.getApplicableRegulations(jurisdictions);
    const transferRestrictions = crossBorderTransfer ? ['Implement Standard Contractual Clauses', 'Ensure adequate safeguards'] : [];
    const dataLocalizationRequirements = jurisdictions.includes('CN') || jurisdictions.includes('RU');
    
    const riskScore = 
      (crossBorderTransfer ? 30 : 0) +
      (gdprApplicable ? 20 : 0) +
      (dataLocalizationRequirements ? 30 : 0) +
      (jurisdictions.length * 5);
    
    return {
      jurisdiction: jurisdictions,
      crossBorderTransfer,
      gdprApplicable,
      additionalRegulations,
      riskScore: Math.min(100, riskScore),
      transferRestrictions,
      dataLocalizationRequirements
    };
  }

  /**
   * Classify data sensitivity based on fields and record count
   */
  async classifyDataSensitivity(fields: string[], recordCount: number): Promise<DataSensitivityClassification> {
    const sensitiveFields = ['ssn', 'credit_card', 'bank_account', 'medical_record'];
    const piiFields = ['name', 'email', 'phone', 'address'];
    
    const hasSensitive = fields.some(f => sensitiveFields.some(sf => f.toLowerCase().includes(sf)));
    const hasPII = fields.some(f => piiFields.some(pf => f.toLowerCase().includes(pf)));
    
    let classification: 'public' | 'internal' | 'confidential' | 'restricted';
    let sensitivityScore: number;
    let categories: string[] = [];
    
    if (hasSensitive) {
      classification = 'restricted';
      sensitivityScore = 90 + (recordCount > 1000 ? 10 : 0);
      categories = ['Financial', 'Medical'];
    } else if (hasPII) {
      classification = 'confidential';
      sensitivityScore = 60 + (recordCount > 10000 ? 20 : 0);
      categories = ['PII'];
    } else {
      classification = fields.length > 5 ? 'internal' : 'public';
      sensitivityScore = fields.length > 5 ? 30 : 10;
      categories = [];
    }
    
    return {
      classification,
      sensitivityScore: Math.min(100, sensitivityScore),
      categories,
      subjectRights: hasPII ? ['access', 'rectification', 'deletion', 'portability'] : [],
      processingRestrictions: hasSensitive ? ['encryption required', 'limited access'] : [],
      retentionRequirements: this.determineRetentionRequirements(fields)
    };
  }

  /**
   * Detect compliance violations
   */
  async detectComplianceViolations(assessment: any): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];
    
    // Check GDPR violations
    if (assessment.frameworks.includes(ComplianceFramework.GDPR)) {
      violations.push(...this.checkGDPRViolations(
        assessment.records.map((r: any) => ({ 
          fieldName: Object.keys(r)[0], 
          piiType: 'personal_data' 
        })),
        { jurisdiction: ['EU'], encryption: false }
      ));
    }
    
    // Check HIPAA violations
    if (assessment.frameworks.includes(ComplianceFramework.HIPAA) && 
        assessment.dataSensitivity.categories.includes('Medical')) {
      violations.push({
        id: crypto.randomUUID(),
        framework: ComplianceFramework.HIPAA,
        violationType: 'phi_exposure',
        severity: 'critical',
        description: 'Protected Health Information (PHI) detected without proper safeguards',
        affectedFields: ['patient_id', 'diagnosis', 'medication'],
        recommendation: 'Implement HIPAA-compliant security measures',
        requiresImmediateAction: true,
        potentialFines: '$50,000 to $1.5 million per violation',
        remediation: {
          steps: ['Encrypt PHI at rest and in transit', 'Implement access controls', 'Conduct risk assessment'],
          timeframe: '30 days',
          cost: 'high'
        }
      });
    }
    
    return violations;
  }

  /**
   * Calculate weighted risk score
   */
  calculateRiskScore(factors: Array<{ weight: number; score: number }>): number {
    if (factors.length === 0) return 0;
    
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.weight * f.score), 0);
    
    return Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);
  }

  /**
   * Generate mitigation plan
   */
  async generateMitigationPlan(assessment: RiskAssessmentResult): Promise<any> {
    const plan: any = {
      planId: crypto.randomUUID(),
      riskAssessmentId: assessment.assessmentId,
      priority: assessment.riskLevel === 'critical' || assessment.overallRiskScore > 80 ? 'immediate' : 'high',
      estimatedCost: 50000,
      actions: [],
      timeline: {
        start: new Date(),
        milestones: [],
        estimatedCompletion: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      resources: {
        internal: ['Security Team', 'Legal', 'IT'],
        external: ['Compliance Consultant']
      },
      costBreakdown: {
        technology: 20000,
        consulting: 25000,
        training: 5000
      },
      successCriteria: ['Compliance score > 90%', 'No critical violations'],
      riskReduction: {
        current: assessment.overallRiskScore,
        target: 30,
        estimatedReduction: assessment.overallRiskScore - 30
      }
    };
    
    // Add immediate actions
    if (assessment.immediateActions.length > 0) {
      plan.actions.push(...assessment.immediateActions.map(action => ({
        id: crypto.randomUUID(),
        description: action,
        priority: 'immediate' as const,
        status: 'pending' as const,
        assignee: 'Security Team',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        timeline: 'within 7 days'
      })));
    }
    
    // Add short-term actions
    plan.actions.push(...assessment.shortTermActions.map(action => ({
      id: crypto.randomUUID(),
      description: action,
      priority: 'high' as const,
      status: 'pending' as const,
      assignee: 'IT Team',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      timeline: 'within 30 days'
    })));
    
    return plan;
  }

  /**
   * Get risk trends over time
   */
  async getRiskTrends(period: string = '30d'): Promise<any> {
    const assessments = this.assessmentHistory.slice(-30);
    
    const dataPoints = assessments.map(a => ({
      date: a.timestamp,
      score: a.overallRiskScore,
      level: a.riskLevel
    }));
    
    const averageRisk = dataPoints.reduce((sum, dp) => sum + dp.score, 0) / dataPoints.length;
    const trend = dataPoints.length > 1 && 
                  dataPoints[dataPoints.length - 1].score > dataPoints[0].score ? 'increasing' :
                  dataPoints.length > 1 && 
                  dataPoints[dataPoints.length - 1].score < dataPoints[0].score ? 'decreasing' : 'stable';
    
    return {
      period,
      dataPoints,
      averageRisk,
      trend,
      highRiskPeriods: dataPoints.filter(dp => dp.score > 70).length
    };
  }

  /**
   * Export risk report
   */
  async exportRiskReport(assessmentId: string, format: string): Promise<any> {
    const assessment = this.assessmentHistory.find(a => a.assessmentId === assessmentId);
    if (!assessment) throw new Error('Assessment not found');
    
    return {
      format,
      data: assessment,
      generatedAt: new Date(),
      exportId: crypto.randomUUID()
    };
  }

  /**
   * Get risk recommendations
   */
  async getRiskRecommendations(riskLevel: string, categories: string[]): Promise<any> {
    const recommendations = {
      immediate: [] as any[],
      shortTerm: [] as any[],
      longTerm: [] as any[]
    };
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.immediate.push({
        priority: 'critical',
        action: 'Implement encryption for all sensitive data',
        impact: 'Reduces data breach risk by 80%',
        cost: 'medium'
      });
    }
    
    if (categories.includes('PII') || categories.includes('Financial')) {
      recommendations.shortTerm.push({
        priority: 'high',
        action: 'Implement data loss prevention (DLP) policies',
        impact: 'Prevents unauthorized data transfers',
        cost: 'medium'
      });
    }
    
    recommendations.longTerm.push({
      priority: 'medium',
      action: 'Establish comprehensive compliance program',
      impact: 'Ensures ongoing regulatory compliance',
      cost: 'high'
    });
    
    return recommendations;
  }

  /**
   * Validate mitigation implementation
   */
  async validateMitigationImplementation(plan: RiskMitigationPlan): Promise<any> {
    const completedActions = plan.mitigationSteps?.filter((a: any) => (a as any).status === 'completed').length || 0;
    const totalActions = plan.mitigationSteps?.length || 0;
    
    return {
      completionRate: totalActions > 0 ? (completedActions / totalActions) * 100 : 0,
      remainingActions: totalActions - completedActions,
      isComplete: completedActions === totalActions,
      validation: {
        date: new Date(),
        validator: 'System',
        findings: []
      }
    };
  }

  /**
   * Perform risk assessment
   */
  async performRiskAssessment(data: any): Promise<RiskAssessmentResult> {
    if (!data || !data.records) {
      throw new Error('Invalid data for risk assessment');
    }

    const assessmentId = crypto.randomUUID();
    const startTime = Date.now();
    
    // Extract fields from records
    const fields = data.records.length > 0 ? Object.keys(data.records[0]) : [];
    const recordCount = data.records.length;
    
    // Perform assessments
    const jurisdictions = data.metadata?.jurisdiction || ['US'];
    const geographicAssessment = await this.assessGeographicRisk(jurisdictions);
    const dataSensitivity = await this.classifyDataSensitivity(fields, recordCount);
    
    // Detect PII
    interface PIIDetection {
      fieldName: string;
      piiType: string;
      confidence: number;
    }
    
    const piiDetections: PIIDetection[] = [];
    for (const record of data.records.slice(0, 10)) { // Sample first 10 records
      for (const [field, value] of Object.entries(record)) {
        if (typeof value === 'string' && value.match(/\d{3}-\d{2}-\d{4}/)) {
          piiDetections.push({ fieldName: field, piiType: 'ssn', confidence: 0.9 });
        }
        if (typeof value === 'string' && value.match(/\S+@\S+\.\S+/)) {
          piiDetections.push({ fieldName: field, piiType: 'email', confidence: 0.95 });
        }
      }
    }
    
    // Calculate risk scores
    const dataRisk = dataSensitivity.sensitivityScore;
    const complianceRisk = piiDetections.length * 10;
    const geographicRisk = geographicAssessment.riskScore;
    const processingRisk = recordCount > 10000 ? 50 : 20;
    
    const overallRiskScore = this.calculateRiskScore([
      { weight: 0.3, score: dataRisk },
      { weight: 0.3, score: complianceRisk },
      { weight: 0.2, score: geographicRisk },
      { weight: 0.2, score: processingRisk }
    ]);
    
    const riskLevel = overallRiskScore >= 80 ? 'critical' :
                     overallRiskScore >= 60 ? 'high' :
                     overallRiskScore >= 40 ? 'medium' : 'low';
    
    // Generate recommendations
    const immediateActions = riskLevel === 'critical' || riskLevel === 'high' ? 
      ['Implement encryption immediately', 'Review data access controls'] : [];
    const shortTermActions = ['Conduct compliance audit', 'Implement monitoring'];
    const longTermActions = ['Develop data governance framework'];
    
    // Detect violations
    const frameworks = geographicAssessment.gdprApplicable ? [ComplianceFramework.GDPR] : [];
    const violations = await this.detectComplianceViolations({
      records: data.records,
      frameworks,
      dataSensitivity
    });
    
    const result: RiskAssessmentResult = {
      assessmentId,
      timestamp: new Date(),
      overallRiskScore,
      riskLevel,
      dataRisk,
      complianceRisk,
      geographicRisk,
      processingRisk,
      geographicAssessment,
      dataSensitivity,
      violations,
      riskFactors: this.identifyRiskFactors({
        processingContext: {
          encryption: false,
          jurisdiction: jurisdictions
        },
        fieldData: data.records
      }),
      immediateActions,
      shortTermActions,
      longTermActions,
      complianceStatus: this.assessComplianceStatus(frameworks, piiDetections, { encryption: false }),
      assessmentMetadata: {
        recordsAnalyzed: recordCount,
        piiItemsFound: piiDetections.length,
        processingTime: Date.now() - startTime,
        assessmentMethod: 'automated',
        confidence: 0.85
      }
    };
    
    // Store in history
    this.assessmentHistory.push(result);
    this.emit('risk:detected', result);
    
    return result;
  }
}

export const riskAssessmentService = new RiskAssessmentService();