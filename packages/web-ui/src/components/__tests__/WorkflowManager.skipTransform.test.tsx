import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowManager } from '../WorkflowManager';
import { AppProvider } from '../../context/AppContext';

// Mock the lazy components
vi.mock('../LazyComponents', () => ({
  RunWizard: ({ datasets, onRunComplete, onCancel }: any) => (
    <div data-testid="run-wizard">
      <div>RunWizard Mock</div>
      <div>Datasets: {datasets.length}</div>
      {datasets.length === 0 && (
        <div data-testid="no-datasets-error">No Datasets Available</div>
      )}
    </div>
  ),
  TransformDesigner: () => <div>TransformDesigner Mock</div>,
  ResultExplorer: () => <div>ResultExplorer Mock</div>,
  preloadHeavyComponents: vi.fn(),
  preloadAnalysisComponents: vi.fn()
}));

// Mock other components
vi.mock('../index', () => ({
  DataSourcePicker: ({ onFilesSelected }: any) => (
    <div>
      <button onClick={() => onFilesSelected([{ name: 'test.csv', size: 1000 }])}>
        Select Files
      </button>
    </div>
  ),
  ProfilerUI: () => <div>ProfilerUI Mock</div>
}));

describe('WorkflowManager - Skip Transform Fix', () => {
  const renderWithProvider = () => {
    return render(
      <AppProvider>
        <WorkflowManager />
      </AppProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not show error screen when clicking Skip Transform', async () => {
    const { container } = renderWithProvider();
    
    // Step 1: Select files
    const selectFilesButton = screen.getByText('Select Files');
    fireEvent.click(selectFilesButton);
    
    // Wait for profile step to load
    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });
    
    // Step 2: Click Skip to Sentiment Analysis
    const skipButton = screen.getByText('Skip to Sentiment Analysis');
    fireEvent.click(skipButton);
    
    // Step 3: Verify that RunWizard is shown without error
    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
      expect(screen.getByTestId('run-wizard')).toBeInTheDocument();
    });
    
    // Verify no error state is shown
    expect(screen.queryByTestId('no-datasets-error')).not.toBeInTheDocument();
    
    // Verify datasets are passed correctly
    expect(screen.getByText('Datasets: 1')).toBeInTheDocument();
  });

  it('should handle profile to configure transition smoothly', async () => {
    const { container } = renderWithProvider();
    
    // Select files
    fireEvent.click(screen.getByText('Select Files'));
    
    // Wait for profile step
    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });
    
    // Click Continue to Transform
    const continueButton = screen.getByText('Continue to Transform');
    fireEvent.click(continueButton);
    
    // Wait for transform step
    await waitFor(() => {
      expect(screen.getByText('Data Transformation (Optional)')).toBeInTheDocument();
    });
    
    // Click Skip Transform
    const skipTransformButton = screen.getByText('Skip Transform');
    fireEvent.click(skipTransformButton);
    
    // Verify smooth transition to configure step
    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
      expect(screen.getByTestId('run-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('no-datasets-error')).not.toBeInTheDocument();
    });
  });

  it('should not flash loading state during normal navigation', async () => {
    const { container } = renderWithProvider();
    
    // Select files
    fireEvent.click(screen.getByText('Select Files'));
    
    // Wait for profile step
    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });
    
    // Click Skip to Sentiment Analysis
    fireEvent.click(screen.getByText('Skip to Sentiment Analysis'));
    
    // Should not see loading state
    expect(screen.queryByText('Loading dataset information...')).not.toBeInTheDocument();
    
    // Should see configure step immediately
    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
    });
  });
});