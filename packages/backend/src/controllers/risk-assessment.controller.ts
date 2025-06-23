import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';

export class RiskAssessmentController {
  // Comprehensive risk analysis endpoint
  async analyzeRisk(req: Request, res: Response): Promise<Response> {
    try {
      const {
        data,
        frameworkIds = ['gdpr', 'hipaa'],
        confidenceThreshold = 0.8,
        includeGeographic = true,
        generateRecommendations = true
      } = req.body;

      if (!data || (typeof data !== 'string' && !Array.isArray(data))) {
        throw new AppError('Data is required for risk analysis', 400, 'MISSING_DATA');
      }

      const assessmentId = `risk-${Date.now()}`;
      
      // Simulate comprehensive risk analysis
      const piiDetections = [
        { type: 'email', confidence: 0.95, riskLevel: 'medium', location: { start: 45, end: 62 } },
        { type: 'phone', confidence: 0.88, riskLevel: 'low', location: { start: 125, end: 137 } },
        { type: 'ssn', confidence: 0.92, riskLevel: 'high', location: { start: 200, end: 211 } }
      ];

      const riskScore = this.calculateRiskScore(piiDetections, frameworkIds);
      const complianceStatus = this.assessCompliance(piiDetections, frameworkIds);
      const geographicRisk = includeGeographic ? this.analyzeGeographicRiskPrivate(data) : null;
      const recommendations = generateRecommendations ? this.generateRiskRecommendations(riskScore, piiDetections) : [];

      const assessment = {
        assessmentId,
        timestamp: new Date().toISOString(),
        riskScore,
        riskLevel: this.getRiskLevel(riskScore),
        piiDetections,
        complianceStatus,
        geographicRisk,
        dataClassification: this.classifyDataSensitivity(piiDetections),
        violationDetection: this.detectViolations(piiDetections, frameworkIds),
        recommendations,
        metadata: {
          frameworksAssessed: frameworkIds,
          confidenceThreshold,
          dataSize: typeof data === 'string' ? data.length : data.length,
          processingTime: Math.floor(Math.random() * 500) + 100 // Simulate processing time
        }
      };

      return res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      console.error('Error analyzing risk:', error);
      throw new AppError('Failed to analyze risk', 500, 'RISK_ANALYSIS_ERROR');
    }
  }

  async getAssessment(req: Request, res: Response): Promise<Response> {
    try {
      const { assessmentId } = req.params;

      // In a real implementation, this would fetch from database
      const assessment = {
        assessmentId,
        timestamp: new Date().toISOString(),
        riskScore: 76,
        riskLevel: 'high',
        status: 'completed',
        piiDetections: [
          { type: 'email', confidence: 0.95, riskLevel: 'medium' },
          { type: 'ssn', confidence: 0.92, riskLevel: 'high' }
        ],
        complianceStatus: {
          gdpr: { compliant: false, violations: 2 },
          hipaa: { compliant: true, violations: 0 }
        }
      };

      return res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      console.error('Error getting assessment:', error);
      throw new AppError('Failed to get assessment', 500, 'GET_ASSESSMENT_ERROR');
    }
  }

  async batchAnalyzeRisk(req: Request, res: Response): Promise<Response> {
    try {
      const { datasets, frameworkIds = ['gdpr', 'hipaa'] } = req.body;

      if (!datasets || !Array.isArray(datasets)) {
        throw new AppError('Datasets array is required', 400, 'MISSING_DATASETS');
      }

      const batchId = `batch-${Date.now()}`;
      const results = datasets.map((data, index) => ({
        datasetIndex: index,
        assessmentId: `risk-${Date.now()}-${index}`,
        riskScore: Math.floor(Math.random() * 100),
        riskLevel: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        piiCount: Math.floor(Math.random() * 10),
        violationCount: Math.floor(Math.random() * 5)
      }));

      const batchSummary = {
        batchId,
        totalDatasets: datasets.length,
        averageRiskScore: Math.floor(results.reduce((sum, r) => sum + r.riskScore, 0) / results.length),
        highRiskDatasets: results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
        totalViolations: results.reduce((sum, r) => sum + r.violationCount, 0),
        processingTime: datasets.length * 250 // Simulate processing time
      };

      return res.json({
        success: true,
        data: {
          batchSummary,
          results
        }
      });
    } catch (error) {
      console.error('Error batch analyzing risk:', error);
      throw new AppError('Failed to batch analyze risk', 500, 'BATCH_RISK_ANALYSIS_ERROR');
    }
  }

