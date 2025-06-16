import { Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';

export class PatternsController {
  // Custom pattern CRUD operations
  async getCustomPatterns(req: Request, res: Response): Promise<Response> {
    try {
      const { category, industry, enabled, page = 1, limit = 20 } = req.query;

      // Mock custom patterns data
      const patterns = [
        {
          id: 'custom-001',
          name: 'Employee ID Pattern',
          description: 'Matches company employee ID format EMP-XXXXX',
          regex: '^EMP-\\d{5}$',
          category: 'identifier',
          industry: 'general',
          enabled: true,
          confidence: 0.9,
          priority: 1,
          testCases: ['EMP-12345', 'EMP-98765'],
          invalidCases: ['EMP-123', 'EMPLOYEE-12345'],
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          performance: {
            avgProcessingTime: 0.5,
            accuracy: 0.95,
            falsePositiveRate: 0.02
          }
        },
        {
          id: 'custom-002',
          name: 'Medical Device Serial',
          description: 'Medical device serial number pattern',
          regex: '^MD[A-Z]{2}\\d{8}$',
          category: 'medical',
          industry: 'healthcare',
          enabled: true,
          confidence: 0.95,
          priority: 2,
          testCases: ['MDAB12345678', 'MDXY87654321'],
          invalidCases: ['MD1234567', 'MDABC12345678'],
          createdAt: '2024-01-10T14:30:00Z',
          updatedAt: '2024-01-10T14:30:00Z',
          performance: {
            avgProcessingTime: 0.7,
            accuracy: 0.98,
            falsePositiveRate: 0.01
          }
        },
        {
          id: 'custom-003',
          name: 'Financial Account Number',
          description: 'Custom financial account number pattern',
          regex: '^FA\\d{10}-[A-Z]{3}$',
          category: 'financial',
          industry: 'financial',
          enabled: false,
          confidence: 0.85,
          priority: 3,
          testCases: ['FA1234567890-USD', 'FA9876543210-EUR'],
          invalidCases: ['FA123456789-USD', 'FA1234567890-US'],
          createdAt: '2024-01-05T09:15:00Z',
          updatedAt: '2024-01-12T16:45:00Z',
          performance: {
            avgProcessingTime: 0.8,
            accuracy: 0.92,
            falsePositiveRate: 0.05
          }
        }
      ];

      // Apply filters
      let filteredPatterns = patterns;
      
      if (category) {
        filteredPatterns = filteredPatterns.filter(p => p.category === category);
      }
      
      if (industry) {
        filteredPatterns = filteredPatterns.filter(p => p.industry === industry);
      }
      
      if (enabled !== undefined) {
        const isEnabled = enabled === 'true';
        filteredPatterns = filteredPatterns.filter(p => p.enabled === isEnabled);
      }

      // Pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedPatterns = filteredPatterns.slice(startIndex, endIndex);

      return res.json({
        success: true,
        data: {
          patterns: paginatedPatterns,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: filteredPatterns.length,
            pages: Math.ceil(filteredPatterns.length / limitNum)
          },
          summary: {
            total: filteredPatterns.length,
            enabled: filteredPatterns.filter(p => p.enabled).length,
            byCategory: this.groupBy(filteredPatterns, 'category'),
            byIndustry: this.groupBy(filteredPatterns, 'industry')
          }
        }
      });
    } catch (error) {
      console.error('Error getting custom patterns:', error);
      throw new AppError('Failed to get custom patterns', 500, 'GET_PATTERNS_ERROR');
    }
  }

  async createCustomPattern(req: Request, res: Response): Promise<Response> {
    try {
      const {
        name,
        description,
        regex,
        category,
        industry = 'general',
        confidence = 0.8,
        priority = 5,
        testCases = [],
        invalidCases = []
      } = req.body;

      // Validate required fields
      if (!name || !description || !regex || !category) {
        throw new AppError('Missing required fields: name, description, regex, category', 400, 'MISSING_FIELDS');
      }

      // Validate regex pattern
      try {
        new RegExp(regex);
      } catch (regexError) {
        throw new AppError('Invalid regex pattern', 400, 'INVALID_REGEX');
      }

      // Validate test cases
      const validationResults = this.validateTestCases(regex, testCases, invalidCases);

      const newPattern = {
        id: `custom-${Date.now()}`,
        name,
        description,
        regex,
        category,
        industry,
        enabled: true,
        confidence,
        priority,
        testCases,
        invalidCases,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        performance: {
          avgProcessingTime: 0,
          accuracy: 0,
          falsePositiveRate: 0
        },
        validation: validationResults
      };

      return res.status(201).json({
        success: true,
        data: newPattern,
        message: 'Custom pattern created successfully'
      });
    } catch (error) {
      console.error('Error creating custom pattern:', error);
      throw new AppError('Failed to create custom pattern', 500, 'CREATE_PATTERN_ERROR');
    }
  }

  async getCustomPattern(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // Mock pattern retrieval
      const pattern = {
        id,
        name: 'Employee ID Pattern',
        description: 'Matches company employee ID format EMP-XXXXX',
        regex: '^EMP-\\d{5}$',
        category: 'identifier',
        industry: 'general',
        enabled: true,
        confidence: 0.9,
        priority: 1,
        testCases: ['EMP-12345', 'EMP-98765'],
        invalidCases: ['EMP-123', 'EMPLOYEE-12345'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        performance: {
          avgProcessingTime: 0.5,
          accuracy: 0.95,
          falsePositiveRate: 0.02,
          totalMatches: 1250,
          successfulMatches: 1188,
          failedMatches: 62
        },
        usageStats: {
          timesUsed: 156,
          lastUsed: '2024-01-16T14:30:00Z',
          avgConfidenceScore: 0.92
        }
      };

      return res.json({
        success: true,
        data: pattern
      });
    } catch (error) {
      console.error('Error getting custom pattern:', error);
      throw new AppError('Failed to get custom pattern', 500, 'GET_PATTERN_ERROR');
    }
  }

  async updateCustomPattern(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Validate regex if being updated
      if (updates.regex) {
        try {
          new RegExp(updates.regex);
        } catch (regexError) {
          throw new AppError('Invalid regex pattern', 400, 'INVALID_REGEX');
        }
      }

      // Validate test cases if being updated
      let validationResults;
      if (updates.regex || updates.testCases || updates.invalidCases) {
        const regex = updates.regex || '^EMP-\\d{5}$'; // Fallback to existing regex
        validationResults = this.validateTestCases(
          regex,
          updates.testCases || [],
          updates.invalidCases || []
        );
      }

      const updatedPattern = {
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
        validation: validationResults
      };

      return res.json({
        success: true,
        data: updatedPattern,
        message: 'Custom pattern updated successfully'
      });
    } catch (error) {
      console.error('Error updating custom pattern:', error);
      throw new AppError('Failed to update custom pattern', 500, 'UPDATE_PATTERN_ERROR');
    }
  }

  async deleteCustomPattern(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // In a real implementation, check if pattern is in use
      const isInUse = Math.random() > 0.7; // 30% chance it's in use
      
      if (isInUse) {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete pattern that is currently in use',
          data: {
            usageCount: Math.floor(Math.random() * 100) + 1,
            activeConfigurations: Math.floor(Math.random() * 5) + 1
          }
        });
      }

      return res.json({
        success: true,
        message: 'Custom pattern deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting custom pattern:', error);
      throw new AppError('Failed to delete custom pattern', 500, 'DELETE_PATTERN_ERROR');
    }
  }

  async validatePattern(req: Request, res: Response): Promise<Response> {
    try {
      const { regex, testCases = [], invalidCases = [] } = req.body;

      if (!regex) {
        throw new AppError('Regex pattern is required', 400, 'MISSING_REGEX');
      }

      // Validate regex syntax
      let regexValid = true;
      let regexError = null;
      try {
        new RegExp(regex);
      } catch (error) {
        regexValid = false;
        regexError = error.message;
      }

      if (!regexValid) {
        return res.json({
          success: true,
          data: {
            valid: false,
            error: regexError,
            testResults: null
          }
        });
      }

      // Test against provided cases
      const validationResults = this.validateTestCases(regex, testCases, invalidCases);

      return res.json({
        success: true,
        data: {
          valid: true,
          error: null,
          testResults: validationResults,
          performance: {
            estimatedProcessingTime: this.estimateProcessingTime(regex),
            complexityScore: this.calculateComplexityScore(regex)
          }
        }
      });
    } catch (error) {
      console.error('Error validating pattern:', error);
      throw new AppError('Failed to validate pattern', 500, 'VALIDATE_PATTERN_ERROR');
    }
  }

  async testPattern(req: Request, res: Response): Promise<Response> {
    try {
      const { patternId, testData } = req.body;

      if (!patternId || !testData) {
        throw new AppError('Pattern ID and test data are required', 400, 'MISSING_TEST_DATA');
      }

      // Mock pattern testing
      const pattern = {
        id: patternId,
        regex: '^EMP-\\d{5}$',
        name: 'Employee ID Pattern'
      };

      const testResults = Array.isArray(testData) ? testData.map(data => ({
        input: data,
        matches: new RegExp(pattern.regex).test(data),
        confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
        processingTime: Math.random() * 2 + 0.5 // 0.5-2.5ms range
      })) : [{
        input: testData,
        matches: new RegExp(pattern.regex).test(testData),
        confidence: Math.random() * 0.3 + 0.7,
        processingTime: Math.random() * 2 + 0.5
      }];

      const summary = {
        totalTests: testResults.length,
        matchCount: testResults.filter(r => r.matches).length,
        avgConfidence: testResults.reduce((sum, r) => sum + r.confidence, 0) / testResults.length,
        avgProcessingTime: testResults.reduce((sum, r) => sum + r.processingTime, 0) / testResults.length,
        successRate: testResults.filter(r => r.matches).length / testResults.length
      };

      return res.json({
        success: true,
        data: {
          pattern,
          testResults,
          summary
        }
      });
    } catch (error) {
      console.error('Error testing pattern:', error);
      throw new AppError('Failed to test pattern', 500, 'TEST_PATTERN_ERROR');
    }
  }

  async batchTestPatterns(req: Request, res: Response): Promise<Response> {
    try {
      const { patternIds, testDataset } = req.body;

      if (!patternIds || !Array.isArray(patternIds) || !testDataset) {
        throw new AppError('Pattern IDs array and test dataset are required', 400, 'MISSING_BATCH_DATA');
      }

      const batchResults = patternIds.map(patternId => {
        const matchCount = Math.floor(Math.random() * testDataset.length * 0.3);
        return {
          patternId,
          results: {
            totalTests: testDataset.length,
            matchCount,
            falsePositives: Math.floor(matchCount * 0.1),
            falseNegatives: Math.floor((testDataset.length - matchCount) * 0.05),
            accuracy: Math.random() * 0.2 + 0.8, // 0.8-1.0 range
            avgProcessingTime: Math.random() * 3 + 1, // 1-4ms range
            avgConfidence: Math.random() * 0.3 + 0.7
          }
        };
      });

      const overallStats = {
        totalPatterns: patternIds.length,
        totalTests: testDataset.length * patternIds.length,
        avgAccuracy: batchResults.reduce((sum, r) => sum + r.results.accuracy, 0) / batchResults.length,
        bestPerformingPattern: batchResults.reduce((best, current) => 
          current.results.accuracy > best.results.accuracy ? current : best
        ).patternId,
        worstPerformingPattern: batchResults.reduce((worst, current) => 
          current.results.accuracy < worst.results.accuracy ? current : worst
        ).patternId
      };

      return res.json({
        success: true,
        data: {
          batchResults,
          overallStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error batch testing patterns:', error);
      throw new AppError('Failed to batch test patterns', 500, 'BATCH_TEST_ERROR');
    }
  }

  async getPatternCategories(req: Request, res: Response): Promise<Response> {
    try {
      const categories = [
        {
          id: 'identifier',
          name: 'Identifiers',
          description: 'Patterns for various types of identifiers',
          patternCount: 12,
          examples: ['Employee IDs', 'Customer Numbers', 'Product Codes']
        },
        {
          id: 'financial',
          name: 'Financial',
          description: 'Financial data patterns',
          patternCount: 8,
          examples: ['Account Numbers', 'Transaction IDs', 'SWIFT Codes']
        },
        {
          id: 'medical',
          name: 'Medical',
          description: 'Healthcare and medical patterns',
          patternCount: 6,
          examples: ['Patient IDs', 'Medical Record Numbers', 'Device Serials']
        },
        {
          id: 'personal',
          name: 'Personal Information',
          description: 'Personal data patterns',
          patternCount: 15,
          examples: ['Phone Numbers', 'Email Addresses', 'National IDs']
        },
        {
          id: 'geographic',
          name: 'Geographic',
          description: 'Location and geographic patterns',
          patternCount: 4,
          examples: ['Postal Codes', 'Coordinates', 'Address Formats']
        },
        {
          id: 'custom',
          name: 'Custom',
          description: 'User-defined custom patterns',
          patternCount: 23,
          examples: ['Company-specific', 'Industry-specific', 'Regional formats']
        }
      ];

      return res.json({
        success: true,
        data: {
          categories,
          totalCategories: categories.length,
          totalPatterns: categories.reduce((sum, cat) => sum + cat.patternCount, 0)
        }
      });
    } catch (error) {
      console.error('Error getting pattern categories:', error);
      throw new AppError('Failed to get pattern categories', 500, 'GET_CATEGORIES_ERROR');
    }
  }

  async getIndustryPatternSets(req: Request, res: Response): Promise<Response> {
    try {
      const industrySets = [
        {
          industry: 'healthcare',
          name: 'Healthcare Patterns',
          description: 'Patterns specific to healthcare industry',
          patternCount: 15,
          compliance: ['HIPAA', 'HITECH'],
          patterns: ['Medical Record Numbers', 'Patient IDs', 'Provider IDs', 'Medical Device Serials']
        },
        {
          industry: 'financial',
          name: 'Financial Services Patterns',
          description: 'Patterns for financial services',
          patternCount: 20,
          compliance: ['PCI-DSS', 'SOX', 'Basel III'],
          patterns: ['Account Numbers', 'Credit Card Numbers', 'SWIFT Codes', 'IBAN Numbers']
        },
        {
          industry: 'retail',
          name: 'Retail Patterns',
          description: 'E-commerce and retail patterns',
          patternCount: 12,
          compliance: ['PCI-DSS', 'GDPR'],
          patterns: ['Customer IDs', 'Order Numbers', 'Product SKUs', 'Loyalty Numbers']
        },
        {
          industry: 'government',
          name: 'Government Patterns',
          description: 'Government and public sector patterns',
          patternCount: 18,
          compliance: ['FedRAMP', 'NIST', 'FISMA'],
          patterns: ['Citizen IDs', 'Case Numbers', 'License Numbers', 'Permit IDs']
        },
        {
          industry: 'education',
          name: 'Education Patterns',
          description: 'Educational institution patterns',
          patternCount: 10,
          compliance: ['FERPA', 'COPPA'],
          patterns: ['Student IDs', 'Course Codes', 'Grade Records', 'Transcript Numbers']
        }
      ];

      return res.json({
        success: true,
        data: {
          industrySets,
          totalIndustries: industrySets.length,
          totalPatterns: industrySets.reduce((sum, set) => sum + set.patternCount, 0)
        }
      });
    } catch (error) {
      console.error('Error getting industry pattern sets:', error);
      throw new AppError('Failed to get industry pattern sets', 500, 'GET_INDUSTRY_SETS_ERROR');
    }
  }

  async getIndustryPatterns(req: Request, res: Response): Promise<Response> {
    try {
      const { industry } = req.params;

      // Mock industry-specific patterns
      const patterns = {
        healthcare: [
          { id: 'mrn-001', name: 'Medical Record Number', regex: '^MRN\\d{8}$', enabled: true },
          { id: 'npi-001', name: 'National Provider Identifier', regex: '^\\d{10}$', enabled: true },
          { id: 'hicn-001', name: 'Health Insurance Claim Number', regex: '^\\d{9}[A-Z]\\d?$', enabled: true }
        ],
        financial: [
          { id: 'aba-001', name: 'ABA Routing Number', regex: '^\\d{9}$', enabled: true },
          { id: 'iban-001', name: 'IBAN Number', regex: '^[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}$', enabled: true },
          { id: 'swift-001', name: 'SWIFT Code', regex: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', enabled: true }
        ],
        retail: [
          { id: 'sku-001', name: 'Product SKU', regex: '^SKU-[A-Z0-9]{8}$', enabled: true },
          { id: 'order-001', name: 'Order Number', regex: '^ORD-\\d{10}$', enabled: true },
          { id: 'loyalty-001', name: 'Loyalty Card Number', regex: '^LYL\\d{12}$', enabled: true }
        ]
      };

      const industryPatterns = patterns[industry] || [];

      return res.json({
        success: true,
        data: {
          industry,
          patterns: industryPatterns,
          totalPatterns: industryPatterns.length,
          enabledPatterns: industryPatterns.filter(p => p.enabled).length
        }
      });
    } catch (error) {
      console.error('Error getting industry patterns:', error);
      throw new AppError('Failed to get industry patterns', 500, 'GET_INDUSTRY_PATTERNS_ERROR');
    }
  }

  async getPatternPerformance(req: Request, res: Response): Promise<Response> {
    try {
      const { patternId, timeRange = '7d' } = req.query;

      // Mock performance data
      const performanceData = {
        patternId: patternId || 'all',
        timeRange,
        metrics: {
          avgProcessingTime: 1.2, // ms
          totalExecutions: 15432,
          successfulMatches: 14876,
          failedMatches: 556,
          accuracy: 0.964,
          falsePositiveRate: 0.023,
          falseNegativeRate: 0.013,
          throughput: 8500 // patterns/second
        },
        trends: {
          processingTime: [1.1, 1.2, 1.3, 1.1, 1.2, 1.4, 1.2],
          accuracy: [0.96, 0.965, 0.962, 0.968, 0.964, 0.961, 0.964],
          throughput: [8200, 8300, 8600, 8400, 8500, 8700, 8500]
        },
        topPerformers: [
          { patternId: 'email-001', accuracy: 0.992, avgTime: 0.8 },
          { patternId: 'phone-001', accuracy: 0.987, avgTime: 0.9 },
          { patternId: 'ssn-001', accuracy: 0.985, avgTime: 1.1 }
        ],
        bottomPerformers: [
          { patternId: 'custom-003', accuracy: 0.89, avgTime: 3.2 },
          { patternId: 'custom-007', accuracy: 0.91, avgTime: 2.8 },
          { patternId: 'custom-012', accuracy: 0.92, avgTime: 2.5 }
        ]
      };

      return res.json({
        success: true,
        data: performanceData
      });
    } catch (error) {
      console.error('Error getting pattern performance:', error);
      throw new AppError('Failed to get pattern performance', 500, 'GET_PERFORMANCE_ERROR');
    }
  }

  async benchmarkPatterns(req: Request, res: Response): Promise<Response> {
    try {
      const { patternIds, testDataSize = 1000, iterations = 100 } = req.body;

      if (!patternIds || !Array.isArray(patternIds)) {
        throw new AppError('Pattern IDs array is required', 400, 'MISSING_PATTERN_IDS');
      }

      const benchmarkId = `benchmark-${Date.now()}`;
      const results = patternIds.map(patternId => ({
        patternId,
        performance: {
          avgProcessingTime: Math.random() * 3 + 0.5, // 0.5-3.5ms
          minProcessingTime: Math.random() * 0.5 + 0.1, // 0.1-0.6ms
          maxProcessingTime: Math.random() * 5 + 3, // 3-8ms
          accuracy: Math.random() * 0.2 + 0.8, // 0.8-1.0
          throughput: Math.floor(Math.random() * 5000) + 3000, // 3000-8000/sec
          memoryUsage: Math.floor(Math.random() * 500) + 100, // 100-600KB
          cpuUsage: Math.random() * 15 + 5 // 5-20%
        },
        ranking: 0 // Will be calculated
      }));

      // Calculate rankings based on overall performance score
      results.forEach((result, index) => {
        const perf = result.performance;
        const score = (perf.accuracy * 0.4) + 
                     ((1 / perf.avgProcessingTime) * 0.3) + 
                     ((perf.throughput / 10000) * 0.3);
        result.ranking = index + 1; // Simplified ranking
      });

      results.sort((a, b) => b.ranking - a.ranking);

      const benchmarkSummary = {
        benchmarkId,
        timestamp: new Date().toISOString(),
        configuration: {
          testDataSize,
          iterations,
          patternCount: patternIds.length
        },
        summary: {
          avgAccuracy: results.reduce((sum, r) => sum + r.performance.accuracy, 0) / results.length,
          avgProcessingTime: results.reduce((sum, r) => sum + r.performance.avgProcessingTime, 0) / results.length,
          avgThroughput: results.reduce((sum, r) => sum + r.performance.throughput, 0) / results.length,
          bestPattern: results[0].patternId,
          worstPattern: results[results.length - 1].patternId
        }
      };

      return res.json({
        success: true,
        data: {
          benchmarkSummary,
          results
        }
      });
    } catch (error) {
      console.error('Error benchmarking patterns:', error);
      throw new AppError('Failed to benchmark patterns', 500, 'BENCHMARK_ERROR');
    }
  }

  async getPerformanceRecommendations(req: Request, res: Response): Promise<Response> {
    try {
      const recommendations = [
        {
          type: 'optimization',
          priority: 'high',
          pattern: 'custom-003',
          issue: 'High processing time',
          recommendation: 'Simplify regex pattern to reduce backtracking',
          expectedImprovement: '60% faster processing',
          effort: 'medium'
        },
        {
          type: 'accuracy',
          priority: 'medium',
          pattern: 'custom-007',
          issue: 'Low accuracy rate',
          recommendation: 'Add more specific character classes',
          expectedImprovement: '15% accuracy increase',
          effort: 'low'
        },
        {
          type: 'maintenance',
          priority: 'low',
          pattern: 'email-legacy',
          issue: 'Deprecated pattern',
          recommendation: 'Update to use modern email validation',
          expectedImprovement: 'Better future compatibility',
          effort: 'high'
        },
        {
          type: 'resource',
          priority: 'high',
          pattern: 'complex-financial',
          issue: 'High memory usage',
          recommendation: 'Split complex pattern into simpler components',
          expectedImprovement: '40% memory reduction',
          effort: 'high'
        }
      ];

      return res.json({
        success: true,
        data: {
          recommendations,
          totalRecommendations: recommendations.length,
          priorityBreakdown: {
            high: recommendations.filter(r => r.priority === 'high').length,
            medium: recommendations.filter(r => r.priority === 'medium').length,
            low: recommendations.filter(r => r.priority === 'low').length
          }
        }
      });
    } catch (error) {
      console.error('Error getting performance recommendations:', error);
      throw new AppError('Failed to get performance recommendations', 500, 'GET_RECOMMENDATIONS_ERROR');
    }
  }

  async getPatternPriorities(req: Request, res: Response): Promise<Response> {
    try {
      const priorities = {
        currentPriorities: [
          { patternId: 'ssn-001', priority: 1, weight: 1.0, reason: 'Critical sensitive data' },
          { patternId: 'creditcard-001', priority: 2, weight: 0.95, reason: 'Financial data protection' },
          { patternId: 'email-001', priority: 3, weight: 0.8, reason: 'Common PII identifier' },
          { patternId: 'phone-001', priority: 4, weight: 0.7, reason: 'Contact information' },
          { patternId: 'custom-medical', priority: 5, weight: 0.9, reason: 'HIPAA compliance' }
        ],
        frameworkSpecific: {
          hipaa: [
            { patternId: 'ssn-001', priority: 1 },
            { patternId: 'custom-medical', priority: 2 },
            { patternId: 'phone-001', priority: 3 }
          ],
          'pci-dss': [
            { patternId: 'creditcard-001', priority: 1 },
            { patternId: 'ssn-001', priority: 2 },
            { patternId: 'bank-account', priority: 3 }
          ],
          gdpr: [
            { patternId: 'email-001', priority: 1 },
            { patternId: 'phone-001', priority: 2 },
            { patternId: 'ssn-001', priority: 3 }
          ]
        },
        conflictResolution: {
          strategy: 'highest-priority-wins',
          tieBreaker: 'confidence-score',
          overlapHandling: 'merge-detections'
        }
      };

      return res.json({
        success: true,
        data: priorities
      });
    } catch (error) {
      console.error('Error getting pattern priorities:', error);
      throw new AppError('Failed to get pattern priorities', 500, 'GET_PRIORITIES_ERROR');
    }
  }

  async updatePatternPriorities(req: Request, res: Response): Promise<Response> {
    try {
      const { priorities, framework, conflictResolution } = req.body;

      if (!priorities || !Array.isArray(priorities)) {
        throw new AppError('Priorities array is required', 400, 'MISSING_PRIORITIES');
      }

      // Validate priority values
      priorities.forEach(p => {
        if (!p.patternId || typeof p.priority !== 'number' || p.priority < 1) {
          throw new AppError('Each priority must have patternId and priority >= 1', 400, 'INVALID_PRIORITY');
        }
      });

      const updatedPriorities = {
        priorities,
        framework,
        conflictResolution,
        updatedAt: new Date().toISOString(),
        appliedTo: framework || 'global'
      };

      return res.json({
        success: true,
        data: updatedPriorities,
        message: 'Pattern priorities updated successfully'
      });
    } catch (error) {
      console.error('Error updating pattern priorities:', error);
      throw new AppError('Failed to update pattern priorities', 500, 'UPDATE_PRIORITIES_ERROR');
    }
  }

  async optimizePriorities(req: Request, res: Response): Promise<Response> {
    try {
      const { framework, dataProfile, optimizationGoal = 'balanced' } = req.body;

      // Mock optimization algorithm
      const optimization = {
        optimizationId: `opt-${Date.now()}`,
        framework,
        goal: optimizationGoal,
        dataProfile,
        optimizedPriorities: [
          { patternId: 'ssn-001', oldPriority: 3, newPriority: 1, reason: 'High sensitivity in data profile' },
          { patternId: 'email-001', oldPriority: 1, newPriority: 2, reason: 'Frequency optimization' },
          { patternId: 'phone-001', oldPriority: 2, newPriority: 3, reason: 'Performance consideration' }
        ],
        expectedImprovements: {
          performanceGain: '12%',
          accuracyIncrease: '5%',
          falsePositiveReduction: '18%'
        },
        recommendations: [
          'Apply optimized priorities for better performance',
          'Consider enabling additional patterns for comprehensive coverage',
          'Review priorities monthly based on data patterns'
        ]
      };

      return res.json({
        success: true,
        data: optimization
      });
    } catch (error) {
      console.error('Error optimizing priorities:', error);
      throw new AppError('Failed to optimize priorities', 500, 'OPTIMIZE_PRIORITIES_ERROR');
    }
  }

  // Helper methods
  private groupBy(array: any[], key: string): { [key: string]: number } {
    return array.reduce((result, item) => {
      const group = item[key];
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }

  private validateTestCases(regex: string, testCases: string[], invalidCases: string[]): any {
    const regexPattern = new RegExp(regex);
    
    const validResults = testCases.map(testCase => ({
      input: testCase,
      expected: true,
      actual: regexPattern.test(testCase),
      passed: regexPattern.test(testCase)
    }));

    const invalidResults = invalidCases.map(testCase => ({
      input: testCase,
      expected: false,
      actual: regexPattern.test(testCase),
      passed: !regexPattern.test(testCase)
    }));

    const allResults = [...validResults, ...invalidResults];
    const passedCount = allResults.filter(r => r.passed).length;

    return {
      totalTests: allResults.length,
      passedTests: passedCount,
      failedTests: allResults.length - passedCount,
      accuracy: allResults.length > 0 ? passedCount / allResults.length : 0,
      validCaseResults: validResults,
      invalidCaseResults: invalidResults
    };
  }

  private estimateProcessingTime(regex: string): number {
    // Simple heuristic for processing time estimation
    let complexity = 0;
    
    // Add complexity for various regex features
    if (regex.includes('*') || regex.includes('+')) complexity += 1;
    if (regex.includes('?')) complexity += 0.5;
    if (regex.includes('|')) complexity += 1;
    if (regex.includes('[')) complexity += 0.5;
    if (regex.includes('(')) complexity += 0.5;
    if (regex.includes('\\d') || regex.includes('\\w')) complexity += 0.2;
    
    // Base time + complexity factor
    return Math.round((0.5 + complexity * 0.3) * 100) / 100;
  }

  private calculateComplexityScore(regex: string): number {
    let score = 0;
    
    // Character classes
    score += (regex.match(/\[.*?\]/g) || []).length * 2;
    // Quantifiers
    score += (regex.match(/[*+?{]/g) || []).length * 3;
    // Groups
    score += (regex.match(/\(/g) || []).length * 2;
    // Alternation
    score += (regex.match(/\|/g) || []).length * 4;
    // Anchors
    score += (regex.match(/[\^$]/g) || []).length * 1;
    // Escapes
    score += (regex.match(/\\./g) || []).length * 1;
    
    return Math.min(100, score);
  }
}

export const patternsController = new PatternsController();