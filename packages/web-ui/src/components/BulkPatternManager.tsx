import React, { useState, useRef } from 'react';

interface Pattern {
  id: string;
  name: string;
  description: string;
  regex: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  enabled: boolean;
  tags: string[];
  metadata: {
    created_by: string;
    created_at: string;
    updated_at: string;
    version: string;
    compliance_frameworks: string[];
  };
  test_cases: Array<{
    input: string;
    expected_match: boolean;
    description: string;
  }>;
}

interface PatternTemplate {
  name: string;
  description: string;
  patterns: Pattern[];
  category: string;
  compliance_framework?: string;
}

interface BulkOperation {
  id: string;
  type: 'import' | 'export' | 'update' | 'delete' | 'enable' | 'disable';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  processed_items: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}

interface BulkPatternManagerProps {
  patterns: Pattern[];
  onPatternsUpdate: (patterns: Pattern[]) => void;
  onPatternImport: (patterns: Pattern[]) => Promise<void>;
  onPatternExport: (patterns: Pattern[], format: 'json' | 'csv' | 'yaml') => void;
}

const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    name: 'GDPR Compliance Pack',
    description: 'Essential patterns for GDPR compliance including EU-specific identifiers',
    category: 'Compliance',
    compliance_framework: 'GDPR',
    patterns: [
      {
        id: 'gdpr_email',
        name: 'Email Address',
        description: 'Detects email addresses',
        regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        category: 'Contact Information',
        riskLevel: 'medium',
        confidence: 0.9,
        enabled: true,
        tags: ['email', 'contact', 'pii'],
        metadata: {
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '1.0',
          compliance_frameworks: ['GDPR']
        },
        test_cases: [
          { input: 'user@example.com', expected_match: true, description: 'Standard email' },
          { input: 'invalid.email', expected_match: false, description: 'Invalid format' }
        ]
      }
    ]
  },
  {
    name: 'Healthcare HIPAA Pack',
    description: 'Medical record numbers, patient IDs, and healthcare identifiers',
    category: 'Healthcare',
    compliance_framework: 'HIPAA',
    patterns: [
      {
        id: 'hipaa_mrn',
        name: 'Medical Record Number',
        description: 'Detects medical record numbers',
        regex: '^MRN[0-9]{6,10}$',
        category: 'Healthcare',
        riskLevel: 'critical',
        confidence: 0.95,
        enabled: true,
        tags: ['medical', 'mrn', 'healthcare'],
        metadata: {
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '1.0',
          compliance_frameworks: ['HIPAA']
        },
        test_cases: [
          { input: 'MRN1234567', expected_match: true, description: 'Valid MRN' },
          { input: 'MR1234567', expected_match: false, description: 'Invalid prefix' }
        ]
      }
    ]
  },
  {
    name: 'Financial PCI-DSS Pack',
    description: 'Credit card numbers, bank accounts, and financial identifiers',
    category: 'Financial',
    compliance_framework: 'PCI-DSS',
    patterns: [
      {
        id: 'pci_credit_card',
        name: 'Credit Card Number',
        description: 'Detects credit card numbers (Luhn algorithm)',
        regex: '(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})',
        category: 'Financial',
        riskLevel: 'critical',
        confidence: 0.98,
        enabled: true,
        tags: ['credit_card', 'payment', 'financial'],
        metadata: {
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '1.0',
          compliance_frameworks: ['PCI-DSS']
        },
        test_cases: [
          { input: '4532123456789012', expected_match: true, description: 'Valid Visa' },
          { input: '1234567890123456', expected_match: false, description: 'Invalid number' }
        ]
      }
    ]
  }
];

