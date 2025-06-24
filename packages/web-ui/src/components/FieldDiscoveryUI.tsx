import React, { useState, useMemo } from 'react';
import './FieldDiscoveryUI.css';

export interface DiscoveredField {
  id: string;
  name: string;
  dataType: string;
  confidence: number;
  isPII: boolean;
  samples: any[];
  nullCount: number;
  uniqueCount: number;
  totalCount: number;
}

interface FieldDiscoveryUIProps {
  fields: DiscoveredField[];
  onFieldSelect: (fieldId: string) => void;
  onFieldToggle: (fieldId: string, isSelected: boolean) => void;
  selectedFields: string[];
  onExportFields?: (selectedFields: DiscoveredField[]) => void;
}

type SortOption = 'confidence' | 'name' | 'dataType' | 'quality';
type FilterOption = 'all' | 'pii' | 'non-pii' | 'high-confidence' | 'low-confidence';

export const FieldDiscoveryUI: React.FC<FieldDiscoveryUIProps> = ({
  fields,
  onFieldSelect,
  onFieldToggle,
  selectedFields,
  onExportFields
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('confidence');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  // Calculate field quality score
  const calculateQuality = (field: DiscoveredField): number => {
    const completeness = 1 - (field.nullCount / field.totalCount);
    const uniqueness = field.uniqueCount / field.totalCount;
    return (completeness + uniqueness) / 2;
  };

  // Get field type icon
  const getFieldIcon = (dataType: string): string => {
    const iconMap: Record<string, string> = {
      email: '✉️',
      numeric: '🔢',
      ssn: '🔒',
      text: '📝',
      date: '📅',
      boolean: '☑️',
      phone: '📞',
      address: '🏠',
      name: '👤',
      currency: '💰'
    };
    return iconMap[dataType] || '❓';
  };

  // Get field warnings
  const getFieldWarnings = (field: DiscoveredField): string[] => {
    const warnings: string[] = [];
    
    if (field.isPII) {
      warnings.push('Contains personally identifiable information');
    }
    if (field.confidence < 0.8) {
      warnings.push('Low confidence score');
    }
    if (field.nullCount / field.totalCount > 0.1) {
      warnings.push('High null percentage');
    }
    
    return warnings;
  };

  // Filter and sort fields
  const processedFields = useMemo(() => {
    let filtered = fields;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(field =>
        field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.dataType.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (filterBy) {
      case 'pii':
        filtered = filtered.filter(field => field.isPII);
        break;
      case 'non-pii':
        filtered = filtered.filter(field => !field.isPII);
        break;
      case 'high-confidence':
        filtered = filtered.filter(field => field.confidence >= confidenceThreshold);
        break;
      case 'low-confidence':
        filtered = filtered.filter(field => field.confidence < confidenceThreshold);
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'dataType':
          return a.dataType.localeCompare(b.dataType);
        case 'quality':
          return calculateQuality(b) - calculateQuality(a);
        default:
          return 0;
      }
    });
  }, [fields, searchQuery, filterBy, sortBy, confidenceThreshold]);

  // Bulk selection handlers
  const handleSelectAll = () => {
    const allFieldIds = processedFields.map(field => field.id);
    allFieldIds.forEach(id => {
      if (!selectedFields.includes(id)) {
        onFieldToggle(id, true);
      }
    });
  };

  const handleSelectNone = () => {
    selectedFields.forEach(id => onFieldToggle(id, false));
  };

  const handleSelectPII = () => {
    const piiFieldIds = processedFields
      .filter(field => field.isPII)
      .map(field => field.id);
    
    piiFieldIds.forEach(id => {
      if (!selectedFields.includes(id)) {
        onFieldToggle(id, true);
      }
    });
  };

  const handleExport = () => {
    const selectedFieldObjects = fields.filter(field => 
      selectedFields.includes(field.id)
    );
    if (onExportFields) {
      onExportFields(selectedFieldObjects);
    }
  };

  const formatSample = (sample: any, isPII: boolean): string => {
    if (isPII && typeof sample === 'string') {
      // Keep PII samples already masked from backend
      return sample;
    }
    if (typeof sample === 'number') {
      return sample.toString();
    }
    return String(sample);
  };

  return (
    <div className="field-discovery-ui">
      <div className="discovery-header">
        <h2>Field Discovery</h2>
        <div className="field-count">
          {processedFields.length} of {fields.length} fields
        </div>
      </div>

      <div className="discovery-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          <label>Filter:</label>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            className="filter-select"
          >
            <option value="all">All Fields</option>
            <option value="pii">PII Fields</option>
            <option value="non-pii">Non-PII Fields</option>
            <option value="high-confidence">High Confidence</option>
            <option value="low-confidence">Low Confidence</option>
          </select>
        </div>

        <div className="sort-section">
          <label>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="sort-select"
          >
            <option value="confidence">Confidence</option>
            <option value="name">Name</option>
            <option value="dataType">Data Type</option>
            <option value="quality">Quality Score</option>
          </select>
        </div>

        <div className="threshold-section">
          <label>Confidence Threshold:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            className="threshold-slider"
          />
          <span>{Math.round(confidenceThreshold * 100)}%</span>
        </div>
      </div>

      <div className="bulk-actions">
        <button onClick={handleSelectAll} className="bulk-button">
          Select All
        </button>
        <button onClick={handleSelectNone} className="bulk-button">
          Select None
        </button>
        <button onClick={handleSelectPII} className="bulk-button warning">
          Select PII Fields
        </button>
        {selectedFields.length > 0 && (
          <button onClick={handleExport} className="bulk-button primary">
            Export Selected ({selectedFields.length})
          </button>
        )}
      </div>

      <div className="fields-list">
        {processedFields.map((field) => {
          const isSelected = selectedFields.includes(field.id);
          const quality = calculateQuality(field);
          const warnings = getFieldWarnings(field);

          return (
            <div
              key={field.id}
              className={`field-card ${isSelected ? 'selected' : ''} ${field.isPII ? 'pii' : ''}`}
              onClick={() => onFieldSelect(field.id)}
            >
              <div className="field-header">
                <div className="field-title">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onFieldToggle(field.id, e.target.checked);
                    }}
                    className="field-checkbox"
                  />
                  <span className="field-icon">{getFieldIcon(field.dataType)}</span>
                  <span className="field-name">{field.name}</span>
                  {field.isPII && (
                    <span className="pii-badge">PII</span>
                  )}
                </div>
                <div className="field-confidence">
                  <span className={`confidence-score ${field.confidence >= 0.8 ? 'high' : field.confidence >= 0.6 ? 'medium' : 'low'}`}>
                    {Math.round(field.confidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="field-details">
                <div className="field-meta">
                  <span className="data-type">{field.dataType}</span>
                  <span className="quality-score">
                    Quality: {Math.round(quality * 100)}%
                  </span>
                </div>

                <div className="field-stats">
                  <div className="stat">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">{field.totalCount.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Unique:</span>
                    <span className="stat-value">{field.uniqueCount.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Nulls:</span>
                    <span className="stat-value">{field.nullCount.toLocaleString()}</span>
                  </div>
                </div>

                {field.samples && field.samples.length > 0 && (
                  <FieldSamples samples={field.samples} isPII={field.isPII} />
                )}

                <FieldWarnings warnings={warnings} />
              </div>
            </div>
          );
        })}
      </div>

      {processedFields.length === 0 && (
        <div className="no-fields">
          <p>No fields match the current filters.</p>
          <button onClick={() => {
            setSearchQuery('');
            setFilterBy('all');
          }} className="reset-filters-button">
            Reset Filters
          </button>
        </div>
      )}

      <div className="discovery-summary">
        <div className="summary-stats">
          <div className="summary-item">
            <span className="summary-label">Total Fields:</span>
            <span className="summary-value">{fields.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">PII Fields:</span>
            <span className="summary-value">{fields.filter(f => f.isPII).length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">High Confidence:</span>
            <span className="summary-value">{fields.filter(f => f.confidence >= 0.8).length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Selected:</span>
            <span className="summary-value">{selectedFields.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
interface FieldSamplesProps {
  samples: any[];
  isPII: boolean;
}

const FieldSamples: React.FC<FieldSamplesProps> = ({ samples, isPII }) => {
  const formatSample = (sample: any, isPII: boolean): string => {
    if (isPII && typeof sample === 'string') {
      // Keep PII samples already masked from backend
      return sample;
    }
    if (typeof sample === 'number') {
      return sample.toString();
    }
    return String(sample);
  };

  return (
    <div className="field-samples">
      <span className="samples-label">Samples:</span>
      <div className="samples-list">
        {samples.slice(0, 3).map((sample, index) => (
          <span key={index} className="sample-value">
            {formatSample(sample, isPII)}
          </span>
        ))}
      </div>
    </div>
  );
};

interface FieldWarningsProps {
  warnings: string[];
}

const FieldWarnings: React.FC<FieldWarningsProps> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <div className="field-warnings">
      {warnings.map((warning, index) => (
        <div key={index} className="warning-item">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">{warning}</span>
        </div>
      ))}
    </div>
  );
};

// Utility functions
export function getFieldIcon(dataType: string): string {
  const iconMap: Record<string, string> = {
    email: '✉️',
    numeric: '🔢',
    ssn: '🔒',
    text: '📝',
    date: '📅',
    boolean: '☑️',
    phone: '📞',
    address: '🏠',
    name: '👤',
    currency: '💰'
  };
  return iconMap[dataType] || '❓';
}