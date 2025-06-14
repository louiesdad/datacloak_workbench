import React, { Component, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send error reports to a service
    this.reportErrorToService(error, errorInfo);
  }

  private reportErrorToService = (error: Error, errorInfo: any) => {
    // In production, send error reports to monitoring service
    // For now, just log to console
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: 'anonymous', // Would be actual user ID in production
      sessionId: this.state.errorId
    };

    console.error('Error Report:', errorReport);
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleReportBug = () => {
    const subject = `Bug Report: ${this.state.error?.name || 'Application Error'}`;
    const body = `
Error ID: ${this.state.errorId}
Error: ${this.state.error?.message || 'Unknown error'}
Stack: ${this.state.error?.stack || 'No stack trace'}
Component Stack: ${this.state.errorInfo?.componentStack || 'No component stack'}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]
    `.trim();

    const mailtoLink = `mailto:support@datacloak.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  private copyErrorDetails = async () => {
    const errorDetails = {
      errorId: this.state.errorId,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      alert('Error details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error details:', err);
      // Fallback: show error details in a modal or alert
      alert(`Error details:\n${JSON.stringify(errorDetails, null, 2)}`);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            
            <h1 className="error-title">Something went wrong</h1>
            
            <p className="error-description">
              We're sorry, but something unexpected happened. The application has encountered an error
              and needs to recover.
            </p>

            <div className="error-details">
              <h3>Error Details:</h3>
              <div className="error-message">
                <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
              </div>
              <div className="error-id">
                <strong>Error ID:</strong> {this.state.errorId}
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="error-stack">
                  <summary>Stack Trace (Development Only)</summary>
                  <pre>{this.state.error?.stack}</pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <h4>Component Stack:</h4>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </details>
              )}
            </div>

            <div className="error-actions">
              <button 
                className="error-action primary"
                onClick={this.handleRetry}
              >
                Try Again
              </button>
              
              <button 
                className="error-action secondary"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
              
              <button 
                className="error-action tertiary"
                onClick={this.copyErrorDetails}
              >
                Copy Error Details
              </button>
              
              <button 
                className="error-action tertiary"
                onClick={this.handleReportBug}
              >
                Report Bug
              </button>
            </div>

            <div className="error-help">
              <h3>What can you do?</h3>
              <ul>
                <li><strong>Try Again:</strong> Attempt to recover from the error without losing your work</li>
                <li><strong>Reload Page:</strong> Refresh the entire application (you may lose unsaved work)</li>
                <li><strong>Report Bug:</strong> Help us fix this issue by sending an error report</li>
                <li><strong>Contact Support:</strong> If the problem persists, reach out to our support team</li>
              </ul>
            </div>

            <div className="error-prevention">
              <h3>Prevention Tips:</h3>
              <ul>
                <li>Make sure you have a stable internet connection</li>
                <li>Try using a modern browser (Chrome, Firefox, Safari, Edge)</li>
                <li>Clear your browser cache and cookies if issues persist</li>
                <li>Disable browser extensions that might interfere with the application</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: any) => {
    console.error('Unhandled error:', error, errorInfo);
    
    // In a real app, you might want to show a toast notification
    // or update global state to show an error message
    throw error; // Re-throw to trigger ErrorBoundary
  };
};

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: any) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};