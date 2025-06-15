/**
 * DataCloak FFI Integration Test
 * Tests the real DataCloak binary integration for Windows and macOS
 */

import { NativeDataCloakBridge } from '@dsw/security/dist/datacloak/native-bridge';
import { DataCloakMock } from '@dsw/security/dist/mock/datacloak-mock';
import { PIIType } from '@dsw/security';
import { platform } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

interface TestResult {
  platform: string;
  binaryFound: boolean;
  binaryPath?: string;
  version?: string;
  tests: {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
  }[];
  performance: {
    detectPII: number;
    maskText: number;
    auditSecurity: number;
  };
  recommendations: string[];
}

export class DataCloakFFITest {
  private bridge: NativeDataCloakBridge;
  private mock: DataCloakMock;
  private testData = {
    texts: [
      'John Doe lives at 123 Main St, and his email is john.doe@example.com',
      'Call me at 555-123-4567 or email sarah@company.org',
      'My SSN is 123-45-6789 and credit card is 4111-1111-1111-1111',
      'Born on 01/15/1990, residing at 456 Oak Avenue, New York, NY 10001'
    ],
    expectedPII: {
      names: ['John Doe', 'sarah'],
      emails: ['john.doe@example.com', 'sarah@company.org'],
      phones: ['555-123-4567'],
      ssn: ['123-45-6789'],
      creditCards: ['4111-1111-1111-1111'],
      addresses: ['123 Main St', '456 Oak Avenue, New York, NY 10001']
    }
  };

  constructor() {
    this.bridge = new NativeDataCloakBridge({
      fallbackToMock: false, // Don't fallback for testing
      timeout: 10000
    });
    this.mock = new DataCloakMock();
  }

  /**
   * Run comprehensive FFI integration tests
   */
  async runTests(): Promise<TestResult> {
    const currentPlatform = platform();
    console.log(`🖥️  Testing DataCloak FFI on ${currentPlatform}...`);

    const result: TestResult = {
      platform: currentPlatform,
      binaryFound: false,
      tests: [],
      performance: {
        detectPII: 0,
        maskText: 0,
        auditSecurity: 0
      },
      recommendations: []
    };

    // Test 1: Binary detection
    console.log('\n📍 Test 1: Binary Detection');
    const binaryTest = await this.testBinaryDetection(currentPlatform);
    result.binaryFound = binaryTest.found;
    result.binaryPath = binaryTest.path;
    result.tests.push({
      name: 'Binary Detection',
      passed: binaryTest.found,
      duration: binaryTest.duration,
      error: binaryTest.error
    });

    if (!result.binaryFound) {
      result.recommendations.push(
        `Install DataCloak binary for ${currentPlatform}`,
        `Expected locations: ${binaryTest.expectedPaths.join(', ')}`
      );
      console.log('⚠️  Binary not found, running mock comparison tests...');
      await this.runMockComparisonTests(result);
      return result;
    }

    // Test 2: Binary initialization
    console.log('\n🚀 Test 2: Binary Initialization');
    const initTest = await this.testInitialization();
    result.version = initTest.version;
    result.tests.push({
      name: 'Binary Initialization',
      passed: initTest.success,
      duration: initTest.duration,
      error: initTest.error
    });

    if (!initTest.success) {
      result.recommendations.push(
        'Check DataCloak binary permissions',
        'Verify binary compatibility with current OS version'
      );
      return result;
    }

    // Test 3: PII Detection
    console.log('\n🔍 Test 3: PII Detection');
    const detectionTest = await this.testPIIDetection();
    result.tests.push({
      name: 'PII Detection',
      passed: detectionTest.passed,
      duration: detectionTest.duration,
      error: detectionTest.error
    });
    result.performance.detectPII = detectionTest.avgTime;

    // Test 4: Text Masking
    console.log('\n🎭 Test 4: Text Masking');
    const maskingTest = await this.testTextMasking();
    result.tests.push({
      name: 'Text Masking',
      passed: maskingTest.passed,
      duration: maskingTest.duration,
      error: maskingTest.error
    });
    result.performance.maskText = maskingTest.avgTime;

    // Test 5: Security Audit
    console.log('\n🔒 Test 5: Security Audit');
    const auditTest = await this.testSecurityAudit();
    result.tests.push({
      name: 'Security Audit',
      passed: auditTest.passed,
      duration: auditTest.duration,
      error: auditTest.error
    });
    result.performance.auditSecurity = auditTest.avgTime;

    // Test 6: Performance comparison
    console.log('\n⚡ Test 6: Performance Comparison');
    const perfTest = await this.testPerformanceComparison();
    result.tests.push({
      name: 'Performance Comparison',
      passed: perfTest.passed,
      duration: perfTest.duration
    });

    if (!perfTest.passed) {
      result.recommendations.push(
        'Binary performance is slower than expected',
        'Consider updating to latest DataCloak version'
      );
    }

    // Test 7: Error handling
    console.log('\n❌ Test 7: Error Handling');
    const errorTest = await this.testErrorHandling();
    result.tests.push({
      name: 'Error Handling',
      passed: errorTest.passed,
      duration: errorTest.duration,
      error: errorTest.error
    });

    this.printResults(result);
    return result;
  }

