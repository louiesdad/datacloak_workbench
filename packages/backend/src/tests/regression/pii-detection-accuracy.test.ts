import { enhancedDataCloak, ComplianceFramework } from '../../services/enhanced-datacloak.service';
import { dataCloak } from '../../services/datacloak.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PII Detection Accuracy - Regression Testing', () => {
  let tempDir: string;
  
  // Baseline accuracy metrics that tests should maintain or exceed
  const BASELINE_METRICS = {
    overall_accuracy: 0.85,
    precision: 0.90,
    recall: 0.80,
    f1_score: 0.85,
    false_positive_rate: 0.10,
    false_negative_rate: 0.20
  };

  // Test datasets with known ground truth
  const GROUND_TRUTH_DATASETS = {
    emails: {
      positive: [
        'Contact us at support@company.com for assistance',
        'Send reports to admin@domain.org immediately',
        'User email: user.name@subdomain.company.co.uk',
        'Reach out to info@startup.io for more details',
        'Personal email: firstname.lastname@gmail.com'
      ],
      negative: [
        'The company@domain format is invalid',
        'Use the format user at domain dot com',
        'Email missing @ symbol: userdomain.com',
        'Invalid: user@.com or @domain.com',
        'Not an email: user@domain'
      ]
    },
    phones: {
      positive: [
        'Call us at (555) 123-4567 during business hours',
        'Emergency contact: 555-987-6543',
        'International: +1-555-234-5678',
        'Toll free: 1-800-555-0123',
        'Extension: 555.123.4567 ext 890'
      ],
      negative: [
        'Reference number: 555-12-3456 (too short)',
        'Invalid: 555-1234 (incomplete)',
        'Not a phone: 555-12-34567 (too long)',
        'Wrong format: 55-123-4567',
        'Text: call five five five one two three four'
      ]
    },
    ssn: {
      positive: [
        'SSN: 123-45-6789 on file',
        'Social Security Number 987-65-4321',
        'Tax ID: 456-78-9012',
        'Employee SSN 234-56-7890',
        'Patient SSN: 345-67-8901'
      ],
      negative: [
        'Invalid SSN: 123-45-67890 (too long)',
        'Wrong format: 12-345-6789',
        'Not SSN: 123-456-789 (missing digit)',
        'Invalid: 000-00-0000 (all zeros)',
        'Text: one two three four five six seven eight nine'
      ]
    },
    credit_cards: {
      positive: [
        'Credit card: 4532-1234-5678-9012',
        'Payment card 5555444433332222',
        'Card number: 4111 1111 1111 1111',
        'Visa: 4532123456789012',
        'MasterCard: 5555-4444-3333-2222'
      ],
      negative: [
        'Invalid card: 4532-1234-5678 (too short)',
        'Wrong: 4532-1234-5678-90123 (too long)',
        'Not a card: 1234-5678-9012-3456 (wrong prefix)',
        'Invalid: 0000-0000-0000-0000',
        'Text: four five three two one two three four'
      ]
    },
    medical: {
      positive: [
        'Medical Record Number: MRN123456',
        'Patient ID: MED789012',
        'Hospital ID: HOSP4567',
        'Medical file: MRN-987654',
        'Healthcare ID: HC123456789'
      ],
      negative: [
        'Invalid MRN: MRN (missing numbers)',
        'Wrong: MED-ABC123 (contains letters)',
        'Not medical: ID123456 (generic)',
        'Invalid: MRN000000 (all zeros)',
        'Text: medical record number'
      ]
    }
  };

  beforeAll(async () => {
    await enhancedDataCloak.initialize();
    await dataCloak.initialize();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pii-regression-test-'));
  });

  afterAll(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  beforeEach(async () => {
    await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GENERAL);
    await enhancedDataCloak.updateConfidenceThreshold(0.8);
  });

  describe('Baseline PII Detection Accuracy', () => {
    it('should maintain email detection accuracy above baseline', async () => {
      const { positive, negative } = GROUND_TRUTH_DATASETS.emails;
      
      // Test positive cases (should detect)
      const positiveResults = await Promise.all(
        positive.map(text => dataCloak.detectPII(text))
      );
      
      const truePositives = positiveResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('email'))
      ).length;
      
      // Test negative cases (should not detect)
      const negativeResults = await Promise.all(
        negative.map(text => dataCloak.detectPII(text))
      );
      
      const falsePositives = negativeResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('email'))
      ).length;
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / positive.length;
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      expect(precision).toBeGreaterThanOrEqual(BASELINE_METRICS.precision);
      expect(recall).toBeGreaterThanOrEqual(BASELINE_METRICS.recall);
      expect(f1Score).toBeGreaterThanOrEqual(BASELINE_METRICS.f1_score);
      
      console.log(`Email Detection - Precision: ${precision.toFixed(3)}, Recall: ${recall.toFixed(3)}, F1: ${f1Score.toFixed(3)}`);
    });

    it('should maintain phone number detection accuracy above baseline', async () => {
      const { positive, negative } = GROUND_TRUTH_DATASETS.phones;
      
      const positiveResults = await Promise.all(
        positive.map(text => dataCloak.detectPII(text))
      );
      
      const truePositives = positiveResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('phone'))
      ).length;
      
      const negativeResults = await Promise.all(
        negative.map(text => dataCloak.detectPII(text))
      );
      
      const falsePositives = negativeResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('phone'))
      ).length;
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / positive.length;
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      expect(precision).toBeGreaterThanOrEqual(BASELINE_METRICS.precision);
      expect(recall).toBeGreaterThanOrEqual(BASELINE_METRICS.recall);
      expect(f1Score).toBeGreaterThanOrEqual(BASELINE_METRICS.f1_score);
      
      console.log(`Phone Detection - Precision: ${precision.toFixed(3)}, Recall: ${recall.toFixed(3)}, F1: ${f1Score.toFixed(3)}`);
    });

    it('should maintain SSN detection accuracy above baseline', async () => {
      const { positive, negative } = GROUND_TRUTH_DATASETS.ssn;
      
      const positiveResults = await Promise.all(
        positive.map(text => dataCloak.detectPII(text))
      );
      
      const truePositives = positiveResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('ssn') || pii.piiType.toLowerCase().includes('social'))
      ).length;
      
      const negativeResults = await Promise.all(
        negative.map(text => dataCloak.detectPII(text))
      );
      
      const falsePositives = negativeResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('ssn') || pii.piiType.toLowerCase().includes('social'))
      ).length;
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / positive.length;
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      expect(precision).toBeGreaterThanOrEqual(BASELINE_METRICS.precision);
      expect(recall).toBeGreaterThanOrEqual(BASELINE_METRICS.recall);
      expect(f1Score).toBeGreaterThanOrEqual(BASELINE_METRICS.f1_score);
      
      console.log(`SSN Detection - Precision: ${precision.toFixed(3)}, Recall: ${recall.toFixed(3)}, F1: ${f1Score.toFixed(3)}`);
    });

    it('should maintain credit card detection accuracy above baseline', async () => {
      const { positive, negative } = GROUND_TRUTH_DATASETS.credit_cards;
      
      const positiveResults = await Promise.all(
        positive.map(text => dataCloak.detectPII(text))
      );
      
      const truePositives = positiveResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('credit') || pii.piiType.toLowerCase().includes('card'))
      ).length;
      
      const negativeResults = await Promise.all(
        negative.map(text => dataCloak.detectPII(text))
      );
      
      const falsePositives = negativeResults.filter(result => 
        result.some((pii: any) => pii.piiType.toLowerCase().includes('credit') || pii.piiType.toLowerCase().includes('card'))
      ).length;
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / positive.length;
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      expect(precision).toBeGreaterThanOrEqual(BASELINE_METRICS.precision);
      expect(recall).toBeGreaterThanOrEqual(BASELINE_METRICS.recall);
      expect(f1Score).toBeGreaterThanOrEqual(BASELINE_METRICS.f1_score);
      
      console.log(`Credit Card Detection - Precision: ${precision.toFixed(3)}, Recall: ${recall.toFixed(3)}, F1: ${f1Score.toFixed(3)}`);
    });
  });

  describe('Enhanced DataCloak Accuracy Regression', () => {
    it('should maintain enhanced PII detection accuracy with custom patterns', async () => {
      await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.HIPAA);
      
      const { positive, negative } = GROUND_TRUTH_DATASETS.medical;
      
      const positiveResults = await Promise.all(
        positive.map(text => enhancedDataCloak.enhancedPIIDetection(text))
      );
      
      const truePositives = positiveResults.filter(result => 
        result.some((pii: any) => 
          pii.piiType.toLowerCase().includes('medical') || 
          pii.piiType.toLowerCase().includes('mrn') ||
          pii.piiType.toLowerCase().includes('healthcare')
        )
      ).length;
      
      const negativeResults = await Promise.all(
        negative.map(text => enhancedDataCloak.enhancedPIIDetection(text))
      );
      
      const falsePositives = negativeResults.filter(result => 
        result.some((pii: any) => 
          pii.piiType.toLowerCase().includes('medical') || 
          pii.piiType.toLowerCase().includes('mrn') ||
          pii.piiType.toLowerCase().includes('healthcare')
        )
      ).length;
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / positive.length;
      const f1Score = 2 * (precision * recall) / (precision + recall);
      
      expect(precision).toBeGreaterThanOrEqual(BASELINE_METRICS.precision);
      expect(recall).toBeGreaterThanOrEqual(BASELINE_METRICS.recall);
      expect(f1Score).toBeGreaterThanOrEqual(BASELINE_METRICS.f1_score);
      
      console.log(`Enhanced Medical Detection - Precision: ${precision.toFixed(3)}, Recall: ${recall.toFixed(3)}, F1: ${f1Score.toFixed(3)}`);
    });

    it('should maintain consistency across different compliance frameworks', async () => {
      const testText = 'User: john@company.com, Phone: 555-123-4567, SSN: 123-45-6789';
      const frameworks = [
        ComplianceFramework.GENERAL,
        ComplianceFramework.HIPAA,
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.GDPR
      ];

      const frameworkResults = [];
      
      for (const framework of frameworks) {
        await enhancedDataCloak.updateComplianceFramework(framework);
        const result = await enhancedDataCloak.enhancedPIIDetection(testText);
        frameworkResults.push({ framework, detectionCount: result.length });
      }

      // All frameworks should detect core PII types consistently
      const detectionCounts = frameworkResults.map(r => r.detectionCount);
      const minDetections = Math.min(...detectionCounts);
      const maxDetections = Math.max(...detectionCounts);
      
      // Variance in detection count should be reasonable (within 50%)
      const variance = ((maxDetections - minDetections) / minDetections) * 100;
      expect(variance).toBeLessThan(50);
      
      console.log('Framework Detection Consistency:', frameworkResults);
    });
  });

  describe('Pattern Performance Regression', () => {
    it('should maintain pattern matching performance within acceptable bounds', async () => {
      const testTexts = Array.from({ length: 1000 }, (_, i) => 
        `Record ${i}: email${i}@company.com, phone: 555-${String(i).padStart(3, '0')}-${String(i % 10000).padStart(4, '0')}`
      );

      const startTime = Date.now();
      const results = await Promise.all(
        testTexts.map(text => dataCloak.detectPII(text))
      );
      const endTime = Date.now();

      const totalDetections = results.reduce((sum, result) => sum + result.length, 0);
      const processingTime = endTime - startTime;
      const throughput = (testTexts.length / processingTime) * 1000; // records per second

      // Performance regression thresholds
      expect(processingTime).toBeLessThan(10000); // < 10 seconds for 1000 records
      expect(throughput).toBeGreaterThan(100); // > 100 records/second
      expect(totalDetections).toBeGreaterThan(1500); // Should detect at least 1.5 PII per record on average

      console.log(`Performance - Time: ${processingTime}ms, Throughput: ${throughput.toFixed(0)} rec/sec, Detections: ${totalDetections}`);
    });

    it('should maintain custom pattern performance within acceptable bounds', async () => {
      // Add several custom patterns
      const patternIds = [];
      
      for (let i = 0; i < 10; i++) {
        const id = await enhancedDataCloak.addCustomPattern({
          name: `Test Pattern ${i}`,
          pattern: `TEST${i}[0-9]{6}`,
          confidence: 0.8,
          risk_level: 'medium',
          compliance_frameworks: [ComplianceFramework.GENERAL],
          description: `Test pattern number ${i}`,
          enabled: true,
          priority: 50
        });
        patternIds.push(id);
      }

      const testTexts = Array.from({ length: 500 }, (_, i) => 
        `Test data with TEST${i % 10}${String(i).padStart(6, '0')} pattern and email${i}@test.com`
      );

      const startTime = Date.now();
      const results = await Promise.all(
        testTexts.map(text => enhancedDataCloak.enhancedPIIDetection(text))
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const throughput = (testTexts.length / processingTime) * 1000;

      // With custom patterns, performance should still be reasonable
      expect(processingTime).toBeLessThan(15000); // < 15 seconds for 500 records with 10 custom patterns
      expect(throughput).toBeGreaterThan(33); // > 33 records/second

      // Clean up custom patterns
      for (const id of patternIds) {
        await enhancedDataCloak.removeCustomPattern(id);
      }

      console.log(`Custom Pattern Performance - Time: ${processingTime}ms, Throughput: ${throughput.toFixed(0)} rec/sec`);
    });
  });

  describe('Confidence Score Regression', () => {
    it('should maintain confidence score accuracy and calibration', async () => {
      const highConfidenceTexts = [
        'Email: john.doe@company.com (clearly formatted)',
        'Phone: (555) 123-4567 (standard format)',
        'SSN: 123-45-6789 (proper format)',
        'Credit Card: 4532-1234-5678-9012 (valid format)'
      ];

      const lowConfidenceTexts = [
        'Email-like: user at domain dot com',
        'Phone-like: five five five one two three four',
        'SSN-like: one two three four five six seven eight nine',
        'Card-like: four five three two one two three four'
      ];

      const highConfidenceResults = await Promise.all(
        highConfidenceTexts.map(text => dataCloak.detectPII(text))
      );

      const lowConfidenceResults = await Promise.all(
        lowConfidenceTexts.map(text => dataCloak.detectPII(text))
      );

      // Calculate average confidence for clear vs unclear patterns
      const highConfidenceScores = highConfidenceResults
        .flat()
        .map((pii: any) => pii.confidence)
        .filter(score => score !== undefined);

      const lowConfidenceScores = lowConfidenceResults
        .flat()
        .map((pii: any) => pii.confidence)
        .filter(score => score !== undefined);

      if (highConfidenceScores.length > 0 && lowConfidenceScores.length > 0) {
        const avgHighConfidence = highConfidenceScores.reduce((a, b) => a + b, 0) / highConfidenceScores.length;
        const avgLowConfidence = lowConfidenceScores.reduce((a, b) => a + b, 0) / lowConfidenceScores.length;

        // High confidence patterns should have significantly higher scores
        expect(avgHighConfidence).toBeGreaterThan(0.8);
        expect(avgHighConfidence).toBeGreaterThan(avgLowConfidence + 0.2);

        console.log(`Confidence Calibration - High: ${avgHighConfidence.toFixed(3)}, Low: ${avgLowConfidence.toFixed(3)}`);
      }
    });

    it('should maintain confidence threshold filtering accuracy', async () => {
      const mixedQualityText = 'Contact: user@domain.com, maybe phone: 555-1234, unclear: user.domain.com';
      
      const thresholds = [0.5, 0.7, 0.9];
      const results = [];

      for (const threshold of thresholds) {
        await enhancedDataCloak.updateConfidenceThreshold(threshold);
        const result = await enhancedDataCloak.enhancedPIIDetection(mixedQualityText);
        results.push({ threshold, detectionCount: result.length });
      }

      // Higher thresholds should result in fewer detections
      expect(results[2].detectionCount).toBeLessThanOrEqual(results[1].detectionCount);
      expect(results[1].detectionCount).toBeLessThanOrEqual(results[0].detectionCount);

      console.log('Confidence Threshold Impact:', results);
    });
  });

  describe('Cross-Framework Accuracy Consistency', () => {
    it('should maintain consistent accuracy across framework switches', async () => {
      const standardTestData = [
        'User: john@company.com, Phone: 555-123-4567',
        'Payment: 4532-1234-5678-9012, Account: user@bank.com',
        'Patient: jane@hospital.com, ID: MRN123456'
      ];

      const frameworks = [ComplianceFramework.GENERAL, ComplianceFramework.HIPAA, ComplianceFramework.GDPR];
      const accuracyResults = [];

      for (const framework of frameworks) {
        await enhancedDataCloak.updateComplianceFramework(framework);
        
        const results = await Promise.all(
          standardTestData.map(text => enhancedDataCloak.enhancedPIIDetection(text))
        );

        const totalDetections = results.reduce((sum, result) => sum + result.length, 0);
        const avgConfidence = results
          .flat()
          .map((pii: any) => pii.confidence)
          .filter(score => score !== undefined)
          .reduce((sum, score) => sum + score, 0) / 
          results.flat().filter((pii: any) => pii.confidence !== undefined).length;

        accuracyResults.push({ 
          framework, 
          detections: totalDetections, 
          avgConfidence: avgConfidence || 0 
        });
      }

      // All frameworks should detect core PII consistently
      const detectionCounts = accuracyResults.map(r => r.detections);
      const confidenceScores = accuracyResults.map(r => r.avgConfidence);

      // Variance in detection counts should be reasonable
      const detectionVariance = (Math.max(...detectionCounts) - Math.min(...detectionCounts)) / Math.min(...detectionCounts);
      expect(detectionVariance).toBeLessThan(0.5); // Less than 50% variance

      // Average confidence should be consistent and above threshold
      confidenceScores.forEach(confidence => {
        expect(confidence).toBeGreaterThan(0.7);
      });

      console.log('Cross-Framework Accuracy:', accuracyResults);
    });
  });

  describe('Regression Detection and Alerting', () => {
    it('should detect accuracy regressions compared to baseline', async () => {
      const comprehensiveTestSet = [
        ...GROUND_TRUTH_DATASETS.emails.positive,
        ...GROUND_TRUTH_DATASETS.phones.positive,
        ...GROUND_TRUTH_DATASETS.ssn.positive,
        ...GROUND_TRUTH_DATASETS.credit_cards.positive
      ];

      const results = await Promise.all(
        comprehensiveTestSet.map(text => dataCloak.detectPII(text))
      );

      // Calculate overall accuracy metrics
      const totalTests = comprehensiveTestSet.length;
      const successfulDetections = results.filter(result => result.length > 0).length;
      const overallAccuracy = successfulDetections / totalTests;

      // Alert if accuracy drops below baseline
      if (overallAccuracy < BASELINE_METRICS.overall_accuracy) {
        console.warn(`REGRESSION ALERT: Overall accuracy ${overallAccuracy.toFixed(3)} below baseline ${BASELINE_METRICS.overall_accuracy}`);
      }

      expect(overallAccuracy).toBeGreaterThanOrEqual(BASELINE_METRICS.overall_accuracy);

      // Generate regression report
      const regressionReport = {
        timestamp: new Date().toISOString(),
        overall_accuracy: overallAccuracy,
        baseline_accuracy: BASELINE_METRICS.overall_accuracy,
        total_tests: totalTests,
        successful_detections: successfulDetections,
        regression_detected: overallAccuracy < BASELINE_METRICS.overall_accuracy
      };

      // Save regression report for tracking
      const reportPath = path.join(tempDir, 'regression-report.json');
      await fs.writeFile(reportPath, JSON.stringify(regressionReport, null, 2));

      console.log('Regression Test Summary:', regressionReport);
    });

    it('should track pattern accuracy over time', async () => {
      const patternTests = {
        email: GROUND_TRUTH_DATASETS.emails.positive,
        phone: GROUND_TRUTH_DATASETS.phones.positive,
        ssn: GROUND_TRUTH_DATASETS.ssn.positive,
        credit_card: GROUND_TRUTH_DATASETS.credit_cards.positive
      };

      const patternAccuracy = {};

      for (const [patternType, testCases] of Object.entries(patternTests)) {
        const results = await Promise.all(
          testCases.map(text => dataCloak.detectPII(text))
        );

        const detections = results.filter(result => 
          result.some((pii: any) => 
            pii.piiType.toLowerCase().includes(patternType.split('_')[0])
          )
        ).length;

        const accuracy = detections / testCases.length;
        patternAccuracy[patternType] = {
          accuracy,
          detections,
          total_tests: testCases.length,
          baseline: BASELINE_METRICS.overall_accuracy
        };

        // Individual pattern regression check
        expect(accuracy).toBeGreaterThanOrEqual(BASELINE_METRICS.overall_accuracy * 0.9); // Allow 10% variance
      }

      // Save pattern accuracy tracking
      const trackingPath = path.join(tempDir, 'pattern-accuracy-tracking.json');
      await fs.writeFile(trackingPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        pattern_accuracy: patternAccuracy
      }, null, 2));

      console.log('Pattern Accuracy Tracking:', patternAccuracy);
    });
  });

  describe('Automated Regression Benchmarking', () => {
    it('should run automated benchmark suite and compare against baselines', async () => {
      // Comprehensive benchmark covering all PII types and edge cases
      const benchmarkSuite = {
        basic_patterns: [
          ...GROUND_TRUTH_DATASETS.emails.positive.slice(0, 3),
          ...GROUND_TRUTH_DATASETS.phones.positive.slice(0, 3),
          ...GROUND_TRUTH_DATASETS.ssn.positive.slice(0, 3)
        ],
        edge_cases: [
          'Email with subdomain: user@sub.domain.company.com',
          'Phone with extension: (555) 123-4567 x890',
          'SSN in text: The SSN 123-45-6789 belongs to...',
          'Multiple PII: Call 555-123-4567 or email john@company.com'
        ],
        framework_specific: [
          'Medical: Patient MRN123456 has condition',
          'Financial: Card 4532-1234-5678-9012 charged',
          'European: EU citizen email@company.de, GDPR applies'
        ]
      };

      const benchmarkResults = {};

      for (const [category, testCases] of Object.entries(benchmarkSuite)) {
        const startTime = Date.now();
        const results = await Promise.all(
          testCases.map(text => dataCloak.detectPII(text))
        );
        const endTime = Date.now();

        const detectionRate = results.filter(result => result.length > 0).length / testCases.length;
        const avgProcessingTime = (endTime - startTime) / testCases.length;
        const totalDetections = results.reduce((sum, result) => sum + result.length, 0);

        benchmarkResults[category] = {
          detection_rate: detectionRate,
          avg_processing_time_ms: avgProcessingTime,
          total_detections: totalDetections,
          test_cases: testCases.length
        };

        // Category-specific regression checks
        expect(detectionRate).toBeGreaterThanOrEqual(0.8); // 80% detection rate
        expect(avgProcessingTime).toBeLessThan(100); // < 100ms per record
      }

      // Generate comprehensive benchmark report
      const benchmarkReport = {
        timestamp: new Date().toISOString(),
        baseline_metrics: BASELINE_METRICS,
        benchmark_results: benchmarkResults,
        overall_performance: {
          total_categories: Object.keys(benchmarkResults).length,
          avg_detection_rate: Object.values(benchmarkResults).reduce((sum: any, result: any) => sum + result.detection_rate, 0) / Object.keys(benchmarkResults).length,
          total_processing_time: Object.values(benchmarkResults).reduce((sum: any, result: any) => sum + result.avg_processing_time_ms, 0)
        }
      };

      // Save benchmark report
      const benchmarkPath = path.join(tempDir, 'automated-benchmark-report.json');
      await fs.writeFile(benchmarkPath, JSON.stringify(benchmarkReport, null, 2));

      console.log('Automated Benchmark Results:', benchmarkReport.overall_performance);
    });
  });
});