import React, { useState, useEffect } from 'react';

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

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  estimatedTime: string;
  dependencies: string[];
  actions: {
    type: 'pattern_migration' | 'policy_update' | 'documentation' | 'training' | 'technical_config';
    title: string;
    description: string;
    automated: boolean;
  }[];
}

interface MigrationAnalysis {
  compatibilityScore: number;
  patternOverlap: {
    common: string[];
    sourceOnly: string[];
    targetOnly: string[];
  };
  requirementGaps: {
    category: string;
    missing: string[];
    additional: string[];
  }[];
  estimatedEffort: {
    totalHours: number;
    complexity: 'low' | 'medium' | 'high' | 'very_high';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  dataImpact: {
    affectedRecords: number;
    newProtections: string[];
    removedProtections: string[];
  };
}

const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
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
      }
    ],
    penalties: { financial: 'Varies by jurisdiction', legal: 'Civil liability' },
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
    penalties: { financial: 'Up to $1.5M per incident', legal: 'Criminal charges possible' },
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
      }
    ],
    penalties: { financial: 'Up to $100,000 per month', legal: 'Card brand sanctions' },
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
      }
    ],
    penalties: { financial: 'Up to 4% of global revenue or €20M', legal: 'Regulatory sanctions' },
    implementation_complexity: 'complex',
    data_residency: ['EU/EEA or adequate countries'],
    breach_notification: '72 hours to DPA, 72 hours to individuals'
  }
];

interface ComplianceFrameworkMigrationWizardProps {
  currentFramework: string;
  onMigrationStart: (targetFramework: string, steps: MigrationStep[]) => void;
  onMigrationCancel: () => void;
}