  /**
   * Test binary detection for current platform
   */
  private async testBinaryDetection(currentPlatform: string): Promise<{
    found: boolean;
    path?: string;
    duration: number;
    error?: string;
    expectedPaths: string[];
  }> {
    const startTime = performance.now();
    const expectedPaths = this.getExpectedBinaryPaths(currentPlatform);
    
    for (const path of expectedPaths) {
      if (existsSync(path)) {
        const duration = performance.now() - startTime;
        console.log(`  ✅ Binary found at: ${path}`);
        return { found: true, path, duration, expectedPaths };
      }
    }

    const duration = performance.now() - startTime;
    console.log(`  ❌ Binary not found in any expected location`);
    return { 
      found: false, 
      duration, 
      error: 'DataCloak binary not found',
      expectedPaths 
    };
  }

  /**
   * Test binary initialization
   */
  private async testInitialization(): Promise<{
    success: boolean;
    version?: string;
    duration: number;
    error?: string;
  }> {
    const startTime = performance.now();
    
    try {
      await this.bridge.initialize({});
      const version = this.bridge.getVersion();
      const duration = performance.now() - startTime;
      
      console.log(`  ✅ Initialized successfully`);
      console.log(`  📋 Version: ${version}`);
      
      return { success: true, version, duration };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`  ❌ Initialization failed: ${error.message}`);
      return { success: false, duration, error: error.message };
    }
  }

  /**
   * Test PII detection accuracy
   */
  private async testPIIDetection(): Promise<{
    passed: boolean;
    duration: number;
    avgTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    let totalDetectTime = 0;
    let detectedCount = 0;
    let expectedCount = 0;

    try {
      for (const text of this.testData.texts) {
        const detectStart = performance.now();
        const results = await this.bridge.detectPII(text);
        totalDetectTime += performance.now() - detectStart;

        // Count detections
        detectedCount += results.length;
        
        // Verify detection types
        for (const result of results) {
          console.log(`    Detected: ${result.piiType} - "${result.sample}" (${result.confidence.toFixed(2)} confidence)`);
        }
      }

      // Calculate expected count
      expectedCount = Object.values(this.testData.expectedPII).flat().length;
      
      const accuracy = detectedCount / expectedCount;
      const avgTime = totalDetectTime / this.testData.texts.length;
      const duration = performance.now() - startTime;

      console.log(`  📊 Detection accuracy: ${(accuracy * 100).toFixed(1)}% (${detectedCount}/${expectedCount})`);
      console.log(`  ⏱️  Average detection time: ${avgTime.toFixed(2)}ms`);

      return {
        passed: accuracy >= 0.8, // 80% accuracy threshold
        duration,
        avgTime
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`  ❌ Detection failed: ${error.message}`);
      return { passed: false, duration, avgTime: 0, error: error.message };
    }
  }

  /**
   * Test text masking functionality
   */
  private async testTextMasking(): Promise<{
    passed: boolean;
    duration: number;
    avgTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    let totalMaskTime = 0;
    let allPassed = true;

    try {
      for (const text of this.testData.texts) {
        const maskStart = performance.now();
        const result = await this.bridge.maskText(text);
        totalMaskTime += performance.now() - maskStart;

        // Verify masking
        const hasUnmaskedPII = this.containsUnmaskedPII(result.maskedText);
        if (hasUnmaskedPII) {
          console.log(`    ⚠️  Unmasked PII found in: ${result.maskedText.substring(0, 50)}...`);
          allPassed = false;
        } else {
          console.log(`    ✅ Properly masked: ${result.maskedText.substring(0, 50)}...`);
        }
      }

      const avgTime = totalMaskTime / this.testData.texts.length;
      const duration = performance.now() - startTime;

      console.log(`  ⏱️  Average masking time: ${avgTime.toFixed(2)}ms`);

      return {
        passed: allPassed,
        duration,
        avgTime
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`  ❌ Masking failed: ${error.message}`);
      return { passed: false, duration, avgTime: 0, error: error.message };
    }
  }

  /**
   * Test security audit functionality
   */
  private async testSecurityAudit(): Promise<{
    passed: boolean;
    duration: number;
    avgTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    
    try {
      // Create a test file path
      const testFile = join(__dirname, 'test-data.csv');
      
      const auditStart = performance.now();
      const result = await this.bridge.auditSecurity(testFile);
      const auditTime = performance.now() - auditStart;

      console.log(`  📋 Audit Results:`);
      console.log(`    - PII Items: ${result.piiItemsDetected}`);
      console.log(`    - Compliance Score: ${(result.complianceScore * 100).toFixed(1)}%`);
      console.log(`    - Violations: ${result.violations.length}`);
      console.log(`    - Recommendations: ${result.recommendations.length}`);

      const duration = performance.now() - startTime;
      
      return {
        passed: result.complianceScore >= 0.7,
        duration,
        avgTime: auditTime
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      console.log(`  ❌ Audit failed: ${error.message}`);
      return { passed: false, duration, avgTime: 0, error: error.message };
    }
  }

  /**
   * Compare performance with mock implementation
   */
  private async testPerformanceComparison(): Promise<{
    passed: boolean;
    duration: number;
  }> {
    const startTime = performance.now();
    
    try {
      await this.mock.initialize({});
      
      // Test detection speed
      const testText = this.testData.texts[0];
      
      const binaryStart = performance.now();
      await this.bridge.detectPII(testText);
      const binaryTime = performance.now() - binaryStart;
      
      const mockStart = performance.now();
      await this.mock.detectPII(testText);
      const mockTime = performance.now() - mockStart;
      
      const speedRatio = binaryTime / mockTime;
      
      console.log(`  🏃 Binary time: ${binaryTime.toFixed(2)}ms`);
      console.log(`  🐌 Mock time: ${mockTime.toFixed(2)}ms`);
      console.log(`  📊 Speed ratio: ${speedRatio.toFixed(2)}x`);
      
      const duration = performance.now() - startTime;
      
      // Binary should be faster or at most 2x slower
      return {
        passed: speedRatio <= 2.0,
        duration
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      return { passed: false, duration };
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<{
    passed: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = performance.now();
    let passed = true;

    try {
      // Test with invalid input
      try {
        await this.bridge.detectPII('');
        console.log(`  ⚠️  Empty string should throw error`);
        passed = false;
      } catch {
        console.log(`  ✅ Empty string error handled correctly`);
      }

      // Test with very long input
      try {
        const longText = 'a'.repeat(1000000);
        await this.bridge.detectPII(longText);
        console.log(`  ✅ Long text processed successfully`);
      } catch {
        console.log(`  ⚠️  Long text processing failed`);
        passed = false;
      }

      const duration = performance.now() - startTime;
      return { passed, duration };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      return { passed: false, duration, error: error.message };
    }
  }

  /**
   * Run comparison tests with mock when binary not available
   */
  private async runMockComparisonTests(result: TestResult): Promise<void> {
    await this.mock.initialize({});
    
    // Test mock functionality
    for (const text of this.testData.texts) {
      const detections = await this.mock.detectPII(text);
      const masking = await this.mock.maskText(text);
      
      console.log(`  Mock detected ${detections.length} PII items`);
      console.log(`  Mock masked text: ${masking.maskedText.substring(0, 50)}...`);
    }
    
    result.recommendations.push(
      'Using mock implementation for development',
      'Install DataCloak binary for production use'
    );
  }

  /**
   * Get expected binary paths for platform
   */
  private getExpectedBinaryPaths(currentPlatform: string): string[] {
    const paths: string[] = [];
    
    // Environment variable path
    if (process.env.DATACLOAK_BINARY_PATH) {
      paths.push(process.env.DATACLOAK_BINARY_PATH);
    }
    
    // Package binary directory
    const packageBinDir = join(__dirname, '..', '..', '..', '..', 'security', 'bin');
    
    switch (currentPlatform) {
      case 'win32':
        paths.push(
          join(packageBinDir, 'windows', 'datacloak.exe'),
          'C:\\Program Files\\DataCloak\\datacloak.exe',
          'C:\\Program Files (x86)\\DataCloak\\datacloak.exe'
        );
        break;
      case 'darwin':
        paths.push(
          join(packageBinDir, 'macos', 'datacloak'),
          '/usr/local/bin/datacloak',
          '/Applications/DataCloak.app/Contents/MacOS/datacloak'
        );
        break;
      case 'linux':
        paths.push(
          join(packageBinDir, 'linux', 'datacloak'),
          '/usr/local/bin/datacloak',
          '/usr/bin/datacloak'
        );
        break;
    }
    
    return paths;
  }

  /**
   * Check if text contains unmasked PII
   */
  private containsUnmaskedPII(text: string): boolean {
    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/ // Credit card
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Print test results
   */
  private printResults(result: TestResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DataCloak FFI Integration Test Results');
    console.log('='.repeat(60));
    
    console.log(`\n🖥️  Platform: ${result.platform}`);
    console.log(`📍 Binary Found: ${result.binaryFound ? '✅' : '❌'}`);
    if (result.binaryPath) {
      console.log(`📂 Binary Path: ${result.binaryPath}`);
    }
    if (result.version) {
      console.log(`📋 Version: ${result.version}`);
    }
    
    console.log('\n📋 Test Results:');
    let passedCount = 0;
    for (const test of result.tests) {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.name} (${test.duration.toFixed(2)}ms)`);
      if (test.error) {
        console.log(`     └─ Error: ${test.error}`);
      }
      if (test.passed) passedCount++;
    }
    
    console.log(`\n📊 Overall: ${passedCount}/${result.tests.length} tests passed`);
    
    if (result.performance.detectPII > 0) {
      console.log('\n⚡ Performance Metrics:');
      console.log(`  - PII Detection: ${result.performance.detectPII.toFixed(2)}ms avg`);
      console.log(`  - Text Masking: ${result.performance.maskText.toFixed(2)}ms avg`);
      console.log(`  - Security Audit: ${result.performance.auditSecurity.toFixed(2)}ms avg`);
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new DataCloakFFITest();
  test.runTests().then(() => {
    console.log('\n✅ FFI integration tests completed');
  }).catch(error => {
    console.error('\n❌ FFI integration tests failed:', error);
    process.exit(1);
  });
}