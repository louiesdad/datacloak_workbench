import React, { useState, useEffect } from 'react';
import type { FileInfo } from '../platform-bridge';
import { DataPreview } from './DataPreview';
import { VirtualTable, PerformantList } from './VirtualScrollList';
import { SecurityAuditReport } from './SecurityAuditReport';
import { PIIBadge } from './SecurityBadge';
import './ProfilerUI.css';

export interface FieldProfile {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  samples: string[];
  nullCount: number;
  totalCount: number;
  uniqueCount?: number;
  piiDetection: {
    isPII: boolean;
    piiType?: 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address' | 'other';
    confidence: number;
  };
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
  };
}

export interface FileProfile {
  file: FileInfo;
  fields: FieldProfile[];
  rowCount: number;
  processingTime: number;
  errors: string[];
}

interface ProfilerUIProps {
  fileProfiles: FileProfile[];
  onFieldToggle?: (fileIndex: number, fieldName: string, selected: boolean) => void;
  onPIIToggle?: (fileIndex: number, fieldName: string, maskPII: boolean) => void;
  selectedFields?: Record<string, boolean>;
  piiMaskingSettings?: Record<string, boolean>;
}

const FieldPIIBadge: React.FC<{ field: FieldProfile }> = ({ field }) => {
  const { piiDetection } = field;
  
  if (!piiDetection.isPII) {
    return null;
  }

  return (
    <PIIBadge
      piiType={piiDetection.piiType as any || 'other'}
      confidence={piiDetection.confidence}
      fieldName={field.name}
      size="small"
      showConfidence={true}
    />
  );
};

const FieldTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, string> = {
    string: '📝',
    number: '🔢',
    date: '📅',
    boolean: '☑️',
    unknown: '❓'
  };
  
  return <span className="field-type-icon" title={`${type} field`}>{icons[type]}</span>;
};

const FieldRow: React.FC<{
  field: FieldProfile;
  fileIndex: number;
  isSelected: boolean;
  isPIIMasked: boolean;
  onFieldToggle?: (fileIndex: number, fieldName: string, selected: boolean) => void;
  onPIIToggle?: (fileIndex: number, fieldName: string, maskPII: boolean) => void;
}> = ({ field, fileIndex, isSelected, isPIIMasked, onFieldToggle, onPIIToggle }) => {
  const completionRate = ((field.totalCount - field.nullCount) / field.totalCount * 100).toFixed(1);
  
  return (
    <div 
      className={`field-row ${isSelected ? 'selected' : ''} ${field.piiDetection.isPII ? 'has-pii' : ''}`}
      data-testid={`field-row-${field.name}`}
      data-has-pii={field.piiDetection.isPII}
    >
      <div className="field-select">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onFieldToggle?.(fileIndex, field.name, e.target.checked)}
        />
      </div>
      <div className="field-name">
        <div className="field-name-content">
          <FieldTypeIcon type={field.type} />
          <span className="name">{field.name}</span>
          <FieldPIIBadge field={field} />
        </div>
      </div>
      <div className="field-type">{field.type}</div>
      <div className="field-stats">
        <div className="completion-rate">
          <div className="completion-bar">
            <div 
              className="completion-fill" 
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
          <span className="completion-text">{completionRate}%</span>
        </div>
        <div className="count-info">
          {field.totalCount.toLocaleString()} rows, {field.nullCount.toLocaleString()} null
        </div>
        {field.uniqueCount && (
          <div className="unique-info">
            {field.uniqueCount.toLocaleString()} unique values
          </div>
        )}
      </div>
      <div className="field-samples">
        <div className="samples">
          {field.samples.slice(0, 3).map((sample, idx) => (
            <span key={idx} className="sample">{sample}</span>
          ))}
          {field.samples.length > 3 && (
            <span className="sample-more">+{field.samples.length - 3} more</span>
          )}
        </div>
      </div>
      <div className="field-actions">
        {field.piiDetection.isPII && (
          <label className="pii-mask-toggle" data-testid={`pii-mask-toggle-${field.name}`}>
            <input
              type="checkbox"
              checked={isPIIMasked}
              onChange={(e) => onPIIToggle?.(fileIndex, field.name, e.target.checked)}
              data-testid={`pii-mask-checkbox-${field.name}`}
              aria-label={`Mask PII data for ${field.name}`}
            />
            <span className="toggle-text">Mask PII</span>
          </label>
        )}
      </div>
    </div>
  );
};

