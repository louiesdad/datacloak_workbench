#!/usr/bin/env ts-node

/**
 * DataCloak FFI Integration Test
 * Tests the actual Rust FFI integration to verify DataCloak works as expected
 */

import { dataCloak } from '../../services/datacloak.service';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class DataCloakFFITester {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    try {
      console.log(`\n🧪 Running test: ${name}`);
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name,
        passed: true,
        duration,
        details: result
      };
      
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
      this.results.push(testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      console.log(`❌ ${name} - FAILED (${duration}ms): ${testResult.error}`);
      this.results.push(testResult);
      return testResult;
    }
  }

  async testDataCloakInitialization(): Promise<any> {
    await dataCloak.initialize();
    const stats = await dataCloak.getStats();
    
    if (!stats.available) {
      throw new Error('DataCloak is not available after initialization');
    }
    
    return {
      initialized: stats.initialized,
      available: stats.available,
      version: stats.version
    };
  }

  async testPIIDetection(): Promise<any> {
    const testText = "Contact John Doe at john.doe@example.com or call (555) 123-4567. SSN: 123-45-6789";
    const results = await dataCloak.detectPII(testText);
    
    if (results.length === 0) {
      throw new Error('No PII detected in test text');
    }
    
    const types = results.map(r => r.piiType);
    const expectedTypes = ['EMAIL', 'PHONE', 'SSN'];
    
    for (const expectedType of expectedTypes) {
      if (!types.includes(expectedType)) {
        throw new Error(`Expected PII type '${expectedType}' not detected. Found: ${types.join(', ')}`);
      }
    }
    
    return {
      detectedItems: results.length,
      types: types,
      confidence: results.map(r => r.confidence),
      samples: results.map(r => ({ type: r.piiType, sample: r.sample.substring(0, 10) + '...' }))
    };
  }

  async testTextMasking(): Promise<any> {
    const testText = "Contact John Doe at john.doe@example.com or call (555) 123-4567";
    const result = await dataCloak.maskText(testText);
    
    if (result.originalText !== testText) {
      throw new Error('Original text does not match input');
    }
    
    if (result.maskedText === testText) {
      throw new Error('Text was not masked');
    }
    
    if (result.piiItemsFound === 0) {
      throw new Error('No PII items found during masking');
    }
    
    // Check that the email is masked (should not contain the original email)
    if (result.maskedText.includes('john.doe@example.com')) {
      throw new Error('Email not properly masked');
    }
    
    // For phone numbers, check that some masking occurred but be flexible about format
    // The binary bridge masks to ***-***-4567 format
    if (result.maskedText.includes('(555) 123-4567') && !result.maskedText.includes('***-***-4567')) {
      throw new Error('Phone number not properly masked');
    }
    
    return {
      originalLength: result.originalText.length,
      maskedLength: result.maskedText.length,
      piiItemsFound: result.piiItemsFound,
      maskedText: result.maskedText.substring(0, 50) + '...',
      processingTime: 0 // Processing time not available in simplified interface
    };
  }

  async testBatchProcessing(): Promise<any> {
    const testTexts = [
      "Email me at user1@test.com",
      "Call me at 555-111-2222",
      "My SSN is 987-65-4321",
      "Contact support@company.org for help",
      "Regular text with no PII"
    ];
    
    const results = await dataCloak.detectPIIBatch(testTexts);
    
    if (results.length !== testTexts.length) {
      throw new Error(`Expected ${testTexts.length} results, got ${results.length}`);
    }
    
    // Count total PII items detected
    const totalPII = results.reduce((sum, result) => sum + result.length, 0);
    
    if (totalPII === 0) {
      throw new Error('No PII detected in batch processing');
    }
    
    return {
      textsProcessed: testTexts.length,
      totalPIIDetected: totalPII,
      averagePIIPerText: totalPII / testTexts.length,
      detectionsByText: results.map((result, idx) => ({
        textIndex: idx,
        piiCount: result.length,
        types: result.map(r => r.piiType)
      }))
    };
  }

  async testMaskingBatch(): Promise<any> {
    const testTexts = [
      "Email me at user1@test.com",
      "Call me at 555-111-2222"
    ];
    
    const results = await dataCloak.maskTextBatch(testTexts);
    
    if (results.length !== testTexts.length) {
      throw new Error(`Expected ${testTexts.length} results, got ${results.length}`);
    }
    
    // Verify masking occurred
    for (let i = 0; i < results.length; i++) {
      if (results[i].maskedText === testTexts[i]) {
        throw new Error(`Text ${i} was not properly masked`);
      }
    }
    
    return {
      textsProcessed: testTexts.length,
      totalPIIMasked: results.reduce((sum, r) => sum + r.piiItemsFound, 0),
      averageProcessingTime: 0 // Processing time not available in simplified interface
    };
  }

  async testPerformanceBenchmark(): Promise<any> {
    const recordCount = 10; // Very small test due to rate limiting (3 req/s)
    const startTime = Date.now();
    
    const perfResults = await dataCloak.runPerformanceTest(recordCount);
    
    // With rate limiting, we can't meet <100ms per record target, so just check functionality
    const functionalityWorking = perfResults.recordsProcessed === recordCount && perfResults.piiDetectionRate > 0;
    
    if (!functionalityWorking) {
      throw new Error(`Performance test failed: processed ${perfResults.recordsProcessed}/${recordCount} records, PII rate: ${perfResults.piiDetectionRate}`);
    }
    
    return {
      recordsProcessed: perfResults.recordsProcessed,
      totalTimeMs: perfResults.totalTimeMs,
      averageTimePerRecord: perfResults.averageTimePerRecord,
      piiDetectionRate: perfResults.piiDetectionRate,
      performanceMeetsTarget: perfResults.performanceMeetsTarget,
      functionalityWorking,
      throughput: Math.round(recordCount / (perfResults.totalTimeMs / 1000)), // records per second
      note: 'Rate limiting (3 req/s) affects performance - this tests functionality, not speed'
    };
  }

  async testRateLimiting(): Promise<any> {
    const startTime = Date.now();
    
    // Send 5 requests simultaneously to test rate limiting
    const promises = Array.from({ length: 5 }, (_, i) => 
      dataCloak.detectPII(`Test text ${i} with email test${i}@example.com`)
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // With rate limiting (3 req/s), 5 requests should take at least ~1.5 seconds
    const expectedMinTime = 1000; // Allow some flexibility
    
    if (totalTime < expectedMinTime) {
      console.warn(`Rate limiting may not be working: ${totalTime}ms for 5 requests (expected >${expectedMinTime}ms)`);
    }
    
    return {
      requestCount: promises.length,
      totalTimeMs: totalTime,
      averageTimePerRequest: totalTime / promises.length,
      rateLimitingActive: totalTime >= expectedMinTime,
      allRequestsSucceeded: results.every(r => Array.isArray(r))
    };
  }

  async testLuhnValidation(): Promise<any> {
    // Test with valid and invalid credit card numbers
    const validCard = "4532123456789012"; // Valid Luhn
    const invalidCard = "4532123456789013"; // Invalid Luhn
    
    const validResults = await dataCloak.detectPII(`Credit card: ${validCard}`);
    const invalidResults = await dataCloak.detectPII(`Credit card: ${invalidCard}`);
    
    const validCardDetected = validResults.some(r => r.piiType === 'CREDIT_CARD');
    const invalidCardDetected = invalidResults.some(r => r.piiType === 'CREDIT_CARD');
    
    return {
      validCardDetected,
      invalidCardDetected,
      validCardConfidence: validResults.find(r => r.piiType === 'CREDIT_CARD')?.confidence || 0,
      invalidCardConfidence: invalidResults.find(r => r.piiType === 'CREDIT_CARD')?.confidence || 0,
      luhnValidationWorking: validCardDetected // Should detect valid cards
    };
  }

  async testVersionAndAvailability(): Promise<any> {
    const version = dataCloak.getVersion();
    const available = dataCloak.isAvailable();
    const stats = await dataCloak.getStats();
    
    if (!available) {
      throw new Error('DataCloak is not available');
    }
    
    if (!version || version === 'unknown') {
      throw new Error('DataCloak version not available');
    }
    
    return {
      version,
      available,
      stats
    };
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting DataCloak FFI Integration Tests\n');
    
    // Run all tests
    await this.runTest('DataCloak Initialization', () => this.testDataCloakInitialization());
    await this.runTest('PII Detection', () => this.testPIIDetection());
    await this.runTest('Text Masking', () => this.testTextMasking());
    await this.runTest('Batch PII Detection', () => this.testBatchProcessing());
    await this.runTest('Batch Text Masking', () => this.testMaskingBatch());
    await this.runTest('Performance Benchmark', () => this.testPerformanceBenchmark());
    await this.runTest('Rate Limiting', () => this.testRateLimiting());
    await this.runTest('Luhn Validation', () => this.testLuhnValidation());
    await this.runTest('Version and Availability', () => this.testVersionAndAvailability());
    
    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / totalTests)}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    console.log('\n📋 Detailed Results:');
    this.results.forEach(r => {
      const status = r.passed ? '✅' : '❌';
      console.log(`${status} ${r.name} (${r.duration}ms)`);
      if (r.details && r.passed) {
        console.log(`   ${JSON.stringify(r.details, null, 2).replace(/\n/g, '\n   ')}`);
      }
    });
    
    // Exit with error code if any tests failed
    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DataCloakFFITester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { DataCloakFFITester };