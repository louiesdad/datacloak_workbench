import React, { useState, useEffect } from 'react';

interface ValidationResult {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'syntax' | 'logic' | 'performance' | 'security' | 'compliance';
  title: string;
  description: string;
  location: {
    component: string;
    line?: number;
    field?: string;
  };
  suggestion: string;
  autoFixAvailable: boolean;
  impact: string;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  input: string;
  expectedOutput: {
    shouldMatch: boolean;
    transformationType?: string;
    maskedPattern?: string;
  };
  status: 'pending' | 'running' | 'passed' | 'failed';
  result?: {
    actualOutput: string;
    processingTime: number;
    errors: string[];
  };
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'patterns' | 'transformations' | 'rules' | 'performance' | 'security';
  testCases: TestCase[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

interface PerformanceMetrics {
  throughput: {
    records_per_second: number;
    avg_processing_time_ms: number;
    peak_memory_usage_mb: number;
  };
  accuracy: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  coverage: {
    patterns_tested: number;
    rules_tested: number;
    edge_cases_covered: number;
    compliance_frameworks_validated: number;
  };
}

interface ConfigurationValidationTesterProps {
  configuration: any; // The current configuration to validate
  onValidationComplete: (results: ValidationResult[]) => void;
  onTestSuiteComplete: (results: TestSuite[]) => void;
  onPerformanceMetrics: (metrics: PerformanceMetrics) => void;
}

const TEST_SUITES: Omit<TestSuite, 'results' | 'status'>[] = [
  {
    id: 'pattern_validation',
    name: 'Pattern Validation',
    description: 'Test regex patterns for correctness and performance',
    category: 'patterns',
    testCases: [
      {
        id: 'email_basic',
        name: 'Email - Basic Format',
        description: 'Test basic email pattern detection',
        input: 'user@example.com',
        expectedOutput: { shouldMatch: true },
        status: 'pending'
      },
      {
        id: 'email_complex',
        name: 'Email - Complex Format',
        description: 'Test complex email with subdomain',
        input: 'user.name+tag@subdomain.example.co.uk',
        expectedOutput: { shouldMatch: true },
        status: 'pending'
      },
      {
        id: 'email_invalid',
        name: 'Email - Invalid Format',
        description: 'Ensure invalid emails are not matched',
        input: 'invalid.email.format',
        expectedOutput: { shouldMatch: false },
        status: 'pending'
      }
    ]
  },
  {
    id: 'transformation_rules',
    name: 'Transformation Rules',
    description: 'Test data transformation and masking rules',
    category: 'transformations',
    testCases: [
      {
        id: 'ssn_masking',
        name: 'SSN Masking',
        description: 'Test SSN masking transformation',
        input: '123-45-6789',
        expectedOutput: { shouldMatch: true, transformationType: 'mask', maskedPattern: 'XXX-XX-6789' },
        status: 'pending'
      },
      {
        id: 'credit_card_tokenization',
        name: 'Credit Card Tokenization',
        description: 'Test credit card tokenization',
        input: '4532-1234-5678-9012',
        expectedOutput: { shouldMatch: true, transformationType: 'tokenize' },
        status: 'pending'
      }
    ]
  },
  {
    id: 'performance_testing',
    name: 'Performance Testing',
    description: 'Test system performance under load',
    category: 'performance',
    testCases: [
      {
        id: 'large_dataset',
        name: 'Large Dataset Processing',
        description: 'Process 10,000 records and measure performance',
        input: 'large_dataset_simulation',
        expectedOutput: { shouldMatch: true },
        status: 'pending'
      },
      {
        id: 'concurrent_requests',
        name: 'Concurrent Requests',
        description: 'Handle multiple simultaneous processing requests',
        input: 'concurrent_simulation',
        expectedOutput: { shouldMatch: true },
        status: 'pending'
      }
    ]
  },
  {
    id: 'security_validation',
    name: 'Security Validation',
    description: 'Test security controls and access restrictions',
    category: 'security',
    testCases: [
      {
        id: 'unauthorized_access',
        name: 'Unauthorized Access Prevention',
        description: 'Ensure unauthorized users cannot access sensitive data',
        input: 'unauthorized_user_simulation',
        expectedOutput: { shouldMatch: false },
        status: 'pending'
      },
      {
        id: 'data_leakage_prevention',
        name: 'Data Leakage Prevention',
        description: 'Verify no PII leaks in logs or outputs',
        input: 'pii_leakage_test',
        expectedOutput: { shouldMatch: false },
        status: 'pending'
      }
    ]
  }
];

const ConfigurationValidationTester: React.FC<ConfigurationValidationTesterProps> = ({
  configuration,
  onValidationComplete,
  onTestSuiteComplete,
  onPerformanceMetrics
}) => {
  const [activeTab, setActiveTab] = useState<'validation' | 'testing' | 'performance' | 'reports'>('validation');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [selectedTestSuite, setSelectedTestSuite] = useState<string>('');

  useEffect(() => {
    // Initialize test suites
    setTestSuites(TEST_SUITES.map(suite => ({
      ...suite,
      status: 'pending',
      results: { total: 0, passed: 0, failed: 0, duration: 0 }
    })));
  }, []);

  const runValidation = async () => {
    setIsValidating(true);
    setValidationResults([]);

    try {
      // Simulate validation process
      const results: ValidationResult[] = [];

      // Check for basic configuration issues
      if (!configuration.patterns || configuration.patterns.length === 0) {
        results.push({
          id: 'no_patterns',
          type: 'error',
          severity: 'high',
          category: 'logic',
          title: 'No Patterns Configured',
          description: 'No detection patterns are configured. At least one pattern is required.',
          location: { component: 'patterns' },
          suggestion: 'Add at least one detection pattern to enable data processing.',
          autoFixAvailable: false,
          impact: 'Data processing will not function without patterns.'
        });
      }

      // Check for regex syntax issues
      configuration.patterns?.forEach((pattern: any, index: number) => {
        try {
          new RegExp(pattern.regex);
        } catch (error) {
          results.push({
            id: `invalid_regex_${index}`,
            type: 'error',
            severity: 'critical',
            category: 'syntax',
            title: 'Invalid Regular Expression',
            description: `Pattern "${pattern.name}" contains invalid regex: ${error}`,
            location: { component: 'patterns', line: index + 1, field: 'regex' },
            suggestion: 'Fix the regular expression syntax or use the pattern builder.',
            autoFixAvailable: false,
            impact: 'This pattern will not function and may cause processing errors.'
          });
        }
      });

      // Check for performance issues
      configuration.patterns?.forEach((pattern: any, index: number) => {
        if (pattern.regex.includes('.*.*') || pattern.regex.includes('.+.+')) {
          results.push({
            id: `redos_risk_${index}`,
            type: 'warning',
            severity: 'high',
            category: 'performance',
            title: 'ReDoS Vulnerability Risk',
            description: `Pattern "${pattern.name}" may be vulnerable to Regular Expression Denial of Service attacks.`,
            location: { component: 'patterns', line: index + 1, field: 'regex' },
            suggestion: 'Optimize the regex to avoid nested quantifiers.',
            autoFixAvailable: true,
            impact: 'May cause severe performance degradation or system unavailability.'
          });
        }
      });

      // Check for security issues
      if (!configuration.global_settings?.audit_level || configuration.global_settings.audit_level === 'minimal') {
        results.push({
          id: 'minimal_auditing',
          type: 'warning',
          severity: 'medium',
          category: 'security',
          title: 'Minimal Audit Logging',
          description: 'Audit logging is set to minimal, which may not meet compliance requirements.',
          location: { component: 'global_settings', field: 'audit_level' },
          suggestion: 'Consider using "standard" or "comprehensive" audit logging.',
          autoFixAvailable: true,
          impact: 'May not meet compliance requirements for audit trails.'
        });
      }

      // Check for compliance issues
      const hasGDPRPatterns = configuration.patterns?.some((p: any) => 
        p.metadata?.compliance_frameworks?.includes('GDPR')
      );
      if (!hasGDPRPatterns) {
        results.push({
          id: 'no_gdpr_patterns',
          type: 'info',
          severity: 'low',
          category: 'compliance',
          title: 'No GDPR-Specific Patterns',
          description: 'No patterns are specifically tagged for GDPR compliance.',
          location: { component: 'patterns' },
          suggestion: 'Consider adding GDPR-specific patterns if processing EU data.',
          autoFixAvailable: false,
          impact: 'May not fully comply with GDPR requirements.'
        });
      }

      // Add success message if no critical issues
      if (results.filter(r => r.severity === 'critical').length === 0) {
        results.push({
          id: 'validation_success',
          type: 'success',
          severity: 'low',
          category: 'logic',
          title: 'Configuration Valid',
          description: 'Basic configuration validation passed with no critical issues.',
          location: { component: 'global' },
          suggestion: 'Review warnings and optimize as needed.',
          autoFixAvailable: false,
          impact: 'Configuration is ready for production use.'
        });
      }

      setValidationResults(results);
      onValidationComplete(results);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const runTestSuite = async (suiteId: string) => {
    setIsRunningTests(true);
    
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;

    // Update suite status to running
    setTestSuites(prev => prev.map(s => 
      s.id === suiteId ? { ...s, status: 'running' } : s
    ));

    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (const testCase of suite.testCases) {
      // Update test case status to running
      setTestSuites(prev => prev.map(s => 
        s.id === suiteId 
          ? { 
              ...s, 
              testCases: s.testCases.map(tc => 
                tc.id === testCase.id ? { ...tc, status: 'running' } : tc
              )
            }
          : s
      ));

      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Simulate test results
      const success = Math.random() > 0.2; // 80% success rate
      const result = {
        actualOutput: success ? testCase.input + '_processed' : 'error',
        processingTime: Math.random() * 100,
        errors: success ? [] : ['Simulated test failure']
      };

      if (success) passed++;
      else failed++;

      // Update test case with results
      setTestSuites(prev => prev.map(s => 
        s.id === suiteId 
          ? { 
              ...s, 
              testCases: s.testCases.map(tc => 
                tc.id === testCase.id 
                  ? { ...tc, status: success ? 'passed' : 'failed', result }
                  : tc
              )
            }
          : s
      ));
    }

    const duration = Date.now() - startTime;

    // Update suite with final results
    setTestSuites(prev => prev.map(s => 
      s.id === suiteId 
        ? { 
            ...s, 
            status: 'completed',
            results: {
              total: suite.testCases.length,
              passed,
              failed,
              duration
            }
          }
        : s
    ));

    setIsRunningTests(false);
    onTestSuiteComplete(testSuites);
  };

  const runPerformanceTest = async () => {
    // Simulate performance testing
    const metrics: PerformanceMetrics = {
      throughput: {
        records_per_second: Math.floor(Math.random() * 1000) + 500,
        avg_processing_time_ms: Math.random() * 10 + 1,
        peak_memory_usage_mb: Math.floor(Math.random() * 256) + 128
      },
      accuracy: {
        true_positives: 850,
        false_positives: 45,
        true_negatives: 920,
        false_negatives: 35,
        precision: 0.95,
        recall: 0.96,
        f1_score: 0.955
      },
      coverage: {
        patterns_tested: configuration.patterns?.length || 0,
        rules_tested: configuration.rules?.length || 0,
        edge_cases_covered: 25,
        compliance_frameworks_validated: 3
      }
    };

    setPerformanceMetrics(metrics);
    onPerformanceMetrics(metrics);
  };

  const getValidationIcon = (type: string) => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📋';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'syntax': return 'text-red-600 bg-red-100';
      case 'logic': return 'text-blue-600 bg-blue-100';
      case 'performance': return 'text-orange-600 bg-orange-100';
      case 'security': return 'text-purple-600 bg-purple-100';
      case 'compliance': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="configuration-validation-tester">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration Validation & Testing</h2>
        <p className="text-gray-600">
          Validate configuration integrity, run comprehensive tests, and analyze performance metrics.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'validation', label: 'Configuration Validation', icon: '✅', count: validationResults.length },
            { id: 'testing', label: 'Test Suites', icon: '🧪', count: testSuites.length },
            { id: 'performance', label: 'Performance Metrics', icon: '📊' },
            { id: 'reports', label: 'Test Reports', icon: '📈' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'validation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Configuration Validation</h3>
            <button
              onClick={runValidation}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isValidating ? 'Validating...' : 'Run Validation'}
            </button>
          </div>

          {validationResults.length === 0 && !isValidating && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Validate</h3>
              <p className="text-gray-600 mb-4">
                Run configuration validation to check for errors, warnings, and optimization opportunities.
              </p>
            </div>
          )}

          {isValidating && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Validating Configuration</h3>
              <p className="text-gray-600">Checking patterns, rules, and settings...</p>
            </div>
          )}

          {validationResults.length > 0 && (
            <div className="space-y-4">
              {validationResults.map((result) => (
                <div key={result.id} className={`border rounded-lg p-6 ${getSeverityColor(result.severity)}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getValidationIcon(result.type)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{result.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${getCategoryColor(result.category)}`}>
                            {result.category.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {result.location.component}{result.location.field && `.${result.location.field}`}
                            {result.location.line && ` (Line ${result.location.line})`}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {result.autoFixAvailable && (
                      <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                        Auto Fix
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Description</h5>
                      <p className="text-sm text-gray-600">{result.description}</p>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Suggestion</h5>
                      <p className="text-sm text-gray-600">{result.suggestion}</p>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Impact</h5>
                      <p className="text-sm text-gray-600">{result.impact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'testing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Test Suites</h3>
            <div className="flex items-center space-x-4">
              <select
                value={selectedTestSuite}
                onChange={(e) => setSelectedTestSuite(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Test Suite</option>
                {testSuites.map(suite => (
                  <option key={suite.id} value={suite.id}>{suite.name}</option>
                ))}
              </select>
              <button
                onClick={() => selectedTestSuite && runTestSuite(selectedTestSuite)}
                disabled={!selectedTestSuite || isRunningTests}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {isRunningTests ? 'Running...' : 'Run Tests'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testSuites.map((suite) => (
              <div key={suite.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{suite.name}</h4>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getTestStatusColor(suite.status)}`}>
                      {suite.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">{suite.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="text-xs text-gray-500">
                    {suite.testCases.length} test cases
                  </div>
                  {suite.status === 'completed' && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-bold text-green-600">{suite.results.passed}</div>
                        <div className="text-gray-600">Passed</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="font-bold text-red-600">{suite.results.failed}</div>
                        <div className="text-gray-600">Failed</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="font-bold text-blue-600">{suite.results.duration}ms</div>
                        <div className="text-gray-600">Duration</div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => runTestSuite(suite.id)}
                  disabled={isRunningTests}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {suite.status === 'running' ? 'Running...' : 'Run Suite'}
                </button>

                {/* Test Cases Details */}
                {suite.testCases.some(tc => tc.status !== 'pending') && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium text-gray-700">Test Cases</h5>
                    {suite.testCases.map((testCase) => (
                      <div key={testCase.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                        <span className="text-xs text-gray-700 truncate">{testCase.name}</span>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${getTestStatusColor(testCase.status)}`}>
                          {testCase.status === 'running' ? '⏳' : testCase.status === 'passed' ? '✅' : testCase.status === 'failed' ? '❌' : '⭕'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
            <button
              onClick={runPerformanceTest}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Run Performance Test
            </button>
          </div>

          {!performanceMetrics && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Data</h3>
              <p className="text-gray-600 mb-4">
                Run performance tests to analyze system throughput, accuracy, and coverage metrics.
              </p>
            </div>
          )}

          {performanceMetrics && (
            <div className="space-y-6">
              {/* Throughput Metrics */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Throughput Performance</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {performanceMetrics.throughput.records_per_second.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Records/Second</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {performanceMetrics.throughput.avg_processing_time_ms.toFixed(2)}ms
                    </div>
                    <div className="text-sm text-gray-600">Avg Processing Time</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {performanceMetrics.throughput.peak_memory_usage_mb}MB
                    </div>
                    <div className="text-sm text-gray-600">Peak Memory Usage</div>
                  </div>
                </div>
              </div>

              {/* Accuracy Metrics */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Accuracy Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {(performanceMetrics.accuracy.precision * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Precision</div>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">
                      {(performanceMetrics.accuracy.recall * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Recall</div>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <div className="text-2xl font-bold text-pink-600">
                      {(performanceMetrics.accuracy.f1_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">F1 Score</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border border-gray-200 rounded">
                    <div className="text-lg font-bold text-green-600">{performanceMetrics.accuracy.true_positives}</div>
                    <div className="text-xs text-gray-600">True Positives</div>
                  </div>
                  <div className="text-center p-3 border border-gray-200 rounded">
                    <div className="text-lg font-bold text-red-600">{performanceMetrics.accuracy.false_positives}</div>
                    <div className="text-xs text-gray-600">False Positives</div>
                  </div>
                  <div className="text-center p-3 border border-gray-200 rounded">
                    <div className="text-lg font-bold text-green-600">{performanceMetrics.accuracy.true_negatives}</div>
                    <div className="text-xs text-gray-600">True Negatives</div>
                  </div>
                  <div className="text-center p-3 border border-gray-200 rounded">
                    <div className="text-lg font-bold text-red-600">{performanceMetrics.accuracy.false_negatives}</div>
                    <div className="text-xs text-gray-600">False Negatives</div>
                  </div>
                </div>
              </div>

              {/* Coverage Metrics */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Test Coverage</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {performanceMetrics.coverage.patterns_tested}
                    </div>
                    <div className="text-sm text-gray-600">Patterns Tested</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {performanceMetrics.coverage.rules_tested}
                    </div>
                    <div className="text-sm text-gray-600">Rules Tested</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {performanceMetrics.coverage.edge_cases_covered}
                    </div>
                    <div className="text-sm text-gray-600">Edge Cases</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {performanceMetrics.coverage.compliance_frameworks_validated}
                    </div>
                    <div className="text-sm text-gray-600">Frameworks</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Test Reports & Analysis</h3>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Summary Report</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {validationResults.filter(r => r.type === 'error').length}
                </div>
                <div className="text-sm text-gray-600">Configuration Errors</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {testSuites.reduce((sum, suite) => sum + suite.results.passed, 0)}
                </div>
                <div className="text-sm text-gray-600">Tests Passed</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {performanceMetrics ? `${(performanceMetrics.accuracy.f1_score * 100).toFixed(1)}%` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Overall Accuracy</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h5 className="font-medium text-gray-900 mb-2">Recommendations</h5>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Review and fix any critical validation errors before deployment</li>
                <li>• Optimize patterns with ReDoS vulnerability warnings</li>
                <li>• Consider increasing audit logging level for compliance</li>
                <li>• Run performance tests regularly to monitor system health</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationValidationTester;