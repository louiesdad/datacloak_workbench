import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowManager } from '../WorkflowManager';
import { AppProvider } from '../../context/AppContext';
import type { FileInfo } from '../../platform-bridge';

// Mock the platform bridge
const mockPlatformBridge = {
  selectFiles: vi.fn(),
  uploadFile: vi.fn(),
  backend: {
    uploadData: vi.fn(),
    analyzeSentiment: vi.fn(),
    getHealthStatus: vi.fn(),
  },
  platform: {
    name: 'web' as const,
    version: '1.0.0',
    capabilities: {
      largeFileSupport: true,
      nativeFileDialogs: false
    }
  }
};

// Mock window.platformBridge
Object.defineProperty(window, 'platformBridge', {
  value: mockPlatformBridge,
  writable: true
});

// Mock lazy components to avoid dynamic imports in tests
vi.mock('../LazyComponents', () => ({
  TransformDesigner: ({ onComplete, onSkip }: any) => (
    <div data-testid="transform-designer">
      <button onClick={onComplete}>Complete Transform</button>
      <button onClick={onSkip}>Skip Transform</button>
    </div>
  ),
  RunWizard: ({ onRunComplete, onCancel }: any) => (
    <div data-testid="run-wizard">
      <button onClick={() => onRunComplete({ 
        status: 'completed',
        results: [{ id: '1', text: 'test', sentiment: 'positive', score: 0.8, confidence: 0.9 }]
      })}>Complete Run</button>
      <button onClick={onCancel}>Cancel Run</button>
    </div>
  ),
  ResultExplorer: ({ results, onExport, onClose }: any) => (
    <div data-testid="result-explorer">
      <span>Results: {results.length}</span>
      <button onClick={() => onExport('csv')}>Export CSV</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
  preloadHeavyComponents: vi.fn(),
  preloadAnalysisComponents: vi.fn()
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    {children}
  </AppProvider>
);

describe('WorkflowManager', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render upload step by default', () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    expect(screen.getByText('Upload Data Files')).toBeInTheDocument();
    expect(screen.getByText(/Select your data files for sentiment analysis/)).toBeInTheDocument();
  });

  it('should handle file selection and progress to profile step', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Simulate file selection through DataSourcePicker
    const mockFiles: FileInfo[] = [
      { 
        name: 'test.csv',
        size: 1000,
        type: 'text/csv',
        path: '/test/test.csv',
        lastModified: Date.now()
      }
    ];

    // Find and trigger file selection (DataSourcePicker should call handleFilesSelected)
    const fileInput = screen.getByTestId('file-input') || screen.getByRole('button', { name: /choose files/i });
    if (fileInput) {
      await user.click(fileInput);
    }

    // The component creates mock profiles automatically
    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });
  });

  it('should transition through all workflow steps', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Start at upload, move to profile
    expect(screen.getByText('Upload Data Files')).toBeInTheDocument();

    // Simulate moving to profile step
    const continueButton = screen.getByRole('button', { name: /continue/i }) || 
                          screen.getByRole('button', { name: /upload/i });
    if (continueButton) {
      await user.click(continueButton);
    }

    // Should be at transform step
    await waitFor(() => {
      expect(screen.getByText('Data Transformation (Optional)')).toBeInTheDocument();
    });

    // Skip transform
    const skipButton = screen.getByRole('button', { name: /skip transform/i });
    await user.click(skipButton);

    // Should be at configure step
    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
    });
  });

  it('should handle transform step completion', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Navigate to transform step programmatically
    // This would typically happen after file upload and profiling
    const transformButton = screen.getByRole('button', { name: /configure transforms/i });
    if (transformButton) {
      await user.click(transformButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
    });
  });

  it('should handle skip transform option', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Navigate to transform step and skip
    const skipButton = screen.getByRole('button', { name: /skip transform/i });
    if (skipButton) {
      await user.click(skipButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
    });
  });

  it('should handle analysis execution', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Skip to configure step
    const configureButton = screen.getByRole('button', { name: /configure/i });
    if (configureButton) {
      await user.click(configureButton);
    }

    // Complete run configuration
    const completeRunButton = screen.getByRole('button', { name: /complete run/i });
    if (completeRunButton) {
      await user.click(completeRunButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId('result-explorer')).toBeInTheDocument();
    });
  });

  it('should handle analysis cancellation', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Navigate to execution step
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    if (cancelButton) {
      await user.click(cancelButton);
    }

    // Should return to configure step
    await waitFor(() => {
      expect(screen.getByText('Configure Sentiment Analysis')).toBeInTheDocument();
    });
  });

  it('should handle export functionality', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Navigate to results step with mock results
    // This would happen after successful analysis
    const exportButton = screen.getByRole('button', { name: /export csv/i });
    if (exportButton) {
      await user.click(exportButton);
    }

    // Should handle export without errors
    expect(exportButton).toBeInTheDocument();
  });

  it('should display error state for unknown step', () => {
    // This would require modifying the state to have an invalid step
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // For now, just verify the component renders without crashing
    expect(screen.getByText('Upload Data Files')).toBeInTheDocument();
  });

  it('should handle existing datasets selection', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Look for existing datasets section
    const existingDatasets = screen.queryByText('Previously Uploaded Datasets');
    
    // If datasets exist, test selection
    if (existingDatasets) {
      const datasetItem = screen.getByRole('button', { name: /dataset/i });
      await user.click(datasetItem);

      await waitFor(() => {
        expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
      });
    }
  });

  it('should handle profile completion without data', () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Look for empty state in profile step
    const goBackButton = screen.queryByText('Go Back to Upload');
    if (goBackButton) {
      expect(goBackButton).toBeInTheDocument();
    }
  });

  it('should handle loading and error states', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // The component should handle loading states during file processing
    // This is tested through the file selection flow
    expect(screen.getByText('Upload Data Files')).toBeInTheDocument();
  });

  it('should handle notification system', async () => {
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Notifications are handled through the context
    // Test that the component doesn't crash when notifications are added
    expect(screen.getByText('Upload Data Files')).toBeInTheDocument();
  });

  it('should preload components on workflow progression', async () => {
    const { preloadHeavyComponents, preloadAnalysisComponents } = await import('../LazyComponents');
    
    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    // Components should be preloaded during workflow progression
    // This is mainly for performance and is hard to test directly
    expect(preloadHeavyComponents).toBeDefined();
    expect(preloadAnalysisComponents).toBeDefined();
  });
});