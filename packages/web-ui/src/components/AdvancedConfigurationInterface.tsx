import React, { useState, useEffect } from 'react';

interface TransformationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: {
    field_patterns: string[];
    data_types: string[];
    value_patterns: string[];
    context_requirements: string[];
  };
  transformations: {
    type: 'mask' | 'encrypt' | 'tokenize' | 'redact' | 'hash' | 'synthetic' | 'conditional';
    method: string;
    parameters: Record<string, any>;
    preserve_format: boolean;
    preserve_length: boolean;
  };
  exceptions: {
    user_roles: string[];
    time_conditions: string[];
    approval_required: boolean;
  };
  audit: {
    log_access: boolean;
    log_transformations: boolean;
    retention_period: string;
  };
  performance: {
    cache_enabled: boolean;
    batch_size: number;
    timeout_ms: number;
  };
}

interface FieldSecurityControl {
  id: string;
  field_name: string;
  table_name: string;
  security_level: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
  access_controls: {
    read_roles: string[];
    write_roles: string[];
    admin_roles: string[];
  };
  transformation_rules: string[]; // Rule IDs
  compliance_requirements: string[];
  data_classification: {
    sensitivity: 'low' | 'medium' | 'high' | 'critical';
    pii_type: string[];
    regulatory_scope: string[];
  };
  encryption: {
    at_rest: boolean;
    in_transit: boolean;
    key_rotation_days: number;
  };
}

interface ConfigurationProfile {
  id: string;
  name: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  rules: TransformationRule[];
  field_controls: FieldSecurityControl[];
  global_settings: {
    default_transformation: string;
    fallback_behavior: 'block' | 'allow' | 'mask';
    performance_mode: 'accuracy' | 'balanced' | 'speed';
    audit_level: 'minimal' | 'standard' | 'comprehensive';
  };
  created_at: string;
  updated_at: string;
  version: string;
}

interface AdvancedConfigurationInterfaceProps {
  currentProfile: ConfigurationProfile | null;
  onProfileSave: (profile: ConfigurationProfile) => void;
  onProfileLoad: (profileId: string) => void;
  availableProfiles: ConfigurationProfile[];
}

const TRANSFORMATION_TYPES = [
  { value: 'mask', label: 'Masking', description: 'Replace characters with asterisks or other symbols', icon: '🎭' },
  { value: 'encrypt', label: 'Encryption', description: 'Encrypt data using strong encryption algorithms', icon: '🔐' },
  { value: 'tokenize', label: 'Tokenization', description: 'Replace sensitive data with non-sensitive tokens', icon: '🎯' },
  { value: 'redact', label: 'Redaction', description: 'Remove or black out sensitive information', icon: '📝' },
  { value: 'hash', label: 'Hashing', description: 'One-way hash transformation', icon: '#️⃣' },
  { value: 'synthetic', label: 'Synthetic Data', description: 'Generate realistic but fake data', icon: '🎨' },
  { value: 'conditional', label: 'Conditional', description: 'Apply different rules based on conditions', icon: '🔀' }
];

const SECURITY_LEVELS = [
  { value: 'public', label: 'Public', color: 'text-green-600 bg-green-100', description: 'No restrictions' },
  { value: 'internal', label: 'Internal', color: 'text-blue-600 bg-blue-100', description: 'Internal use only' },
  { value: 'confidential', label: 'Confidential', color: 'text-yellow-600 bg-yellow-100', description: 'Restricted access' },
  { value: 'restricted', label: 'Restricted', color: 'text-orange-600 bg-orange-100', description: 'Highly restricted' },
  { value: 'top_secret', label: 'Top Secret', color: 'text-red-600 bg-red-100', description: 'Maximum security' }
];

const COMPLIANCE_FRAMEWORKS = ['GDPR', 'HIPAA', 'PCI-DSS', 'SOX', 'CCPA', 'PIPEDA'];
const USER_ROLES = ['admin', 'analyst', 'viewer', 'developer', 'auditor', 'data_steward'];
const DATA_TYPES = ['email', 'phone', 'ssn', 'credit_card', 'address', 'name', 'ip_address', 'medical_id'];

