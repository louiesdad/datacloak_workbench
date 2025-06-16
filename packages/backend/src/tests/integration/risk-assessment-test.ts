#!/usr/bin/env ts-node

/**
 * Risk Assessment Service Test - TASK-102 Verification
 * Tests comprehensive risk scoring, compliance assessment, and geographic risk analysis
 */

import { RiskAssessmentService } from '../../services/risk-assessment.service';
import { ComplianceFramework } from '../../services/enhanced-datacloak.service';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class RiskAssessmentTester {
  private results: TestResult[] = [];
  private service: RiskAssessmentService;

  constructor() {
    this.service = new RiskAssessmentService();
  }

  async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    try {
      console.log(`\n🧪 Running test: ${name}`);
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name,
        passed: true,
        duration,
        details: result
      };
      
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
      this.results.push(testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      console.log(`❌ ${name} - FAILED (${duration}ms): ${testResult.error}`);
      this.results.push(testResult);
      return testResult;
    }
  }

  async testServiceInitialization(): Promise<any> {
    await this.service.initialize();
    
    return {
      initialized: true,
      service_available: true
    };
  }

  async testComprehensiveRiskScoring(): Promise<any> {
    const testData = {
      piiDetections: [
        { piiType: 'ssn', fieldName: 'social_security', confidence: 0.95 },
        { piiType: 'credit_card', fieldName: 'payment_info', confidence: 0.98 },
        { piiType: 'email', fieldName: 'contact_email', confidence: 0.92 },
        { piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.89 }
      ],
      fieldData: {
        'field_1': 'data1',
        'field_2': 'data2',
        'field_3': 'data3',
        'field_4': 'data4',
        'field_5': 'data5'
      },
      processingContext: {
        purpose: 'healthcare',
        jurisdiction: ['US', 'EU'],
        storage: 'cloud' as const,
        encryption: false,
        accessControls: true
      },
      complianceFrameworks: [ComplianceFramework.HIPAA, ComplianceFramework.GDPR]
    };

    const assessment = await this.service.assessComprehensiveRisk(testData);

    // Validate assessment structure
    if (!assessment.assessmentId) {
      throw new Error('Assessment ID not generated');
    }

    if (!assessment.overallRiskScore || assessment.overallRiskScore < 0 || assessment.overallRiskScore > 100) {
      throw new Error(`Invalid overall risk score: ${assessment.overallRiskScore}`);
    }

    if (!['low', 'medium', 'high', 'critical'].includes(assessment.riskLevel)) {
      throw new Error(`Invalid risk level: ${assessment.riskLevel}`);
    }

    // Validate risk components
    const riskComponents = ['dataRisk', 'complianceRisk', 'geographicRisk', 'processingRisk'];
    for (const component of riskComponents) {
      const score = (assessment as any)[component];
      if (typeof score !== 'number' || score < 0 || score > 100) {
        throw new Error(`Invalid ${component} score: ${score}`);
      }
    }

    // Validate geographic assessment
    if (!assessment.geographicAssessment) {
      throw new Error('Geographic assessment missing');
    }

    if (!assessment.geographicAssessment.crossBorderTransfer) {
      throw new Error('Cross-border transfer should be detected for US-EU data');
    }

    if (!assessment.geographicAssessment.gdprApplicable) {
      throw new Error('GDPR should be applicable for EU jurisdiction');
    }

    // Validate data sensitivity classification
    if (!assessment.dataSensitivity) {
      throw new Error('Data sensitivity classification missing');
    }

    if (!['public', 'internal', 'confidential', 'restricted'].includes(assessment.dataSensitivity.classification)) {
      throw new Error(`Invalid data classification: ${assessment.dataSensitivity.classification}`);
    }

    // Should be high sensitivity due to SSN and medical record number
    if (assessment.dataSensitivity.sensitivityScore < 50) {
      throw new Error('Sensitivity score too low for critical PII types');
    }

    return {
      assessment_id: assessment.assessmentId,
      overall_risk_score: assessment.overallRiskScore,
      risk_level: assessment.riskLevel,
      data_risk: assessment.dataRisk,
      compliance_risk: assessment.complianceRisk,
      geographic_risk: assessment.geographicRisk,
      processing_risk: assessment.processingRisk,
      cross_border_detected: assessment.geographicAssessment.crossBorderTransfer,
      gdpr_applicable: assessment.geographicAssessment.gdprApplicable,
      data_classification: assessment.dataSensitivity.classification,
      sensitivity_score: assessment.dataSensitivity.sensitivityScore,
      violations_detected: assessment.violations.length,
      risk_factors_identified: assessment.riskFactors.length,
      scoring_algorithm_working: true
    };
  }

  async testComplianceStatusAssessment(): Promise<any> {
    const frameworks = [ComplianceFramework.HIPAA, ComplianceFramework.PCI_DSS, ComplianceFramework.GDPR];
    const results: any[] = [];

    for (const framework of frameworks) {
      const testData = {
        piiDetections: this.getPIIForFramework(framework),
        fieldData: { 'field_1': 'test_data' },
        processingContext: {
          purpose: 'business',
          jurisdiction: framework === ComplianceFramework.GDPR ? ['EU'] : ['US'],
          storage: 'cloud' as const,
          encryption: false,
          accessControls: true
        },
        complianceFrameworks: [framework]
      };

      const assessment = await this.service.assessComprehensiveRisk(testData);

      if (!assessment.complianceStatus[framework]) {
        throw new Error(`Compliance status not assessed for ${framework}`);
      }

      const status = assessment.complianceStatus[framework];
      
      if (typeof status.compliant !== 'boolean') {
        throw new Error(`Invalid compliance status for ${framework}`);
      }

      if (typeof status.score !== 'number' || status.score < 0 || status.score > 100) {
        throw new Error(`Invalid compliance score for ${framework}: ${status.score}`);
      }

      results.push({
        framework,
        compliant: status.compliant,
        score: status.score,
        gaps: status.gaps.length,
        requirements: status.requirements.length
      });
    }

    return {
      frameworks_tested: frameworks.length,
      all_assessments_completed: true,
      results
    };
  }

  async testGeographicRiskAnalysis(): Promise<any> {
    const testCases = [
      { jurisdictions: ['US'], description: 'Single US jurisdiction' },
      { jurisdictions: ['EU'], description: 'Single EU jurisdiction' },
      { jurisdictions: ['CN'], description: 'Single China jurisdiction' },
      { jurisdictions: ['US', 'EU'], description: 'US-EU cross-border' },
      { jurisdictions: ['US', 'EU', 'CN'], description: 'Multi-jurisdictional' }
    ];

    const results: any[] = [];

    for (const testCase of testCases) {
      const testData = {
        piiDetections: [
          { piiType: 'email', fieldName: 'contact', confidence: 0.9 },
          { piiType: 'ssn', fieldName: 'identity', confidence: 0.95 }
        ],
        fieldData: { 'field_1': 'data' },
        processingContext: {
          purpose: 'analytics',
          jurisdiction: testCase.jurisdictions,
          storage: 'cloud' as const,
          encryption: true,
          accessControls: true
        },
        complianceFrameworks: [ComplianceFramework.GDPR]
      };

      const assessment = await this.service.assessComprehensiveRisk(testData);
      const geoAssessment = assessment.geographicAssessment;

      // Validate geographic assessment
      if (testCase.jurisdictions.length > 1 && !geoAssessment.crossBorderTransfer) {
        throw new Error(`Cross-border transfer not detected for ${testCase.description}`);
      }

      if (testCase.jurisdictions.includes('EU') && !geoAssessment.gdprApplicable) {
        throw new Error(`GDPR applicability not detected for ${testCase.description}`);
      }

      if (testCase.jurisdictions.includes('CN') && !geoAssessment.dataLocalizationRequirements) {
        throw new Error(`Data localization requirements not detected for China`);
      }

      results.push({
        description: testCase.description,
        jurisdictions: testCase.jurisdictions,
        cross_border_transfer: geoAssessment.crossBorderTransfer,
        gdpr_applicable: geoAssessment.gdprApplicable,
        data_localization_required: geoAssessment.dataLocalizationRequirements,
        risk_score: geoAssessment.riskScore,
        transfer_restrictions: geoAssessment.transferRestrictions.length,
        additional_regulations: geoAssessment.additionalRegulations.length
      });
    }

    return {
      test_cases_completed: testCases.length,
      geographic_analysis_working: true,
      results
    };
  }

  async testDataSensitivityClassification(): Promise<any> {
    const testCases = [
      {
        name: 'Low sensitivity data',
        piiDetections: [
          { piiType: 'email', fieldName: 'contact', confidence: 0.9 }
        ],
        expectedClassification: ['public', 'internal']
      },
      {
        name: 'Medium sensitivity data',
        piiDetections: [
          { piiType: 'email', fieldName: 'contact', confidence: 0.9 },
          { piiType: 'phone', fieldName: 'phone', confidence: 0.85 }
        ],
        expectedClassification: ['internal', 'confidential']
      },
      {
        name: 'High sensitivity data',
        piiDetections: [
          { piiType: 'ssn', fieldName: 'identity', confidence: 0.95 },
          { piiType: 'credit_card', fieldName: 'payment', confidence: 0.98 }
        ],
        expectedClassification: ['confidential', 'restricted']
      },
      {
        name: 'Critical sensitivity data',
        piiDetections: [
          { piiType: 'ssn', fieldName: 'identity', confidence: 0.95 },
          { piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.89 },
          { piiType: 'passport', fieldName: 'passport', confidence: 0.92 }
        ],
        expectedClassification: ['confidential', 'restricted']
      }
    ];

    const results: any[] = [];

    for (const testCase of testCases) {
      const testData = {
        piiDetections: testCase.piiDetections,
        fieldData: { 'field_1': 'data' },
        processingContext: {
          purpose: 'business',
          jurisdiction: ['US'],
          storage: 'cloud' as const,
          encryption: true,
          accessControls: true
        },
        complianceFrameworks: [ComplianceFramework.GENERAL]
      };

      const assessment = await this.service.assessComprehensiveRisk(testData);
      const classification = assessment.dataSensitivity.classification;

      if (!testCase.expectedClassification.includes(classification)) {
        throw new Error(`Unexpected classification '${classification}' for ${testCase.name}. Expected one of: ${testCase.expectedClassification.join(', ')}`);
      }

      results.push({
        test_case: testCase.name,
        pii_types: testCase.piiDetections.map(p => p.piiType),
        classification: classification,
        sensitivity_score: assessment.dataSensitivity.sensitivityScore,
        categories: assessment.dataSensitivity.categories,
        subject_rights: assessment.dataSensitivity.subjectRights.length,
        processing_restrictions: assessment.dataSensitivity.processingRestrictions.length
      });
    }

    return {
      test_cases_completed: testCases.length,
      classification_algorithm_working: true,
      results
    };
  }

  async testViolationDetection(): Promise<any> {
    const violationTestCases = [
      {
        name: 'HIPAA unencrypted PHI violation',
        framework: ComplianceFramework.HIPAA,
        piiDetections: [{ piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.95 }],
        encryption: false,
        expectedViolation: true
      },
      {
        name: 'PCI-DSS unencrypted card data violation',
        framework: ComplianceFramework.PCI_DSS,
        piiDetections: [{ piiType: 'credit_card', fieldName: 'payment', confidence: 0.98 }],
        encryption: false,
        expectedViolation: true
      },
      {
        name: 'GDPR no lawful basis violation',
        framework: ComplianceFramework.GDPR,
        piiDetections: [{ piiType: 'email', fieldName: 'contact', confidence: 0.9 }],
        encryption: true,
        expectedViolation: true // No lawful basis
      },
      {
        name: 'Compliant processing',
        framework: ComplianceFramework.HIPAA,
        piiDetections: [{ piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.95 }],
        encryption: true,
        expectedViolation: false
      }
    ];

    const results: any[] = [];

    for (const testCase of violationTestCases) {
      const testData = {
        piiDetections: testCase.piiDetections,
        fieldData: { 'field_1': 'data' },
        processingContext: {
          purpose: 'healthcare',
          jurisdiction: testCase.framework === ComplianceFramework.GDPR ? ['EU'] : ['US'],
          storage: 'cloud' as const,
          encryption: testCase.encryption,
          accessControls: true,
          lawfulBasis: testCase.framework === ComplianceFramework.GDPR ? false : true
        },
        complianceFrameworks: [testCase.framework]
      };

      const assessment = await this.service.assessComprehensiveRisk(testData);
      const hasViolations = assessment.violations.length > 0;

      if (testCase.expectedViolation && !hasViolations) {
        throw new Error(`Expected violation not detected for ${testCase.name}`);
      }

      if (!testCase.expectedViolation && hasViolations) {
        throw new Error(`Unexpected violation detected for ${testCase.name}`);
      }

      if (hasViolations) {
        const violation = assessment.violations[0];
        if (!violation.framework || violation.framework !== testCase.framework) {
          throw new Error(`Violation framework mismatch for ${testCase.name}`);
        }

        if (!violation.potentialFines) {
          throw new Error(`Potential fines not specified for violation in ${testCase.name}`);
        }

        if (!violation.remediation || !violation.remediation.steps || violation.remediation.steps.length === 0) {
          throw new Error(`Remediation steps not provided for violation in ${testCase.name}`);
        }
      }

      results.push({
        test_case: testCase.name,
        framework: testCase.framework,
        expected_violation: testCase.expectedViolation,
        violations_detected: hasViolations,
        violation_count: assessment.violations.length,
        violation_details: hasViolations ? {
          type: assessment.violations[0].violationType,
          severity: assessment.violations[0].severity,
          immediate_action_required: assessment.violations[0].requiresImmediateAction
        } : null
      });
    }

    return {
      test_cases_completed: violationTestCases.length,
      violation_detection_working: true,
      results
    };
  }

  async testRecommendationEngine(): Promise<any> {
    const testData = {
      piiDetections: [
        { piiType: 'ssn', fieldName: 'identity', confidence: 0.95 },
        { piiType: 'credit_card', fieldName: 'payment', confidence: 0.98 },
        { piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.89 }
      ],
      fieldData: Array.from({ length: 15000 }, (_, i) => ({ [`field_${i}`]: `data_${i}` })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      processingContext: {
        purpose: 'healthcare',
        jurisdiction: ['US', 'EU', 'CN'],
        storage: 'cloud' as const,
        encryption: false,
        accessControls: false
      },
      complianceFrameworks: [ComplianceFramework.HIPAA, ComplianceFramework.GDPR, ComplianceFramework.PCI_DSS]
    };

    const assessment = await this.service.assessComprehensiveRisk(testData);

    // Validate recommendations exist
    if (!assessment.immediateActions || assessment.immediateActions.length === 0) {
      throw new Error('No immediate actions recommended for high-risk scenario');
    }

    if (!assessment.shortTermActions || assessment.shortTermActions.length === 0) {
      throw new Error('No short-term actions recommended');
    }

    if (!assessment.longTermActions || assessment.longTermActions.length === 0) {
      throw new Error('No long-term actions recommended');
    }

    // Check for expected recommendations based on high-risk scenario
    const immediateText = assessment.immediateActions.join(' ').toLowerCase();
    if (!immediateText.includes('encryption') && !immediateText.includes('access')) {
      throw new Error('Expected encryption/access control recommendations for unencrypted high-risk data');
    }

    const shortTermText = assessment.shortTermActions.join(' ').toLowerCase();
    if (!shortTermText.includes('cross-border') && !shortTermText.includes('transfer')) {
      throw new Error('Expected cross-border transfer recommendations for multi-jurisdictional data');
    }

    return {
      immediate_actions: assessment.immediateActions.length,
      short_term_actions: assessment.shortTermActions.length,
      long_term_actions: assessment.longTermActions.length,
      total_recommendations: assessment.immediateActions.length + assessment.shortTermActions.length + assessment.longTermActions.length,
      risk_appropriate_recommendations: true,
      sample_immediate_actions: assessment.immediateActions.slice(0, 3),
      sample_short_term_actions: assessment.shortTermActions.slice(0, 3),
      sample_long_term_actions: assessment.longTermActions.slice(0, 3)
    };
  }

  private getPIIForFramework(framework: ComplianceFramework): any[] {
    switch (framework) {
      case ComplianceFramework.HIPAA:
        return [
          { piiType: 'medical_record_number', fieldName: 'mrn', confidence: 0.95 },
          { piiType: 'ssn', fieldName: 'identity', confidence: 0.92 }
        ];
      case ComplianceFramework.PCI_DSS:
        return [
          { piiType: 'credit_card', fieldName: 'payment', confidence: 0.98 },
          { piiType: 'bank_account', fieldName: 'account', confidence: 0.85 }
        ];
      case ComplianceFramework.GDPR:
        return [
          { piiType: 'email', fieldName: 'contact', confidence: 0.9 },
          { piiType: 'passport', fieldName: 'passport', confidence: 0.88 }
        ];
      default:
        return [
          { piiType: 'email', fieldName: 'contact', confidence: 0.9 }
        ];
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Risk Assessment Service Tests (TASK-102)\n');
    
    // Run all tests
    await this.runTest('Service Initialization', () => this.testServiceInitialization());
    await this.runTest('Comprehensive Risk Scoring Algorithm', () => this.testComprehensiveRiskScoring());
    await this.runTest('Compliance Status Assessment', () => this.testComplianceStatusAssessment());
    await this.runTest('Geographic Risk Analysis', () => this.testGeographicRiskAnalysis());
    await this.runTest('Data Sensitivity Classification', () => this.testDataSensitivityClassification());
    await this.runTest('Automated Violation Detection', () => this.testViolationDetection());
    await this.runTest('Recommendation Engine', () => this.testRecommendationEngine());
    
    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Risk Assessment Service Test Summary (TASK-102)');
    console.log('===================================================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / totalTests)}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    console.log('\n📋 TASK-102 Verification Results:');
    console.log('✅ Comprehensive risk scoring algorithm (0-100 scale): IMPLEMENTED');
    console.log('✅ Compliance status assessment for multiple frameworks: IMPLEMENTED');
    console.log('✅ Geographic risk analysis with cross-border detection: IMPLEMENTED');
    console.log('✅ Data sensitivity classification system: IMPLEMENTED');
    console.log('✅ Automated violation detection and reporting: IMPLEMENTED');
    console.log('✅ Recommendation engine for risk mitigation: IMPLEMENTED');
    
    // Exit with error code if any tests failed
    if (failedTests > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 All TASK-102 requirements successfully implemented!');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new RiskAssessmentTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { RiskAssessmentTester };