export const ProfilerUI: React.FC<ProfilerUIProps> = ({
  fileProfiles,
  onFieldToggle,
  onPIIToggle,
  selectedFields = {},
  piiMaskingSettings = {}
) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [showSecurityAudit, setShowSecurityAudit] = useState(false);

  useEffect(() => {
    // Auto-expand first file if only one file
    if (fileProfiles.length === 1) {
      setExpandedFiles(new Set([0]));
    }
  }, [fileProfiles.length]);

  const toggleFileExpansion = (fileIndex: number) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileIndex)) {
      newExpanded.delete(fileIndex);
    } else {
      newExpanded.add(fileIndex);
    }
    setExpandedFiles(newExpanded);
  };

  const getFieldKey = (fileIndex: number, fieldName: string) => `${fileIndex}:${fieldName}`;

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleMaskAllPII = () => {
    fileProfiles.forEach((profile, fileIndex) => {
      profile.fields.forEach(field => {
        if (field.piiDetection.isPII) {
          onPIIToggle?.(fileIndex, field.name, true);
        }
      });
    });
  };

  const handleExportSecurityReport = () => {
    // Implementation would export the security audit report
    console.log('Exporting security report...');
  };

  const allFields = fileProfiles.flatMap(profile => profile.fields);
  const hasPIIFields = allFields.some(field => field.piiDetection.isPII);

  if (fileProfiles.length === 0) {
    return (
      <div className="profiler-ui empty">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Data to Profile</h3>
          <p>Select data files to see field analysis and PII detection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profiler-ui">
      <div className="profiler-header">
        <div className="header-main">
          <h2>Data Profile Analysis</h2>
          <div className="profile-summary">
            {fileProfiles.length} file{fileProfiles.length > 1 ? 's' : ''} analyzed
          </div>
        </div>
        <div className="header-actions">
          {hasPIIFields && (
            <button
              className="security-audit-toggle"
              onClick={() => setShowSecurityAudit(!showSecurityAudit)}
              data-testid="security-audit-toggle"
            >
              🔒 {showSecurityAudit ? 'Hide' : 'Show'} Security Report
            </button>
          )}
        </div>
      </div>

      {fileProfiles.map((profile, fileIndex) => {
        const isExpanded = expandedFiles.has(fileIndex);
        const piiFieldCount = profile.fields.filter(f => f.piiDetection.isPII).length;
        const selectedFieldCount = profile.fields.filter(f => 
          selectedFields[getFieldKey(fileIndex, f.name)]
        ).length;

        return (
          <div key={fileIndex} className="file-profile">
            <div 
              className="file-header"
              onClick={() => toggleFileExpansion(fileIndex)}
            >
              <div className="file-info">
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                <strong className="file-name">{profile.file.name}</strong>
                <span className="file-size">{formatFileSize(profile.file.size)}</span>
              </div>
              <div className="file-stats">
                <span className="row-count">{profile.rowCount.toLocaleString()} rows</span>
                <span className="field-count">{profile.fields.length} fields</span>
                {piiFieldCount > 0 && (
                  <span className="pii-count">🔒 {piiFieldCount} PII</span>
                )}
                {selectedFieldCount > 0 && (
                  <span className="selected-count">✓ {selectedFieldCount} selected</span>
                )}
              </div>
            </div>

            {profile.errors.length > 0 && (
              <div className="file-errors">
                <h4>Processing Errors:</h4>
                {profile.errors.map((error, idx) => (
                  <div key={idx} className="error-message">{error}</div>
                ))}
              </div>
            )}

            {isExpanded && (
              <div className="fields-table-container">
                <div className="fields-table-header">
                  <div className="select-col">
                    <input
                      type="checkbox"
                      checked={selectedFieldCount === profile.fields.length}
                      onChange={(e) => {
                        profile.fields.forEach(field => {
                          onFieldToggle?.(fileIndex, field.name, e.target.checked);
                        });
                      }}
                      title="Select all fields"
                    />
                  </div>
                  <div className="field-header">Field Name</div>
                  <div className="type-header">Type</div>
                  <div className="stats-header">Statistics</div>
                  <div className="samples-header">Sample Values</div>
                  <div className="actions-header">Actions</div>
                </div>
                
                <PerformantList
                  items={profile.fields}
                  height={Math.min(400, profile.fields.length * 60 + 20)}
                  estimatedItemHeight={60}
                  threshold={20}
                  className="fields-virtual-list"
                  testId={`fields-list-${fileIndex}`}
                  renderItem={(field, index) => (
                    <div className="field-row-container">
                      <FieldRow
                        field={field}
                        fileIndex={fileIndex}
                        isSelected={selectedFields[getFieldKey(fileIndex, field.name)] || false}
                        isPIIMasked={piiMaskingSettings[getFieldKey(fileIndex, field.name)] || false}
                        onFieldToggle={onFieldToggle}
                        onPIIToggle={onPIIToggle}
                      />
                    </div>
                  )}
                />
              </div>
            )}
            
            {isExpanded && (
              <DataPreview 
                fileProfile={profile}
                maxRows={10}
              />
            )}
          </div>
        );
      })}

      {/* Security Audit Report */}
      {showSecurityAudit && hasPIIFields && (
        <SecurityAuditReport
          fieldProfiles={allFields}
          onMaskAllPII={handleMaskAllPII}
          onExportReport={handleExportSecurityReport}
          className="profiler-security-audit"
        />
      )}
    </div>
  );
};