const ComplianceFrameworkMigrationWizard: React.FC<ComplianceFrameworkMigrationWizardProps> = ({
  currentFramework,
  onMigrationStart,
  onMigrationCancel
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'selection' | 'analysis' | 'planning' | 'confirmation'>('selection');
  const [migrationAnalysis, setMigrationAnalysis] = useState<MigrationAnalysis | null>(null);
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sourceFramework = COMPLIANCE_FRAMEWORKS.find(f => f.id === currentFramework);
  const targetFramework = COMPLIANCE_FRAMEWORKS.find(f => f.id === selectedTarget);

  const analyzeMigration = async (sourceId: string, targetId: string): Promise<MigrationAnalysis> => {
    const source = COMPLIANCE_FRAMEWORKS.find(f => f.id === sourceId);
    const target = COMPLIANCE_FRAMEWORKS.find(f => f.id === targetId);
    
    if (!source || !target) {
      throw new Error('Invalid framework selection');
    }

    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate pattern overlap
    const commonPatterns = source.patterns.filter(p => target.patterns.includes(p));
    const sourceOnlyPatterns = source.patterns.filter(p => !target.patterns.includes(p));
    const targetOnlyPatterns = target.patterns.filter(p => !source.patterns.includes(p));

    // Calculate compatibility score
    const compatibilityScore = Math.round((commonPatterns.length / Math.max(source.patterns.length, target.patterns.length)) * 100);

    // Analyze requirement gaps
    const requirementGaps = target.requirements.map(targetReq => {
      const sourceReq = source.requirements.find(sr => sr.category === targetReq.category);
      return {
        category: targetReq.category,
        missing: sourceReq ? targetReq.items.filter(item => !sourceReq.items.includes(item)) : targetReq.items,
        additional: sourceReq ? sourceReq.items.filter(item => !targetReq.items.includes(item)) : []
      };
    });

    // Estimate effort based on complexity difference and pattern gaps
    const complexityMap = { simple: 1, moderate: 2, complex: 3, very_complex: 4 };
    const complexityDiff = complexityMap[target.implementation_complexity] - complexityMap[source.implementation_complexity];
    const baseHours = 40 + (targetOnlyPatterns.length * 8) + (requirementGaps.reduce((sum, gap) => sum + gap.missing.length, 0) * 4);
    const totalHours = baseHours + Math.max(0, complexityDiff * 20);

    return {
      compatibilityScore,
      patternOverlap: {
        common: commonPatterns,
        sourceOnly: sourceOnlyPatterns,
        targetOnly: targetOnlyPatterns
      },
      requirementGaps,
      estimatedEffort: {
        totalHours,
        complexity: totalHours < 40 ? 'low' : totalHours < 80 ? 'medium' : totalHours < 160 ? 'high' : 'very_high',
        riskLevel: complexityDiff > 1 ? 'high' : complexityDiff > 0 ? 'medium' : 'low'
      },
      dataImpact: {
        affectedRecords: Math.floor(Math.random() * 10000) + 1000, // Simulated
        newProtections: targetOnlyPatterns,
        removedProtections: sourceOnlyPatterns
      }
    };
  };

  const generateMigrationSteps = (analysis: MigrationAnalysis, source: ComplianceFramework, target: ComplianceFramework): MigrationStep[] => {
    const steps: MigrationStep[] = [];

    // Step 1: Pre-migration assessment
    steps.push({
      id: 'assessment',
      title: 'Pre-Migration Assessment',
      description: 'Conduct thorough assessment of current data and compliance posture',
      status: 'pending',
      estimatedTime: '1-2 weeks',
      dependencies: [],
      actions: [
        {
          type: 'documentation',
          title: 'Data inventory update',
          description: 'Update data inventory to reflect current state',
          automated: false
        },
        {
          type: 'technical_config',
          title: 'Backup current configuration',
          description: 'Create backup of current DataCloak configuration',
          automated: true
        }
      ]
    });

    // Step 2: Pattern migration
    if (analysis.patternOverlap.targetOnly.length > 0) {
      steps.push({
        id: 'pattern_migration',
        title: 'Pattern Configuration Update',
        description: `Add ${analysis.patternOverlap.targetOnly.length} new pattern types for ${target.name} compliance`,
        status: 'pending',
        estimatedTime: '3-5 days',
        dependencies: ['assessment'],
        actions: [
          {
            type: 'pattern_migration',
            title: 'Deploy new detection patterns',
            description: `Configure patterns for: ${analysis.patternOverlap.targetOnly.join(', ')}`,
            automated: true
          },
          {
            type: 'technical_config',
            title: 'Pattern validation',
            description: 'Test new patterns against sample data',
            automated: false
          }
        ]
      });
    }

    // Step 3: Policy updates
    if (analysis.requirementGaps.some(gap => gap.missing.length > 0)) {
      steps.push({
        id: 'policy_update',
        title: 'Policy and Procedure Updates',
        description: 'Update organizational policies to meet new compliance requirements',
        status: 'pending',
        estimatedTime: '1-3 weeks',
        dependencies: ['assessment'],
        actions: [
          {
            type: 'policy_update',
            title: 'Privacy policy updates',
            description: 'Update privacy policies for new framework requirements',
            automated: false
          },
          {
            type: 'documentation',
            title: 'Procedure documentation',
            description: 'Document new compliance procedures and workflows',
            automated: false
          }
        ]
      });
    }

    // Step 4: Technical configuration
    steps.push({
      id: 'technical_config',
      title: 'Technical Configuration',
      description: 'Configure DataCloak for new compliance framework',
      status: 'pending',
      estimatedTime: '1 week',
      dependencies: ['pattern_migration', 'policy_update'],
      actions: [
        {
          type: 'technical_config',
          title: 'Framework activation',
          description: `Activate ${target.name} compliance framework`,
          automated: true
        },
        {
          type: 'technical_config',
          title: 'Rule configuration',
          description: 'Configure compliance rules and thresholds',
          automated: false
        }
      ]
    });

    // Step 5: Training and documentation
    steps.push({
      id: 'training',
      title: 'Team Training',
      description: 'Train team members on new compliance requirements',
      status: 'pending',
      estimatedTime: '1-2 weeks',
      dependencies: ['technical_config'],
      actions: [
        {
          type: 'training',
          title: 'Compliance training',
          description: `Train staff on ${target.name} requirements`,
          automated: false
        },
        {
          type: 'documentation',
          title: 'User documentation',
          description: 'Create user guides for new compliance procedures',
          automated: false
        }
      ]
    });

    // Step 6: Validation and testing
    steps.push({
      id: 'validation',
      title: 'Migration Validation',
      description: 'Validate migration success and compliance status',
      status: 'pending',
      estimatedTime: '1 week',
      dependencies: ['training'],
      actions: [
        {
          type: 'technical_config',
          title: 'Compliance testing',
          description: 'Run compliance validation tests',
          automated: true
        },
        {
          type: 'documentation',
          title: 'Migration report',
          description: 'Generate migration completion report',
          automated: true
        }
      ]
    });

    return steps;
  };

  const handleTargetSelection = (frameworkId: string) => {
    setSelectedTarget(frameworkId);
  };

  const handleAnalyzeTarget = async () => {
    if (!selectedTarget || !currentFramework) return;

    setIsAnalyzing(true);
    setCurrentStep('analysis');

    try {
      const analysis = await analyzeMigration(currentFramework, selectedTarget);
      setMigrationAnalysis(analysis);
      
      const steps = generateMigrationSteps(analysis, sourceFramework!, targetFramework!);
      setMigrationSteps(steps);
      
      setCurrentStep('planning');
    } catch (error) {
      console.error('Migration analysis failed:', error);
      // Handle error appropriately
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!sourceFramework) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Invalid Current Framework</h3>
        <p className="text-gray-600">Unable to find current compliance framework configuration.</p>
      </div>
    );
  }

  return (
    <div className="compliance-migration-wizard">
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Compliance Framework Migration</h2>
            <p className="text-gray-600 mt-1">
              Migrate from <span className="font-medium">{sourceFramework.name}</span> to a new compliance framework
            </p>
          </div>
          <button
            onClick={onMigrationCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center space-x-8 mb-8">
          {[
            { id: 'selection', label: 'Target Selection', icon: '🎯' },
            { id: 'analysis', label: 'Migration Analysis', icon: '🔍' },
            { id: 'planning', label: 'Migration Planning', icon: '📋' },
            { id: 'confirmation', label: 'Confirmation', icon: '✅' }
          ].map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep === step.id
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : index < ['selection', 'analysis', 'planning', 'confirmation'].indexOf(currentStep)
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : 'border-gray-300 bg-gray-50 text-gray-400'
              }`}>
                <span className="text-sm">{step.icon}</span>
              </div>
              <span className={`ml-2 text-sm font-medium ${
                currentStep === step.id ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'selection' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-blue-600 text-lg mr-3">💡</span>
              <div>
                <h3 className="text-blue-900 font-medium">Choose your target framework</h3>
                <p className="text-blue-800 text-sm mt-1">
                  Select the compliance framework you want to migrate to. We'll analyze the migration requirements and provide a detailed plan.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPLIANCE_FRAMEWORKS.filter(f => f.id !== currentFramework).map((framework) => (
              <div
                key={framework.id}
                className={`border rounded-xl p-6 cursor-pointer transition-all ${
                  selectedTarget === framework.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleTargetSelection(framework.id)}
              >
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
                      type="radio"
                      name="targetFramework"
                      value={framework.id}
                      checked={selectedTarget === framework.id}
                      onChange={() => handleTargetSelection(framework.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <p className="text-sm text-gray-600 mb-4">{framework.description}</p>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Protected Patterns:</span>
                    <span className="font-medium">{framework.patterns.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Max Penalty:</span>
                    <span className="font-medium text-red-600">{framework.penalties.financial}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAnalyzeTarget}
              disabled={!selectedTarget}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Analyze Migration Requirements
            </button>
          </div>
        </div>
      )}

      {currentStep === 'analysis' && isAnalyzing && (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing Migration Requirements</h3>
          <p className="text-gray-600">
            Comparing frameworks, analyzing pattern overlap, and estimating migration effort...
          </p>
        </div>
      )}

      {currentStep === 'planning' && migrationAnalysis && (
        <div className="space-y-6">
          {/* Migration Analysis Results */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Analysis Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{migrationAnalysis.compatibilityScore}%</div>
                <div className="text-sm text-gray-600">Compatibility Score</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{migrationAnalysis.estimatedEffort.totalHours}h</div>
                <div className="text-sm text-gray-600">Estimated Effort</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{migrationAnalysis.patternOverlap.common.length}</div>
                <div className="text-sm text-gray-600">Shared Patterns</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{migrationAnalysis.patternOverlap.targetOnly.length}</div>
                <div className="text-sm text-gray-600">New Patterns</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Pattern Changes</h4>
                <div className="space-y-2">
                  {migrationAnalysis.patternOverlap.targetOnly.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <div className="text-sm font-medium text-green-900">New Protections</div>
                      <div className="text-xs text-green-700 mt-1">
                        {migrationAnalysis.patternOverlap.targetOnly.join(', ')}
                      </div>
                    </div>
                  )}
                  {migrationAnalysis.patternOverlap.sourceOnly.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="text-sm font-medium text-yellow-900">Removed Protections</div>
                      <div className="text-xs text-yellow-700 mt-1">
                        {migrationAnalysis.patternOverlap.sourceOnly.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Effort Assessment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Complexity:</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getComplexityColor(migrationAnalysis.estimatedEffort.complexity)}`}>
                      {migrationAnalysis.estimatedEffort.complexity.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Risk Level:</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor(migrationAnalysis.estimatedEffort.riskLevel)}`}>
                      {migrationAnalysis.estimatedEffort.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Affected Records:</span>
                    <span className="text-sm font-medium">{migrationAnalysis.dataImpact.affectedRecords.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Steps */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Plan</h3>
            
            <div className="space-y-4">
              {migrationSteps.map((step, index) => (
                <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{step.title}</h4>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {step.estimatedTime}
                    </span>
                  </div>
                  
                  <div className="ml-11">
                    <div className="space-y-2">
                      {step.actions.map((action, actionIndex) => (
                        <div key={actionIndex} className="flex items-center text-sm">
                          <span className={`w-2 h-2 rounded-full mr-2 ${action.automated ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                          <span className="text-gray-700">{action.title}</span>
                          {action.automated && (
                            <span className="ml-2 text-xs text-green-600 bg-green-100 px-1 rounded">AUTO</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('selection')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back to Selection
            </button>
            <button
              onClick={() => setCurrentStep('confirmation')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Proceed with Migration
            </button>
          </div>
        </div>
      )}

      {currentStep === 'confirmation' && migrationAnalysis && targetFramework && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start">
              <span className="text-yellow-600 text-lg mr-3">⚠️</span>
              <div>
                <h3 className="text-yellow-900 font-medium">Confirm Migration</h3>
                <p className="text-yellow-800 text-sm mt-1">
                  You are about to migrate from <strong>{sourceFramework.name}</strong> to <strong>{targetFramework.name}</strong>. 
                  This will update your compliance configuration and may affect data processing.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">From: {sourceFramework.name}</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• {sourceFramework.patterns.length} protected pattern types</li>
                  <li>• {sourceFramework.implementation_complexity} implementation</li>
                  <li>• {sourceFramework.riskLevel} risk level</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-2">To: {targetFramework.name}</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• {targetFramework.patterns.length} protected pattern types</li>
                  <li>• {targetFramework.implementation_complexity} implementation</li>
                  <li>• {targetFramework.riskLevel} risk level</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">What will happen:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Current configuration will be backed up</li>
                <li>• New compliance framework will be activated</li>
                <li>• {migrationAnalysis.patternOverlap.targetOnly.length} new pattern types will be enabled</li>
                <li>• Team will receive migration completion notification</li>
                <li>• Estimated total time: {migrationAnalysis.estimatedEffort.totalHours} hours</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('planning')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back to Plan
            </button>
            <div className="space-x-4">
              <button
                onClick={onMigrationCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel Migration
              </button>
              <button
                onClick={() => onMigrationStart(selectedTarget, migrationSteps)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Start Migration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceFrameworkMigrationWizard;