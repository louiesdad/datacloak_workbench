import React, { useState } from 'react';

interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  mandatory: boolean;
  implementationSteps: string[];
  datacloak_features: string[];
  documentation_needed: string[];
  penalties_for_non_compliance: string;
  examples: {
    good: string[];
    bad: string[];
  };
}

interface ComplianceFrameworkGuide {
  id: string;
  name: string;
  icon: string;
  overview: string;
  scope: string;
  key_principles: string[];
  legal_basis: string;
  enforcement_body: string;
  geographical_scope: string[];
  requirements: ComplianceRequirement[];
  implementation_timeline: {
    phase: string;
    duration: string;
    activities: string[];
  }[];
  common_violations: {
    violation: string;
    consequence: string;
    prevention: string;
  }[];
  certification_options?: string[];
}

const COMPLIANCE_GUIDES: ComplianceFrameworkGuide[] = [
  {
    id: 'gdpr',
    name: 'GDPR (General Data Protection Regulation)',
    icon: '🇪🇺',
    overview: 'The GDPR is a comprehensive data protection law that applies to any organization processing personal data of EU residents, regardless of where the organization is located.',
    scope: 'Any processing of personal data of EU residents by organizations, regardless of location',
    key_principles: [
      'Lawfulness, fairness and transparency',
      'Purpose limitation',
      'Data minimization',
      'Accuracy',
      'Storage limitation',
      'Integrity and confidentiality',
      'Accountability'
    ],
    legal_basis: 'EU Regulation 2016/679',
    enforcement_body: 'Data Protection Authorities (DPAs) in each EU member state',
    geographical_scope: ['European Union', 'European Economic Area', 'Organizations processing EU resident data'],
    requirements: [
      {
        id: 'lawful_basis',
        title: 'Establish Lawful Basis for Processing',
        description: 'You must have a valid legal basis for processing personal data under Article 6 GDPR',
        mandatory: true,
        implementationSteps: [
          'Identify the purpose of data processing',
          'Determine the most appropriate lawful basis',
          'Document the lawful basis decision',
          'Inform data subjects of the lawful basis',
          'Review and update as necessary'
        ],
        datacloak_features: [
          'Data processing purpose tracking',
          'Consent management integration',
          'Lawful basis documentation'
        ],
        documentation_needed: [
          'Privacy policy updates',
          'Data processing records',
          'Consent records (if applicable)',
          'Legitimate interest assessments (if applicable)'
        ],
        penalties_for_non_compliance: 'Up to 4% of global annual revenue or €20 million',
        examples: {
          good: [
            'Obtaining explicit consent for marketing emails',
            'Processing employee data for payroll (contract basis)',
            'Using customer data for fraud prevention (legitimate interest)'
          ],
          bad: [
            'Processing personal data without any lawful basis',
            'Using consent as basis when another basis is more appropriate',
            'Failing to document the lawful basis decision'
          ]
        }
      },
      {
        id: 'data_subject_rights',
        title: 'Implement Data Subject Rights',
        description: 'Individuals have specific rights regarding their personal data that must be respected',
        mandatory: true,
        implementationSteps: [
          'Create procedures for handling rights requests',
          'Implement identity verification processes',
          'Set up data portability mechanisms',
          'Establish data deletion procedures',
          'Train staff on rights fulfillment'
        ],
        datacloak_features: [
          'Right to access reports',
          'Data portability export',
          'Automated deletion workflows',
          'Request tracking system'
        ],
        documentation_needed: [
          'Rights request procedures',
          'Identity verification protocols',
          'Data deletion logs',
          'Request response records'
        ],
        penalties_for_non_compliance: 'Up to 4% of global annual revenue or €20 million',
        examples: {
          good: [
            'Responding to access requests within 30 days',
            'Providing data in machine-readable format',
            'Implementing automated deletion processes'
          ],
          bad: [
            'Ignoring or delaying rights requests',
            'Charging fees for access requests',
            'Providing incomplete data exports'
          ]
        }
      },
      {
        id: 'privacy_by_design',
        title: 'Privacy by Design and Default',
        description: 'Data protection must be built into systems and processes from the ground up',
        mandatory: true,
        implementationSteps: [
          'Conduct Privacy Impact Assessments (PIAs)',
          'Implement data minimization practices',
          'Design privacy-preserving architectures',
          'Set privacy-friendly defaults',
          'Regular privacy reviews'
        ],
        datacloak_features: [
          'Automated PII detection and masking',
          'Data minimization recommendations',
          'Privacy-preserving analytics',
          'Encryption by default'
        ],
        documentation_needed: [
          'Privacy Impact Assessments',
          'System design documentation',
          'Privacy review reports',
          'Technical safeguards documentation'
        ],
        penalties_for_non_compliance: 'Up to 4% of global annual revenue or €20 million',
        examples: {
          good: [
            'Automatically masking PII in non-production environments',
            'Collecting only necessary data fields',
            'Implementing encryption by default'
          ],
          bad: [
            'Adding privacy controls as an afterthought',
            'Collecting excessive personal data',
            'Using privacy-invasive defaults'
          ]
        }
      }
    ],
    implementation_timeline: [
      {
        phase: 'Assessment (Months 1-2)',
        duration: '2 months',
        activities: [
          'Data mapping and inventory',
          'Gap analysis against GDPR requirements',
          'Risk assessment',
          'Legal basis review'
        ]
      },
      {
        phase: 'Design (Months 3-4)',
        duration: '2 months',
        activities: [
          'Privacy policy updates',
          'Process design for data subject rights',
          'Technical safeguards planning',
          'Staff training program design'
        ]
      },
      {
        phase: 'Implementation (Months 5-8)',
        duration: '4 months',
        activities: [
          'Deploy technical safeguards',
          'Implement rights request procedures',
          'Update systems and processes',
          'Conduct staff training'
        ]
      },
      {
        phase: 'Monitoring (Ongoing)',
        duration: 'Continuous',
        activities: [
          'Regular compliance audits',
          'Rights request handling',
          'Breach monitoring and reporting',
          'Continuous improvement'
        ]
      }
    ],
    common_violations: [
      {
        violation: 'Inadequate consent mechanisms',
        consequence: 'Fines up to €20M or 4% of global revenue',
        prevention: 'Implement clear, granular consent with easy withdrawal'
      },
      {
        violation: 'Failure to report data breaches',
        consequence: 'Fines and regulatory sanctions',
        prevention: 'Establish 72-hour breach notification procedures'
      },
      {
        violation: 'No legal basis for processing',
        consequence: 'Processing must cease, potential fines',
        prevention: 'Document lawful basis for all processing activities'
      }
    ]
  },
  {
    id: 'hipaa',
    name: 'HIPAA (Health Insurance Portability and Accountability Act)',
    icon: '🏥',
    overview: 'HIPAA protects the privacy and security of individually identifiable health information in the United States.',
    scope: 'Covered entities (healthcare providers, health plans, healthcare clearinghouses) and business associates',
    key_principles: [
      'Minimum necessary standard',
      'Individual rights over health information',
      'Administrative safeguards',
      'Physical safeguards',
      'Technical safeguards'
    ],
    legal_basis: 'US Public Law 104-191',
    enforcement_body: 'Department of Health and Human Services (HHS) Office for Civil Rights',
    geographical_scope: ['United States'],
    requirements: [
      {
        id: 'administrative_safeguards',
        title: 'Administrative Safeguards',
        description: 'Policies and procedures to manage the selection, development, implementation, and maintenance of security measures',
        mandatory: true,
        implementationSteps: [
          'Assign a security officer',
          'Conduct workforce training',
          'Implement access management procedures',
          'Create contingency plans',
          'Regular security evaluations'
        ],
        datacloak_features: [
          'Access control and monitoring',
          'Audit logging',
          'User training compliance tracking',
          'Policy management system'
        ],
        documentation_needed: [
          'Security policies and procedures',
          'Training records',
          'Access control documentation',
          'Security incident logs'
        ],
        penalties_for_non_compliance: 'Civil penalties $100-$50,000 per violation, up to $1.5M per incident',
        examples: {
          good: [
            'Regular security awareness training',
            'Role-based access controls',
            'Documented incident response procedures'
          ],
          bad: [
            'No designated security officer',
            'Lack of employee training',
            'Informal access control procedures'
          ]
        }
      },
      {
        id: 'physical_safeguards',
        title: 'Physical Safeguards',
        description: 'Physical measures to protect electronic systems, equipment, and media from unauthorized access',
        mandatory: true,
        implementationSteps: [
          'Implement facility access controls',
          'Secure workstation environments',
          'Control media access and disposal',
          'Monitor physical access',
          'Regular physical security assessments'
        ],
        datacloak_features: [
          'Secure data center requirements',
          'Workstation security guidelines',
          'Media sanitization procedures'
        ],
        documentation_needed: [
          'Facility access logs',
          'Workstation security policies',
          'Media disposal records',
          'Physical security assessments'
        ],
        penalties_for_non_compliance: 'Civil penalties $100-$50,000 per violation, up to $1.5M per incident',
        examples: {
          good: [
            'Locked server rooms with access cards',
            'Screen locks on workstations',
            'Secure media disposal procedures'
          ],
          bad: [
            'Unsecured server rooms',
            'Unattended workstations without locks',
            'Improper disposal of storage media'
          ]
        }
      },
      {
        id: 'technical_safeguards',
        title: 'Technical Safeguards',
        description: 'Technology controls to protect and control access to electronic health information',
        mandatory: true,
        implementationSteps: [
          'Implement user access controls',
          'Deploy audit logging systems',
          'Ensure data integrity measures',
          'Encrypt data in transmission',
          'Regular technical evaluations'
        ],
        datacloak_features: [
          'Encryption at rest and in transit',
          'Comprehensive audit logging',
          'Access control integration',
          'Data integrity monitoring'
        ],
        documentation_needed: [
          'Access control configurations',
          'Encryption implementation records',
          'Audit log retention policies',
          'Technical security assessments'
        ],
        penalties_for_non_compliance: 'Civil penalties $100-$50,000 per violation, up to $1.5M per incident',
        examples: {
          good: [
            'Strong encryption for PHI transmission',
            'Comprehensive audit trails',
            'Multi-factor authentication'
          ],
          bad: [
            'Unencrypted email containing PHI',
            'Disabled audit logging',
            'Weak password policies'
          ]
        }
      }
    ],
    implementation_timeline: [
      {
        phase: 'Risk Assessment (Months 1-2)',
        duration: '2 months',
        activities: [
          'Conduct security risk assessment',
          'Identify all PHI locations',
          'Review current safeguards',
          'Gap analysis'
        ]
      },
      {
        phase: 'Policy Development (Months 2-3)',
        duration: '2 months',
        activities: [
          'Develop required policies and procedures',
          'Create training materials',
          'Design incident response procedures',
          'Business associate agreements'
        ]
      },
      {
        phase: 'Implementation (Months 4-8)',
        duration: '5 months',
        activities: [
          'Deploy technical safeguards',
          'Implement administrative procedures',
          'Enhance physical security',
          'Conduct staff training'
        ]
      },
      {
        phase: 'Monitoring (Ongoing)',
        duration: 'Continuous',
        activities: [
          'Regular risk assessments',
          'Audit log reviews',
          'Incident response',
          'Continuous training'
        ]
      }
    ],
    common_violations: [
      {
        violation: 'Unencrypted laptops/devices with PHI',
        consequence: 'Fines $10,000-$250,000+',
        prevention: 'Implement full disk encryption and device management'
      },
      {
        violation: 'Unauthorized PHI access',
        consequence: 'Fines and termination',
        prevention: 'Role-based access controls and regular access reviews'
      },
      {
        violation: 'Lack of business associate agreements',
        consequence: 'Joint liability for violations',
        prevention: 'Execute BAAs with all service providers handling PHI'
      }
    ]
  },
  {
    id: 'financial',
    name: 'PCI-DSS (Payment Card Industry Data Security Standard)',
    icon: '💳',
    overview: 'PCI-DSS is a security standard for organizations that handle branded credit cards from major card schemes.',
    scope: 'Any entity that stores, processes, or transmits cardholder data',
    key_principles: [
      'Build and maintain a secure network',
      'Protect stored cardholder data',
      'Maintain a vulnerability management program',
      'Implement strong access control measures',
      'Regularly monitor and test networks',
      'Maintain an information security policy'
    ],
    legal_basis: 'Industry standard mandated by payment card brands',
    enforcement_body: 'Payment Card Industry Security Standards Council',
    geographical_scope: ['Global (anywhere payment cards are accepted)'],
    requirements: [
      {
        id: 'secure_network',
        title: 'Build and Maintain Secure Network',
        description: 'Install and maintain firewall configuration and avoid vendor defaults',
        mandatory: true,
        implementationSteps: [
          'Deploy and configure firewalls',
          'Change all vendor-supplied defaults',
          'Implement network segmentation',
          'Regular firewall rule reviews',
          'Document network architecture'
        ],
        datacloak_features: [
          'Network security scanning',
          'Configuration compliance checking',
          'Default credential detection'
        ],
        documentation_needed: [
          'Firewall configurations',
          'Network diagrams',
          'Change management records',
          'Security testing reports'
        ],
        penalties_for_non_compliance: 'Card brand fines $5,000-$100,000 per month until compliant',
        examples: {
          good: [
            'Properly configured firewalls with deny-all rules',
            'Changed default passwords on all systems',
            'Segmented cardholder data environment'
          ],
          bad: [
            'Default firewall configurations',
            'Vendor default passwords still in use',
            'Flat network architecture'
          ]
        }
      },
      {
        id: 'protect_data',
        title: 'Protect Stored Cardholder Data',
        description: 'Protect stored cardholder data through encryption and data retention policies',
        mandatory: true,
        implementationSteps: [
          'Implement strong encryption for stored data',
          'Mask PAN when not needed',
          'Establish data retention policies',
          'Secure cryptographic key management',
          'Regular data discovery scans'
        ],
        datacloak_features: [
          'Automatic PAN detection and masking',
          'Encryption key management',
          'Data retention policy enforcement',
          'Tokenization services'
        ],
        documentation_needed: [
          'Encryption implementation details',
          'Key management procedures',
          'Data retention policies',
          'Data discovery reports'
        ],
        penalties_for_non_compliance: 'Card brand fines $5,000-$100,000 per month until compliant',
        examples: {
          good: [
            'AES-256 encryption for stored cardholder data',
            'Masking PAN in logs and reports',
            'Secure key management with hardware security modules'
          ],
          bad: [
            'Storing unencrypted cardholder data',
            'Full PAN visible in application logs',
            'Keys stored with encrypted data'
          ]
        }
      }
    ],
    implementation_timeline: [
      {
        phase: 'Scoping (Month 1)',
        duration: '1 month',
        activities: [
          'Define cardholder data environment',
          'Network segmentation analysis',
          'Data flow documentation',
          'System inventory'
        ]
      },
      {
        phase: 'Gap Assessment (Month 2)',
        duration: '1 month',
        activities: [
          'PCI DSS compliance assessment',
          'Vulnerability scanning',
          'Policy review',
          'Risk analysis'
        ]
      },
      {
        phase: 'Remediation (Months 3-8)',
        duration: '6 months',
        activities: [
          'Implement security controls',
          'Deploy encryption solutions',
          'Update policies and procedures',
          'Staff training'
        ]
      },
      {
        phase: 'Validation (Month 9)',
        duration: '1 month',
        activities: [
          'Self-assessment questionnaire',
          'External vulnerability scan',
          'Penetration testing',
          'Attestation of compliance'
        ]
      }
    ],
    common_violations: [
      {
        violation: 'Storing prohibited data (CVV, magnetic stripe)',
        consequence: 'Immediate compliance failure, potential card brand sanctions',
        prevention: 'Implement data discovery tools and deletion procedures'
      },
      {
        violation: 'Unencrypted cardholder data transmission',
        consequence: 'PCI compliance failure, potential fines',
        prevention: 'Implement TLS/SSL for all cardholder data transmissions'
      },
      {
        violation: 'Inadequate access controls',
        consequence: 'Compliance failure and security risks',
        prevention: 'Implement role-based access and regular access reviews'
      }
    ]
  }
];

