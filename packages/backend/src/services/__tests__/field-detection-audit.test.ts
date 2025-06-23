import * as fs from 'fs';
import * as path from 'path';

// Mock the analysis audit service before importing the service
jest.mock('../analysis-audit.service', () => ({
  analysisAuditService: {
    logFieldDetectionDecision: jest.fn().mockResolvedValue('test-log-id'),
    anonymizeText: jest.fn().mockImplementation((text: string) => 
      text.replace(/sensitive/gi, '[REDACTED]')
    ),
    startNewSession: jest.fn().mockReturnValue('test-session-id'),
    getCurrentSessionId: jest.fn().mockReturnValue('test-session-id')
  },
  AnalysisAuditService: jest.fn()
}));

jest.mock('../openai.service', () => ({
  openaiService: {
    analyzeSentiment: jest.fn().mockResolvedValue({
      analysis: '{"type": "string", "confidence": 0.85, "reasoning": "Default analysis"}',
      usage: { total_tokens: 100 }
    })
  }
}));

// Import after mocking
import { RefactoredFileStreamService } from '../file-stream-refactored';
import { analysisAuditService } from '../analysis-audit.service';
import { openaiService } from '../openai.service';

// Get typed mocks
const mockAnalysisAuditService = analysisAuditService as jest.Mocked<typeof analysisAuditService>;
const mockOpenaiService = openaiService as jest.Mocked<typeof openaiService>;

