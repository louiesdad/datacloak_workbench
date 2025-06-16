import React, { useState, useCallback, useEffect } from 'react';

interface CustomPattern {
  id: string;
  name: string;
  description: string;
  regex: string;
  testCases: {
    input: string;
    shouldMatch: boolean;
    description: string;
  }[];
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceThreshold: number;
  isValid: boolean;
  validationErrors: string[];
  performance: {
    testTime: number;
    matches: number;
    falsePositives: number;
  } | null;
}

interface PatternValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  performance: {
    executionTime: number;
    complexity: 'low' | 'medium' | 'high' | 'catastrophic';
  };
}

const PATTERN_CATEGORIES = [
  'Personal Identifiers',
  'Financial Information',
  'Healthcare Data',
  'Government IDs',
  'Technical Identifiers',
  'Custom Business Data'
];

const PREDEFINED_PATTERNS = [
  {
    name: 'Driver\'s License (US)',
    regex: '^[A-Z]{1,2}[0-9]{6,8}$',
    description: 'US driver\'s license number format',
    testCases: [
      { input: 'D12345678', shouldMatch: true, description: 'Valid DL format' },
      { input: 'ABC123456', shouldMatch: false, description: 'Too many letters' },
      { input: 'D123', shouldMatch: false, description: 'Too short' }
    ]
  },
  {
    name: 'Medical Record Number',
    regex: '^MRN[0-9]{6,10}$',
    description: 'Medical record number with MRN prefix',
    testCases: [
      { input: 'MRN1234567', shouldMatch: true, description: 'Valid MRN' },
      { input: 'MR1234567', shouldMatch: false, description: 'Invalid prefix' },
      { input: 'MRN123', shouldMatch: false, description: 'Too short' }
    ]
  },
  {
    name: 'IBAN',
    regex: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$',
    description: 'International Bank Account Number',
    testCases: [
      { input: 'GB29NWBK60161331926819', shouldMatch: true, description: 'Valid UK IBAN' },
      { input: 'DE89370400440532013000', shouldMatch: true, description: 'Valid German IBAN' },
      { input: 'GB29NWBK', shouldMatch: false, description: 'Too short' }
    ]
  }
];

interface CustomPatternBuilderProps {
  onPatternSave: (pattern: CustomPattern) => void;
  existingPatterns: CustomPattern[];
  onPatternUpdate: (pattern: CustomPattern) => void;
  editingPattern?: CustomPattern | null;
}

