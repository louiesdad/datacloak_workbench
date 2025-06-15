import React, { useState } from 'react';
import type { ApiError } from '../hooks/useApiErrorHandler';
import './ApiErrorDisplay.css';

interface ApiErrorDisplayProps {
  error: ApiError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  context?: string;
  showDetails?: boolean;
  className?: string;
}

export const ApiErrorDisplay: React.FC<ApiErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  context,
  showDetails = false,
  className = ''
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (!error) return null;

  const getErrorIcon = (code: string): string => {
    switch (code) {
      case 'NETWORK_ERROR':
      case 'CONNECTION_ERROR':
        return '🌐';
      case 'TIMEOUT_ERROR':
        return '⏱️';
      case 'RATE_LIMIT_EXCEEDED':
        return '🚦';
      case 'QUOTA_EXCEEDED':
        return '💳';
      case 'UNAUTHORIZED':
        return '🔐';
      case 'FORBIDDEN':
        return '🚫';
      case 'NOT_FOUND':
        return '🔍';
      case 'PAYLOAD_TOO_LARGE':
        return '📦';
      case 'INTERNAL_SERVER_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return '⚠️';
      case 'MODEL_OVERLOADED':
        return '🤖';
      case 'CONTEXT_TOO_LONG':
        return '📝';
      default:
        return '❌';
    }
  };

  const getErrorSeverity = (code: string): 'error' | 'warning' | 'info' => {
    switch (code) {
      case 'RATE_LIMIT_EXCEEDED':
      case 'MODEL_OVERLOADED':
      case 'SERVICE_UNAVAILABLE':
      case 'TIMEOUT_ERROR':
        return 'warning';
      case 'NETWORK_ERROR':
      case 'CONNECTION_ERROR':
        return 'info';
      default:
        return 'error';
    }
  };

  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const severity = getErrorSeverity(error.code);
  const icon = getErrorIcon(error.code);

  return (
    <div className={`api-error-display ${severity} ${className}`} role="alert">
      <div className="api-error-header">
        <div className="api-error-icon">{icon}</div>
        <div className="api-error-content">
          <div className="api-error-title">
            {context && <span className="api-error-context">{context}: </span>}
            <span className="api-error-message">{error.message}</span>
          </div>
          {error.timestamp && (
            <div className="api-error-timestamp">
              Occurred at {formatTimestamp(error.timestamp)}
            </div>
          )}
        </div>
        <div className="api-error-actions">
          {error.retryable && onRetry && (
            <button
              className="api-error-retry-button"
              onClick={onRetry}
              title="Retry this operation"
            >
              🔄 Retry
            </button>
          )}
          {showDetails && error.details && (
            <button
              className="api-error-details-toggle"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              title="Show technical details"
            >
              {detailsExpanded ? '▼' : '▶'} Details
            </button>
          )}
          {onDismiss && (
            <button
              className="api-error-dismiss-button"
              onClick={onDismiss}
              title="Dismiss this error"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {detailsExpanded && error.details && (
        <div className="api-error-details">
          <div className="api-error-details-header">Technical Details:</div>
          <div className="api-error-details-content">
            <div className="api-error-code">
              <strong>Error Code:</strong> {error.code}
            </div>
            {typeof error.details === 'string' ? (
              <div className="api-error-details-text">{error.details}</div>
            ) : (
              <pre className="api-error-details-json">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Progress indicator for retry operations */}
      {error.retryable && (
        <div className="api-error-suggestions">
          <div className="api-error-suggestion-title">💡 Suggestions:</div>
          <ul className="api-error-suggestion-list">
            {error.code === 'NETWORK_ERROR' && (
              <li>Check your internet connection</li>
            )}
            {error.code === 'RATE_LIMIT_EXCEEDED' && (
              <li>Wait a few minutes before trying again</li>
            )}
            {error.code === 'MODEL_OVERLOADED' && (
              <li>Try again during off-peak hours</li>
            )}
            {error.code === 'TIMEOUT_ERROR' && (
              <li>Try with a smaller dataset or check your connection</li>
            )}
            {error.code === 'SERVICE_UNAVAILABLE' && (
              <li>Service may be under maintenance, try again later</li>
            )}
            {(error.code === 'INTERNAL_SERVER_ERROR' || error.code === 'UNKNOWN_ERROR') && (
              <li>If this persists, please contact support</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// Higher-order component for wrapping components with error handling
export function withApiErrorHandling<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  defaultContext?: string
) {
  return React.forwardRef<any, P & { errorContext?: string }>((props, ref) => {
    const [apiError, setApiError] = useState<ApiError | null>(null);

    const handleError = (error: ApiError) => {
      setApiError(error);
    };

    const clearError = () => {
      setApiError(null);
    };

    return (
      <>
        <WrappedComponent
          {...props}
          ref={ref}
          onApiError={handleError}
          clearApiError={clearError}
        />
        <ApiErrorDisplay
          error={apiError}
          context={props.errorContext || defaultContext}
          onDismiss={clearError}
          showDetails={process.env.NODE_ENV === 'development'}
        />
      </>
    );
  });
}