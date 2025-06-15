import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Test to verify ErrorBoundary import fix
describe('LazyComponents ErrorBoundary Fix', () => {
  it('should import and use ErrorBoundary correctly', () => {
    // This test verifies that ErrorBoundary is imported from the correct location
    expect(ErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary).toBe('function');
  });

  it('should render ErrorBoundary without crashing', () => {
    const TestComponent = () => <div>Test Content</div>;
    
    const { container } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should catch errors in child components', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };
    
    const { container } = render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );
    
    // Should show error UI instead of crashing
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });
});