interface ComplianceRequirementsGuideProps {
  selectedFramework: string;
  onImplementationStart: (requirement: ComplianceRequirement) => void;
}

const ComplianceRequirementsGuide: React.FC<ComplianceRequirementsGuideProps> = ({
  selectedFramework,
  onImplementationStart
}) => {
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'timeline' | 'violations'>('overview');

  const framework = COMPLIANCE_GUIDES.find(f => f.id === selectedFramework);

  if (!framework) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a compliance framework</h3>
        <p className="text-gray-600">
          Choose a compliance framework to view detailed requirements and implementation guidance.
        </p>
      </div>
    );
  }

  const getDifficultyColor = (mandatory: boolean) => {
    return mandatory ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100';
  };

  return (
    <div className="compliance-requirements-guide">
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center mb-4">
          <span className="text-4xl mr-4">{framework.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{framework.name}</h1>
            <p className="text-gray-600">{framework.overview}</p>
          </div>
        </div>

        {/* Framework Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'requirements', label: 'Requirements', icon: '✅' },
              { id: 'timeline', label: 'Implementation', icon: '📅' },
              { id: 'violations', label: 'Common Issues', icon: '⚠️' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Framework Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Legal Basis:</span>
                  <div className="text-sm text-gray-900">{framework.legal_basis}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Enforcement:</span>
                  <div className="text-sm text-gray-900">{framework.enforcement_body}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Scope:</span>
                  <div className="text-sm text-gray-900">{framework.scope}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Geographic Scope:</span>
                  <div className="text-sm text-gray-900">{framework.geographical_scope.join(', ')}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Key Principles</h3>
              <ul className="space-y-2">
                {framework.key_principles.map((principle, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">•</span>
                    <span className="text-sm text-gray-900">{principle}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-blue-900 font-medium mb-2">💡 Getting Started</h3>
            <p className="text-blue-800 text-sm mb-4">
              Ready to implement {framework.name}? Start with our step-by-step requirements guide and implementation timeline.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('requirements')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                View Requirements
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-sm"
              >
                Implementation Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requirements' && (
        <div className="space-y-6">
          {framework.requirements.map((requirement) => (
            <div key={requirement.id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium text-gray-900 mr-3">{requirement.title}</h3>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getDifficultyColor(requirement.mandatory)}`}>
                        {requirement.mandatory ? 'MANDATORY' : 'RECOMMENDED'}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{requirement.description}</p>
                  </div>
                  
                  <button
                    onClick={() => setSelectedRequirement(
                      selectedRequirement === requirement.id ? null : requirement.id
                    )}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {selectedRequirement === requirement.id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {selectedRequirement === requirement.id && (
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Implementation Steps</h4>
                        <ol className="space-y-2">
                          {requirement.implementationSteps.map((step, index) => (
                            <li key={index} className="flex items-start text-sm">
                              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-gray-700">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">DataCloak Features</h4>
                        <ul className="space-y-2">
                          {requirement.datacloak_features.map((feature, index) => (
                            <li key={index} className="flex items-start text-sm">
                              <span className="text-green-500 mr-2 mt-1">✓</span>
                              <span className="text-gray-700">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Required Documentation</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {requirement.documentation_needed.map((doc, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <span className="text-blue-500 mr-2">📄</span>
                            <span className="text-gray-700">{doc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 mb-2">Penalties for Non-Compliance</h4>
                      <p className="text-red-700 text-sm">{requirement.penalties_for_non_compliance}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-3">✅ Good Examples</h4>
                        <ul className="space-y-1">
                          {requirement.examples.good.map((example, index) => (
                            <li key={index} className="text-sm text-green-700">
                              • {example}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-medium text-red-900 mb-3">❌ Bad Examples</h4>
                        <ul className="space-y-1">
                          {requirement.examples.bad.map((example, index) => (
                            <li key={index} className="text-sm text-red-700">
                              • {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => onImplementationStart(requirement)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start Implementation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Implementation Timeline</h3>
            <div className="space-y-6">
              {framework.implementation_timeline.map((phase, index) => (
                <div key={index} className="flex">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-bold">{index + 1}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium text-gray-900 mr-3">{phase.phase}</h4>
                      <span className="text-sm text-gray-500">({phase.duration})</span>
                    </div>
                    
                    <ul className="space-y-1">
                      {phase.activities.map((activity, actIndex) => (
                        <li key={actIndex} className="text-sm text-gray-600 flex items-start">
                          <span className="text-blue-500 mr-2 mt-1">•</span>
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-yellow-600 text-lg mr-3">⚠️</span>
              <div>
                <h3 className="text-yellow-900 font-medium">Common Compliance Violations</h3>
                <p className="text-yellow-800 text-sm mt-1">
                  Learn from common mistakes to avoid costly violations and penalties.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {framework.common_violations.map((violation, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">❌ Violation</h4>
                    <p className="text-sm text-gray-700">{violation.violation}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-orange-900 mb-2">⚖️ Consequence</h4>
                    <p className="text-sm text-gray-700">{violation.consequence}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-green-900 mb-2">✅ Prevention</h4>
                    <p className="text-sm text-gray-700">{violation.prevention}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceRequirementsGuide;