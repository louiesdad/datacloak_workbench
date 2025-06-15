import React from 'react';
import './AppVersion.css';

interface AppVersionProps {
  position?: 'footer' | 'header' | 'sidebar';
  className?: string;
  showBuildInfo?: boolean;
}

// Get version from environment or fallback
const getAppVersion = () => {
  // In production, this would come from build environment
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0';
  const buildDate = import.meta.env.VITE_BUILD_DATE || new Date().toISOString().split('T')[0];
  const buildHash = import.meta.env.VITE_BUILD_HASH || 'dev';
  
  return {
    version,
    buildDate,
    buildHash: buildHash.slice(0, 8) // Short hash
  };
};

export const AppVersion: React.FC<AppVersionProps> = ({
  position = 'footer',
  className = '',
  showBuildInfo = false
}) => {
  const { version, buildDate, buildHash } = getAppVersion();
  
  return (
    <div 
      className={`app-version ${position} ${className}`}
      data-testid="app-version"
    >
      <div className="version-info">
        <span className="version-label">Version</span>
        <span className="version-number" data-testid="version-number">
          {version}
        </span>
      </div>
      
      {showBuildInfo && (
        <div className="build-info">
          <div className="build-detail">
            <span className="build-label">Build:</span>
            <span className="build-hash" data-testid="build-hash">
              {buildHash}
            </span>
          </div>
          <div className="build-detail">
            <span className="build-label">Date:</span>
            <span className="build-date" data-testid="build-date">
              {buildDate}
            </span>
          </div>
        </div>
      )}
      
      <div className="app-info">
        <span className="app-name">DataCloak Sentiment Workbench</span>
      </div>
    </div>
  );
};

// Compact version for sidebar
export const CompactAppVersion: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { version } = getAppVersion();
  
  return (
    <div className={`app-version-compact ${className}`} data-testid="app-version-compact">
      <span className="version-compact">v{version}</span>
    </div>
  );
};

export default AppVersion;