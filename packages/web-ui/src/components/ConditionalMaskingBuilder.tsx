import React, { useState, useEffect } from 'react';

interface MaskingCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'regex' | 'length_gt' | 'length_lt' | 'range';
  value: string | number;
  case_sensitive?: boolean;
}

interface UserContext {
  roles: string[];
  department: string;
  clearance_level: number;
  location: string;
  time_restrictions?: {
    allowed_hours: string[];
    allowed_days: string[];
    timezone: string;
  };
}

interface MaskingRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: {
    data_conditions: MaskingCondition[];
    user_conditions: {
      required_roles: string[];
      min_clearance_level: number;
      allowed_departments: string[];
      location_restrictions: string[];
    };
    time_conditions: {
      business_hours_only: boolean;
      allowed_days: string[];
      time_ranges: Array<{ start: string; end: string; timezone: string }>;
    };
    context_conditions: {
      request_source: string[];
      purpose: string[];
      approval_required: boolean;
    };
  };
  transformations: {
    default_action: 'mask' | 'encrypt' | 'redact' | 'allow' | 'block';
    conditional_actions: Array<{
      condition_set: string; // Reference to condition group
      action: 'mask' | 'encrypt' | 'redact' | 'allow' | 'block';
      parameters: {
        mask_character?: string;
        mask_percentage?: number;
        preserve_format?: boolean;
        preserve_length?: boolean;
        encryption_key?: string;
        redaction_replacement?: string;
      };
    }>;
  };
  exceptions: {
    emergency_access: boolean;
    admin_override: boolean;
    audit_bypass: boolean;
  };
}

interface FieldSecurityPolicy {
  id: string;
  field_identifier: {
    table_name: string;
    field_name: string;
    schema?: string;
  };
  classification: {
    sensitivity_level: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
    data_categories: string[];
    pii_types: string[];
    compliance_tags: string[];
  };
  access_matrix: {
    role: string;
    permissions: {
      read: 'allow' | 'mask' | 'encrypt' | 'block';
      write: 'allow' | 'block';
      export: 'allow' | 'mask' | 'block';
      audit: 'allow' | 'block';
    };
    conditions?: MaskingCondition[];
  }[];
  masking_rules: string[]; // References to MaskingRule IDs
  monitoring: {
    track_access: boolean;
    alert_on_unauthorized: boolean;
    log_data_usage: boolean;
    retention_period: string;
  };
}

interface ConditionalMaskingBuilderProps {
  onRuleSave: (rule: MaskingRule) => void;
  onPolicySave: (policy: FieldSecurityPolicy) => void;
  existingRules: MaskingRule[];
  existingPolicies: FieldSecurityPolicy[];
  availableFields: Array<{ table: string; field: string; type: string }>;
  availableRoles: string[];
}

const OPERATORS = [
  { value: 'equals', label: 'Equals', description: 'Exact match' },
  { value: 'not_equals', label: 'Not Equals', description: 'Does not match' },
  { value: 'contains', label: 'Contains', description: 'Contains substring' },
  { value: 'not_contains', label: 'Not Contains', description: 'Does not contain substring' },
  { value: 'regex', label: 'Regex Match', description: 'Regular expression pattern' },
  { value: 'length_gt', label: 'Length Greater Than', description: 'String length >' },
  { value: 'length_lt', label: 'Length Less Than', description: 'String length <' },
  { value: 'range', label: 'In Range', description: 'Numeric range (min-max)' }
];

const MASKING_ACTIONS = [
  { value: 'allow', label: 'Allow', description: 'Show original data', icon: '✅', color: 'text-green-600 bg-green-100' },
  { value: 'mask', label: 'Mask', description: 'Replace with mask characters', icon: '🎭', color: 'text-blue-600 bg-blue-100' },
  { value: 'encrypt', label: 'Encrypt', description: 'Encrypt the data', icon: '🔐', color: 'text-purple-600 bg-purple-100' },
  { value: 'redact', label: 'Redact', description: 'Remove or black out', icon: '📝', color: 'text-orange-600 bg-orange-100' },
  { value: 'block', label: 'Block', description: 'Deny access completely', icon: '🚫', color: 'text-red-600 bg-red-100' }
];

