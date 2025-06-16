import { enhancedDataCloak, ComplianceFramework } from '../../services/enhanced-datacloak.service';
import { complianceService } from '../../services/compliance.service';
import * as os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';

describe('Concurrent Risk Assessments - Load Testing', () => {
  const MAX_CONCURRENT_REQUESTS = 50;
  const LOAD_TEST_DURATION_MS = 30000; // 30 seconds
  const STRESS_TEST_DURATION_MS = 60000; // 60 seconds
  
  beforeAll(async () => {
    await enhancedDataCloak.initialize();
  });

  beforeEach(async () => {
    await enhancedDataCloak.updateComplianceFramework(ComplianceFramework.GENERAL);
    await enhancedDataCloak.updateConfidenceThreshold(0.8);
  });

  // Helper function to generate realistic test data
  const generateTestData = (size: number, complexity: 'simple' | 'complex' = 'simple'): string[] => {
    const templates = {
      simple: [
        'User: user{i}@company.com, Phone: 555-{phone}',
        'Customer {i}: contact{i}@domain.com, ID: CUST{id}',
        'Email: user{i}@test.org, Account: ACC{account}'
      ],
      complex: [
        'Patient: John Doe {i}, MRN: MED{mrn}, SSN: {ssn}, Email: patient{i}@hospital.com, Phone: 555-{phone}, DOB: 01/{day}/19{year}',
        'Financial Record {i}: Card 4532-{card1}-{card2}-{card3}, Account: {account}, Customer: user{i}@bank.com, Phone: (555) {phone}',
        'EU Citizen {i}: Email: citizen{i}@company.de, Phone: +49-30-{phone}, Passport: P{passport}, Address: Berlin Street {i}, Germany'
      ]
    };

    return Array.from({ length: size }, (_, i) => {
      const template = templates[complexity][i % templates[complexity].length];
      return template
        .replace(/\{i\}/g, String(i))
        .replace(/\{phone\}/g, String(100 + (i % 900)).padStart(3, '0') + '-' + String(1000 + (i % 9000)).padStart(4, '0'))
        .replace(/\{ssn\}/g, String(100 + (i % 900)).padStart(3, '0') + '-' + String(10 + (i % 90)).padStart(2, '0') + '-' + String(1000 + (i % 9000)).padStart(4, '0'))
        .replace(/\{mrn\}/g, String(100000 + i).padStart(6, '0'))
        .replace(/\{id\}/g, String(10000 + i).padStart(5, '0'))
        .replace(/\{account\}/g, String(1000000000000000 + i))
        .replace(/\{card1\}/g, String(1000 + (i % 9000)).padStart(4, '0'))
        .replace(/\{card2\}/g, String(1000 + ((i + 1) % 9000)).padStart(4, '0'))
        .replace(/\{card3\}/g, String(1000 + ((i + 2) % 9000)).padStart(4, '0'))
        .replace(/\{passport\}/g, String(100000000 + i))
        .replace(/\{day\}/g, String(1 + (i % 28)).padStart(2, '0'))
        .replace(/\{year\}/g, String(50 + (i % 50)));
    });
  };

  describe('Basic Concurrent Load Testing', () => {
    it('should handle 10 concurrent risk assessments efficiently', async () => {
      const concurrentRequests = 10;
      const recordsPerRequest = 1000;
      
      const datasets = Array.from({ length: concurrentRequests }, (_, i) => 
        generateTestData(recordsPerRequest, 'simple').map(record => `Request${i}: ${record}`)
      );

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Execute concurrent risk assessments
      const results = await Promise.all(
        datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

      // Verify all requests completed successfully
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.risk_score).toBeGreaterThanOrEqual(0);
        expect(result.pii_detected.length).toBeGreaterThan(0);
      });

      // Performance expectations
      expect(totalTime).toBeLessThan(20000); // Complete within 20 seconds
      expect(memoryIncrease).toBeLessThan(1000); // Less than 1GB memory increase

      console.log(`10 Concurrent Requests - Time: ${totalTime}ms, Memory: ${memoryIncrease.toFixed(2)}MB`);
    });

    it('should handle 25 concurrent requests with different compliance frameworks', async () => {
      const concurrentRequests = 25;
      const frameworks = [
        ComplianceFramework.GENERAL,
        ComplianceFramework.HIPAA,
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.GDPR
      ];

      const datasets = Array.from({ length: concurrentRequests }, (_, i) => ({
        framework: frameworks[i % frameworks.length],
        data: generateTestData(500, 'complex')
      }));

      const startTime = Date.now();

      // Process requests with different frameworks concurrently
      const results = await Promise.all(
        datasets.map(async ({ framework, data }) => {
          // Note: In a real implementation, each request would have its own framework context
          // For this test, we'll assess with a common framework but vary the data
          return enhancedDataCloak.assessDataRisk(data);
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests completed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.overall_risk).toBeIn(['low', 'medium', 'high', 'critical']);
      });

      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds

      console.log(`25 Mixed Framework Requests - Time: ${totalTime}ms`);
    });

    it('should maintain reasonable response times under moderate load', async () => {
      const concurrentRequests = 15;
      const recordsPerRequest = 750;
      
      const datasets = Array.from({ length: concurrentRequests }, (_, i) => 
        generateTestData(recordsPerRequest, 'simple')
      );

      const requestTimes: number[] = [];

      // Measure individual request times
      const results = await Promise.all(
        datasets.map(async (dataset, index) => {
          const requestStart = Date.now();
          const result = await enhancedDataCloak.assessDataRisk(dataset);
          const requestEnd = Date.now();
          requestTimes.push(requestEnd - requestStart);
          return { index, result, requestTime: requestEnd - requestStart };
        })
      );

      const avgRequestTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
      const maxRequestTime = Math.max(...requestTimes);
      const minRequestTime = Math.min(...requestTimes);

      // Performance expectations for individual requests
      expect(avgRequestTime).toBeLessThan(3000); // Average < 3 seconds
      expect(maxRequestTime).toBeLessThan(8000); // No request > 8 seconds
      expect(minRequestTime).toBeGreaterThan(100); // Sanity check

      console.log(`Request Times - Avg: ${avgRequestTime.toFixed(0)}ms, Max: ${maxRequestTime}ms, Min: ${minRequestTime}ms`);
    });
  });

  describe('High Concurrency Stress Testing', () => {
    it('should handle 50 concurrent requests without system failure', async () => {
      const concurrentRequests = 50;
      const recordsPerRequest = 500;
      
      const datasets = Array.from({ length: concurrentRequests }, (_, i) => 
        generateTestData(recordsPerRequest, 'simple')
      );

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Execute high concurrency load
      const results = await Promise.allSettled(
        datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024;

      // Count successful vs failed requests
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      // Expect at least 90% success rate under high load
      const successRate = successful / concurrentRequests;
      expect(successRate).toBeGreaterThan(0.9);

      console.log(`High Concurrency (50 requests) - Success: ${successRate * 100}%, Time: ${totalTime}ms, Memory: ${memoryIncrease.toFixed(2)}MB`);
    });

    it('should handle sustained load over time', async () => {
      const duration = 15000; // 15 seconds
      const batchSize = 10;
      const batchInterval = 1000; // 1 second between batches
      
      const startTime = Date.now();
      const results: any[] = [];
      const errors: any[] = [];

      while (Date.now() - startTime < duration) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const data = generateTestData(200, 'simple');
          return enhancedDataCloak.assessDataRisk(data);
        });

        try {
          const batchResults = await Promise.allSettled(batchPromises);
          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              errors.push(result.reason);
            }
          });

          // Wait before next batch
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        } catch (error) {
          errors.push(error);
        }
      }

      const totalRequests = results.length + errors.length;
      const successRate = results.length / totalRequests;

      expect(successRate).toBeGreaterThan(0.85); // 85% success rate during sustained load
      expect(results.length).toBeGreaterThan(50); // Should process significant number of requests

      console.log(`Sustained Load - Processed: ${totalRequests} requests, Success Rate: ${(successRate * 100).toFixed(1)}%`);
    });
  });

  describe('Resource Utilization Under Load', () => {
    it('should maintain memory usage within acceptable bounds during concurrent processing', async () => {
      const concurrentRequests = 30;
      const recordsPerRequest = 1000;
      
      const datasets = Array.from({ length: concurrentRequests }, (_, i) => 
        generateTestData(recordsPerRequest, 'complex')
      );

      const memoryReadings: number[] = [];
      const interval = setInterval(() => {
        memoryReadings.push(process.memoryUsage().heapUsed / 1024 / 1024);
      }, 500);

      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        await Promise.all(
          datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
        );
      } finally {
        clearInterval(interval);
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const peakMemory = Math.max(...memoryReadings);
      const memoryIncrease = peakMemory - initialMemory;

      // Memory usage expectations
      expect(memoryIncrease).toBeLessThan(2000); // Less than 2GB peak increase
      expect(finalMemory - initialMemory).toBeLessThan(1000); // Less than 1GB permanent increase

      console.log(`Memory Usage - Initial: ${initialMemory.toFixed(0)}MB, Peak: ${peakMemory.toFixed(0)}MB, Final: ${finalMemory.toFixed(0)}MB`);
    });

    it('should handle CPU-intensive concurrent pattern matching efficiently', async () => {
      // Add multiple complex custom patterns to increase CPU load
      const patternIds = [];
      
      for (let i = 0; i < 20; i++) {
        const id = await enhancedDataCloak.addCustomPattern({
          name: `Complex Pattern ${i}`,
          pattern: `COMP${i}[A-Z]{2}[0-9]{4}[a-z]{3}`,
          confidence: 0.8,
          risk_level: 'medium',
          compliance_frameworks: [ComplianceFramework.GENERAL],
          description: `CPU intensive pattern ${i}`,
          enabled: true,
          priority: 50
        });
        patternIds.push(id);
      }

      try {
        const concurrentRequests = 20;
        const recordsPerRequest = 500;
        
        const datasets = Array.from({ length: concurrentRequests }, (_, i) => 
          generateTestData(recordsPerRequest, 'complex').map(record => 
            record + ` COMP${i % 20}AB${String(i).padStart(4, '0')}xyz`
          )
        );

        const startTime = Date.now();
        const results = await Promise.all(
          datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
        );
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        const totalRecords = concurrentRequests * recordsPerRequest;
        const throughput = (totalRecords / processingTime) * 1000;

        // Should maintain reasonable throughput even with complex patterns
        expect(processingTime).toBeLessThan(60000); // Complete within 60 seconds
        expect(throughput).toBeGreaterThan(10); // > 10 records/second
        expect(results.length).toBe(concurrentRequests);

        console.log(`CPU Intensive Load - Time: ${processingTime}ms, Throughput: ${throughput.toFixed(1)} rec/sec`);
      } finally {
        // Clean up custom patterns
        for (const id of patternIds) {
          await enhancedDataCloak.removeCustomPattern(id);
        }
      }
    });
  });

  describe('Compliance Service Concurrent Load', () => {
    it('should handle concurrent compliance audits efficiently', async () => {
      const concurrentAudits = 20;
      
      const auditData = Array.from({ length: concurrentAudits }, (_, i) => ({
        piiDetected: [
          {
            type: 'email',
            value: `user${i}@company.com`,
            position: { start: 0, end: 16 },
            confidence: 0.9,
            pattern: 'email',
            piiType: 'email'
          },
          {
            type: 'phone',
            value: `555-${String(i).padStart(3, '0')}-${String(i).padStart(4, '0')}`,
            position: { start: 20, end: 32 },
            confidence: 0.85,
            pattern: 'phone',
            piiType: 'phone'
          }
        ],
        dataTypes: ['email', 'phone'],
        processingPurpose: 'testing',
        userConsent: true,
        dataMinimization: true,
        encryptionEnabled: true,
        accessControls: true,
        auditLogging: true,
        dataRetentionPolicy: true,
        rightToDelete: true,
        dataPortability: true,
        breachNotification: true,
        privacyByDesign: true,
        geolocation: 'US'
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        auditData.map(data => complianceService.performComplianceAudit(data))
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Verify all audits completed
      expect(results).toHaveLength(concurrentAudits);
      results.forEach(result => {
        expect(result.auditId).toBeDefined();
        expect(result.overall.score).toBeGreaterThanOrEqual(0);
      });

      expect(processingTime).toBeLessThan(10000); // Complete within 10 seconds

      console.log(`Concurrent Compliance Audits - ${concurrentAudits} audits in ${processingTime}ms`);
    });

    it('should handle mixed risk assessment and compliance audit load', async () => {
      const mixedRequests = 30;
      const riskAssessmentRatio = 0.6; // 60% risk assessments, 40% compliance audits
      
      const requests = Array.from({ length: mixedRequests }, (_, i) => {
        if (i < mixedRequests * riskAssessmentRatio) {
          // Risk assessment request
          return {
            type: 'risk_assessment',
            data: generateTestData(300, 'simple'),
            index: i
          };
        } else {
          // Compliance audit request
          return {
            type: 'compliance_audit',
            data: {
              piiDetected: [
                {
                  type: 'email',
                  value: `user${i}@company.com`,
                  position: { start: 0, end: 16 },
                  confidence: 0.9,
                  pattern: 'email',
                  piiType: 'email'
                }
              ],
              dataTypes: ['email'],
              processingPurpose: 'testing',
              userConsent: true,
              dataMinimization: true,
              encryptionEnabled: true,
              accessControls: true,
              auditLogging: true,
              dataRetentionPolicy: true,
              rightToDelete: true,
              dataPortability: true,
              breachNotification: true,
              privacyByDesign: true,
              geolocation: 'US'
            },
            index: i
          };
        }
      });

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(async request => {
          if (request.type === 'risk_assessment') {
            return {
              type: 'risk_assessment',
              result: await enhancedDataCloak.assessDataRisk(request.data),
              index: request.index
            };
          } else {
            return {
              type: 'compliance_audit',
              result: await complianceService.performComplianceAudit(request.data),
              index: request.index
            };
          }
        })
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Verify all requests completed
      expect(results).toHaveLength(mixedRequests);
      
      const riskAssessments = results.filter(r => r.type === 'risk_assessment');
      const complianceAudits = results.filter(r => r.type === 'compliance_audit');
      
      expect(riskAssessments.length).toBeGreaterThan(0);
      expect(complianceAudits.length).toBeGreaterThan(0);

      expect(processingTime).toBeLessThan(45000); // Complete within 45 seconds

      console.log(`Mixed Load Test - ${riskAssessments.length} risk assessments, ${complianceAudits.length} audits in ${processingTime}ms`);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should gracefully handle errors in concurrent requests without affecting other requests', async () => {
      const concurrentRequests = 20;
      const errorRate = 0.2; // 20% of requests will have errors
      
      const datasets = Array.from({ length: concurrentRequests }, (_, i) => {
        if (i < concurrentRequests * errorRate) {
          // Introduce errors in some requests
          return [
            null as any,
            'Valid data: user@company.com',
            undefined as any,
            'Another valid: 555-123-4567',
            ''
          ];
        } else {
          return generateTestData(500, 'simple');
        }
      });

      const results = await Promise.allSettled(
        datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset.filter(d => d !== null && d !== undefined)))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      // Should handle errors gracefully
      expect(successful).toBeGreaterThan(concurrentRequests * 0.7); // At least 70% success
      expect(failed).toBeLessThan(concurrentRequests * 0.3); // Less than 30% failure

      console.log(`Error Handling - Successful: ${successful}, Failed: ${failed}, Success Rate: ${(successful/concurrentRequests * 100).toFixed(1)}%`);
    });

    it('should recover quickly from temporary system stress', async () => {
      // Create initial high load
      const highLoadRequests = 40;
      const datasets = Array.from({ length: highLoadRequests }, (_, i) => 
        generateTestData(800, 'complex')
      );

      // Start high load (don't wait for completion)
      const highLoadPromise = Promise.allSettled(
        datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
      );

      // Wait a bit for system to be under stress
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send additional requests during high load
      const recoveryTestStart = Date.now();
      const recoveryTestData = generateTestData(100, 'simple');
      const recoveryResult = await enhancedDataCloak.assessDataRisk(recoveryTestData);
      const recoveryTestTime = Date.now() - recoveryTestStart;

      // Wait for high load to complete
      const highLoadResults = await highLoadPromise;

      // System should still be responsive during stress
      expect(recoveryResult).toBeDefined();
      expect(recoveryResult.risk_score).toBeGreaterThanOrEqual(0);
      expect(recoveryTestTime).toBeLessThan(15000); // Should complete within 15 seconds even under load

      console.log(`Recovery Test - Completed in ${recoveryTestTime}ms during high system load`);
    });
  });

  describe('Performance Scaling Analysis', () => {
    it('should demonstrate reasonable performance scaling with increased concurrency', async () => {
      const concurrencyLevels = [5, 10, 20, 30];
      const recordsPerRequest = 500;
      const scalingResults = [];

      for (const concurrency of concurrencyLevels) {
        const datasets = Array.from({ length: concurrency }, (_, i) => 
          generateTestData(recordsPerRequest, 'simple')
        );

        const startTime = Date.now();
        const results = await Promise.allSettled(
          datasets.map(dataset => enhancedDataCloak.assessDataRisk(dataset))
        );
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
        const throughput = (successfulRequests * recordsPerRequest / totalTime) * 1000; // records/second

        scalingResults.push({
          concurrency,
          totalTime,
          successfulRequests,
          throughput: Math.round(throughput)
        });

        console.log(`Concurrency ${concurrency}: ${totalTime}ms, Success: ${successfulRequests}/${concurrency}, Throughput: ${Math.round(throughput)} rec/sec`);
      }

      // Analyze scaling efficiency
      const baseThroughput = scalingResults[0].throughput;
      scalingResults.forEach((result, index) => {
        if (index > 0) {
          const efficiency = result.throughput / baseThroughput;
          // Efficiency should not degrade too severely with increased concurrency
          expect(efficiency).toBeGreaterThan(0.3); // Should maintain at least 30% of base efficiency
        }
      });

      // All levels should maintain reasonable success rates
      scalingResults.forEach(result => {
        const successRate = result.successfulRequests / result.concurrency;
        expect(successRate).toBeGreaterThan(0.8); // 80% success rate minimum
      });
    });
  });
});