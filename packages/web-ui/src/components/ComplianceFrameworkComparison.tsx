import React, { useState } from 'react';

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
  requirements: {
    category: string;
    items: string[];
  }[];
  penalties: {
    financial: string;
    legal: string;
  };
  implementation_complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  data_residency: string[];
  breach_notification: string;
}

const ENHANCED_COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'general',
    name: 'General PII',
    description: 'Basic personal information protection',
    patterns: ['email', 'phone', 'ssn', 'address'],
    riskLevel: 'medium',
    icon: '🔒',
    requirements: [
      {
        category: 'Data Protection',
        items: ['Basic encryption', 'Access controls', 'Data minimization']
      },
      {
        category: 'Documentation',
        items: ['Data inventory', 'Processing records', 'Policy documentation']
      }
    ],
    penalties: {
      financial: 'Varies by jurisdiction',
      legal: 'Civil liability'
    },
    implementation_complexity: 'simple',
    data_residency: ['Any jurisdiction'],
    breach_notification: '72 hours to authorities'
  },
  {
    id: 'hipaa',
    name: 'HIPAA Healthcare',
    description: 'Medical records and healthcare data protection',
    patterns: ['ssn', 'medical_record_number', 'date_of_birth', 'phone', 'email', 'address', 'patient_id'],
    riskLevel: 'critical',
    icon: '🏥',
    requirements: [
      {
        category: 'Administrative Safeguards',
        items: ['Security officer', 'Workforce training', 'Access management', 'Contingency plan']
      },
      {
        category: 'Physical Safeguards',
        items: ['Facility access controls', 'Workstation security', 'Media controls']
      },
      {
        category: 'Technical Safeguards',
        items: ['Access control', 'Audit controls', 'Integrity', 'Transmission security']
      }
    ],
    penalties: {
      financial: 'Up to $1.5M per incident',
      legal: 'Criminal charges possible'
    },
    implementation_complexity: 'very_complex',
    data_residency: ['United States'],
    breach_notification: '60 days to HHS, 60 days to individuals'
  },
  {
    id: 'financial',
    name: 'PCI-DSS Financial',
    description: 'Credit card and financial data protection',
    patterns: ['credit_card', 'bank_account', 'ssn', 'phone', 'email', 'iban', 'routing_number'],
    riskLevel: 'critical',
    icon: '💳',
    requirements: [
      {
        category: 'Build and Maintain',
        items: ['Secure network', 'Vendor-supplied defaults', 'Stored cardholder data protection']
      },
      {
        category: 'Protect',
        items: ['Encrypted transmission', 'Anti-virus software', 'Secure systems']
      },
      {
        category: 'Monitor and Test',
        items: ['Access monitoring', 'Regular testing', 'Information security policy']
      }
    ],
    penalties: {
      financial: 'Up to $100,000 per month',
      legal: 'Card brand sanctions'
    },
    implementation_complexity: 'complex',
    data_residency: ['Secure processing environment'],
    breach_notification: 'Immediate to card brands'
  },
  {
    id: 'gdpr',
    name: 'GDPR European',
    description: 'EU General Data Protection Regulation compliance',
    patterns: ['email', 'phone', 'address', 'name', 'ip_address', 'date_of_birth', 'passport', 'id_number'],
    riskLevel: 'high',
    icon: '🇪🇺',
    requirements: [
      {
        category: 'Lawful Basis',
        items: ['Consent', 'Contract', 'Legal obligation', 'Vital interests', 'Public task', 'Legitimate interests']
      },
      {
        category: 'Individual Rights',
        items: ['Right to access', 'Right to rectification', 'Right to erasure', 'Right to portability']
      },
      {
        category: 'Governance',
        items: ['Privacy by design', 'Data protection impact assessments', 'Records of processing']
      }
    ],
    penalties: {
      financial: 'Up to 4% of global revenue or €20M',
      legal: 'Regulatory sanctions'
    },
    implementation_complexity: 'complex',
    data_residency: ['EU/EEA or adequate countries'],
    breach_notification: '72 hours to DPA, 72 hours to individuals'
  },
  {
    id: 'custom',
    name: 'Custom Patterns',
    description: 'Define your own pattern detection rules',
    patterns: [],
    riskLevel: 'medium',
    icon: '⚙️',
    requirements: [
      {
        category: 'Pattern Definition',
        items: ['Regular expressions', 'Validation rules', 'Confidence thresholds']
      },
      {
        category: 'Testing',
        items: ['Pattern validation', 'False positive testing', 'Performance benchmarks']
      }
    ],
    penalties: {
      financial: 'Based on applicable regulations',
      legal: 'Varies by jurisdiction'
    },
    implementation_complexity: 'moderate',
    data_residency: ['As per business requirements'],
    breach_notification: 'As per applicable regulations'
  }
];

interface ComplianceFrameworkComparisonProps {
  selectedFrameworks: string[];
  onFrameworkToggle: (frameworkId: string) => void;
  onFrameworkSelect: (framework: ComplianceFramework) => void;
}