const BulkPatternManager: React.FC<BulkPatternManagerProps> = ({
  patterns,
  onPatternsUpdate,
  onPatternImport,
  onPatternExport
}) => {
  const [activeTab, setActiveTab] = useState<'manage' | 'import' | 'export' | 'templates'>('manage');
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [importData, setImportData] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'yaml'>('json');
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<Pattern[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPatterns = patterns.filter(pattern => {
    const matchesSearch = !searchTerm || 
      pattern.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pattern.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !filterCategory || pattern.category === filterCategory;
    const matchesRisk = !filterRisk || pattern.riskLevel === filterRisk;
    
    return matchesSearch && matchesCategory && matchesRisk;
  });

  const categories = [...new Set(patterns.map(p => p.category))];
  const riskLevels = ['low', 'medium', 'high', 'critical'];

  const handleSelectAll = (checked: boolean) => {
    setSelectedPatterns(checked ? filteredPatterns.map(p => p.id) : []);
  };

  const handleSelectPattern = (patternId: string, checked: boolean) => {
    setSelectedPatterns(prev => 
      checked 
        ? [...prev, patternId]
        : prev.filter(id => id !== patternId)
    );
  };

  const handleBulkAction = async (action: string) => {
    const selectedPatternsData = patterns.filter(p => selectedPatterns.includes(p.id));
    
    const operation: BulkOperation = {
      id: `operation_${Date.now()}`,
      type: action as any,
      status: 'running',
      progress: 0,
      total_items: selectedPatternsData.length,
      processed_items: 0,
      errors: [],
      started_at: new Date().toISOString()
    };

    setBulkOperations(prev => [operation, ...prev]);

    try {
      switch (action) {
        case 'enable':
        case 'disable':
          const updatedPatterns = patterns.map(p => 
            selectedPatterns.includes(p.id) 
              ? { ...p, enabled: action === 'enable' }
              : p
          );
          onPatternsUpdate(updatedPatterns);
          break;

        case 'delete':
          const remainingPatterns = patterns.filter(p => !selectedPatterns.includes(p.id));
          onPatternsUpdate(remainingPatterns);
          break;

        case 'export':
          onPatternExport(selectedPatternsData, exportFormat);
          break;
      }

      // Simulate progress
      for (let i = 0; i <= selectedPatternsData.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setBulkOperations(prev => prev.map(op => 
          op.id === operation.id 
            ? { 
                ...op, 
                progress: Math.round((i / selectedPatternsData.length) * 100),
                processed_items: i,
                status: i === selectedPatternsData.length ? 'completed' : 'running',
                completed_at: i === selectedPatternsData.length ? new Date().toISOString() : undefined
              }
            : op
        ));
      }

      setSelectedPatterns([]);
    } catch (error) {
      setBulkOperations(prev => prev.map(op => 
        op.id === operation.id 
          ? { 
              ...op, 
              status: 'failed',
              errors: [error instanceof Error ? error.message : 'Unknown error'],
              completed_at: new Date().toISOString()
            }
          : op
      ));
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const data = JSON.parse(content);
        setImportPreview(Array.isArray(data) ? data : [data]);
        setShowImportPreview(true);
      } catch (error) {
        alert('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  const handleTextImport = () => {
    try {
      const data = JSON.parse(importData);
      setImportPreview(Array.isArray(data) ? data : [data]);
      setShowImportPreview(true);
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  const confirmImport = async () => {
    try {
      await onPatternImport(importPreview);
      setImportPreview([]);
      setImportData('');
      setShowImportPreview(false);
      setActiveTab('manage');
    } catch (error) {
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const installTemplate = async (template: PatternTemplate) => {
    try {
      await onPatternImport(template.patterns);
      alert(`Successfully installed ${template.name}`);
    } catch (error) {
      alert('Template installation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bulk-pattern-manager">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bulk Pattern Management</h2>
        <p className="text-gray-600">
          Import, export, and manage multiple patterns at scale with bulk operations and templates.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'manage', label: 'Manage Patterns', icon: '📋', count: patterns.length },
            { id: 'import', label: 'Import Patterns', icon: '📥' },
            { id: 'export', label: 'Export Patterns', icon: '📤' },
            { id: 'templates', label: 'Template Library', icon: '📚', count: PATTERN_TEMPLATES.length }
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
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search patterns..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                <select
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Levels</option>
                  {riskLevels.map(level => (
                    <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Results</label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-600">
                  {filteredPatterns.length} of {patterns.length} patterns
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPatterns.length === filteredPatterns.length && filteredPatterns.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Select all ({selectedPatterns.length} selected)
                  </span>
                </label>
              </div>

              {selectedPatterns.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleBulkAction('enable')}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    Enable
                  </button>
                  <button
                    onClick={() => handleBulkAction('disable')}
                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                  >
                    Disable
                  </button>
                  <button
                    onClick={() => handleBulkAction('export')}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pattern List */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedPatterns.length === filteredPatterns.length && filteredPatterns.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPatterns.map((pattern) => (
                    <tr key={pattern.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPatterns.includes(pattern.id)}
                          onChange={(e) => handleSelectPattern(pattern.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{pattern.name}</div>
                          <div className="text-sm text-gray-500">{pattern.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pattern.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(pattern.riskLevel)}`}>
                          {pattern.riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(pattern.confidence * 100)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          pattern.enabled ? 'text-green-800 bg-green-100' : 'text-gray-800 bg-gray-100'
                        }`}>
                          {pattern.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {pattern.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              {tag}
                            </span>
                          ))}
                          {pattern.tags.length > 3 && (
                            <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              +{pattern.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk Operations Status */}
          {bulkOperations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Operations</h3>
              <div className="space-y-3">
                {bulkOperations.slice(0, 5).map((operation) => (
                  <div key={operation.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(operation.status)}`}>
                        {operation.status}
                      </span>
                      <span className="ml-3 text-sm text-gray-900 capitalize">
                        {operation.type} {operation.total_items} patterns
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {operation.status === 'running' && (
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${operation.progress}%` }}
                          ></div>
                        </div>
                      )}
                      <span className="text-xs text-gray-500">
                        {operation.processed_items} / {operation.total_items}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Import */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import from File</h3>
              <div className="space-y-4">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,.yaml,.yml"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  >
                    📁 Choose File (JSON, CSV, YAML)
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  <p>Supported formats:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>JSON array of pattern objects</li>
                    <li>CSV with standard pattern fields</li>
                    <li>YAML pattern definitions</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Text Import */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import from Text</h3>
              <div className="space-y-4">
                <div>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="w-full h-32 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Paste JSON pattern data here..."
                  />
                </div>
                <button
                  onClick={handleTextImport}
                  disabled={!importData.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Preview Import
                </button>
              </div>
            </div>
          </div>

          {/* Import Preview */}
          {showImportPreview && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Import Preview</h3>
                <span className="text-sm text-gray-500">{importPreview.length} patterns</span>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {importPreview.map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{pattern.name}</div>
                      <div className="text-sm text-gray-500">{pattern.category}</div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(pattern.riskLevel)}`}>
                      {pattern.riskLevel}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => setShowImportPreview(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirm Import
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'export' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Export Patterns</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Export Options</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Export Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="json">JSON (Recommended)</option>
                    <option value="csv">CSV (Tabular)</option>
                    <option value="yaml">YAML (Human-readable)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="exportScope"
                      value="all"
                      defaultChecked
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Export all patterns ({patterns.length})</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="exportScope"
                      value="filtered"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Export filtered patterns ({filteredPatterns.length})</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="exportScope"
                      value="selected"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Export selected patterns ({selectedPatterns.length})</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Export Preview</h4>
              <div className="bg-gray-50 rounded-lg p-4 h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {exportFormat === 'json' && JSON.stringify(patterns.slice(0, 2), null, 2)}
                  {exportFormat === 'csv' && 'name,description,category,riskLevel,enabled\n"Email","Email pattern","Contact","medium",true'}
                  {exportFormat === 'yaml' && '- name: Email\n  description: Email pattern\n  category: Contact\n  riskLevel: medium\n  enabled: true'}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              onClick={() => onPatternExport(patterns, exportFormat)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Download Export
            </button>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-blue-600 text-lg mr-3">📚</span>
              <div>
                <h3 className="text-blue-900 font-medium">Pattern Template Library</h3>
                <p className="text-blue-800 text-sm mt-1">
                  Install pre-built pattern collections for common compliance frameworks and use cases.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PATTERN_TEMPLATES.map((template) => (
              <div key={template.name} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded mt-1">
                      {template.category}
                    </span>
                  </div>
                  {template.compliance_framework && (
                    <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {template.compliance_framework}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-4">{template.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="text-xs text-gray-500">
                    {template.patterns.length} patterns included
                  </div>
                  <div className="space-y-1">
                    {template.patterns.slice(0, 3).map((pattern) => (
                      <div key={pattern.id} className="text-xs text-gray-600">
                        • {pattern.name}
                      </div>
                    ))}
                    {template.patterns.length > 3 && (
                      <div className="text-xs text-gray-500">
                        ... and {template.patterns.length - 3} more
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => installTemplate(template)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Install Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkPatternManager;