import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';

// Test component that throws an error
const ThrowingComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Working component</div>;
};

// Test component that throws an error during render
const RenderErrorComponent = () => {
  throw new Error('Render error');
};

// Test component that throws an async error
const AsyncErrorComponent = () => {
  const handleClick = () => {
    throw new Error('Async error');
  };

  return <button onClick={handleClick}>Trigger Error</button>;
};

describe('ErrorBoundary', () => {
  const user = userEvent.setup();
  
  // Mock console methods to avoid noise during tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('should catch and display error when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('should display error details in development mode', () => {
    // Mock development mode
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Render error/)).toBeInTheDocument();
    
    // Should show error details in development
    const errorDetails = screen.getByRole('button', { name: /show details/i });
    expect(errorDetails).toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should hide error details in production mode', () => {
    // Mock production mode
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Should not show detailed error in production
    const errorDetails = screen.queryByRole('button', { name: /show details/i });
    expect(errorDetails).not.toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should allow retry after error', async () => {
    let shouldThrow = true;
    
    const RetryComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Component recovered</div>;
    };

    render(
      <ErrorBoundary>
        <RetryComponent />
      </ErrorBoundary>
    );

    // Should show error initially
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    // Component should recover
    expect(screen.getByText('Component recovered')).toBeInTheDocument();
  });

  it('should provide reload page option', async () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        reload: mockReload
      },
      writable: true
    });

    render(
      <ErrorBoundary>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload page/i });
    await user.click(reloadButton);

    expect(mockReload).toHaveBeenCalled();
  });

  it('should call onError callback when provided', () => {
    const onErrorMock = vi.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should provide custom fallback when specified', () => {
    const CustomFallback = ({ error, retry }: any) => (
      <div>
        <h1>Custom Error UI</h1>
        <p>Error: {error.message}</p>
        <button onClick={retry}>Custom Retry</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.getByText('Error: Render error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument();
  });

  it('should reset error state on key change', () => {
    let key = 'key1';
    
    const { rerender } = render(
      <ErrorBoundary key={key}>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    // Should show error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Change key to reset error boundary
    key = 'key2';
    rerender(
      <ErrorBoundary key={key}>
        <div>Reset component</div>
      </ErrorBoundary>
    );

    // Should show new content
    expect(screen.getByText('Reset component')).toBeInTheDocument();
  });

  it('should handle errors in event handlers gracefully', async () => {
    // Note: Error boundaries don't catch errors in event handlers
    // This test ensures the component renders correctly even with async errors
    render(
      <ErrorBoundary>
        <AsyncErrorComponent />
      </ErrorBoundary>
    );

    const triggerButton = screen.getByRole('button', { name: /trigger error/i });
    expect(triggerButton).toBeInTheDocument();

    // The error in the event handler won't be caught by the boundary
    // but the component should still render
    await expect(async () => {
      await user.click(triggerButton);
    }).rejects.toThrow('Async error');
  });

  it('should display error ID for tracking', () => {
    render(
      <ErrorBoundary>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    // Should show error ID for support/tracking
    const errorIdElement = screen.getByText(/Error ID:/);
    expect(errorIdElement).toBeInTheDocument();
  });

  it('should handle multiple consecutive errors', async () => {
    let errorCount = 0;
    
    const MultiErrorComponent = () => {
      errorCount++;
      throw new Error(`Error ${errorCount}`);
    };

    const { rerender } = render(
      <ErrorBoundary>
        <MultiErrorComponent />
      </ErrorBoundary>
    );

    // First error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Retry should trigger second error
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    // Should still show error boundary
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should provide accessibility features', () => {
    render(
      <ErrorBoundary>
        <RenderErrorComponent />
      </ErrorBoundary>
    );

    // Error boundary should have proper ARIA attributes
    const errorContainer = screen.getByRole('alert');
    expect(errorContainer).toBeInTheDocument();

    // Buttons should be accessible
    const retryButton = screen.getByRole('button', { name: /try again/i });
    const reloadButton = screen.getByRole('button', { name: /reload page/i });
    
    expect(retryButton).toBeInTheDocument();
    expect(reloadButton).toBeInTheDocument();
  });

  it('should handle different error types', () => {
    const NetworkErrorComponent = () => {
      throw new TypeError('Network error');
    };

    render(
      <ErrorBoundary>
        <NetworkErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});