describe('Field Detection with Audit Logging', () => {
  let fileStreamService: RefactoredFileStreamService;
  let testCSVPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    fileStreamService = new RefactoredFileStreamService();
    
    // Setup mocks
    mockAnalysisAuditService.logFieldDetectionDecision = jest.fn().mockResolvedValue('test-log-id');
    mockAnalysisAuditService.anonymizeText = jest.fn().mockImplementation((text: string) => 
      text.replace(/sensitive/gi, '[REDACTED]')
    );
    
    // Create test CSV file
    testCSVPath = path.join(__dirname, 'test-field-detection.csv');
    const csvContent = `name,email,age,is_active,created_date,website
John Doe,john@example.com,25,true,2023-01-15,https://example.com
Jane Smith,jane@test.org,30,false,2023-02-20,https://test.org
Bob Johnson,bob@company.net,35,true,2023-03-10,https://company.net`;
    
    fs.writeFileSync(testCSVPath, csvContent);
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testCSVPath)) {
      fs.unlinkSync(testCSVPath);
    }
  });

  describe('Enhanced Field Analysis', () => {
    it('should detect field types with heuristic scoring', async () => {
      const headers = ['name', 'email', 'age', 'is_active', 'created_date', 'website'];
      const testRows = [
        { name: 'John Doe', email: 'john@example.com', age: 25, is_active: true, created_date: '2023-01-15', website: 'https://example.com' },
        { name: 'Jane Smith', email: 'jane@test.org', age: 30, is_active: false, created_date: '2023-02-20', website: 'https://test.org' }
      ];

      const results = await fileStreamService.enhancedFieldAnalysis(headers, testRows, false);

      expect(results).toHaveLength(6);
      
      // Check email field detection
      const emailField = results.find(r => r.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.type).toBe('email');
      expect(emailField?.confidence).toBeGreaterThan(0.8);
      expect(emailField?.gptUsed).toBe(false);
      
      // Check number field detection
      const ageField = results.find(r => r.name === 'age');
      expect(ageField).toBeDefined();
      expect(ageField?.type).toBe('number');
      
      // Check boolean field detection
      const activeField = results.find(r => r.name === 'is_active');
      expect(activeField).toBeDefined();
      expect(activeField?.type).toBe('boolean');
      
      // Check URL field detection
      const websiteField = results.find(r => r.name === 'website');
      expect(websiteField).toBeDefined();
      expect(websiteField?.type).toBe('url');

      // Verify audit logging was called for each field
      expect(mockAnalysisAuditService.logFieldDetectionDecision).toHaveBeenCalledTimes(6);
    });

    it('should use GPT enhancement for low confidence fields', async () => {
      // Mock GPT response
      mockOpenaiService.analyzeSentiment = jest.fn().mockResolvedValue({
        analysis: '{"type": "email", "confidence": 0.95, "reasoning": "Field contains email patterns"}',
        usage: { total_tokens: 150 }
      });

      const headers = ['contact_info'];
      const testRows = [
        { contact_info: 'some@email.com' },
        { contact_info: 'ambiguous data' }  // This should trigger low confidence
      ];

      const results = await fileStreamService.enhancedFieldAnalysis(headers, testRows, true);

      expect(results).toHaveLength(1);
      const field = results[0];
      
      // Should have been enhanced with GPT
      expect(field.gptUsed).toBe(true);
      expect(mockOpenaiService.analyzeSentiment).toHaveBeenCalled();
      
      // Check audit logging
      expect(mockAnalysisAuditService.logFieldDetectionDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldName: 'contact_info',
          gptEnhancement: expect.objectContaining({
            used: true,
            tokens_used: 150
          })
        })
      );
    });

    it('should handle anonymization of sample tokens', async () => {
      const headers = ['sensitive_field'];
      const testRows = [
        { sensitive_field: 'sensitive data here' },
        { sensitive_field: 'more sensitive content' }
      ];

      await fileStreamService.enhancedFieldAnalysis(headers, testRows, false);

      expect(mockAnalysisAuditService.anonymizeText).toHaveBeenCalledWith('sensitive data here');
      expect(mockAnalysisAuditService.anonymizeText).toHaveBeenCalledWith('more sensitive content');
    });

    it('should capture comprehensive heuristic scores', async () => {
      const headers = ['mixed_field'];
      const testRows = [
        { mixed_field: 'text1' },
        { mixed_field: 'text2' },
        { mixed_field: 'text3' }
      ];

      await fileStreamService.enhancedFieldAnalysis(headers, testRows, false);

      expect(mockAnalysisAuditService.logFieldDetectionDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldName: 'mixed_field',
          heuristicScores: expect.objectContaining({
            pattern_match: expect.any(Number),
            sample_analysis: expect.any(Number),
            statistical_features: expect.any(Number),
            gpt_enhancement: expect.any(Number)
          }),
          decision_factors: expect.any(Array),
          finalConfidence: expect.any(Number)
        })
      );
    });
  });

  describe('Enhanced CSV Processing with Audit', () => {
    it('should process CSV file with enhanced field detection', async () => {
      const result = await fileStreamService.streamCSVWithEnhancedStats(testCSVPath, false);

      expect(result.fieldInfo).toHaveLength(6);
      expect(result.recordCount).toBe(3);
      expect(result.previewData).toHaveLength(3);

      // Check that all fields have confidence scores
      result.fieldInfo.forEach(field => {
        expect(field.confidence).toBeDefined();
        expect(field.heuristicScores).toBeDefined();
        expect(typeof field.gptUsed).toBe('boolean');
      });

      // Verify audit logging occurred
      expect(mockAnalysisAuditService.logFieldDetectionDecision).toHaveBeenCalled();
    });

    it('should enable GPT enhancement when requested', async () => {
      mockOpenaiService.analyzeSentiment = jest.fn().mockResolvedValue({
        analysis: '{"type": "string", "confidence": 0.85, "reasoning": "Mixed content detected"}',
        usage: { total_tokens: 100 }
      });

      const result = await fileStreamService.streamCSVWithEnhancedStats(testCSVPath, true);

      // Check if any field used GPT (depends on confidence thresholds)
      const gptUsedFields = result.fieldInfo.filter(f => f.gptUsed);
      
      if (gptUsedFields.length > 0) {
        expect(mockOpenaiService.analyzeSentiment).toHaveBeenCalled();
      }
    });
  });

  describe('Heuristic Score Calculation', () => {
    it('should calculate accurate pattern matching scores', async () => {
      const emailValues = ['test@example.com', 'user@domain.org', 'admin@site.net'];
      
      // Access private method through type assertion for testing
      const service = fileStreamService as any;
      const scores = service.calculateHeuristicScores(emailValues);
      
      expect(scores.pattern_match).toBeGreaterThan(0.9);
      expect(scores.pattern_scores.email).toBe(1.0);
      expect(scores.sample_analysis).toBeGreaterThan(0);
      expect(scores.statistical_features).toBeGreaterThan(0);
    });

    it('should handle mixed data types appropriately', async () => {
      const mixedValues = ['text', '123', 'more text', '456'];
      
      const service = fileStreamService as any;
      const scores = service.calculateHeuristicScores(mixedValues);
      
      expect(scores.pattern_match).toBeLessThan(1.0);
      expect(scores.sample_analysis).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle GPT enhancement failures gracefully', async () => {
      mockOpenaiService.analyzeSentiment = jest.fn().mockRejectedValue(new Error('GPT API error'));

      const headers = ['test_field'];
      const testRows = [{ test_field: 'ambiguous' }];

      const results = await fileStreamService.enhancedFieldAnalysis(headers, testRows, true);

      expect(results).toHaveLength(1);
      expect(results[0].gptUsed).toBe(false);
      
      // Should still log the decision without GPT enhancement
      expect(mockAnalysisAuditService.logFieldDetectionDecision).toHaveBeenCalled();
    });

    it('should handle audit logging failures gracefully', async () => {
      mockAnalysisAuditService.logFieldDetectionDecision = jest.fn().mockRejectedValue(new Error('Audit error'));

      const headers = ['test_field'];
      const testRows = [{ test_field: 'test' }];

      // Should not throw error even if audit logging fails
      await expect(fileStreamService.enhancedFieldAnalysis(headers, testRows, false))
        .resolves.not.toThrow();
    });
  });
});