const CustomPatternBuilder: React.FC<CustomPatternBuilderProps> = ({
  onPatternSave,
  existingPatterns,
  onPatternUpdate,
  editingPattern = null
}) => {
  const [currentPattern, setCurrentPattern] = useState<CustomPattern>({
    id: '',
    name: '',
    description: '',
    regex: '',
    testCases: [{ input: '', shouldMatch: true, description: '' }],
    category: 'Personal Identifiers',
    riskLevel: 'medium',
    confidenceThreshold: 0.8,
    isValid: false,
    validationErrors: [],
    performance: null
  });

  const [testInput, setTestInput] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<PatternValidationResult | null>(null);
  const [isTestingPerformance, setIsTestingPerformance] = useState(false);

  // Load editing pattern
  useEffect(() => {
    if (editingPattern) {
      setCurrentPattern(editingPattern);
    }
  }, [editingPattern]);

  const validateRegex = useCallback((regex: string): PatternValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isValid = true;
    let complexity: 'low' | 'medium' | 'high' | 'catastrophic' = 'low';

    try {
      // Test if regex is valid
      new RegExp(regex);
      
      // Performance and complexity analysis
      const start = performance.now();
      const testString = 'a'.repeat(1000);
      const testRegex = new RegExp(regex, 'g');
      
      // Test against a large string to detect potential ReDoS
      testRegex.test(testString);
      const executionTime = performance.now() - start;
      
      // Complexity analysis
      if (regex.includes('.*.*') || regex.includes('.+.+')) {
        complexity = 'catastrophic';
        errors.push('Potential ReDoS vulnerability detected - avoid nested quantifiers');
        isValid = false;
      } else if (regex.includes('.*') || regex.includes('.+')) {
        complexity = 'high';
        warnings.push('High complexity - consider more specific patterns');
      } else if (regex.includes('+') || regex.includes('*') || regex.includes('{')) {
        complexity = 'medium';
      }

      // Common issues
      if (regex.length > 200) {
        warnings.push('Very long regex - consider breaking into smaller patterns');
      }
      
      if (!regex.includes('^') && !regex.includes('$')) {
        warnings.push('Consider adding anchors (^ and $) for exact matching');
      }

      // Test against common false positives
      const commonFalsePositives = ['', '123', 'abc', 'test@test', '000-00-0000'];
      const regexTest = new RegExp(regex);
      const falsePositiveMatches = commonFalsePositives.filter(fp => regexTest.test(fp));
      
      if (falsePositiveMatches.length > 0) {
        warnings.push(`Potential false positives: ${falsePositiveMatches.join(', ')}`);
      }

      return {
        isValid,
        errors,
        warnings,
        performance: {
          executionTime,
          complexity
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid regex: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        performance: {
          executionTime: 0,
          complexity: 'low'
        }
      };
    }
  }, []);

  const handleRegexChange = (regex: string) => {
    const validation = validateRegex(regex);
    setValidationResult(validation);
    
    setCurrentPattern(prev => ({
      ...prev,
      regex,
      isValid: validation.isValid,
      validationErrors: validation.errors
    }));
  };

  const testPattern = () => {
    if (!currentPattern.regex || !testInput) return;

    try {
      const regex = new RegExp(currentPattern.regex, 'gi');
      const matches = testInput.match(regex) || [];
      
      setTestResults([
        {
          input: testInput,
          matches: matches,
          matchCount: matches.length,
          isMatch: matches.length > 0,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      setTestResults([
        {
          input: testInput,
          error: error instanceof Error ? error.message : 'Test failed',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  const runTestCases = () => {
    const results = currentPattern.testCases.map((testCase, index) => {
      if (!testCase.input) return { ...testCase, result: 'skipped', index };

      try {
        const regex = new RegExp(currentPattern.regex);
        const isMatch = regex.test(testCase.input);
        const isPassed = isMatch === testCase.shouldMatch;
        
        return {
          ...testCase,
          result: isPassed ? 'passed' : 'failed',
          actualMatch: isMatch,
          index
        };
      } catch (error) {
        return {
          ...testCase,
          result: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          index
        };
      }
    });

    setTestResults(results);
  };

  const performanceTest = async () => {
    if (!currentPattern.regex) return;

    setIsTestingPerformance(true);
    
    try {
      const testData = [
        'john.doe@example.com',
        '555-123-4567',
        '123-45-6789',
        '4532-1234-5678-9012',
        'random text that should not match',
        'another@email.test',
        '(555) 987-6543',
        'mixed data 123-45-6789 with email test@domain.com',
        ...Array(100).fill(0).map((_, i) => `test_data_${i}@example.com`)
      ];

      const regex = new RegExp(currentPattern.regex, 'g');
      const start = performance.now();
      
      let totalMatches = 0;
      let falsePositives = 0;
      
      testData.forEach(data => {
        const matches = data.match(regex);
        if (matches) {
          totalMatches += matches.length;
          // Simple heuristic for false positives
          if (data.includes('random') || data.includes('should not match')) {
            falsePositives++;
          }
        }
      });
      
      const testTime = performance.now() - start;
      
      setCurrentPattern(prev => ({
        ...prev,
        performance: {
          testTime,
          matches: totalMatches,
          falsePositives
        }
      }));
    } finally {
      setIsTestingPerformance(false);
    }
  };

  const addTestCase = () => {
    setCurrentPattern(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', shouldMatch: true, description: '' }]
    }));
  };

  const updateTestCase = (index: number, field: string, value: any) => {
    setCurrentPattern(prev => ({
      ...prev,
      testCases: prev.testCases.map((tc, i) => 
        i === index ? { ...tc, [field]: value } : tc
      )
    }));
  };

  const removeTestCase = (index: number) => {
    setCurrentPattern(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index)
    }));
  };

  const loadPredefinedPattern = (pattern: typeof PREDEFINED_PATTERNS[0]) => {
    setCurrentPattern(prev => ({
      ...prev,
      name: pattern.name,
      description: pattern.description,
      regex: pattern.regex,
      testCases: pattern.testCases,
      id: Date.now().toString()
    }));
    handleRegexChange(pattern.regex);
  };

  const savePattern = () => {
    if (!currentPattern.isValid || !currentPattern.name || !currentPattern.regex) {
      return;
    }

    const patternToSave = {
      ...currentPattern,
      id: currentPattern.id || Date.now().toString()
    };

    if (editingPattern) {
      onPatternUpdate(patternToSave);
    } else {
      onPatternSave(patternToSave);
    }

    // Reset form
    setCurrentPattern({
      id: '',
      name: '',
      description: '',
      regex: '',
      testCases: [{ input: '', shouldMatch: true, description: '' }],
      category: 'Personal Identifiers',
      riskLevel: 'medium',
      confidenceThreshold: 0.8,
      isValid: false,
      validationErrors: [],
      performance: null
    });
    setTestResults([]);
    setValidationResult(null);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'catastrophic': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="custom-pattern-builder space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {editingPattern ? 'Edit Custom Pattern' : 'Create Custom Pattern'}
        </h2>

        {/* Quick Start Templates */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Start Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PREDEFINED_PATTERNS.map((pattern, index) => (
              <button
                key={index}
                className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50"
                onClick={() => loadPredefinedPattern(pattern)}
              >
                <div className="font-medium text-sm text-gray-900">{pattern.name}</div>
                <div className="text-xs text-gray-500 mt-1">{pattern.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern Name *
              </label>
              <input
                type="text"
                value={currentPattern.name}
                onChange={(e) => setCurrentPattern(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Employee ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={currentPattern.description}
                onChange={(e) => setCurrentPattern(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Describe what this pattern detects..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={currentPattern.category}
                onChange={(e) => setCurrentPattern(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PATTERN_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risk Level
                </label>
                <select
                  value={currentPattern.riskLevel}
                  onChange={(e) => setCurrentPattern(prev => ({ ...prev, riskLevel: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confidence Threshold
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={currentPattern.confidenceThreshold}
                  onChange={(e) => setCurrentPattern(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(currentPattern.confidenceThreshold * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Regular Expression *
              </label>
              <textarea
                value={currentPattern.regex}
                onChange={(e) => handleRegexChange(e.target.value)}
                className={`w-full border rounded-md px-3 py-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 ${
                  validationResult?.isValid === false ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                rows={3}
                placeholder="Enter your regex pattern..."
              />
            </div>

            {/* Validation Results */}
            {validationResult && (
              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-900 mb-1">Validation Errors</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-yellow-900 mb-1">Warnings</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Complexity</span>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getComplexityColor(validationResult.performance.complexity)}`}>
                      {validationResult.performance.complexity.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Execution time: {validationResult.performance.executionTime.toFixed(2)}ms
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Cases */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Test Cases</h3>
          <button
            onClick={addTestCase}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Add Test Case
          </button>
        </div>

        <div className="space-y-3">
          {currentPattern.testCases.map((testCase, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 border border-gray-200 rounded-lg">
              <div className="col-span-4">
                <input
                  type="text"
                  value={testCase.input}
                  onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Test input..."
                />
              </div>
              <div className="col-span-2">
                <select
                  value={testCase.shouldMatch ? 'match' : 'no-match'}
                  onChange={(e) => updateTestCase(index, 'shouldMatch', e.target.value === 'match')}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="match">Should Match</option>
                  <option value="no-match">Should Not Match</option>
                </select>
              </div>
              <div className="col-span-4">
                <input
                  type="text"
                  value={testCase.description}
                  onChange={(e) => updateTestCase(index, 'description', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Description..."
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => removeTestCase(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                  disabled={currentPattern.testCases.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-4 mt-4">
          <button
            onClick={runTestCases}
            disabled={!currentPattern.regex}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            Run Test Cases
          </button>
          
          <button
            onClick={performanceTest}
            disabled={!currentPattern.regex || isTestingPerformance}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isTestingPerformance ? 'Testing...' : 'Performance Test'}
          </button>
        </div>
      </div>

      {/* Quick Test */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Test</h3>
        
        <div className="flex space-x-4">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter text to test against your pattern..."
          />
          <button
            onClick={testPattern}
            disabled={!currentPattern.regex || !testInput}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Test
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Test Results</h3>
          
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                result.result === 'passed' ? 'bg-green-50 border-green-200' :
                result.result === 'failed' ? 'bg-red-50 border-red-200' :
                result.error ? 'bg-red-50 border-red-200' :
                result.isMatch ? 'bg-green-50 border-green-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono">{result.input}</code>
                  <div className="flex items-center space-x-2">
                    {result.result && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.result === 'passed' ? 'bg-green-100 text-green-800' :
                        result.result === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {result.result.toUpperCase()}
                      </span>
                    )}
                    {result.matchCount !== undefined && (
                      <span className="text-xs text-gray-600">
                        {result.matchCount} matches
                      </span>
                    )}
                  </div>
                </div>
                
                {result.matches && result.matches.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-600">Matches: </span>
                    {result.matches.map((match: string, i: number) => (
                      <code key={i} className="text-xs bg-blue-100 text-blue-800 px-1 rounded mr-1">
                        {match}
                      </code>
                    ))}
                  </div>
                )}
                
                {result.error && (
                  <div className="mt-2 text-xs text-red-600">
                    Error: {result.error}
                  </div>
                )}

                {result.description && (
                  <div className="mt-1 text-xs text-gray-600">
                    {result.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Results */}
      {currentPattern.performance && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {currentPattern.performance.testTime.toFixed(2)}ms
              </div>
              <div className="text-sm text-gray-600">Execution Time</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {currentPattern.performance.matches}
              </div>
              <div className="text-sm text-gray-600">Total Matches</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {currentPattern.performance.falsePositives}
              </div>
              <div className="text-sm text-gray-600">Potential False Positives</div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePattern}
          disabled={!currentPattern.isValid || !currentPattern.name || !currentPattern.regex}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {editingPattern ? 'Update Pattern' : 'Save Pattern'}
        </button>
      </div>
    </div>
  );
};

export default CustomPatternBuilder;