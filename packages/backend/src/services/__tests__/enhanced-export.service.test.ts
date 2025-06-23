import { EnhancedExportService } from '../enhanced-export.service';
import { DataService } from '../data.service';
import { InsightsService } from '../insights.service';
import { RiskAssessmentService } from '../risk-assessment.service';
import { ConfigService } from '../config.service';
import { SecurityService } from '../security.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

// Mock dependencies
jest.mock('../data.service');
jest.mock('../insights.service');
jest.mock('../risk-assessment.service');
jest.mock('../config.service');
jest.mock('../security.service');
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('stream/promises');
jest.mock('crypto');

describe('EnhancedExportService', () => {
  let enhancedExportService: EnhancedExportService;
  let mockDataService: jest.Mocked<DataService>;
  let mockInsightsService: jest.Mocked<InsightsService>;
  let mockRiskAssessmentService: jest.Mocked<RiskAssessmentService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSecurityService: jest.Mocked<SecurityService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDataService = new DataService() as jest.Mocked<DataService>;
    mockInsightsService = new InsightsService() as jest.Mocked<InsightsService>;
    mockRiskAssessmentService = new RiskAssessmentService() as jest.Mocked<RiskAssessmentService>;
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockSecurityService = new SecurityService() as jest.Mocked<SecurityService>;

    // Mock config service
    mockConfigService.get = jest.fn().mockImplementation((key: string) => {
      const config: any = {
        'export.tempDir': '/tmp/exports',
        'export.maxFileSize': 100 * 1024 * 1024, // 100MB
        'export.formats.pdf.enabled': true,
        'export.formats.csv.enabled': true,
        'export.formats.json.enabled': true,
        'export.encryption.enabled': true,
        'export.compression.enabled': true
      };
      return config[key];
    });

    // Create service instance
    enhancedExportService = new EnhancedExportService(
      mockDataService,
      mockInsightsService,
      mockRiskAssessmentService,
      mockConfigService,
      mockSecurityService
    );
  });

  describe('PDF Audit Report Generation', () => {
    it('should generate PDF audit report with complete analysis', async () => {
      // Mock data
      const mockAnalysisData = {
        id: 'analysis-123',
        filename: 'test-data.csv',
        status: 'completed',
        results: {
          totalRecords: 1000,
          sentimentBreakdown: {
            positive: 400,
            negative: 350,
            neutral: 250
          },
          riskLevel: 'medium',
          insights: ['High negative sentiment detected', 'Risk areas identified']
        }
      };

      const mockRiskAssessment = {
        overallRisk: 'medium',
        riskFactors: [
          { factor: 'Sentiment', score: 0.7, impact: 'high' },
          { factor: 'Volume', score: 0.5, impact: 'medium' }
        ],
        recommendations: ['Monitor negative sentiment trends', 'Implement response protocols']
      };

      // Setup mocks
      mockDataService.getAnalysis = jest.fn().mockResolvedValue(mockAnalysisData);
      mockRiskAssessmentService.assessRisk = jest.fn().mockResolvedValue(mockRiskAssessment);
      mockInsightsService.generateInsights = jest.fn().mockResolvedValue({
        keyFindings: ['Finding 1', 'Finding 2'],
        recommendations: ['Recommendation 1', 'Recommendation 2']
      });

      // Mock file system
      const mockWriteStream = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn()
      };
      (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

      // Test PDF generation
      const result = await enhancedExportService.generatePDFAuditReport('analysis-123');

      expect(result).toMatchObject({
        success: true,
        filePath: expect.stringContaining('.pdf'),
        metadata: {
          format: 'pdf',
          analysisId: 'analysis-123',
          generatedAt: expect.any(Date),
          encrypted: expect.any(Boolean)
        }
      });

      expect(mockDataService.getAnalysis).toHaveBeenCalledWith('analysis-123');
      expect(mockRiskAssessmentService.assessRisk).toHaveBeenCalled();
      expect(mockInsightsService.generateInsights).toHaveBeenCalled();
    });

    it('should handle PDF generation errors gracefully', async () => {
      mockDataService.getAnalysis = jest.fn().mockRejectedValue(new Error('Analysis not found'));

      await expect(enhancedExportService.generatePDFAuditReport('invalid-id'))
        .rejects.toThrow('Failed to generate PDF audit report');
    });
  });

  describe('CSV Decision Export', () => {
    it('should export decision data to CSV format', async () => {
      // Mock decision data
      const mockDecisions = [
        {
          id: 'decision-1',
          timestamp: new Date('2024-01-01'),
          type: 'sentiment_threshold',
          decision: 'flag',
          confidence: 0.85,
          factors: ['high_negative_sentiment', 'risk_score'],
          metadata: { threshold: 0.8, actual: 0.85 }
        },
        {
          id: 'decision-2',
          timestamp: new Date('2024-01-02'),
          type: 'risk_assessment',
          decision: 'approve',
          confidence: 0.92,
          factors: ['low_risk', 'positive_trend'],
          metadata: { riskScore: 0.2 }
        }
      ];

      mockDataService.getDecisions = jest.fn().mockResolvedValue(mockDecisions);

      // Mock CSV stream
      const mockTransform = new Transform({
        transform(chunk, encoding, callback) {
          callback(null, chunk);
        }
      });

      (pipeline as jest.Mock).mockResolvedValue(undefined);

      // Test CSV export
      const result = await enhancedExportService.exportDecisionsToCSV({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        types: ['sentiment_threshold', 'risk_assessment']
      });

      expect(result).toMatchObject({
        success: true,
        filePath: expect.stringContaining('.csv'),
        recordCount: 2,
        metadata: {
          format: 'csv',
          dateRange: {
            start: expect.any(Date),
            end: expect.any(Date)
          }
        }
      });

      expect(mockDataService.getDecisions).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        types: expect.any(Array)
      });
    });

    it('should handle large CSV exports with streaming', async () => {
      // Mock large dataset
      const mockLargeDecisions = Array(10000).fill(null).map((_, i) => ({
        id: `decision-${i}`,
        timestamp: new Date(),
        type: 'sentiment_threshold',
        decision: i % 2 === 0 ? 'flag' : 'approve',
        confidence: Math.random(),
        factors: ['factor1', 'factor2'],
        metadata: {}
      }));

      mockDataService.getDecisions = jest.fn().mockResolvedValue(mockLargeDecisions);

      const result = await enhancedExportService.exportDecisionsToCSV({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(result.recordCount).toBe(10000);
      expect(result.metadata.streamed).toBe(true);
    });
  });

  describe('Methodology Documentation', () => {
    it('should generate comprehensive methodology documentation', async () => {
      const mockMethodology = {
        version: '1.0.0',
        algorithms: {
          sentiment: {
            name: 'Advanced Sentiment Analysis',
            description: 'Multi-layer neural network for sentiment classification',
            accuracy: 0.92,
            parameters: {
              threshold: 0.75,
              model: 'bert-base-uncased'
            }
          },
          risk: {
            name: 'Risk Assessment Engine',
            description: 'Composite risk scoring based on multiple factors',
            factors: ['sentiment', 'volume', 'velocity', 'patterns']
          }
        },
        dataProcessing: {
          preprocessing: ['tokenization', 'normalization', 'filtering'],
          features: ['sentiment_score', 'risk_indicators', 'temporal_patterns']
        },
        compliance: {
          standards: ['GDPR', 'CCPA'],
          dataRetention: '90 days',
          encryption: 'AES-256'
        }
      };

      mockConfigService.get = jest.fn().mockReturnValue(mockMethodology);

      const result = await enhancedExportService.generateMethodologyDocument();

      expect(result).toMatchObject({
        success: true,
        filePath: expect.stringContaining('methodology'),
        format: 'pdf',
        metadata: {
          version: '1.0.0',
          generatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('Export Packages', () => {
    it('should create complete export package with all components', async () => {
      const analysisId = 'analysis-123';
      
      // Mock all component generations
      jest.spyOn(enhancedExportService, 'generatePDFAuditReport')
        .mockResolvedValue({
          success: true,
          filePath: '/tmp/exports/audit-report.pdf',
          metadata: { format: 'pdf' }
        });

      jest.spyOn(enhancedExportService, 'exportDecisionsToCSV')
        .mockResolvedValue({
          success: true,
          filePath: '/tmp/exports/decisions.csv',
          recordCount: 100,
          metadata: { format: 'csv' }
        });

      jest.spyOn(enhancedExportService, 'generateMethodologyDocument')
        .mockResolvedValue({
          success: true,
          filePath: '/tmp/exports/methodology.pdf',
          format: 'pdf',
          metadata: { version: '1.0.0' }
        });

      // Mock archive creation
      const mockArchiveStream = {
        pipe: jest.fn(),
        append: jest.fn(),
        finalize: jest.fn(),
        on: jest.fn()
      };

      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn(),
        digest: jest.fn().mockReturnValue('mock-hash-123')
      });

      const result = await enhancedExportService.createExportPackage(analysisId, {
        includeAuditReport: true,
        includeDecisions: true,
        includeMethodology: true,
        includeRawData: false,
        format: 'zip',
        encryption: true
      });

      expect(result).toMatchObject({
        success: true,
        packagePath: expect.stringContaining('.zip'),
        components: ['audit-report', 'decisions', 'methodology'],
        metadata: {
          analysisId,
          createdAt: expect.any(Date),
          encrypted: true,
          checksum: 'mock-hash-123'
        }
      });

      expect(enhancedExportService.generatePDFAuditReport).toHaveBeenCalledWith(analysisId);
      expect(enhancedExportService.exportDecisionsToCSV).toHaveBeenCalled();
      expect(enhancedExportService.generateMethodologyDocument).toHaveBeenCalled();
    });

    it('should handle partial export package requests', async () => {
      const analysisId = 'analysis-123';

      jest.spyOn(enhancedExportService, 'generatePDFAuditReport')
        .mockResolvedValue({
          success: true,
          filePath: '/tmp/exports/audit-report.pdf',
          metadata: { format: 'pdf' }
        });

      const result = await enhancedExportService.createExportPackage(analysisId, {
        includeAuditReport: true,
        includeDecisions: false,
        includeMethodology: false,
        includeRawData: false,
        format: 'zip'
      });

      expect(result.components).toEqual(['audit-report']);
      expect(enhancedExportService.exportDecisionsToCSV).not.toHaveBeenCalled();
      expect(enhancedExportService.generateMethodologyDocument).not.toHaveBeenCalled();
    });

    it('should encrypt export packages when requested', async () => {
      const analysisId = 'analysis-123';
      
      mockSecurityService.encryptFile = jest.fn().mockResolvedValue({
        encryptedPath: '/tmp/exports/package.zip.enc',
        key: 'encryption-key-123',
        iv: 'initialization-vector'
      });

      const result = await enhancedExportService.createExportPackage(analysisId, {
        includeAuditReport: true,
        format: 'zip',
        encryption: true,
        password: 'user-password'
      });

      expect(mockSecurityService.encryptFile).toHaveBeenCalled();
      expect(result.metadata.encrypted).toBe(true);
      expect(result.metadata.encryptionKey).toBeDefined();
    });
  });

  describe('Export Progress Tracking', () => {
    it('should track export progress with callbacks', async () => {
      const progressCallback = jest.fn();
      const analysisId = 'analysis-123';

      jest.spyOn(enhancedExportService, 'generatePDFAuditReport')
        .mockImplementation(async () => {
          progressCallback({ stage: 'audit_report', progress: 50 });
          return {
            success: true,
            filePath: '/tmp/exports/audit-report.pdf',
            metadata: { format: 'pdf' }
          };
        });

      await enhancedExportService.createExportPackage(analysisId, {
        includeAuditReport: true,
        includeDecisions: false,
        format: 'zip'
      }, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          progress: expect.any(Number)
        })
      );
    });
  });

  describe('Export Format Validation', () => {
    it('should validate export format options', async () => {
      const invalidOptions = {
        includeAuditReport: true,
        format: 'invalid-format' as any
      };

      await expect(enhancedExportService.createExportPackage('analysis-123', invalidOptions))
        .rejects.toThrow('Invalid export format');
    });

    it('should validate required components', async () => {
      const emptyOptions = {
        includeAuditReport: false,
        includeDecisions: false,
        includeMethodology: false,
        includeRawData: false,
        format: 'zip'
      };

      await expect(enhancedExportService.createExportPackage('analysis-123', emptyOptions))
        .rejects.toThrow('At least one component must be included');
    });
  });

  describe('Export Cleanup', () => {
    it('should clean up temporary files after export', async () => {
      const mockUnlink = jest.fn();
      (fs.promises as any).unlink = mockUnlink;

      await enhancedExportService.cleanupExportFiles([
        '/tmp/exports/file1.pdf',
        '/tmp/exports/file2.csv'
      ]);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/exports/file1.pdf');
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/exports/file2.csv');
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockUnlink = jest.fn().mockRejectedValue(new Error('File not found'));
      (fs.promises as any).unlink = mockUnlink;

      // Should not throw
      await expect(enhancedExportService.cleanupExportFiles(['/tmp/exports/missing.pdf']))
        .resolves.not.toThrow();
    });
  });
});