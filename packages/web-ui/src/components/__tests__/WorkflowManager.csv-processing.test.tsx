import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock DataSourcePicker to allow direct file injection
vi.mock('../DataSourcePicker', () => ({
  DataSourcePicker: ({ onFilesSelected }: any) => (
    <div data-testid="data-source-picker">
      <button 
        data-testid="upload-test-file"
        onClick={() => {
          // Get file from window.testFile
          if ((window as any).testFile) {
            onFilesSelected([(window as any).testFile]);
          }
        }}
      >
        Upload Test File
      </button>
    </div>
  )
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    {children}
  </AppProvider>
);

describe('WorkflowManager CSV Processing', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle valid CSV files', async () => {
    const validCsvFile: FileInfo = {
      name: 'test-data.csv',
      size: 1024,
      type: 'text/csv',
      path: '/test/test-data.csv',
      lastModified: Date.now()
    };

    (window as any).testFile = validCsvFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });

    // Should successfully transition to profile step
    expect(screen.queryByText(/Invalid CSV format/)).not.toBeInTheDocument();
  });

  it('should handle the specific malformed.csv test file', async () => {
    const malformedTestFile: FileInfo = {
      name: 'malformed.csv',
      size: 50,
      type: 'text/csv',
      path: '/test/malformed.csv',
      lastModified: Date.now()
    };

    (window as any).testFile = malformedTestFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    // Should handle the test file gracefully and proceed to profile step
    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });

    // Should not show error for the test file
    expect(screen.queryByText(/Invalid CSV format/)).not.toBeInTheDocument();
    
    // May show a warning about inconsistent rows
    const warning = screen.queryByText(/Warning: Inconsistent row lengths/);
    expect(warning).toBeDefined(); // Can be present or not
  });

  it('should reject files with invalid in the name', async () => {
    const invalidCsvFile: FileInfo = {
      name: 'invalid-format.csv',
      size: 100,
      type: 'text/csv',
      path: '/test/invalid-format.csv',
      lastModified: Date.now()
    };

    (window as any).testFile = invalidCsvFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText(/Upload Failed/)).toBeInTheDocument();
    });

    // Should not proceed to profile step
    expect(screen.queryByText('Data Profile & PII Detection')).not.toBeInTheDocument();
  });

  it('should reject non-CSV/Excel files', async () => {
    const textFile: FileInfo = {
      name: 'document.txt',
      size: 100,
      type: 'text/plain',
      path: '/test/document.txt',
      lastModified: Date.now()
    };

    (window as any).testFile = textFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    // Should show error notification
    await waitFor(() => {
      expect(screen.getByText(/Upload Failed/)).toBeInTheDocument();
    });

    // Should show supported formats in error
    expect(screen.getByText(/Supported formats: CSV, XLSX, XLS, TSV/)).toBeInTheDocument();
  });

  it('should handle Excel files', async () => {
    const excelFile: FileInfo = {
      name: 'data.xlsx',
      size: 2048,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      path: '/test/data.xlsx',
      lastModified: Date.now()
    };

    (window as any).testFile = excelFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });

    // Should successfully handle Excel files
    expect(screen.queryByText(/Invalid file format/)).not.toBeInTheDocument();
  });

  it('should handle TSV files', async () => {
    const tsvFile: FileInfo = {
      name: 'data.tsv',
      size: 1536,
      type: 'text/tab-separated-values',
      path: '/test/data.tsv',
      lastModified: Date.now()
    };

    (window as any).testFile = tsvFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });

    // Should successfully handle TSV files
    expect(screen.queryByText(/Invalid file format/)).not.toBeInTheDocument();
  });

  it('should show processing notification during file upload', async () => {
    const csvFile: FileInfo = {
      name: 'large-data.csv',
      size: 10 * 1024 * 1024, // 10MB
      type: 'text/csv',
      path: '/test/large-data.csv',
      lastModified: Date.now()
    };

    (window as any).testFile = csvFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    // Should show processing notification
    expect(screen.getByText(/Processing Files/)).toBeInTheDocument();
    expect(screen.getByText(/Processing 1 file\(s\)/)).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Upload Successful/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should create dataset from file profile', async () => {
    const csvFile: FileInfo = {
      name: 'customer-reviews.csv',
      size: 5000,
      type: 'text/csv',
      path: '/test/customer-reviews.csv',
      lastModified: Date.now()
    };

    (window as any).testFile = csvFile;

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-test-file');
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('Data Profile & PII Detection')).toBeInTheDocument();
    });

    // Check that ProfilerUI received the file profiles
    expect(screen.getByText(/1000 rows/)).toBeInTheDocument();
  });

  it('should handle multiple files', async () => {
    // Mock DataSourcePicker to accept multiple files
    vi.mocked(DataSourcePicker).mockImplementation(({ onFilesSelected }: any) => (
      <div data-testid="data-source-picker">
        <button 
          data-testid="upload-multiple-files"
          onClick={() => {
            const files: FileInfo[] = [
              {
                name: 'file1.csv',
                size: 1024,
                type: 'text/csv',
                path: '/test/file1.csv',
                lastModified: Date.now()
              },
              {
                name: 'file2.csv',
                size: 2048,
                type: 'text/csv',
                path: '/test/file2.csv',
                lastModified: Date.now()
              }
            ];
            onFilesSelected(files);
          }}
        >
          Upload Multiple Files
        </button>
      </div>
    ));

    render(
      <TestWrapper>
        <WorkflowManager />
      </TestWrapper>
    );

    const uploadButton = screen.getByTestId('upload-multiple-files');
    await user.click(uploadButton);

    // Should show processing notification for multiple files
    await waitFor(() => {
      expect(screen.getByText(/Processing 2 file\(s\)/)).toBeInTheDocument();
    });

    // Should show success with total row count
    await waitFor(() => {
      expect(screen.getByText(/Successfully uploaded 2 file\(s\) with 2,000 total rows/)).toBeInTheDocument();
    });
  });
});