const ComplianceFrameworkComparison: React.FC<ComplianceFrameworkComparisonProps> = ({
  selectedFrameworks,
  onFrameworkToggle,
  onFrameworkSelect
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'comparison'>('grid');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'text-green-600 bg-green-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'complex': return 'text-orange-600 bg-orange-100';
      case 'very_complex': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const selectedFrameworkObjects = ENHANCED_COMPLIANCE_FRAMEWORKS.filter(f => 
    selectedFrameworks.includes(f.id)
  );

  return (
    <div className="compliance-framework-comparison">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Compliance Framework Selection</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('grid')}
            >
              📋 Grid View
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('comparison')}
              disabled={selectedFrameworks.length < 2}
            >
              ⚖️ Compare ({selectedFrameworks.length})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-blue-600 text-lg mr-3">💡</span>
              <div>
                <h3 className="text-blue-900 font-medium">Select frameworks to compare</h3>
                <p className="text-blue-800 text-sm mt-1">
                  Choose multiple frameworks to see a detailed side-by-side comparison of requirements, penalties, and implementation complexity.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ENHANCED_COMPLIANCE_FRAMEWORKS.map((framework) => (
              <div
                key={framework.id}
                className={`border rounded-xl p-6 transition-all cursor-pointer ${
                  selectedFrameworks.includes(framework.id)
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* Framework Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">{framework.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{framework.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${getRiskColor(framework.riskLevel)}`}>
                          {framework.riskLevel.toUpperCase()}
                        </span>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${getComplexityColor(framework.implementation_complexity)}`}>
                          {framework.implementation_complexity.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedFrameworks.includes(framework.id)}
                      onChange={() => onFrameworkToggle(framework.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>

                {/* Framework Description */}
                <p className="text-sm text-gray-600 mb-4">{framework.description}</p>

                {/* Quick Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Patterns:</span>
                    <span className="font-medium">{framework.patterns.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Max Penalty:</span>
                    <span className="font-medium text-red-600">{framework.penalties.financial}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Notification:</span>
                    <span className="font-medium">{framework.breach_notification}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(showDetails === framework.id ? null : framework.id);
                    }}
                  >
                    {showDetails === framework.id ? 'Hide Details' : 'View Details'}
                  </button>
                  
                  <button
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    onClick={() => onFrameworkSelect(framework)}
                  >
                    Select & Configure
                  </button>
                </div>

                {/* Expandable Details */}
                {showDetails === framework.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Protected Data Types:</h4>
                      <div className="flex flex-wrap gap-1">
                        {framework.patterns.map((pattern) => (
                          <span
                            key={pattern}
                            className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          >
                            {pattern.replace('_', ' ').toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Key Requirements:</h4>
                      <div className="space-y-1">
                        {framework.requirements.slice(0, 2).map((req) => (
                          <div key={req.category}>
                            <span className="text-xs font-medium text-gray-600">{req.category}:</span>
                            <span className="text-xs text-gray-500 ml-1">
                              {req.items.slice(0, 2).join(', ')}
                              {req.items.length > 2 && '...'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-1">Data Residency:</h4>
                      <span className="text-xs text-gray-600">{framework.data_residency.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'comparison' && selectedFrameworkObjects.length >= 2 && (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Framework Comparison</h3>
            <p className="text-sm text-gray-600">
              Comparing {selectedFrameworkObjects.length} frameworks side-by-side
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    Aspect
                  </th>
                  {selectedFrameworkObjects.map((framework) => (
                    <th key={framework.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      <div className="flex items-center">
                        <span className="mr-2">{framework.icon}</span>
                        {framework.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Risk Level</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getRiskColor(framework.riskLevel)}`}>
                        {framework.riskLevel.toUpperCase()}
                      </span>
                    </td>
                  ))}
                </tr>
                
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Implementation Complexity</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getComplexityColor(framework.implementation_complexity)}`}>
                        {framework.implementation_complexity.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Protected Patterns</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 text-sm">
                      <span className="font-medium">{framework.patterns.length} types</span>
                      <div className="text-xs text-gray-500 mt-1">
                        {framework.patterns.slice(0, 3).join(', ')}
                        {framework.patterns.length > 3 && '...'}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Maximum Penalties</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 text-sm">
                      <div className="font-medium text-red-600">{framework.penalties.financial}</div>
                      <div className="text-xs text-gray-500">{framework.penalties.legal}</div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Breach Notification</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 text-sm">
                      {framework.breach_notification}
                    </td>
                  ))}
                </tr>

                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Data Residency</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 text-sm">
                      {framework.data_residency.join(', ')}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Key Requirements</td>
                  {selectedFrameworkObjects.map((framework) => (
                    <td key={framework.id} className="px-6 py-4 text-sm">
                      <div className="space-y-2">
                        {framework.requirements.map((req) => (
                          <div key={req.category}>
                            <div className="font-medium text-gray-700">{req.category}</div>
                            <ul className="text-xs text-gray-500 mt-1 space-y-1">
                              {req.items.slice(0, 3).map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                              {req.items.length > 3 && (
                                <li>• ... and {req.items.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-blue-900 font-medium mb-2">📊 Comparison Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Most Restrictive:</span>
                <div className="text-blue-700">
                  {selectedFrameworkObjects.reduce((most, current) => 
                    current.riskLevel === 'critical' ? current : most
                  ).name}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-800">Highest Penalties:</span>
                <div className="text-blue-700">
                  {selectedFrameworkObjects.find(f => f.id === 'gdpr')?.name || 
                   selectedFrameworkObjects.find(f => f.id === 'hipaa')?.name || 
                   selectedFrameworkObjects[0]?.name}
                </div>
              </div>
              <div>
                <span className="font-medium text-blue-800">Most Complex:</span>
                <div className="text-blue-700">
                  {selectedFrameworkObjects.reduce((most, current) => 
                    current.implementation_complexity === 'very_complex' ? current : most
                  ).name}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'comparison' && selectedFrameworkObjects.length < 2 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">⚖️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select frameworks to compare</h3>
          <p className="text-gray-600">
            Choose at least 2 compliance frameworks from the grid view to see a detailed comparison.
          </p>
        </div>
      )}
    </div>
  );
};

export default ComplianceFrameworkComparison;