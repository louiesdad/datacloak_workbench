import React, { useState, useEffect } from 'react';

interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number; // 0-100
  pii_detected: {
    type: string;
    count: number;
    confidence: number;
    risk_level: string;
    samples: string[];
    compliance_impact: string[];
  }[];
  compliance_status: {
    framework: string;
    compliant: boolean;
    violations: string[];
    recommendations: string[];
  }[];
  data_sensitivity: {
    total_records: number;
    sensitive_records: number;
    sensitivity_percentage: number;
  };
  geographic_risk: {
    jurisdiction: string[];
    cross_border_transfer: boolean;
    gdpr_applicable: boolean;
  };
}

interface RiskAssessmentDashboardProps {
  assessment: RiskAssessment | null;
  isLoading: boolean;
}

const RiskAssessmentDashboard: React.FC<RiskAssessmentDashboardProps> = ({
  assessment,
  isLoading
}) => {
  const [selectedRiskType, setSelectedRiskType] = useState<string>('overview');

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🟠';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Analyzing data sensitivity...</span>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <span className="text-gray-500">No risk assessment available</span>
      </div>
    );
  }

  return (
    <div className="risk-assessment-dashboard space-y-6">
      {/* Overall Risk Score */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Data Risk Assessment</h2>
          <div className={`px-4 py-2 rounded-full border ${getRiskColor(assessment.overall_risk)}`}>
            <span className="text-sm font-medium">
              {getRiskIcon(assessment.overall_risk)} {assessment.overall_risk.toUpperCase()} RISK
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{assessment.risk_score}</div>
            <div className="text-sm text-gray-500">Risk Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{assessment.pii_detected.length}</div>
            <div className="text-sm text-gray-500">PII Types Found</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {Math.round(assessment.data_sensitivity.sensitivity_percentage)}%
            </div>
            <div className="text-sm text-gray-500">Sensitive Data</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {assessment.compliance_status.filter(c => c.compliant).length}
            </div>
            <div className="text-sm text-gray-500">Compliant Frameworks</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'pii-details', label: 'PII Detection', icon: '🔍' },
            { id: 'compliance', label: 'Compliance', icon: '⚖️' },
            { id: 'recommendations', label: 'Recommendations', icon: '💡' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedRiskType === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setSelectedRiskType(tab.id)}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {selectedRiskType === 'overview' && (
          <div className="space-y-6">
            {/* Sensitivity Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Data Sensitivity Breakdown</h3>
              <div className="space-y-3">
                {assessment.pii_detected.map((pii) => (
                  <div key={pii.type} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <span className={`inline-block w-3 h-3 rounded-full mr-3 ${getRiskColor(pii.risk_level).split(' ')[2]}`}></span>
                      <div>
                        <span className="font-medium">{pii.type.replace('_', ' ').toUpperCase()}</span>
                        <span className="text-sm text-gray-500 ml-2">({pii.count} instances)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{Math.round(pii.confidence * 100)}% confidence</div>
                      <div className={`text-xs ${getRiskColor(pii.risk_level).split(' ')[0]}`}>
                        {pii.risk_level.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Geographic Risk */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Geographic & Regulatory Context</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-sm font-medium text-blue-900">Jurisdictions</div>
                  <div className="text-lg text-blue-600">
                    {assessment.geographic_risk.jurisdiction.join(', ')}
                  </div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded">
                  <div className="text-sm font-medium text-yellow-900">Cross-Border</div>
                  <div className="text-lg text-yellow-600">
                    {assessment.geographic_risk.cross_border_transfer ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <div className="text-sm font-medium text-purple-900">GDPR Applicable</div>
                  <div className="text-lg text-purple-600">
                    {assessment.geographic_risk.gdpr_applicable ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedRiskType === 'pii-details' && (
          <div className="space-y-4">
            {assessment.pii_detected.map((pii) => (
              <div key={pii.type} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">{pii.type.replace('_', ' ').toUpperCase()}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm ${getRiskColor(pii.risk_level)}`}>
                    {pii.risk_level.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-gray-500">Instances Found</span>
                    <div className="text-2xl font-bold text-gray-900">{pii.count}</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Confidence</span>
                    <div className="text-2xl font-bold text-blue-600">{Math.round(pii.confidence * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Compliance Impact</span>
                    <div className="text-sm">
                      {pii.compliance_impact.map((impact) => (
                        <span key={impact} className="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs mr-1">
                          {impact}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 mb-2 block">Sample Matches</span>
                  <div className="space-y-1">
                    {pii.samples.map((sample, index) => (
                      <code key={index} className="block bg-gray-100 p-2 rounded text-sm font-mono">
                        {sample}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedRiskType === 'compliance' && (
          <div className="space-y-4">
            {assessment.compliance_status.map((compliance) => (
              <div key={compliance.framework} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">{compliance.framework.toUpperCase()}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    compliance.compliant 
                      ? 'text-green-600 bg-green-100 border-green-200'
                      : 'text-red-600 bg-red-100 border-red-200'
                  }`}>
                    {compliance.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}
                  </span>
                </div>

                {compliance.violations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-red-900 mb-2">Violations</h4>
                    <ul className="space-y-1">
                      {compliance.violations.map((violation, index) => (
                        <li key={index} className="text-sm text-red-700 flex items-start">
                          <span className="text-red-500 mr-2">•</span>
                          {violation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {compliance.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {compliance.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-blue-700 flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedRiskType === 'recommendations' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recommended Actions</h3>
            <div className="space-y-4">
              {assessment.overall_risk === 'critical' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <h4 className="font-medium text-red-900">🚨 Immediate Action Required</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Critical PII detected. Consider implementing field-level encryption and restricting data access.
                  </p>
                </div>
              )}
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-medium text-blue-900">💡 Data Protection Recommendations</h4>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• Enable DataCloak masking for all detected PII types</li>
                  <li>• Configure role-based access controls for sensitive data</li>
                  <li>• Implement data retention policies</li>
                  <li>• Set up audit logging for data access</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h4 className="font-medium text-green-900">✅ Compliance Steps</h4>
                <ul className="text-sm text-green-700 mt-2 space-y-1">
                  <li>• Document data processing activities</li>
                  <li>• Establish data subject rights procedures</li>
                  <li>• Conduct regular privacy impact assessments</li>
                  <li>• Train staff on data protection requirements</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskAssessmentDashboard;