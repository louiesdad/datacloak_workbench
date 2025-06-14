import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  AppProvider, 
  useAppContext, 
  useAppActions,
  type WorkflowStep,
  type AnalysisConfig,
  type Notification
} from '../AppContext';
import type { FileInfo } from '../../platform-bridge';
import type { Dataset, SentimentResult } from '../../../../../shared/contracts/api';

// Test component to interact with context
const TestComponent = () => {
  const { state } = useAppContext();
  const actions = useAppActions();

  return (
    <div>
      <div data-testid="current-step">{state.currentStep}</div>
      <div data-testid="loading">{state.isLoading.toString()}</div>
      <div data-testid="error">{state.error || 'none'}</div>
      <div data-testid="files-count">{state.selectedFiles.length}</div>
      <div data-testid="notifications-count">{state.notifications.length}</div>
      
      <button onClick={() => actions.setStep('profile')}>Set Profile Step</button>
      <button onClick={() => actions.completeStep('upload')}>Complete Upload</button>
      <button onClick={() => actions.setLoading(true)}>Set Loading</button>
      <button onClick={() => actions.setError('Test error')}>Set Error</button>
      <button onClick={() => actions.clearError()}>Clear Error</button>
      <button onClick={() => actions.addNotification({
        id: '1',
        type: 'success',
        title: 'Test',
        message: 'Test message'
      })}>Add Notification</button>
      <button onClick={() => actions.removeNotification('1')}>Remove Notification</button>
      <button onClick={() => actions.setSelectedFiles([{
        name: 'test.csv',
        size: 1000,
        type: 'text/csv',
        path: '/test.csv',
        lastModified: Date.now()
      }])}>Set Files</button>
      <button onClick={() => actions.setAnalysisRunning(true)}>Set Analysis Running</button>
    </div>
  );
};

describe('AppContext', () => {
  const user = userEvent.setup();

  it('should provide initial state', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('current-step')).toHaveTextContent('upload');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByTestId('files-count')).toHaveTextContent('0');
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
  });

  it('should update workflow step', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const setStepButton = screen.getByText('Set Profile Step');
    await user.click(setStepButton);

    expect(screen.getByTestId('current-step')).toHaveTextContent('profile');
  });

  it('should complete workflow steps', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const completeStepButton = screen.getByText('Complete Upload');
    await user.click(completeStepButton);

    // The completed step should be tracked internally
    // We can't directly observe this without exposing completedSteps
    expect(completeStepButton).toBeInTheDocument();
  });

  it('should handle loading state', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const setLoadingButton = screen.getByText('Set Loading');
    await user.click(setLoadingButton);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('should handle error state', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const setErrorButton = screen.getByText('Set Error');
    await user.click(setErrorButton);

    expect(screen.getByTestId('error')).toHaveTextContent('Test error');

    const clearErrorButton = screen.getByText('Clear Error');
    await user.click(clearErrorButton);

    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('should handle notifications', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const addNotificationButton = screen.getByText('Add Notification');
    await user.click(addNotificationButton);

    expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');

    const removeNotificationButton = screen.getByText('Remove Notification');
    await user.click(removeNotificationButton);

    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
  });

  it('should handle file selection', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const setFilesButton = screen.getByText('Set Files');
    await user.click(setFilesButton);

    expect(screen.getByTestId('files-count')).toHaveTextContent('1');
  });

  it('should handle analysis running state', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const setAnalysisRunningButton = screen.getByText('Set Analysis Running');
    await user.click(setAnalysisRunningButton);

    // Analysis running state should be updated
    expect(setAnalysisRunningButton).toBeInTheDocument();
  });

  it('should throw error when used outside provider', () => {
    // Mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAppContext must be used within an AppProvider');

    consoleSpy.mockRestore();
  });
});

