import { MultiFieldImpactAssessmentService } from '../multi-field-impact-assessment.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('MultiFieldImpactAssessmentService', () => {
  let impactAssessment: MultiFieldImpactAssessmentService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    } as any;
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    impactAssessment = new MultiFieldImpactAssessmentService();
  });

  describe('Cross-Field Impact Detection', () => {
    test('should detect correlations between multiple sentiment fields', async () => {
      // RED: This test should fail - MultiFieldImpactAssessmentService doesn't exist yet
      const mockSentimentData = [
        { customer_id: 'CUST-001', overall_sentiment: 0.8, feature_sentiment: 0.7, support_sentiment: 0.9, price_sentiment: 0.6 },
        { customer_id: 'CUST-002', overall_sentiment: 0.3, feature_sentiment: 0.4, support_sentiment: 0.2, price_sentiment: 0.3 },
        { customer_id: 'CUST-003', overall_sentiment: 0.6, feature_sentiment: 0.8, support_sentiment: 0.5, price_sentiment: 0.4 },
        { customer_id: 'CUST-004', overall_sentiment: 0.9, feature_sentiment: 0.9, support_sentiment: 0.8, price_sentiment: 0.7 },
        { customer_id: 'CUST-005', overall_sentiment: 0.2, feature_sentiment: 0.1, support_sentiment: 0.3, price_sentiment: 0.2 },
      ];

      mockDb.all.mockResolvedValue(mockSentimentData);

      const eventId = 'EVENT-001';
      const assessment = await impactAssessment.analyzeMultiFieldImpact(eventId, {
        primaryFields: ['overall_sentiment'],
        secondaryFields: ['feature_sentiment', 'support_sentiment', 'price_sentiment'],
        correlationThreshold: 0.5
      });

      expect(assessment).toHaveProperty('correlations');
      expect(assessment.correlations).toHaveProperty('overall_sentiment');
      expect(assessment.correlations.overall_sentiment.feature_sentiment).toBeGreaterThan(0.5);
      expect(assessment.correlations.overall_sentiment.support_sentiment).toBeGreaterThan(0.5);
      expect(assessment.impactStrength).toBe('strong');
    });

    test('should calculate cross-field correlation coefficients', async () => {
      // RED: This test should fail - correlation calculation not implemented
      const mockData = [
        { field_a: 0.8, field_b: 0.9 },
        { field_a: 0.6, field_b: 0.7 },
        { field_a: 0.4, field_b: 0.3 },
        { field_a: 0.2, field_b: 0.1 },
        { field_a: 0.9, field_b: 0.8 },
      ];

      mockDb.all.mockResolvedValue(mockData);

      const correlation = await impactAssessment.calculateFieldCorrelation('field_a', 'field_b', 'EVENT-001');

      expect(correlation.coefficient).toBeCloseTo(0.95, 1); // Strong positive correlation
      expect(correlation.pValue).toBeLessThan(0.05); // Statistically significant
      expect(correlation.significance).toBe('significant');
      expect(correlation.sampleSize).toBe(5);
    });

    test('should identify field interaction patterns', async () => {
      // RED: This test should fail - interaction pattern detection not implemented
      const mockInteractionData = [
        { customer_id: 'CUST-001', price_sentiment: 0.9, feature_sentiment: 0.8, overall_sentiment: 0.85 },
        { customer_id: 'CUST-002', price_sentiment: 0.2, feature_sentiment: 0.9, overall_sentiment: 0.6 },
        { customer_id: 'CUST-003', price_sentiment: 0.8, feature_sentiment: 0.3, overall_sentiment: 0.5 },
        { customer_id: 'CUST-004', price_sentiment: 0.1, feature_sentiment: 0.1, overall_sentiment: 0.1 },
      ];

      mockDb.all.mockResolvedValue(mockInteractionData);

      const patterns = await impactAssessment.detectInteractionPatterns('EVENT-001', {
        fields: ['price_sentiment', 'feature_sentiment'],
        targetField: 'overall_sentiment',
        interactionTypes: ['multiplicative', 'additive', 'dominant']
      });

      expect(patterns).toHaveProperty('bestModel');
      expect(patterns.models).toHaveProperty('multiplicative');
      expect(patterns.models).toHaveProperty('additive');
      expect(patterns.bestModel.rsquared).toBeGreaterThan(0.5);
      expect(['multiplicative', 'additive', 'dominant']).toContain(patterns.bestModel.type);
    });
  });

  describe('Field Dependency Analysis', () => {
    test('should calculate field dependency strength', async () => {
      // RED: This test should fail - dependency analysis not implemented
      const mockDependencyData = [
        { support_sentiment: 0.9, overall_sentiment: 0.8 },
        { support_sentiment: 0.1, overall_sentiment: 0.2 },
        { support_sentiment: 0.7, overall_sentiment: 0.7 },
        { support_sentiment: 0.3, overall_sentiment: 0.4 },
        { support_sentiment: 0.8, overall_sentiment: 0.9 },
      ];

      mockDb.all.mockResolvedValue(mockDependencyData);

      const dependency = await impactAssessment.analyzeDependencyStrength('support_sentiment', 'overall_sentiment', 'EVENT-001');

      expect(dependency.dependencyScore).toBeGreaterThan(0.7); // Strong dependency
      expect(dependency.direction).toBe('positive');
      expect(dependency.confidence).toBeGreaterThan(0.8);
      expect(dependency.mutualInformation).toBeDefined();
      expect(dependency.conditionalEntropy).toBeDefined();
    });

    test('should identify causal direction between fields', async () => {
      // RED: This test should fail - causal direction analysis not implemented
      const mockCausalData = [
        { timestamp: '2024-01-01', feature_sentiment: 0.8, overall_sentiment: 0.7 },
        { timestamp: '2024-01-02', feature_sentiment: 0.6, overall_sentiment: 0.8 },
        { timestamp: '2024-01-03', feature_sentiment: 0.4, overall_sentiment: 0.6 },
        { timestamp: '2024-01-04', feature_sentiment: 0.2, overall_sentiment: 0.4 },
        { timestamp: '2024-01-05', feature_sentiment: 0.9, overall_sentiment: 0.2 },
      ];

      mockDb.all.mockResolvedValue(mockCausalData);

      const causalAnalysis = await impactAssessment.analyzeCausalDirection('feature_sentiment', 'overall_sentiment', 'EVENT-001');

      expect(causalAnalysis).toHaveProperty('direction');
      expect(['x_causes_y', 'y_causes_x', 'bidirectional', 'independent']).toContain(causalAnalysis.direction);
      expect(causalAnalysis.grangerCausality).toBeDefined();
      expect(causalAnalysis.lagEffect).toBeDefined();
      expect(causalAnalysis.confidence).toBeGreaterThan(0.0);
    });

    test('should detect field hierarchy relationships', async () => {
      // RED: This test should fail - hierarchy detection not implemented
      const mockHierarchyData = [
        { overall: 0.8, category_a: 0.9, subcategory_a1: 0.95, subcategory_a2: 0.85 },
        { overall: 0.6, category_a: 0.7, subcategory_a1: 0.75, subcategory_a2: 0.65 },
        { overall: 0.4, category_a: 0.3, subcategory_a1: 0.35, subcategory_a2: 0.25 },
        { overall: 0.2, category_a: 0.1, subcategory_a1: 0.15, subcategory_a2: 0.05 },
      ];

      mockDb.all.mockResolvedValue(mockHierarchyData);

      const hierarchy = await impactAssessment.detectFieldHierarchy('EVENT-001', {
        candidateFields: ['overall', 'category_a', 'subcategory_a1', 'subcategory_a2'],
        hierarchyTypes: ['aggregation', 'composition', 'specialization']
      });

      expect(hierarchy.levels).toBeDefined();
      expect(hierarchy.relationships).toBeDefined();
      expect(hierarchy.aggregationFlow).toContain('subcategory_a1');
      expect(hierarchy.aggregationFlow).toContain('subcategory_a2');
      expect(hierarchy.aggregationFlow).toContain('category_a');
      expect(hierarchy.aggregationFlow).toContain('overall');
      expect(hierarchy.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Multi-Dimensional Impact Scoring', () => {
    test('should calculate composite impact scores across fields', async () => {
      // RED: This test should fail - composite scoring not implemented
      const mockMultiFieldData = [
        { 
          customer_id: 'CUST-001', 
          satisfaction: 0.8, 
          loyalty: 0.9, 
          engagement: 0.7,
          before_satisfaction: 0.9,
          before_loyalty: 0.95,
          before_engagement: 0.85
        },
        { 
          customer_id: 'CUST-003', 
          satisfaction: 0.7, 
          loyalty: 0.8, 
          engagement: 0.6,
          before_satisfaction: 0.85,
          before_loyalty: 0.9,
          before_engagement: 0.8
        },
        { 
          customer_id: 'CUST-002', 
          satisfaction: 0.3, 
          loyalty: 0.2, 
          engagement: 0.4,
          before_satisfaction: 0.8,
          before_loyalty: 0.7,
          before_engagement: 0.9
        },
      ];

      mockDb.all.mockResolvedValue(mockMultiFieldData);

      const compositeScore = await impactAssessment.calculateCompositeImpactScore('EVENT-001', {
        fields: [
          { name: 'satisfaction', weight: 0.4 },
          { name: 'loyalty', weight: 0.4 },
          { name: 'engagement', weight: 0.2 }
        ],
        aggregationMethod: 'weighted_average',
        includeDelta: true
      });

      expect(compositeScore.overallScore).toBeLessThan(0); // Negative impact
      expect(compositeScore.fieldContributions).toHaveProperty('satisfaction');
      expect(compositeScore.fieldContributions).toHaveProperty('loyalty');
      expect(compositeScore.fieldContributions).toHaveProperty('engagement');
      expect(compositeScore.impactMagnitude).toBe('moderate');
      expect(compositeScore.confidence).toBeGreaterThan(0.8);
    });

    test('should weight field importance based on correlation strength', async () => {
      // RED: This test should fail - weighted importance not implemented
      const mockWeightingData = [
        { primary_kpi: 0.8, field_a: 0.9, field_b: 0.3, field_c: 0.7 },
        { primary_kpi: 0.6, field_a: 0.7, field_b: 0.2, field_c: 0.5 },
        { primary_kpi: 0.4, field_a: 0.3, field_b: 0.8, field_c: 0.4 },
        { primary_kpi: 0.2, field_a: 0.1, field_b: 0.9, field_c: 0.2 },
      ];

      mockDb.all.mockResolvedValue(mockWeightingData);

      const weights = await impactAssessment.calculateAdaptiveWeights('EVENT-001', {
        primaryKpi: 'primary_kpi',
        candidateFields: ['field_a', 'field_b', 'field_c'],
        weightingMethod: 'correlation_strength'
      });

      expect(weights.field_a).toBeGreaterThan(weights.field_b); // field_a more correlated
      expect(weights.field_c).toBeGreaterThan(weights.field_b); // field_c more correlated
      expect(Math.abs(weights.field_a + weights.field_b + weights.field_c - 1.0)).toBeLessThan(0.01); // Sum to 1
      expect(weights.correlationEvidence).toBeDefined();
    });

    test('should identify field clusters and interactions', async () => {
      // RED: This test should fail - clustering not implemented
      const mockClusterData = [
        { ux_score: 0.8, ui_score: 0.9, usability: 0.85, performance: 0.3, speed: 0.2, reliability: 0.4 },
        { ux_score: 0.6, ui_score: 0.7, usability: 0.65, performance: 0.8, speed: 0.9, reliability: 0.7 },
        { ux_score: 0.4, ui_score: 0.3, usability: 0.35, performance: 0.6, speed: 0.5, reliability: 0.7 },
        { ux_score: 0.2, ui_score: 0.1, usability: 0.15, performance: 0.9, speed: 0.8, reliability: 0.9 },
      ];

      mockDb.all.mockResolvedValue(mockClusterData);

      const clusters = await impactAssessment.identifyFieldClusters('EVENT-001', {
        fields: ['ux_score', 'ui_score', 'usability', 'performance', 'speed', 'reliability'],
        clusteringMethod: 'correlation_based',
        minClusterSize: 2
      });

      expect(clusters.clusters.length).toBeGreaterThanOrEqual(1); // At least one cluster
      expect(clusters.clusters[0].fields).toContain('ux_score');
      expect(clusters.clusters[0].fields).toContain('ui_score');
      if (clusters.clusters.length > 1) {
        expect(clusters.clusters[1].fields).toContain('performance');
        expect(clusters.clusters[1].fields).toContain('speed');
      }
      expect(clusters.interClusterCorrelations).toBeDefined();
    });
  });

  describe('Temporal Field Analysis', () => {
    test('should analyze field evolution over time windows', async () => {
      // RED: This test should fail - temporal analysis not implemented
      const mockTemporalData = [
        { time_window: 'pre_event', overall_sentiment: 0.8, feature_sentiment: 0.7, support_sentiment: 0.9 },
        { time_window: 'during_event', overall_sentiment: 0.4, feature_sentiment: 0.3, support_sentiment: 0.5 },
        { time_window: 'post_event_1d', overall_sentiment: 0.5, feature_sentiment: 0.4, support_sentiment: 0.6 },
        { time_window: 'post_event_3d', overall_sentiment: 0.6, feature_sentiment: 0.5, support_sentiment: 0.7 },
        { time_window: 'post_event_7d', overall_sentiment: 0.7, feature_sentiment: 0.6, support_sentiment: 0.8 },
      ];

      mockDb.all.mockResolvedValue(mockTemporalData);

      const evolution = await impactAssessment.analyzeFieldEvolution('EVENT-001', {
        fields: ['overall_sentiment', 'feature_sentiment', 'support_sentiment'],
        timeWindows: ['pre_event', 'during_event', 'post_event_1d', 'post_event_3d', 'post_event_7d'],
        recoveryThreshold: 0.8
      });

      expect(evolution.recoveryPatterns).toBeDefined();
      expect(evolution.recoveryPatterns.overall_sentiment.isRecovering).toBe(true);
      expect(evolution.recoveryPatterns.overall_sentiment.recoveryRate).toBeGreaterThan(0);
      expect(evolution.fieldSynchronization).toBeDefined();
      expect(evolution.temporalCorrelations).toBeDefined();
    });

    test('should detect lagged field responses', async () => {
      // RED: This test should fail - lag detection not implemented
      const mockLagData = [
        { day: 1, primary_field: 0.9, lagged_field: 0.8 },
        { day: 2, primary_field: 0.8, lagged_field: 0.9 },
        { day: 3, primary_field: 0.4, lagged_field: 0.8 },
        { day: 4, primary_field: 0.2, lagged_field: 0.4 },
        { day: 5, primary_field: 0.6, lagged_field: 0.2 },
        { day: 6, primary_field: 0.8, lagged_field: 0.6 },
      ];

      mockDb.all.mockResolvedValue(mockLagData);

      const lagAnalysis = await impactAssessment.detectFieldLags('EVENT-001', {
        leadingField: 'primary_field',
        laggingField: 'lagged_field',
        maxLag: 3,
        minCorrelation: 0.5
      });

      expect(lagAnalysis.optimalLag).toBe(1); // 1 day lag
      expect(lagAnalysis.lagCorrelation).toBeGreaterThan(0.8);
      expect(lagAnalysis.isSignificant).toBe(true);
      expect(lagAnalysis.lagStrength).toBe('strong');
    });
  });

  describe('Statistical Validation', () => {
    test('should validate multi-field statistical significance', async () => {
      // RED: This test should fail - statistical validation not implemented
      const mockValidationData = [
        { id: 1, field_a: 0.8, field_b: 0.9, field_c: 0.7 },
        { id: 2, field_a: 0.6, field_b: 0.7, field_c: 0.5 },
        { id: 3, field_a: 0.4, field_b: 0.3, field_c: 0.6 },
        { id: 4, field_a: 0.2, field_b: 0.1, field_c: 0.3 },
        { id: 5, field_a: 0.9, field_b: 0.8, field_c: 0.8 },
      ];

      mockDb.all.mockResolvedValue(mockValidationData);

      const validation = await impactAssessment.validateMultiFieldSignificance('EVENT-001', {
        fields: ['field_a', 'field_b', 'field_c'],
        testType: 'multivariate_anova',
        alpha: 0.05,
        corrections: ['bonferroni', 'fdr']
      });

      expect(validation.overallSignificance).toBeDefined();
      expect(validation.pairwiseTests).toBeDefined();
      expect(validation.effectSizes).toBeDefined();
      expect(validation.corrections.bonferroni).toBeDefined();
      expect(validation.corrections.fdr).toBeDefined();
      expect(validation.powerAnalysis).toBeDefined();
    });

    test('should handle missing data and outliers in multi-field analysis', async () => {
      // RED: This test should fail - robust analysis not implemented
      const mockRobustData = [
        { customer_id: 'CUST-001', field_a: 0.5, field_b: 0.5, field_c: null },
        { customer_id: 'CUST-002', field_a: null, field_b: 0.5, field_c: 0.5 },
        { customer_id: 'CUST-003', field_a: 0.5, field_b: 0.5, field_c: 0.5 },
        { customer_id: 'CUST-004', field_a: 2.5, field_b: 0.5, field_c: 0.5 }, // Clear outlier
        { customer_id: 'CUST-005', field_a: 0.5, field_b: 0.5, field_c: 0.5 },
      ];

      mockDb.all.mockResolvedValue(mockRobustData);

      const robustAnalysis = await impactAssessment.performRobustMultiFieldAnalysis('EVENT-001', {
        fields: ['field_a', 'field_b', 'field_c'],
        missingDataStrategy: 'pairwise_deletion',
        outlierDetection: 'iqr',
        outlierHandling: 'winsorize'
      });

      expect(robustAnalysis.cleanedDataCount).toBeGreaterThanOrEqual(3); // After handling missing/outliers
      expect(robustAnalysis.outlierCount).toBeGreaterThanOrEqual(0);
      expect(robustAnalysis.missingDataReport).toBeDefined();
      expect(robustAnalysis.robustCorrelations).toBeDefined();
      expect(robustAnalysis.dataQualityScore).toBeGreaterThan(0.5);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});