  async getAssessmentHistory(req: Request, res: Response): Promise<Response> {
    try {
      const { page = 1, limit = 20, framework, riskLevel, dateFrom, dateTo } = req.query;

      // Mock assessment history
      const assessments = Array.from({ length: 50 }, (_, i) => ({
        assessmentId: `risk-${Date.now() - i * 1000}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        riskScore: Math.floor(Math.random() * 100),
        riskLevel: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        frameworks: ['gdpr', 'hipaa'],
        violationCount: Math.floor(Math.random() * 5),
        dataSize: `${Math.floor(Math.random() * 10) + 1}MB`
      }));

      // Apply filters
      let filteredAssessments = assessments;
      
      if (framework) {
        filteredAssessments = filteredAssessments.filter(a => a.frameworks.includes(framework as string));
      }
      
      if (riskLevel) {
        filteredAssessments = filteredAssessments.filter(a => a.riskLevel === riskLevel);
      }

      // Pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedAssessments = filteredAssessments.slice(startIndex, endIndex);

      return res.json({
        success: true,
        data: {
          assessments: paginatedAssessments,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: filteredAssessments.length,
            pages: Math.ceil(filteredAssessments.length / limitNum)
          },
          summary: {
            totalAssessments: filteredAssessments.length,
            averageRiskScore: Math.floor(filteredAssessments.reduce((sum, a) => sum + a.riskScore, 0) / filteredAssessments.length),
            riskDistribution: {
              low: filteredAssessments.filter(a => a.riskLevel === 'low').length,
              medium: filteredAssessments.filter(a => a.riskLevel === 'medium').length,
              high: filteredAssessments.filter(a => a.riskLevel === 'high').length,
              critical: filteredAssessments.filter(a => a.riskLevel === 'critical').length
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting assessment history:', error);
      throw new AppError('Failed to get assessment history', 500, 'GET_HISTORY_ERROR');
    }
  }

  async deleteAssessment(req: Request, res: Response): Promise<Response> {
    try {
      const { assessmentId } = req.params;

      // In a real implementation, this would delete from database
      return res.json({
        success: true,
        message: 'Assessment deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting assessment:', error);
      throw new AppError('Failed to delete assessment', 500, 'DELETE_ASSESSMENT_ERROR');
    }
  }

  async getScoringRules(req: Request, res: Response): Promise<Response> {
    try {
      const scoringRules = {
        piiWeights: {
          email: 10,
          phone: 15,
          ssn: 40,
          creditCard: 35,
          passport: 30,
          driversLicense: 25,
          bankAccount: 35,
          medicalRecordNumber: 45
        },
        confidenceMultipliers: {
          high: 1.0,    // 0.9-1.0
          medium: 0.8,  // 0.7-0.89
          low: 0.5      // 0.0-0.69
        },
        frameworkMultipliers: {
          hipaa: 1.2,
          'pci-dss': 1.3,
          gdpr: 1.1,
          general: 1.0
        },
        riskThresholds: {
          low: 30,
          medium: 60,
          high: 80,
          critical: 95
        },
        geographicRiskFactors: {
          'cross-border': 1.2,
          'high-risk-country': 1.5,
          'data-localization-required': 1.3
        }
      };

      return res.json({
        success: true,
        data: scoringRules
      });
    } catch (error) {
      console.error('Error getting scoring rules:', error);
      throw new AppError('Failed to get scoring rules', 500, 'GET_SCORING_RULES_ERROR');
    }
  }

  async updateScoringRules(req: Request, res: Response): Promise<Response> {
    try {
      const updatedRules = req.body;

      // Validate the rules structure
      if (updatedRules.piiWeights) {
        Object.values(updatedRules.piiWeights).forEach(weight => {
          if (typeof weight !== 'number' || weight < 0 || weight > 100) {
            throw new AppError('PII weights must be numbers between 0 and 100', 400, 'INVALID_WEIGHT');
          }
        });
      }

      // In a real implementation, this would update the database
      return res.json({
        success: true,
        data: updatedRules,
        message: 'Scoring rules updated successfully'
      });
    } catch (error) {
      console.error('Error updating scoring rules:', error);
      throw new AppError('Failed to update scoring rules', 500, 'UPDATE_SCORING_RULES_ERROR');
    }
  }

  async getRiskThresholds(req: Request, res: Response): Promise<Response> {
    try {
      const thresholds = {
        global: {
          low: 30,
          medium: 60,
          high: 80,
          critical: 95
        },
        frameworkSpecific: {
          hipaa: {
            low: 25,
            medium: 55,
            high: 75,
            critical: 90
          },
          'pci-dss': {
            low: 20,
            medium: 50,
            high: 70,
            critical: 85
          },
          gdpr: {
            low: 35,
            medium: 65,
            high: 85,
            critical: 95
          }
        },
        industrySpecific: {
          healthcare: {
            low: 20,
            medium: 50,
            high: 70,
            critical: 85
          },
          financial: {
            low: 15,
            medium: 45,
            high: 65,
            critical: 80
          },
          retail: {
            low: 40,
            medium: 70,
            high: 85,
            critical: 95
          }
        }
      };

      return res.json({
        success: true,
        data: thresholds
      });
    } catch (error) {
      console.error('Error getting risk thresholds:', error);
      throw new AppError('Failed to get risk thresholds', 500, 'GET_THRESHOLDS_ERROR');
    }
  }

  async updateRiskThresholds(req: Request, res: Response): Promise<Response> {
    try {
      const { framework, industry, thresholds } = req.body;

      // Validate threshold values
      if (thresholds) {
        const { low, medium, high, critical } = thresholds;
        if (low >= medium || medium >= high || high >= critical) {
          throw new AppError('Thresholds must be in ascending order: low < medium < high < critical', 400, 'INVALID_THRESHOLDS');
        }
      }

      // In a real implementation, this would update the database
      return res.json({
        success: true,
        data: { framework, industry, thresholds },
        message: 'Risk thresholds updated successfully'
      });
    } catch (error) {
      console.error('Error updating risk thresholds:', error);
      throw new AppError('Failed to update risk thresholds', 500, 'UPDATE_THRESHOLDS_ERROR');
    }
  }

  async getGeographicRules(req: Request, res: Response): Promise<Response> {
    try {
      const geographicRules = {
        crossBorderTransfers: {
          euToNonEu: { riskMultiplier: 1.3, requiresAdequacyDecision: true },
          usToEu: { riskMultiplier: 1.2, requiresPrivacyShield: false },
          chinaTransfers: { riskMultiplier: 1.8, requiresLocalStorage: true }
        },
        dataLocalizationRequirements: {
          russia: { required: true, riskMultiplier: 1.5 },
          china: { required: true, riskMultiplier: 1.6 },
          india: { required: false, riskMultiplier: 1.1 }
        },
        highRiskCountries: [
          { country: 'North Korea', riskMultiplier: 2.0 },
          { country: 'Iran', riskMultiplier: 1.9 },
          { country: 'Syria', riskMultiplier: 1.8 }
        ]
      };

      return res.json({
        success: true,
        data: geographicRules
      });
    } catch (error) {
      console.error('Error getting geographic rules:', error);
      throw new AppError('Failed to get geographic rules', 500, 'GET_GEOGRAPHIC_RULES_ERROR');
    }
  }

  async updateGeographicRules(req: Request, res: Response): Promise<Response> {
    try {
      const updatedRules = req.body;

      // In a real implementation, this would update the database
      return res.json({
        success: true,
        data: updatedRules,
        message: 'Geographic rules updated successfully'
      });
    } catch (error) {
      console.error('Error updating geographic rules:', error);
      throw new AppError('Failed to update geographic rules', 500, 'UPDATE_GEOGRAPHIC_RULES_ERROR');
    }
  }

  async analyzeGeographicRisk(req: Request, res: Response): Promise<Response> {
    try {
      const { sourceCountry, targetCountries, dataTypes } = req.body;

      if (!sourceCountry || !targetCountries || !Array.isArray(targetCountries)) {
        throw new AppError('Source country and target countries array are required', 400, 'MISSING_GEOGRAPHIC_DATA');
      }

      const analysis = {
        sourceCountry,
        targetCountries,
        dataTypes: dataTypes || ['personal_data'],
        riskAssessment: targetCountries.map(country => ({
          country,
          riskLevel: this.calculateGeographicRisk(sourceCountry, country),
          crossBorderCompliance: this.assessCrossBorderCompliance(sourceCountry, country),
          recommendations: this.getGeographicRecommendations(sourceCountry, country)
        })),
        overallRisk: this.calculateOverallGeographicRisk(sourceCountry, targetCountries),
        complianceRequirements: this.getComplianceRequirements(sourceCountry, targetCountries)
      };

      return res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing geographic risk:', error);
      throw new AppError('Failed to analyze geographic risk', 500, 'GEOGRAPHIC_ANALYSIS_ERROR');
    }
  }

  async getRecommendations(req: Request, res: Response): Promise<Response> {
    try {
      const { assessmentId } = req.params;

      // Mock recommendations based on assessment
      const recommendations = [
        {
          priority: 'critical',
          category: 'data_protection',
          title: 'Implement field-level encryption',
          description: 'Encrypt sensitive PII fields to reduce data exposure risk',
          effort: 'medium',
          impact: 'high',
          timeline: '2-4 weeks'
        },
        {
          priority: 'high',
          category: 'access_control',
          title: 'Enhance access controls',
          description: 'Implement role-based access control for sensitive data',
          effort: 'high',
          impact: 'high',
          timeline: '4-6 weeks'
        },
        {
          priority: 'medium',
          category: 'compliance',
          title: 'Update privacy policies',
          description: 'Review and update privacy policies to reflect current data usage',
          effort: 'low',
          impact: 'medium',
          timeline: '1-2 weeks'
        }
      ];

      return res.json({
        success: true,
        data: {
          assessmentId,
          recommendations,
          totalRecommendations: recommendations.length,
          priorityBreakdown: {
            critical: recommendations.filter(r => r.priority === 'critical').length,
            high: recommendations.filter(r => r.priority === 'high').length,
            medium: recommendations.filter(r => r.priority === 'medium').length,
            low: recommendations.filter(r => r.priority === 'low').length
          }
        }
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw new AppError('Failed to get recommendations', 500, 'GET_RECOMMENDATIONS_ERROR');
    }
  }

  async generateRecommendations(req: Request, res: Response): Promise<Response> {
    try {
      const { riskScore, piiTypes, frameworks, context } = req.body;

      if (typeof riskScore !== 'number' || riskScore < 0 || riskScore > 100) {
        throw new AppError('Risk score must be a number between 0 and 100', 400, 'INVALID_RISK_SCORE');
      }

      const recommendations = this.generateRiskRecommendations(riskScore, piiTypes, frameworks, context);

      return res.json({
        success: true,
        data: {
          recommendations,
          generatedAt: new Date().toISOString(),
          basedOn: { riskScore, piiTypes, frameworks, context }
        }
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw new AppError('Failed to generate recommendations', 500, 'GENERATE_RECOMMENDATIONS_ERROR');
    }
  }

  // Helper methods for risk calculation
  private calculateRiskScore(piiDetections: any[], frameworkIds: string[]): number {
    let baseScore = 0;
    
    piiDetections.forEach(detection => {
      const piiWeight = this.getPIIWeight(detection.type);
      const confidenceMultiplier = detection.confidence;
      baseScore += piiWeight * confidenceMultiplier;
    });

    // Apply framework multipliers
    const frameworkMultiplier = Math.max(...frameworkIds.map(id => this.getFrameworkMultiplier(id)));
    
    return Math.min(100, Math.floor(baseScore * frameworkMultiplier));
  }

  private getPIIWeight(type: string): number {
    const weights = {
      email: 10,
      phone: 15,
      ssn: 40,
      creditCard: 35,
      passport: 30,
      driversLicense: 25,
      bankAccount: 35,
      medicalRecordNumber: 45
    };
    return weights[type] || 10;
  }

  private getFrameworkMultiplier(frameworkId: string): number {
    const multipliers = {
      hipaa: 1.2,
      'pci-dss': 1.3,
      gdpr: 1.1,
      general: 1.0
    };
    return multipliers[frameworkId] || 1.0;
  }

  private getRiskLevel(score: number): string {
    if (score >= 95) return 'critical';
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private assessCompliance(piiDetections: any[], frameworkIds: string[]): any {
    return frameworkIds.reduce((acc, framework) => {
      acc[framework] = {
        compliant: Math.random() > 0.3, // 70% chance of compliance
        violations: Math.floor(Math.random() * 3),
        score: Math.floor(Math.random() * 40) + 60 // 60-100 range
      };
      return acc;
    }, {});
  }

  private analyzeGeographicRiskPrivate(data: any): any {
    return {
      crossBorderTransfers: Math.random() > 0.7,
      riskMultiplier: 1.2,
      complianceRequirements: ['GDPR Article 44', 'Adequacy decision required']
    };
  }

  private classifyDataSensitivity(piiDetections: any[]): string {
    const hasHighSensitive = piiDetections.some(d => ['ssn', 'creditCard', 'medicalRecordNumber'].includes(d.type));
    if (hasHighSensitive) return 'highly_sensitive';
    
    const hasMediumSensitive = piiDetections.some(d => ['phone', 'driversLicense', 'passport'].includes(d.type));
    if (hasMediumSensitive) return 'sensitive';
    
    return 'normal';
  }

  private detectViolations(piiDetections: any[], frameworkIds: string[]): any[] {
    const violations: any[] = [];
    
    // Simulate violation detection
    if (piiDetections.some(d => d.type === 'ssn')) {
      violations.push({
        framework: 'hipaa',
        rule: 'PHI-001',
        severity: 'high',
        message: 'SSN detected without proper safeguards'
      });
    }

    return violations;
  }

  private generateRiskRecommendations(riskScore: number, piiDetections?: any[], frameworks?: string[], context?: any): any[] {
    const recommendations: any[] = [];

    if (riskScore >= 80) {
      recommendations.push({
        priority: 'critical',
        category: 'immediate_action',
        title: 'Implement immediate risk mitigation',
        description: 'High risk detected - implement encryption and access controls immediately'
      });
    }

    if (riskScore >= 60) {
      recommendations.push({
        priority: 'high',
        category: 'data_protection',
        title: 'Enhance data protection measures',
        description: 'Implement additional data protection controls and monitoring'
      });
    }

    if (piiDetections?.some(d => d.type === 'ssn')) {
      recommendations.push({
        priority: 'critical',
        category: 'compliance',
        title: 'Secure SSN handling',
        description: 'Implement specific controls for Social Security Number processing'
      });
    }

    return recommendations;
  }

  private calculateGeographicRisk(sourceCountry: string, targetCountry: string): string {
    // Simplified geographic risk calculation
    const highRiskCountries = ['China', 'Russia', 'North Korea', 'Iran'];
    
    if (highRiskCountries.includes(targetCountry)) {
      return 'high';
    }
    
    if (sourceCountry === 'EU' && !['US', 'Canada', 'Japan'].includes(targetCountry)) {
      return 'medium';
    }
    
    return 'low';
  }

  private assessCrossBorderCompliance(sourceCountry: string, targetCountry: string): any {
    return {
      requiresAdequacyDecision: sourceCountry === 'EU' && !['US', 'Canada'].includes(targetCountry),
      requiresPrivacyShield: sourceCountry === 'EU' && targetCountry === 'US',
      hasDataLocalizationRequirements: ['China', 'Russia'].includes(targetCountry)
    };
  }

  private getGeographicRecommendations(sourceCountry: string, targetCountry: string): string[] {
    const recommendations: string[] = [];
    
    if (sourceCountry === 'EU' && targetCountry === 'US') {
      recommendations.push('Implement Standard Contractual Clauses (SCCs)');
      recommendations.push('Consider data residency options');
    }
    
    if (['China', 'Russia'].includes(targetCountry)) {
      recommendations.push('Evaluate data localization requirements');
      recommendations.push('Implement enhanced security measures');
    }
    
    return recommendations;
  }

  private calculateOverallGeographicRisk(sourceCountry: string, targetCountries: string[]): string {
    const riskLevels = targetCountries.map(country => this.calculateGeographicRisk(sourceCountry, country));
    
    if (riskLevels.includes('high')) return 'high';
    if (riskLevels.includes('medium')) return 'medium';
    return 'low';
  }

  private getComplianceRequirements(sourceCountry: string, targetCountries: string[]): string[] {
    const requirements = new Set<string>();
    
    targetCountries.forEach(country => {
      if (sourceCountry === 'EU' && country === 'US') {
        requirements.add('Standard Contractual Clauses (SCCs)');
        requirements.add('Data Transfer Impact Assessment (DTIA)');
      }
      
      if (['China', 'Russia'].includes(country)) {
        requirements.add('Data localization compliance');
        requirements.add('Government approval for data transfers');
      }
    });
    
    return Array.from(requirements);
  }
}

export const riskAssessmentController = new RiskAssessmentController();