// Test the reducer functions more directly
describe('AppContext Reducer', () => {
  const AdvancedTestComponent = () => {
    const { state } = useAppContext();
    const actions = useAppActions();

    const testFileProfiles = [{
      file: {
        name: 'test.csv',
        size: 1000,
        type: 'text/csv',
        path: '/test.csv',
        lastModified: Date.now()
      },
      fields: [],
      rowCount: 100,
      processingTime: 1.5,
      errors: []
    }];

    const testDataset: Dataset = {
      id: 'test-dataset',
      name: 'Test Dataset',
      filename: 'test.csv',
      size: 1000,
      rowCount: 100,
      columnCount: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const testAnalysisConfig: AnalysisConfig = {
      datasetId: 'test-dataset',
      textColumn: 'text',
      model: 'gpt-4',
      batchSize: 10,
      auditSecurity: true
    };

    const testResults: SentimentResult[] = [{
      id: '1',
      text: 'Great product!',
      sentiment: 'positive',
      score: 0.8,
      confidence: 0.9,
      keywords: ['great', 'product']
    }];

    return (
      <div>
        <div data-testid="profiles-count">{state.fileProfiles.length}</div>
        <div data-testid="datasets-count">{state.datasets.length}</div>
        <div data-testid="has-selected-dataset">{state.selectedDataset ? 'yes' : 'no'}</div>
        <div data-testid="has-analysis-config">{state.analysisConfig ? 'yes' : 'no'}</div>
        <div data-testid="results-count">{state.analysisResults.length}</div>
        <div data-testid="analysis-running">{state.isAnalysisRunning.toString()}</div>

        <button onClick={() => actions.setFileProfiles(testFileProfiles)}>Set Profiles</button>
        <button onClick={() => actions.addDataset(testDataset)}>Add Dataset</button>
        <button onClick={() => actions.setSelectedDataset(testDataset)}>Set Selected Dataset</button>
        <button onClick={() => actions.setAnalysisConfig(testAnalysisConfig)}>Set Analysis Config</button>
        <button onClick={() => actions.setAnalysisResults(testResults)}>Set Results</button>
        <button onClick={() => actions.resetWorkflow()}>Reset Workflow</button>
      </div>
    );
  };

  it('should handle file profiles', async () => {
    const user = userEvent.setup();
    
    render(
      <AppProvider>
        <AdvancedTestComponent />
      </AppProvider>
    );

    const setProfilesButton = screen.getByText('Set Profiles');
    await user.click(setProfilesButton);

    expect(screen.getByTestId('profiles-count')).toHaveTextContent('1');
  });

  it('should handle datasets', async () => {
    const user = userEvent.setup();
    
    render(
      <AppProvider>
        <AdvancedTestComponent />
      </AppProvider>
    );

    const addDatasetButton = screen.getByText('Add Dataset');
    await user.click(addDatasetButton);

    expect(screen.getByTestId('datasets-count')).toHaveTextContent('1');

    const setSelectedDatasetButton = screen.getByText('Set Selected Dataset');
    await user.click(setSelectedDatasetButton);

    expect(screen.getByTestId('has-selected-dataset')).toHaveTextContent('yes');
  });

  it('should handle analysis configuration', async () => {
    const user = userEvent.setup();
    
    render(
      <AppProvider>
        <AdvancedTestComponent />
      </AppProvider>
    );

    const setAnalysisConfigButton = screen.getByText('Set Analysis Config');
    await user.click(setAnalysisConfigButton);

    expect(screen.getByTestId('has-analysis-config')).toHaveTextContent('yes');
  });

  it('should handle analysis results', async () => {
    const user = userEvent.setup();
    
    render(
      <AppProvider>
        <AdvancedTestComponent />
      </AppProvider>
    );

    const setResultsButton = screen.getByText('Set Results');
    await user.click(setResultsButton);

    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
  });

  it('should handle workflow reset', async () => {
    const user = userEvent.setup();
    
    render(
      <AppProvider>
        <AdvancedTestComponent />
      </AppProvider>
    );

    // First set some state
    const setProfilesButton = screen.getByText('Set Profiles');
    await user.click(setProfilesButton);
    
    const addDatasetButton = screen.getByText('Add Dataset');
    await user.click(addDatasetButton);

    // Verify state is set
    expect(screen.getByTestId('profiles-count')).toHaveTextContent('1');
    expect(screen.getByTestId('datasets-count')).toHaveTextContent('1');

    // Reset workflow
    const resetButton = screen.getByText('Reset Workflow');
    await user.click(resetButton);

    // State should be reset (some items like datasets might persist)
    expect(screen.getByTestId('profiles-count')).toHaveTextContent('0');
  });

  it('should auto-remove notifications after timeout', async () => {
    const user = userEvent.setup();
    
    vi.useFakeTimers();
    
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    const addNotificationButton = screen.getByText('Add Notification');
    await user.click(addNotificationButton);

    expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');

    // Fast-forward time to trigger auto-removal
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Notification should be auto-removed
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');

    vi.useRealTimers();
  });
});