const SENSITIVITY_LEVELS = [
  { value: 'public', label: 'Public', color: 'text-green-600 bg-green-100', description: 'No restrictions' },
  { value: 'internal', label: 'Internal', color: 'text-blue-600 bg-blue-100', description: 'Internal use only' },
  { value: 'confidential', label: 'Confidential', color: 'text-yellow-600 bg-yellow-100', description: 'Restricted access' },
  { value: 'restricted', label: 'Restricted', color: 'text-orange-600 bg-orange-100', description: 'Highly restricted' },
  { value: 'top_secret', label: 'Top Secret', color: 'text-red-600 bg-red-100', description: 'Maximum security' }
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ConditionalMaskingBuilder: React.FC<ConditionalMaskingBuilderProps> = ({
  onRuleSave,
  onPolicySave,
  existingRules,
  existingPolicies,
  availableFields,
  availableRoles
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'policies'>('rules');
  const [editingRule, setEditingRule] = useState<MaskingRule | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<FieldSecurityPolicy | null>(null);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showPolicyBuilder, setShowPolicyBuilder] = useState(false);

  const createNewRule = (): MaskingRule => ({
    id: `rule_${Date.now()}`,
    name: '',
    description: '',
    priority: existingRules.length + 1,
    enabled: true,
    conditions: {
      data_conditions: [],
      user_conditions: {
        required_roles: [],
        min_clearance_level: 1,
        allowed_departments: [],
        location_restrictions: []
      },
      time_conditions: {
        business_hours_only: false,
        allowed_days: [...DAYS_OF_WEEK],
        time_ranges: []
      },
      context_conditions: {
        request_source: [],
        purpose: [],
        approval_required: false
      }
    },
    transformations: {
      default_action: 'mask',
      conditional_actions: []
    },
    exceptions: {
      emergency_access: false,
      admin_override: true,
      audit_bypass: false
    }
  });

  const createNewPolicy = (): FieldSecurityPolicy => ({
    id: `policy_${Date.now()}`,
    field_identifier: {
      table_name: '',
      field_name: '',
      schema: undefined
    },
    classification: {
      sensitivity_level: 'internal',
      data_categories: [],
      pii_types: [],
      compliance_tags: []
    },
    access_matrix: [],
    masking_rules: [],
    monitoring: {
      track_access: true,
      alert_on_unauthorized: true,
      log_data_usage: true,
      retention_period: '90 days'
    }
  });

  const addDataCondition = (rule: MaskingRule): MaskingRule => ({
    ...rule,
    conditions: {
      ...rule.conditions,
      data_conditions: [
        ...rule.conditions.data_conditions,
        {
          id: `condition_${Date.now()}`,
          field: '',
          operator: 'equals',
          value: '',
          case_sensitive: false
        }
      ]
    }
  });

  const updateDataCondition = (rule: MaskingRule, conditionId: string, updates: Partial<MaskingCondition>): MaskingRule => ({
    ...rule,
    conditions: {
      ...rule.conditions,
      data_conditions: rule.conditions.data_conditions.map(condition =>
        condition.id === conditionId ? { ...condition, ...updates } : condition
      )
    }
  });

  const removeDataCondition = (rule: MaskingRule, conditionId: string): MaskingRule => ({
    ...rule,
    conditions: {
      ...rule.conditions,
      data_conditions: rule.conditions.data_conditions.filter(condition => condition.id !== conditionId)
    }
  });

  const addAccessMatrixEntry = (policy: FieldSecurityPolicy): FieldSecurityPolicy => ({
    ...policy,
    access_matrix: [
      ...policy.access_matrix,
      {
        role: '',
        permissions: {
          read: 'mask',
          write: 'block',
          export: 'block',
          audit: 'allow'
        }
      }
    ]
  });

  const updateAccessMatrixEntry = (policy: FieldSecurityPolicy, index: number, updates: any): FieldSecurityPolicy => ({
    ...policy,
    access_matrix: policy.access_matrix.map((entry, i) =>
      i === index ? { ...entry, ...updates } : entry
    )
  });

  const getActionColor = (action: string) => {
    const actionConfig = MASKING_ACTIONS.find(a => a.value === action);
    return actionConfig?.color || 'text-gray-600 bg-gray-100';
  };

  const getSensitivityColor = (level: string) => {
    const levelConfig = SENSITIVITY_LEVELS.find(s => s.value === level);
    return levelConfig?.color || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="conditional-masking-builder">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Conditional Masking & Field Security</h2>
        <p className="text-gray-600">
          Create advanced masking rules and field-level security policies based on user context, data conditions, and business requirements.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'rules', label: 'Masking Rules', icon: '🔀', count: existingRules.length },
            { id: 'policies', label: 'Field Policies', icon: '🛡️', count: existingPolicies.length }
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
              <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Conditional Masking Rules</h3>
            <button
              onClick={() => {
                setEditingRule(createNewRule());
                setShowRuleBuilder(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create New Rule
            </button>
          </div>

          {existingRules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">🔀</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No masking rules</h3>
              <p className="text-gray-600 mb-4">
                Create conditional masking rules to dynamically transform data based on user context and data conditions.
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
              {existingRules
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
                        <span className={`text-xs px-2 py-1 rounded-full ${getActionColor(rule.transformations.default_action)}`}>
                          {rule.transformations.default_action.toUpperCase()}
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
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Data Conditions</h5>
                        <div className="text-xs text-gray-600">
                          {rule.conditions.data_conditions.length > 0 ? (
                            <div>{rule.conditions.data_conditions.length} conditions</div>
                          ) : (
                            <div>No data conditions</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">User Conditions</h5>
                        <div className="text-xs text-gray-600">
                          {rule.conditions.user_conditions.required_roles.length > 0 ? (
                            <div>Roles: {rule.conditions.user_conditions.required_roles.join(', ')}</div>
                          ) : (
                            <div>All users</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Time Conditions</h5>
                        <div className="text-xs text-gray-600">
                          {rule.conditions.time_conditions.business_hours_only ? (
                            <div>Business hours only</div>
                          ) : (
                            <div>Any time</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Context</h5>
                        <div className="text-xs text-gray-600">
                          {rule.conditions.context_conditions.approval_required ? (
                            <div>Approval required</div>
                          ) : (
                            <div>No approval needed</div>
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

      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Field Security Policies</h3>
            <button
              onClick={() => {
                setEditingPolicy(createNewPolicy());
                setShowPolicyBuilder(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create New Policy
            </button>
          </div>

          {existingPolicies.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <div className="text-gray-400 text-6xl mb-4">🛡️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No field policies</h3>
              <p className="text-gray-600 mb-4">
                Create field-level security policies to control access and transformations for specific database fields.
              </p>
              <button
                onClick={() => {
                  setEditingPolicy(createNewPolicy());
                  setShowPolicyBuilder(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Policy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {existingPolicies.map((policy) => (
                <div key={policy.id} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {policy.field_identifier.table_name}.{policy.field_identifier.field_name}
                      </h4>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getSensitivityColor(policy.classification.sensitivity_level)}`}>
                        {policy.classification.sensitivity_level.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        setEditingPolicy(policy);
                        setShowPolicyBuilder(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Access Matrix</h5>
                      <div className="text-xs text-gray-600">
                        {policy.access_matrix.length} role(s) configured
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">PII Types</h5>
                      <div className="text-xs text-gray-600">
                        {policy.classification.pii_types.length > 0 ? (
                          policy.classification.pii_types.join(', ')
                        ) : (
                          'No PII types specified'
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700">Monitoring</h5>
                      <div className="text-xs text-gray-600">
                        {policy.monitoring.track_access && (
                          <div>✓ Access tracking enabled</div>
                        )}
                        {policy.monitoring.alert_on_unauthorized && (
                          <div>✓ Unauthorized access alerts</div>
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

      {/* Rule Builder Modal */}
      {showRuleBuilder && editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingRule.id ? 'Edit Masking Rule' : 'Create New Masking Rule'}
                </h3>
                <button
                  onClick={() => setShowRuleBuilder(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Executive Data Access Rule"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) => setEditingRule(prev => prev ? { ...prev, priority: parseInt(e.target.value) } : null)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingRule.description}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Describe when and how this rule should be applied..."
                />
              </div>

              {/* Default Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Default Action</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {MASKING_ACTIONS.map((action) => (
                    <label key={action.value} className="flex items-center">
                      <input
                        type="radio"
                        name="defaultAction"
                        value={action.value}
                        checked={editingRule.transformations.default_action === action.value}
                        onChange={(e) => setEditingRule(prev => prev ? {
                          ...prev,
                          transformations: { ...prev.transformations, default_action: e.target.value as any }
                        } : null)}
                        className="sr-only"
                      />
                      <div className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center ${
                        editingRule.transformations.default_action === action.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="text-lg mb-1">{action.icon}</div>
                        <div className="text-xs font-medium">{action.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Data Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Data Conditions</label>
                  <button
                    onClick={() => setEditingRule(prev => prev ? addDataCondition(prev) : null)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Condition
                  </button>
                </div>
                
                <div className="space-y-3">
                  {editingRule.conditions.data_conditions.map((condition) => (
                    <div key={condition.id} className="grid grid-cols-12 gap-3 items-center p-3 border border-gray-200 rounded-lg">
                      <div className="col-span-3">
                        <select
                          value={condition.field}
                          onChange={(e) => setEditingRule(prev => prev ? updateDataCondition(prev, condition.id, { field: e.target.value }) : null)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">Select field...</option>
                          {availableFields.map((field) => (
                            <option key={`${field.table}.${field.field}`} value={`${field.table}.${field.field}`}>
                              {field.table}.{field.field}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <select
                          value={condition.operator}
                          onChange={(e) => setEditingRule(prev => prev ? updateDataCondition(prev, condition.id, { operator: e.target.value as any }) : null)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => setEditingRule(prev => prev ? updateDataCondition(prev, condition.id, { value: e.target.value }) : null)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Value..."
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          onClick={() => setEditingRule(prev => prev ? removeDataCondition(prev, condition.id) : null)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">User Access Conditions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Required Roles</label>
                    <div className="space-y-1">
                      {availableRoles.map((role) => (
                        <label key={role} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={editingRule.conditions.user_conditions.required_roles.includes(role)}
                            onChange={(e) => {
                              const roles = e.target.checked
                                ? [...editingRule.conditions.user_conditions.required_roles, role]
                                : editingRule.conditions.user_conditions.required_roles.filter(r => r !== role);
                              setEditingRule(prev => prev ? {
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  user_conditions: { ...prev.conditions.user_conditions, required_roles: roles }
                                }
                              } : null);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm text-gray-700">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Minimum Clearance Level</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={editingRule.conditions.user_conditions.min_clearance_level}
                      onChange={(e) => setEditingRule(prev => prev ? {
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          user_conditions: { ...prev.conditions.user_conditions, min_clearance_level: parseInt(e.target.value) }
                        }
                      } : null)}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Level {editingRule.conditions.user_conditions.min_clearance_level}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Time Restrictions</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingRule.conditions.time_conditions.business_hours_only}
                      onChange={(e) => setEditingRule(prev => prev ? {
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          time_conditions: { ...prev.conditions.time_conditions, business_hours_only: e.target.checked }
                        }
                      } : null)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm text-gray-700">Restrict to business hours only</span>
                  </label>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Allowed Days</label>
                    <div className="grid grid-cols-4 gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={editingRule.conditions.time_conditions.allowed_days.includes(day)}
                            onChange={(e) => {
                              const days = e.target.checked
                                ? [...editingRule.conditions.time_conditions.allowed_days, day]
                                : editingRule.conditions.time_conditions.allowed_days.filter(d => d !== day);
                              setEditingRule(prev => prev ? {
                                ...prev,
                                conditions: {
                                  ...prev.conditions,
                                  time_conditions: { ...prev.conditions.time_conditions, allowed_days: days }
                                }
                              } : null);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
                          />
                          <span className="text-xs text-gray-700">{day.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exceptions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Exception Controls</label>
                <div className="space-y-2">
                  {[
                    { key: 'emergency_access', label: 'Allow emergency access override' },
                    { key: 'admin_override', label: 'Allow administrator override' },
                    { key: 'audit_bypass', label: 'Allow audit logging bypass' }
                  ].map((exception) => (
                    <label key={exception.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingRule.exceptions[exception.key as keyof typeof editingRule.exceptions]}
                        onChange={(e) => setEditingRule(prev => prev ? {
                          ...prev,
                          exceptions: { ...prev.exceptions, [exception.key]: e.target.checked }
                        } : null)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700">{exception.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowRuleBuilder(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onRuleSave(editingRule);
                  setShowRuleBuilder(false);
                  setEditingRule(null);
                }}
                disabled={!editingRule.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy Builder Modal - Similar structure to Rule Builder */}
      {showPolicyBuilder && editingPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingPolicy.id ? 'Edit Field Security Policy' : 'Create New Field Security Policy'}
                </h3>
                <button
                  onClick={() => setShowPolicyBuilder(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Field Identifier */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                  <input
                    type="text"
                    value={editingPolicy.field_identifier.table_name}
                    onChange={(e) => setEditingPolicy(prev => prev ? {
                      ...prev,
                      field_identifier: { ...prev.field_identifier, table_name: e.target.value }
                    } : null)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., users"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                  <input
                    type="text"
                    value={editingPolicy.field_identifier.field_name}
                    onChange={(e) => setEditingPolicy(prev => prev ? {
                      ...prev,
                      field_identifier: { ...prev.field_identifier, field_name: e.target.value }
                    } : null)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sensitivity Level</label>
                  <select
                    value={editingPolicy.classification.sensitivity_level}
                    onChange={(e) => setEditingPolicy(prev => prev ? {
                      ...prev,
                      classification: { ...prev.classification, sensitivity_level: e.target.value as any }
                    } : null)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SENSITIVITY_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} - {level.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Access Matrix */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Role-Based Access Matrix</label>
                  <button
                    onClick={() => setEditingPolicy(prev => prev ? addAccessMatrixEntry(prev) : null)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Role
                  </button>
                </div>
                
                <div className="space-y-3">
                  {editingPolicy.access_matrix.map((entry, index) => (
                    <div key={index} className="grid grid-cols-6 gap-3 items-center p-3 border border-gray-200 rounded-lg">
                      <div>
                        <select
                          value={entry.role}
                          onChange={(e) => setEditingPolicy(prev => prev ? updateAccessMatrixEntry(prev, index, { role: e.target.value }) : null)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">Select role...</option>
                          {availableRoles.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                      {(['read', 'write', 'export', 'audit'] as const).map((permission) => (
                        <div key={permission}>
                          <label className="block text-xs text-gray-600 mb-1 capitalize">{permission}</label>
                          <select
                            value={entry.permissions[permission]}
                            onChange={(e) => setEditingPolicy(prev => prev ? updateAccessMatrixEntry(prev, index, {
                              permissions: { ...entry.permissions, [permission]: e.target.value }
                            }) : null)}
                            className="w-full border border-gray-300 rounded px-1 py-1 text-xs"
                          >
                            {permission === 'read' || permission === 'export' ? (
                              <>
                                <option value="allow">Allow</option>
                                <option value="mask">Mask</option>
                                <option value="encrypt">Encrypt</option>
                                <option value="block">Block</option>
                              </>
                            ) : (
                              <>
                                <option value="allow">Allow</option>
                                <option value="block">Block</option>
                              </>
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Monitoring Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Monitoring & Auditing</label>
                <div className="space-y-2">
                  {[
                    { key: 'track_access', label: 'Track all field access' },
                    { key: 'alert_on_unauthorized', label: 'Alert on unauthorized access attempts' },
                    { key: 'log_data_usage', label: 'Log data usage patterns' }
                  ].map((setting) => (
                    <label key={setting.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingPolicy.monitoring[setting.key as keyof typeof editingPolicy.monitoring] as boolean}
                        onChange={(e) => setEditingPolicy(prev => prev ? {
                          ...prev,
                          monitoring: { ...prev.monitoring, [setting.key]: e.target.checked }
                        } : null)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700">{setting.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowPolicyBuilder(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onPolicySave(editingPolicy);
                  setShowPolicyBuilder(false);
                  setEditingPolicy(null);
                }}
                disabled={!editingPolicy.field_identifier.table_name || !editingPolicy.field_identifier.field_name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionalMaskingBuilder;