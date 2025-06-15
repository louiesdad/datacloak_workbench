import React from 'react';
import './SecurityBadge.css';

export type SecurityLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address' | 'other';

interface SecurityBadgeProps {
  level: SecurityLevel;
  piiType?: PIIType;
  confidence?: number;
  count?: number;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  showConfidence?: boolean;
  className?: string;
  onClick?: () => void;
}

export const SecurityBadge: React.FC<SecurityBadgeProps> = ({
  level,
  piiType,
  confidence,
  count,
  size = 'medium',
  showIcon = true,
  showConfidence = false,
  className = '',
  onClick
}) => {
  const getSecurityIcon = (level: SecurityLevel): string => {
    switch (level) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '🔍';
      default: return '✅';
    }
  };

  const getPIIIcon = (type: PIIType): string => {
    switch (type) {
      case 'email': return '📧';
      case 'phone': return '📞';
      case 'ssn': return '🆔';
      case 'credit_card': return '💳';
      case 'name': return '👤';
      case 'address': return '🏠';
      default: return '🔒';
    }
  };

  const formatPIIType = (type: PIIType): string => {
    const labels: Record<PIIType, string> = {
      email: 'Email',
      phone: 'Phone',
      ssn: 'SSN',
      credit_card: 'Credit Card',
      name: 'Name',
      address: 'Address',
      other: 'PII'
    };
    return labels[type];
  };

  const getSecurityLevel = (level: SecurityLevel): string => {
    switch (level) {
      case 'critical': return 'Critical Risk';
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      default: return 'Safe';
    }
  };

  const icon = piiType ? getPIIIcon(piiType) : getSecurityIcon(level);
  const label = piiType ? formatPIIType(piiType) : getSecurityLevel(level);

  const title = [
    label,
    confidence !== undefined ? `(${Math.round(confidence * 100)}% confidence)` : '',
    count !== undefined ? `${count} field${count !== 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(' ');

  return (
    <span
      className={`security-badge ${level} ${size} ${piiType || ''} ${onClick ? 'clickable' : ''} ${className}`}
      title={title}
      onClick={onClick}
      data-testid={`security-badge-${level}${piiType ? `-${piiType}` : ''}`}
      data-level={level}
      data-pii-type={piiType}
      data-confidence={confidence}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {showIcon && (
        <span className="badge-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="badge-text">
        {label}
        {count !== undefined && count > 1 && (
          <span className="badge-count"> ({count})</span>
        )}
      </span>
      {showConfidence && confidence !== undefined && (
        <span className="badge-confidence">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
};

// Specialized PII Badge component
export const PIIBadge: React.FC<{
  piiType: PIIType;
  confidence: number;
  fieldName?: string;
  size?: SecurityBadgeProps['size'];
  showConfidence?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ piiType, confidence, fieldName, size = 'medium', showConfidence = true, className = '', onClick }) => {
  const getSecurityLevel = (confidence: number): SecurityLevel => {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  return (
    <SecurityBadge
      level={getSecurityLevel(confidence)}
      piiType={piiType}
      confidence={confidence}
      size={size}
      showConfidence={showConfidence}
      className={`pii-badge ${className}`}
      onClick={onClick}
      data-field-name={fieldName}
    />
  );
};

// Security Risk Summary Badge
export const SecurityRiskBadge: React.FC<{
  piiFieldCount: number;
  totalFieldCount: number;
  highRiskCount?: number;
  size?: SecurityBadgeProps['size'];
  className?: string;
  onClick?: () => void;
}> = ({ piiFieldCount, totalFieldCount, highRiskCount = 0, size = 'medium', className = '', onClick }) => {
  const getOverallRisk = (): SecurityLevel => {
    if (highRiskCount > 0) return 'critical';
    
    const piiPercentage = (piiFieldCount / totalFieldCount) * 100;
    if (piiPercentage > 50) return 'high';
    if (piiPercentage > 25) return 'medium';
    if (piiPercentage > 0) return 'low';
    return 'safe';
  };

  const risk = getOverallRisk();
  
  return (
    <SecurityBadge
      level={risk}
      count={piiFieldCount}
      size={size}
      className={`security-risk-badge ${className}`}
      onClick={onClick}
    />
  );
};

export default SecurityBadge;