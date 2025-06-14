import { BenchmarkReporter, AccuracyResult } from '../benchmarks/reporter';
import { AccuracyMetrics, TypeMetrics } from '../benchmarks/accuracy-evaluator';
import { BenchmarkProfile } from '../benchmarks/performance-profiler';
import { FieldType } from '../types';

describe('BenchmarkReporter Isolated Tests', () => {
  describe('CSV Export', () => {
    test('exports accuracy results to CSV format', () => {
      const mockMatrix: Record<FieldType, Record<FieldType, number>> = {
        'string': { 'string': 8, 'number': 1, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'number': { 'string': 0, 'number': 1, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'boolean': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'date': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'email': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'url': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'phone': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'json': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'array': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'object': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'null': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'undefined': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 },
        'mixed': { 'string': 0, 'number': 0, 'boolean': 0, 'date': 0, 'email': 0, 'url': 0, 'phone': 0, 'json': 0, 'array': 0, 'object': 0, 'null': 0, 'undefined': 0, 'mixed': 0 }
      };

      const mockTypeMetrics: Record<FieldType, TypeMetrics> = {
        'string': { truePositives: 8, falsePositives: 0, falseNegatives: 1, precision: 1.0, recall: 0.89, f1Score: 0.94 },
        'number': { truePositives: 1, falsePositives: 1, falseNegatives: 0, precision: 0.5, recall: 1.0, f1Score: 0.67 },
        'boolean': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'date': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'email': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'url': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'phone': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'json': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'array': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'object': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'null': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'undefined': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 },
        'mixed': { truePositives: 0, falsePositives: 0, falseNegatives: 0, precision: 0, recall: 0, f1Score: 0 }
      };

      const accuracyResults: AccuracyResult[] = [
        {
          testName: 'Test 1',
          metrics: {
            accuracy: 0.9,
            precision: 0.85,
            recall: 0.88,
            f1Score: 0.865,
            confusionMatrix: { matrix: mockMatrix, totalPredictions: 10 },
            typeSpecificMetrics: mockTypeMetrics
          },
          passed: true,
          threshold: 0.8
        }
      ];

      const csv = BenchmarkReporter.exportToCsv(accuracyResults);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toContain('Test Name');
      expect(lines[1]).toContain('Test 1');
      expect(lines[1]).toContain('0.9000');
    });
  });

  describe('Report Generation', () => {
    test('generates benchmark report with empty results', () => {
      const report = BenchmarkReporter.generateReport([], []);
      
      expect(report.timestamp).toBeDefined();
      expect(report.summary.totalTests).toBe(0);
      expect(report.summary.passedTests).toBe(0);
      expect(report.accuracyResults).toHaveLength(0);
      expect(report.performanceResults).toHaveLength(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('JSON Export', () => {
    test('exports report to JSON string', () => {
      const report = {
        timestamp: '2024-01-01T00:00:00.000Z',
        summary: {
          totalTests: 1,
          passedTests: 1,
          failedTests: 0,
          averageAccuracy: 0.9,
          averageExecutionTime: 100,
          totalExecutionTime: 500
        },
        accuracyResults: [],
        performanceResults: [],
        recommendations: []
      };

      const json = BenchmarkReporter.exportToJson(report);
      const parsed = JSON.parse(json);

      expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(parsed.summary.averageAccuracy).toBe(0.9);
    });
  });
});