import React, { useState } from 'react';
import type { FieldProfile } from './ProfilerUI';
import { ProgressIndicator } from './ProgressIndicator';
import './SecurityAuditReport.css';

interface SecurityAuditData {
  totalFields: number;
  piiFieldsFound: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  piiTypes: Record<string, number>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  detectedPIIFields: Array<{
    fieldName: string;
    piiType: string;
    confidence: number;
    samples: string[];
  }>;
}

interface SecurityAuditReportProps {
  fieldProfiles: FieldProfile[];
  className?: string;
  onMaskAllPII?: () => void;
  onExportReport?: () => void;
}

export const SecurityAuditReport: React.FC<SecurityAuditReportProps> = ({
  fieldProfiles,
  className = '',
  onMaskAllPII,
  onExportReport
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const generateAuditData = (): SecurityAuditData => {
    const piiFields = fieldProfiles.filter(field => field.piiDetection.isPII);
    const totalFields = fieldProfiles.length;
    const piiFieldsFound = piiFields.length;

    // Calculate risk level based on PII percentage and types
    const piiPercentage = (piiFieldsFound / totalFields) * 100;
    let riskLevel: SecurityAuditData['riskLevel'] = 'low';
    
    if (piiPercentage > 50 || piiFields.some(f => ['ssn', 'credit_card'].includes(f.piiDetection.piiType || ''))) {
      riskLevel = 'critical';
    } else if (piiPercentage > 25 || piiFields.some(f => ['email', 'phone'].includes(f.piiDetection.piiType || ''))) {
      riskLevel = 'high';
    } else if (piiPercentage > 10) {
      riskLevel = 'medium';
    }

    // Count PII types
    const piiTypes: Record<string, number> = {};
    piiFields.forEach(field => {
      const type = field.piiDetection.piiType || 'other';
      piiTypes[type] = (piiTypes[type] || 0) + 1;
    });

    // Calculate confidence distribution
    const confidenceDistribution = {
      high: piiFields.filter(f => f.piiDetection.confidence >= 0.8).length,
      medium: piiFields.filter(f => f.piiDetection.confidence >= 0.6 && f.piiDetection.confidence < 0.8).length,
      low: piiFields.filter(f => f.piiDetection.confidence < 0.6).length
    };

    // Generate recommendations
    const recommendations = [];
    if (piiFieldsFound > 0) {
      recommendations.push(`Found ${piiFieldsFound} fields containing PII data`);
      recommendations.push('Consider enabling PII masking for sensitive fields');
    }
    if (Object.keys(piiTypes).includes('ssn')) {
      recommendations.push('SSN detected - ensure compliance with privacy regulations');
    }
    if (Object.keys(piiTypes).includes('credit_card')) {
      recommendations.push('Credit card data detected - consider PCI DSS compliance requirements');
    }
    if (confidenceDistribution.low > 0) {
      recommendations.push(`${confidenceDistribution.low} fields have low-confidence PII detection - manual review recommended`);
    }

    const detectedPIIFields = piiFields.map(field => ({
      fieldName: field.name,
      piiType: field.piiDetection.piiType || 'other',
      confidence: field.piiDetection.confidence,
      samples: field.samples.slice(0, 3)
    }));

    return {
      totalFields,
      piiFieldsFound,
      riskLevel,
      recommendations,
      piiTypes,
      confidenceDistribution,
      detectedPIIFields
    };
  };

  const auditData = generateAuditData();

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      default: return '#059669';
    }
  };

  const getRiskIcon = (risk: string): string => {
    switch (risk) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      default: return '✅';
    }
  };

  const formatPIIType = (type: string): string => {
    const labels: Record<string, string> = {
      email: 'Email Addresses',
      phone: 'Phone Numbers',
      ssn: 'Social Security Numbers',
      credit_card: 'Credit Card Numbers',
      name: 'Personal Names',
      address: 'Addresses',
      other: 'Other PII'
    };
    return labels[type] || type;
  };

  const renderSection = (id: string, title: string, content: React.ReactNode, badge?: string) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="audit-section" data-testid={`audit-section-${id}`}>
        <button
          className="section-header"
          onClick={() => toggleSection(id)}
          aria-expanded={isExpanded}
          data-testid={`audit-section-toggle-${id}`}
        >
          <div className="section-title">
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
            <span className="title-text">{title}</span>
            {badge && <span className="section-badge">{badge}</span>}
          </div>
        </button>
        {isExpanded && (
          <div className="section-content" data-testid={`audit-section-content-${id}`}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`security-audit-report ${className}`} data-testid="security-audit-report">
      <div className="audit-header">
        <h2>Security Audit Report</h2>
        <div className="audit-actions">
          {auditData.piiFieldsFound > 0 && onMaskAllPII && (
            <button 
              className="mask-all-button"
              onClick={onMaskAllPII}
              data-testid="mask-all-pii-button"
            >
              🔒 Mask All PII
            </button>
          )}
          {onExportReport && (
            <button 
              className="export-report-button"
              onClick={onExportReport}
              data-testid="export-report-button"
            >
              📄 Export Report
            </button>
          )}
        </div>
      </div>

      {renderSection('overview', 'Security Overview', (
        <div className="security-overview">
          <div className="risk-assessment">
            <div className="risk-level" style={{ color: getRiskColor(auditData.riskLevel) }}>
              <span className="risk-icon">{getRiskIcon(auditData.riskLevel)}</span>
              <span className="risk-text">Risk Level: {auditData.riskLevel.toUpperCase()}</span>
            </div>
            <div className="risk-metrics">
              <div className="metric">
                <span className="metric-value">{auditData.piiFieldsFound}</span>
                <span className="metric-label">PII Fields Found</span>
              </div>
              <div className="metric">
                <span className="metric-value">{auditData.totalFields}</span>
                <span className="metric-label">Total Fields</span>
              </div>
              <div className="metric">
                <span className="metric-value">{((auditData.piiFieldsFound / auditData.totalFields) * 100).toFixed(1)}%</span>
                <span className="metric-label">PII Coverage</span>
              </div>
            </div>
          </div>
        </div>
      ), `${auditData.piiFieldsFound} PII`)}

      {auditData.piiFieldsFound > 0 && renderSection('types', 'PII Types Detected', (
        <div className="pii-types">
          {Object.entries(auditData.piiTypes).map(([type, count]) => (
            <div key={type} className="pii-type-item" data-testid={`pii-type-${type}`}>
              <div className="type-info">
                <span className="type-name">{formatPIIType(type)}</span>
                <span className="type-count">{count} field{count > 1 ? 's' : ''}</span>
              </div>
              <div className="type-percentage">
                {((count / auditData.piiFieldsFound) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      ), `${Object.keys(auditData.piiTypes).length} types`)}

      {renderSection('confidence', 'Detection Confidence', (
        <div className="confidence-analysis">
          <div className="confidence-chart">
            <div className="confidence-item high">
              <div className="confidence-bar">
                <ProgressIndicator 
                  value={(auditData.confidenceDistribution.high / auditData.piiFieldsFound) * 100}
                  variant="success"
                  size="small"
                />
              </div>
              <div className="confidence-details">
                <span className="confidence-label">High Confidence (≥80%)</span>
                <span className="confidence-count">{auditData.confidenceDistribution.high} fields</span>
              </div>
            </div>
            <div className="confidence-item medium">
              <div className="confidence-bar">
                <ProgressIndicator 
                  value={(auditData.confidenceDistribution.medium / auditData.piiFieldsFound) * 100}
                  variant="warning"
                  size="small"
                />
              </div>
              <div className="confidence-details">
                <span className="confidence-label">Medium Confidence (60-79%)</span>
                <span className="confidence-count">{auditData.confidenceDistribution.medium} fields</span>
              </div>
            </div>
            <div className="confidence-item low">
              <div className="confidence-bar">
                <ProgressIndicator 
                  value={(auditData.confidenceDistribution.low / auditData.piiFieldsFound) * 100}
                  variant="danger"
                  size="small"
                />
              </div>
              <div className="confidence-details">
                <span className="confidence-label">Low Confidence (<60%)</span>
                <span className="confidence-count">{auditData.confidenceDistribution.low} fields</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {auditData.detectedPIIFields.length > 0 && renderSection('details', 'Detected PII Fields', (
        <div className="pii-details">
          {auditData.detectedPIIFields.map((field, index) => (
            <div key={field.fieldName} className="pii-field-detail" data-testid={`pii-detail-${field.fieldName}`}>
              <div className="field-header">
                <span className="field-name">{field.fieldName}</span>
                <span className={`pii-type ${field.piiType}`}>{formatPIIType(field.piiType)}</span>
                <span className="confidence-score">{(field.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="field-samples">
                <span className="samples-label">Sample values:</span>
                {field.samples.map((sample, idx) => (
                  <span key={idx} className="sample-value">
                    {sample.length > 20 ? `${sample.substring(0, 20)}...` : sample}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ), `${auditData.detectedPIIFields.length} fields`)}

      {renderSection('recommendations', 'Security Recommendations', (
        <div className="recommendations">
          {auditData.recommendations.map((recommendation, index) => (
            <div key={index} className="recommendation-item" data-testid={`recommendation-${index}`}>
              <span className="recommendation-icon">💡</span>
              <span className="recommendation-text">{recommendation}</span>
            </div>
          ))}
        </div>
      ), `${auditData.recommendations.length} items`)}
    </div>
  );
};

export default SecurityAuditReport;