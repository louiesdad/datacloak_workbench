import React from 'react';
import './ProgressIndicator.css';

export interface ProgressIndicatorProps {
  /** Progress value between 0 and 100 */
  value?: number;
  /** Whether to show the progress as indeterminate (no specific value) */
  indeterminate?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show text label */
  label?: string;
  /** Show percentage */
  showPercentage?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Test ID for E2E testing */
  testId?: string;
  /** Loading message */
  message?: string;
  /** Variant style */
  variant?: 'default' | 'overlay' | 'inline';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value = 0,
  indeterminate = false,
  size = 'medium',
  label,
  showPercentage = false,
  className = '',
  testId,
  message,
  variant = 'default'
}) => {
  const progressValue = Math.min(Math.max(value, 0), 100);
  const isComplete = progressValue >= 100;
  
  const baseClasses = [
    'progress-indicator',
    `progress-indicator--${size}`,
    `progress-indicator--${variant}`,
    indeterminate && 'progress-indicator--indeterminate',
    isComplete && 'progress-indicator--complete',
    className
  ].filter(Boolean).join(' ');

  if (variant === 'overlay') {
    return (
      <div 
        className={baseClasses}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || message || 'Loading'}
        data-testid={testId}
      >
        <div className="progress-overlay-content">
          <div className="progress-spinner">
            <div className="spinner-ring"></div>
          </div>
          {(message || label) && (
            <div className="progress-message">
              {message || label}
            </div>
          )}
          {!indeterminate && showPercentage && (
            <div className="progress-percentage">
              {progressValue}%
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={baseClasses}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progressValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
      data-testid={testId}
    >
      {label && (
        <div className="progress-label">
          {label}
          {showPercentage && !indeterminate && (
            <span className="progress-percentage"> {progressValue}%</span>
          )}
        </div>
      )}
      
      <div className="progress-track">
        {indeterminate ? (
          <div className="progress-bar progress-bar--indeterminate"></div>
        ) : (
          <div 
            className="progress-bar"
            style={{ width: `${progressValue}%` }}
          ></div>
        )}
      </div>
      
      {message && (
        <div className="progress-message">
          {message}
        </div>
      )}
    </div>
  );
};

// Spinner component for indeterminate loading
export const Spinner: React.FC<{
  size?: 'small' | 'medium' | 'large';
  className?: string;
  testId?: string;
}> = ({ 
  size = 'medium', 
  className = '',
  testId 
}) => (
  <div 
    className={`spinner spinner--${size} ${className}`}
    role="progressbar"
    aria-label="Loading"
    data-testid={testId}
  >
    <div className="spinner-ring"></div>
  </div>
);

// Hook for managing progress state
export const useProgress = (initialValue = 0) => {
  const [progress, setProgress] = React.useState(initialValue);
  const [isActive, setIsActive] = React.useState(false);
  
  const start = React.useCallback(() => {
    setIsActive(true);
    setProgress(0);
  }, []);
  
  const update = React.useCallback((value: number) => {
    setProgress(Math.min(Math.max(value, 0), 100));
  }, []);
  
  const complete = React.useCallback(() => {
    setProgress(100);
    setTimeout(() => setIsActive(false), 300); // Small delay for visual feedback
  }, []);
  
  const reset = React.useCallback(() => {
    setProgress(0);
    setIsActive(false);
  }, []);
  
  return {
    progress,
    isActive,
    start,
    update,
    complete,
    reset
  };
};