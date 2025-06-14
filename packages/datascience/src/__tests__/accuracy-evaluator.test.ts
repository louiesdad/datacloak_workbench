import { AccuracyEvaluator, GroundTruth } from '../benchmarks/accuracy-evaluator';
import { InferenceResult } from '../types';

describe('AccuracyEvaluator Additional Tests', () => {
  describe('Confusion Matrix Building', () => {
    test('builds confusion matrix with multiple types', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'field1',
          inferredType: 'string',
          confidence: 0.9,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'field2',
          inferredType: 'number',
          confidence: 0.8,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'field3',
          inferredType: 'email',
          confidence: 0.95,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'field1', actualType: 'string' },
        { fieldName: 'field2', actualType: 'number' },
        { fieldName: 'field3', actualType: 'email' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1Score).toBe(1.0);
      expect(metrics.confusionMatrix.totalPredictions).toBe(3);
      expect(metrics.confusionMatrix.matrix['string']['string']).toBe(1);
      expect(metrics.confusionMatrix.matrix['number']['number']).toBe(1);
      expect(metrics.confusionMatrix.matrix['email']['email']).toBe(1);
    });

    test('handles mixed correct and incorrect predictions', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'correct1',
          inferredType: 'string',
          confidence: 0.9,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'incorrect1',
          inferredType: 'string', // Wrong - should be number
          confidence: 0.7,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'correct2',
          inferredType: 'email',
          confidence: 0.95,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'correct1', actualType: 'string' },
        { fieldName: 'incorrect1', actualType: 'number' },
        { fieldName: 'correct2', actualType: 'email' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      expect(metrics.accuracy).toBeCloseTo(2/3, 2);
      expect(metrics.confusionMatrix.matrix['number']['string']).toBe(1); // False negative
      expect(metrics.typeSpecificMetrics['string'].falsePositives).toBe(1);
      expect(metrics.typeSpecificMetrics['number'].falseNegatives).toBe(1);
    });
  });

  describe('Type-Specific Metrics', () => {
    test('calculates precision, recall, and F1 for each type', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'string1',
          inferredType: 'string',
          confidence: 0.9,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'string2',
          inferredType: 'string',
          confidence: 0.8,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'number1',
          inferredType: 'string', // Wrong prediction
          confidence: 0.6,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'string1', actualType: 'string' },
        { fieldName: 'string2', actualType: 'string' },
        { fieldName: 'number1', actualType: 'number' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      const stringMetrics = metrics.typeSpecificMetrics['string'];
      expect(stringMetrics.truePositives).toBe(2);
      expect(stringMetrics.falsePositives).toBe(1);
      expect(stringMetrics.falseNegatives).toBe(0);
      expect(stringMetrics.precision).toBeCloseTo(2/3, 2);
      expect(stringMetrics.recall).toBe(1.0);

      const numberMetrics = metrics.typeSpecificMetrics['number'];
      expect(numberMetrics.truePositives).toBe(0);
      expect(numberMetrics.falsePositives).toBe(0);
      expect(numberMetrics.falseNegatives).toBe(1);
      expect(numberMetrics.precision).toBe(0);
      expect(numberMetrics.recall).toBe(0);
    });
  });

  describe('Confidence Analysis', () => {
    test('analyzes confidence levels for correct vs incorrect predictions', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'high_conf_correct',
          inferredType: 'string',
          confidence: 0.9, // High confidence, correct
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'low_conf_correct',
          inferredType: 'number',
          confidence: 0.6, // Low confidence, correct
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'high_conf_wrong',
          inferredType: 'string',
          confidence: 0.8, // High confidence, wrong
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'low_conf_wrong',
          inferredType: 'number',
          confidence: 0.5, // Low confidence, wrong
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'high_conf_correct', actualType: 'string' },
        { fieldName: 'low_conf_correct', actualType: 'number' },
        { fieldName: 'high_conf_wrong', actualType: 'email' },
        { fieldName: 'low_conf_wrong', actualType: 'boolean' }
      ];

      const confidenceAnalysis = AccuracyEvaluator.compareConfidence(predictions, groundTruth);

      expect(confidenceAnalysis.correctHighConfidence).toBe(1); // high_conf_correct
      expect(confidenceAnalysis.correctLowConfidence).toBe(1); // low_conf_correct
      expect(confidenceAnalysis.incorrectHighConfidence).toBe(1); // high_conf_wrong
      expect(confidenceAnalysis.incorrectLowConfidence).toBe(1); // low_conf_wrong
      expect(confidenceAnalysis.averageConfidenceCorrect).toBe(0.75); // (0.9 + 0.6) / 2
      expect(confidenceAnalysis.averageConfidenceIncorrect).toBe(0.65); // (0.8 + 0.5) / 2
    });

    test('handles edge case with no correct predictions', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'wrong1',
          inferredType: 'string',
          confidence: 0.8,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'wrong1', actualType: 'number' }
      ];

      const confidenceAnalysis = AccuracyEvaluator.compareConfidence(predictions, groundTruth);

      expect(confidenceAnalysis.correctHighConfidence).toBe(0);
      expect(confidenceAnalysis.correctLowConfidence).toBe(0);
      expect(confidenceAnalysis.averageConfidenceCorrect).toBe(0);
      expect(confidenceAnalysis.averageConfidenceIncorrect).toBe(0.8);
    });
  });

  describe('Multiple Evaluations', () => {
    test('evaluates multiple benchmark cases', async () => {
      const benchmarkCases = [
        {
          dataset: {
            name: 'test1',
            fields: { field1: ['test'] },
            metadata: {}
          },
          groundTruth: [{ fieldName: 'field1', actualType: 'string' as const }],
          name: 'case1',
          description: 'Test case 1'
        },
        {
          dataset: {
            name: 'test2',
            fields: { field2: [123] },
            metadata: {}
          },
          groundTruth: [{ fieldName: 'field2', actualType: 'number' as const }],
          name: 'case2',
          description: 'Test case 2'
        }
      ];

      const mockInferenceFunction = async (dataset: any) => {
        return Object.keys(dataset.fields).map(fieldName => ({
          fieldName,
          inferredType: fieldName === 'field1' ? 'string' as const : 'number' as const,
          confidence: 1.0,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }));
      };

      const results = await AccuracyEvaluator.evaluateMultiple(benchmarkCases, mockInferenceFunction);

      expect(results).toHaveLength(2);
      expect(results[0].accuracy).toBe(1.0);
      expect(results[1].accuracy).toBe(1.0);
    });
  });

  describe('Edge Cases', () => {
    test('handles predictions with no matching ground truth fields', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'nonexistent',
          inferredType: 'string',
          confidence: 0.9,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'different_field', actualType: 'string' }
      ];

      expect(() => {
        AccuracyEvaluator.evaluate(predictions, groundTruth);
      }).toThrow('No matching predictions found for ground truth');
    });

    test('handles empty predictions and ground truth', () => {
      expect(() => {
        AccuracyEvaluator.evaluate([], []);
      }).toThrow('No matching predictions found for ground truth');
    });
  });
});