const AdvancedConfigurationInterface: React.FC<AdvancedConfigurationInterfaceProps> = ({
  currentProfile,
  onProfileSave,
  onProfileLoad,
  availableProfiles
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'fields' | 'global' | 'validation'>('rules');
  const [editingRule, setEditingRule] = useState<TransformationRule | null>(null);
  const [editingField, setEditingField] = useState<FieldSecurityControl | null>(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [configValidation, setConfigValidation] = useState<any>(null);

  const [profile, setProfile] = useState<ConfigurationProfile>({
    id: '',
    name: 'New Configuration',
    description: '',
    environment: 'development',
    rules: [],
    field_controls: [],
    global_settings: {
      default_transformation: 'mask',
      fallback_behavior: 'mask',
      performance_mode: 'balanced',
      audit_level: 'standard'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: '1.0.0'
  });

  useEffect(() => {
    if (currentProfile) {
      setProfile(currentProfile);
    }
  }, [currentProfile]);

  const createNewRule = (): TransformationRule => ({
    id: `rule_${Date.now()}`,
    name: '',
    description: '',
    enabled: true,
    priority: profile.rules.length + 1,
    conditions: {
      field_patterns: [],
      data_types: [],
      value_patterns: [],
      context_requirements: []
    },
    transformations: {
      type: 'mask',
      method: 'asterisk',
      parameters: {},
      preserve_format: true,
      preserve_length: true
    },
    exceptions: {
      user_roles: [],
      time_conditions: [],
      approval_required: false
    },
    audit: {
      log_access: true,
      log_transformations: true,
      retention_period: '90 days'
    },
    performance: {
      cache_enabled: true,
      batch_size: 1000,
      timeout_ms: 5000
    }
  });

  const createNewFieldControl = (): FieldSecurityControl => ({
    id: `field_${Date.now()}`,
    field_name: '',
    table_name: '',
    security_level: 'internal',
    access_controls: {
      read_roles: [],
      write_roles: [],
      admin_roles: ['admin']
    },
    transformation_rules: [],
    compliance_requirements: [],
    data_classification: {
      sensitivity: 'medium',
      pii_type: [],
      regulatory_scope: []
    },
    encryption: {
      at_rest: false,
      in_transit: false,
      key_rotation_days: 90
    }
  });

  const handleSaveRule = (rule: TransformationRule) => {
    setProfile(prev => ({
      ...prev,
      rules: editingRule 
        ? prev.rules.map(r => r.id === rule.id ? rule : r)
        : [...prev.rules, rule],
      updated_at: new Date().toISOString()
    }));
    setEditingRule(null);
    setShowRuleBuilder(false);
  };

  const handleSaveFieldControl = (fieldControl: FieldSecurityControl) => {
    setProfile(prev => ({
      ...prev,
      field_controls: editingField 
        ? prev.field_controls.map(f => f.id === fieldControl.id ? fieldControl : f)
        : [...prev.field_controls, fieldControl],
      updated_at: new Date().toISOString()
    }));
    setEditingField(null);
    setShowFieldBuilder(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    setProfile(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId),
      updated_at: new Date().toISOString()
    }));
  };

  const handleDeleteFieldControl = (fieldId: string) => {
    setProfile(prev => ({
      ...prev,
      field_controls: prev.field_controls.filter(f => f.id !== fieldId),
      updated_at: new Date().toISOString()
    }));
  };

  const validateConfiguration = () => {
    const validation = {
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[],
      coverage: {
        rules_with_conditions: profile.rules.filter(r => r.conditions.data_types.length > 0).length,
        fields_with_controls: profile.field_controls.length,
        compliance_coverage: profile.field_controls.filter(f => f.compliance_requirements.length > 0).length
      }
    };

    // Validation logic
    if (profile.rules.length === 0) {
      validation.errors.push('No transformation rules defined');
    }

    profile.rules.forEach(rule => {
      if (!rule.name) {
        validation.errors.push(`Rule ${rule.id} is missing a name`);
      }
      if (rule.conditions.data_types.length === 0 && rule.conditions.field_patterns.length === 0) {
        validation.warnings.push(`Rule "${rule.name}" has no conditions defined`);
      }
    });

    if (profile.field_controls.length === 0) {
      validation.warnings.push('No field-level security controls defined');
    }

    // Check for overlapping rules
    const rulesByPriority = profile.rules.sort((a, b) => a.priority - b.priority);
    for (let i = 0; i < rulesByPriority.length - 1; i++) {
      const current = rulesByPriority[i];
      const next = rulesByPriority[i + 1];
      if (current.priority === next.priority) {
        validation.warnings.push(`Rules "${current.name}" and "${next.name}" have the same priority`);
      }
    }

    setConfigValidation(validation);
  };

  const getSecurityLevelColor = (level: string) => {
    const levelConfig = SECURITY_LEVELS.find(s => s.value === level);
    return levelConfig?.color || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="advanced-configuration-interface">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Configuration</h2>
            <p className="text-gray-600 mt-1">
              Configure data transformation rules and field-level security controls
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={profile.id}
              onChange={(e) => onProfileLoad(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">New Configuration</option>
              {availableProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            
            <button
              onClick={() => onProfileSave(profile)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
            <select
              value={profile.environment}
              onChange={(e) => setProfile(prev => ({ ...prev, environment: e.target.value as any }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
            <input
              type="text"
              value={profile.version}
              onChange={(e) => setProfile(prev => ({ ...prev, version: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rules Count</label>
            <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-600">
              {profile.rules.length} rules, {profile.field_controls.length} fields
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'rules', label: 'Transformation Rules', icon: '🔄', count: profile.rules.length },
            { id: 'fields', label: 'Field Security', icon: '🛡️', count: profile.field_controls.length },
            { id: 'global', label: 'Global Settings', icon: '⚙️' },
            { id: 'validation', label: 'Validation', icon: '✅' }
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
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Transformation Rules</h3>
            <button
              onClick={() => {
                setEditingRule(createNewRule());
                setShowRuleBuilder(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add New Rule
            </button>
          </div>

          {profile.rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">🔄</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transformation rules</h3>
              <p className="text-gray-600 mb-4">
                Create transformation rules to define how sensitive data should be processed.
              </p>
              <button
                onClick={() => {
                  setEditingRule(createNewRule());
                  setShowRuleBuilder(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.rules
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => (
                  <div key={rule.id} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{rule.name || `Rule ${rule.id}`}</h4>
                          <p className="text-sm text-gray-600">{rule.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Priority: {rule.priority}
                        </span>
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleBuilder(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Conditions</h5>
                        <div className="space-y-1">
                          {rule.conditions.data_types.length > 0 && (
                            <div className="text-xs text-gray-600">
                              Data Types: {rule.conditions.data_types.join(', ')}
                            </div>
                          )}
                          {rule.conditions.field_patterns.length > 0 && (
                            <div className="text-xs text-gray-600">
                              Fields: {rule.conditions.field_patterns.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Transformation</h5>
                        <div className="text-xs text-gray-600">
                          <div>{TRANSFORMATION_TYPES.find(t => t.value === rule.transformations.type)?.label}</div>
                          <div>Method: {rule.transformations.method}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Access</h5>
                        <div className="text-xs text-gray-600">
                          {rule.exceptions.user_roles.length > 0 ? (
                            <div>Exceptions: {rule.exceptions.user_roles.join(', ')}</div>
                          ) : (
                            <div>Applies to all users</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fields' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Field-Level Security Controls</h3>
            <button
              onClick={() => {
                setEditingField(createNewFieldControl());
                setShowFieldBuilder(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Field Control
            </button>
          </div>

          {profile.field_controls.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">🛡️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No field controls</h3>
              <p className="text-gray-600 mb-4">
                Define field-level security controls to protect specific data fields.
              </p>
              <button
                onClick={() => {
                  setEditingField(createNewFieldControl());
                  setShowFieldBuilder(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Control
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.field_controls.map((field) => (
                <div key={field.id} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {field.table_name}.{field.field_name}
                      </h4>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getSecurityLevelColor(field.security_level)}`}>
                        {field.security_level.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingField(field);
                          setShowFieldBuilder(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteFieldControl(field.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Classification</h5>
                      <div className="text-xs text-gray-600">
                        Sensitivity: {field.data_classification.sensitivity}
                      </div>
                      {field.data_classification.pii_type.length > 0 && (
                        <div className="text-xs text-gray-600">
                          PII: {field.data_classification.pii_type.join(', ')}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Access Roles</h5>
                      <div className="text-xs text-gray-600">
                        Read: {field.access_controls.read_roles.length || 'None'}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Rules Applied</h5>
                      <div className="text-xs text-gray-600">
                        {field.transformation_rules.length} rules
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'global' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Global Configuration Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Transformation
                </label>
                <select
                  value={profile.global_settings.default_transformation}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    global_settings: { ...prev.global_settings, default_transformation: e.target.value }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {TRANSFORMATION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback Behavior
                </label>
                <select
                  value={profile.global_settings.fallback_behavior}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    global_settings: { ...prev.global_settings, fallback_behavior: e.target.value as any }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="block">Block Access</option>
                  <option value="allow">Allow Access</option>
                  <option value="mask">Apply Masking</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  What to do when no specific rule matches
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Performance Mode
                </label>
                <select
                  value={profile.global_settings.performance_mode}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    global_settings: { ...prev.global_settings, performance_mode: e.target.value as any }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="accuracy">Accuracy (Slower, more precise)</option>
                  <option value="balanced">Balanced (Default)</option>
                  <option value="speed">Speed (Faster, less precise)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audit Level
                </label>
                <select
                  value={profile.global_settings.audit_level}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    global_settings: { ...prev.global_settings, audit_level: e.target.value as any }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="minimal">Minimal (Performance optimized)</option>
                  <option value="standard">Standard (Recommended)</option>
                  <option value="comprehensive">Comprehensive (Full audit trail)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Configuration Validation</h3>
            <button
              onClick={validateConfiguration}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Run Validation
            </button>
          </div>

          {configValidation ? (
            <div className="space-y-4">
              {/* Validation Results */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{configValidation.errors.length}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{configValidation.warnings.length}</div>
                  <div className="text-sm text-gray-600">Warnings</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{configValidation.suggestions.length}</div>
                  <div className="text-sm text-gray-600">Suggestions</div>
                </div>
              </div>

              {/* Issues */}
              {configValidation.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">❌ Errors</h4>
                  <ul className="space-y-1">
                    {configValidation.errors.map((error: string, index: number) => (
                      <li key={index} className="text-sm text-red-700">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {configValidation.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-900 mb-2">⚠️ Warnings</h4>
                  <ul className="space-y-1">
                    {configValidation.warnings.map((warning: string, index: number) => (
                      <li key={index} className="text-sm text-yellow-700">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Coverage Analysis */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Coverage Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Rules with Conditions</div>
                    <div className="text-lg font-bold text-gray-900">
                      {configValidation.coverage.rules_with_conditions} / {profile.rules.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Protected Fields</div>
                    <div className="text-lg font-bold text-gray-900">
                      {configValidation.coverage.fields_with_controls}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Compliance Coverage</div>
                    <div className="text-lg font-bold text-gray-900">
                      {configValidation.coverage.compliance_coverage} fields
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Run Configuration Validation</h3>
              <p className="text-gray-600 mb-4">
                Validate your configuration for errors, warnings, and optimization opportunities.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedConfigurationInterface;