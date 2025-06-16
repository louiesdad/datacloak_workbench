import React, { useState } from 'react';

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
}

const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'general',
    name: 'General PII',
    description: 'Basic personal information protection',
    patterns: ['email', 'phone', 'ssn', 'address'],
    riskLevel: 'medium',
    icon: '🔒'
  },
  {
    id: 'hipaa',
    name: 'HIPAA Healthcare',
    description: 'Medical records and healthcare data protection',
    patterns: ['ssn', 'medical_record_number', 'date_of_birth', 'phone', 'email', 'address'],
    riskLevel: 'critical',
    icon: '🏥'
  },
  {
    id: 'financial',
    name: 'PCI-DSS Financial',
    description: 'Credit card and financial data protection',
    patterns: ['credit_card', 'bank_account', 'ssn', 'phone', 'email'],
    riskLevel: 'critical',
    icon: '💳'
  },
  {
    id: 'gdpr',
    name: 'GDPR European',
    description: 'EU General Data Protection Regulation compliance',
    patterns: ['email', 'phone', 'address', 'name', 'ip_address', 'date_of_birth'],
    riskLevel: 'high',
    icon: '🇪🇺'
  },
  {
    id: 'custom',
    name: 'Custom Patterns',
    description: 'Define your own pattern detection rules',
    patterns: [],
    riskLevel: 'medium',
    icon: '⚙️'
  }
];

interface ComplianceSelectorProps {
  selectedFramework: string;
  onFrameworkChange: (framework: ComplianceFramework) => void;
  customPatterns?: string[];
}

const ComplianceSelector: React.FC<ComplianceSelectorProps> = ({
  selectedFramework,
  onFrameworkChange,
  customPatterns = []
}) => {
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="compliance-selector">
      <h3 className="text-lg font-semibold mb-4">Select Compliance Framework</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPLIANCE_FRAMEWORKS.map((framework) => (
          <div
            key={framework.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedFramework === framework.id
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => onFrameworkChange(framework)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center">
                <span className="text-2xl mr-2">{framework.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{framework.name}</h4>
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded-full ${getRiskColor(framework.riskLevel)}`}
                  >
                    {framework.riskLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{framework.description}</p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {framework.patterns.length > 0 
                  ? `${framework.patterns.length} patterns`
                  : 'Custom configuration'
                }
              </span>
              
              <button
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(showDetails === framework.id ? null : framework.id);
                }}
              >
                {showDetails === framework.id ? 'Hide' : 'Details'}
              </button>
            </div>
            
            {showDetails === framework.id && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h5 className="text-xs font-medium text-gray-700 mb-2">Protected Data Types:</h5>
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
            )}
          </div>
        ))}
      </div>
      
      {selectedFramework && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-blue-600 mr-2">ℹ️</span>
            <h4 className="font-medium text-blue-900">Selected Framework Impact</h4>
          </div>
          <p className="text-sm text-blue-800">
            {selectedFramework === 'hipaa' && 
              'HIPAA compliance will detect and mask medical record numbers, patient IDs, and health-related identifiers.'
            }
            {selectedFramework === 'financial' && 
              'Financial compliance will prioritize credit card numbers, bank accounts, and payment information detection.'
            }
            {selectedFramework === 'gdpr' && 
              'GDPR compliance includes enhanced personal identifier detection including IP addresses and location data.'
            }
            {selectedFramework === 'general' && 
              'General PII protection covers the most common personal identifiers across various data types.'
            }
            {selectedFramework === 'custom' && 
              'Custom patterns allow you to define specific detection rules for your unique data requirements.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ComplianceSelector;