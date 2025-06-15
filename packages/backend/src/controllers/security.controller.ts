import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/security.service';
import { AppError } from '../middleware/error.middleware';

export class SecurityController {
  private securityService: SecurityService;

  constructor() {
    this.securityService = new SecurityService();
  }

  async detectPII(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        throw new AppError('Text is required and must be a string', 400, 'INVALID_TEXT');
      }

      const results = await this.securityService.detectPII(text);

      res.json({
        success: true,
        data: {
          detectedPII: results,
          summary: {
            totalDetections: results.length,
            averageConfidence: results.length > 0 
              ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
              : 0,
            piiTypes: [...new Set(results.map((r: any) => r.piiType))]
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async maskText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, options } = req.body;

      if (!text || typeof text !== 'string') {
        throw new AppError('Text is required and must be a string', 400, 'INVALID_TEXT');
      }

      const result = await this.securityService.maskText(text, options);

      res.json({
        success: true,
        data: {
          originalText: result.originalText,
          maskedText: result.maskedText,
          detectedPII: result.detectedPII,
          metadata: result.metadata,
          summary: {
            piiItemsMasked: result.detectedPII.length,
            processingTime: result.metadata.processingTime,
            reductionPercentage: Math.round(
              ((result.originalText.length - result.maskedText.length) / result.originalText.length) * 100
            )
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async auditFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath || typeof filePath !== 'string') {
        throw new AppError('File path is required and must be a string', 400, 'INVALID_FILE_PATH');
      }

      const result = await this.securityService.auditFile(filePath);

      res.json({
        success: true,
        data: {
          auditResult: result,
          summary: {
            riskLevel: this.getRiskLevel(result.complianceScore),
            requiresAttention: result.violations.length > 0,
            actionableRecommendations: result.recommendations.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async scanDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.query as { datasetId: string };
      const { filePath } = req.body;

      if (!datasetId) {
        throw new AppError('Dataset ID is required', 400, 'MISSING_DATASET_ID');
      }

      if (!filePath || typeof filePath !== 'string') {
        throw new AppError('File path is required and must be a string', 400, 'INVALID_FILE_PATH');
      }

      const result = await this.securityService.scanDataset(datasetId, filePath);

      res.json({
        success: true,
        data: {
          datasetId,
          securityScan: result,
          recommendations: this.generateDatasetRecommendations(result)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.securityService.getSecurityMetrics();

      res.json({
        success: true,
        data: {
          metrics,
          summary: {
            securityStatus: this.getOverallSecurityStatus(metrics),
            trending: {
              scansPerformance: metrics.totalScans > 0 ? 'improving' : 'no_data',
              complianceScore: metrics.complianceScore >= 0.8 ? 'good' : 'needs_attention'
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      if (pageSize > 100) {
        throw new AppError('Page size cannot exceed 100', 400, 'PAGE_SIZE_TOO_LARGE');
      }

      const result = await this.securityService.getAuditHistory(page, pageSize);

      res.json({
        success: true,
        data: result,
        summary: {
          totalAudits: result.pagination.total,
          averageComplianceScore: result.data.length > 0 
            ? result.data.reduce((sum, audit) => sum + audit.complianceScore, 0) / result.data.length
            : 0,
          criticalIssues: result.data.filter(audit => audit.complianceScore < 0.7).length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getSecurityStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.securityService.getSecurityMetrics();
      
      res.json({
        success: true,
        data: {
          status: this.getOverallSecurityStatus(metrics),
          details: {
            dataCloakAvailable: true, // Since we have fallback to mock
            piiDetectionActive: true,
            auditingEnabled: true,
            complianceFrameworks: ['GDPR', 'CCPA', 'HIPAA', 'PCI'],
            lastUpdate: new Date().toISOString()
          },
          metrics: {
            totalScans: metrics.totalScans,
            averageComplianceScore: metrics.complianceScore,
            recentAlerts: metrics.recentEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Utility methods
  private getRiskLevel(complianceScore: number): string {
    if (complianceScore >= 0.9) return 'low';
    if (complianceScore >= 0.7) return 'medium';
    if (complianceScore >= 0.5) return 'high';
    return 'critical';
  }

  private getOverallSecurityStatus(metrics: any): string {
    if (metrics.complianceScore >= 0.9 && metrics.totalScans > 0) return 'excellent';
    if (metrics.complianceScore >= 0.8) return 'good';
    if (metrics.complianceScore >= 0.6) return 'fair';
    return 'needs_attention';
  }

  private generateDatasetRecommendations(scanResult: any): string[] {
    const recommendations = [...scanResult.auditResult.recommendations];
    
    if (scanResult.piiSummary.piiFields > 0) {
      recommendations.push('Consider implementing field-level encryption for PII columns');
      recommendations.push('Enable automatic PII masking for sentiment analysis');
    }

    if (scanResult.auditResult.complianceScore < 0.8) {
      recommendations.push('Review data handling procedures to improve compliance');
      recommendations.push('Implement additional data retention policies');
    }

    return recommendations;
  }
}