import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiFileUpload } from '../MultiFileUpload';
import { vi } from 'vitest';

// Mock API
vi.mock('../../../services/api', () => ({
  multiFileAnalysisApi: {
    stageFile: vi.fn()
  }
}));

// Import the mocked API to get access to the mock
import { multiFileAnalysisApi } from '../../../services/api';
const mockStageFile = vi.mocked(multiFileAnalysisApi.stageFile);

describe('MultiFileUpload', () => {
  const mockSessionId = 'test-session-123';

  beforeEach(() => {
    mockStageFile.mockClear();
  });

  // RED TEST 1: Accept multiple CSV files
  test('should accept multiple CSV files', async () => {
    const user = userEvent.setup();
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    
    const files = [
      new File(['user,email\nJohn,john@test.com'], 'users.csv', { type: 'text/csv' }),
      new File(['order_id,user_id\n1,1'], 'orders.csv', { type: 'text/csv' })
    ];
    
    await user.upload(input, files);
    
    await waitFor(() => {
      expect(screen.getByText('users.csv')).toBeInTheDocument();
      expect(screen.getByText('orders.csv')).toBeInTheDocument();
    });
  });

  // RED TEST 2: Show upload progress
  test('should show upload progress', async () => {
    const user = userEvent.setup();
    
    // Mock delayed upload
    mockStageFile.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        fileId: 'file-1',
        filename: 'test.csv',
        rowCount: 100,
        columns: []
      }), 500))
    );
    
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByTestId('file-input');
    
    await user.upload(input, [file]);
    
    // Should show progress bar
    expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
    expect(screen.getByTestId('upload-progress')).toHaveAttribute('value');
  });

  // RED TEST 3: Display file metadata after upload
  test('should display file metadata after successful upload', async () => {
    const user = userEvent.setup();
    
    mockStageFile.mockResolvedValueOnce({
      fileId: 'file-123',
      filename: 'customers.csv',
      rowCount: 1500,
      columns: [
        { name: 'customer_id', dataType: 'string', uniqueness: 0.99 },
        { name: 'email', dataType: 'email', uniqueness: 0.99 },
        { name: 'signup_date', dataType: 'date', uniqueness: 0.45 }
      ],
      potentialKeys: ['customer_id', 'email']
    });
    
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const file = new File(['test'], 'customers.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('file-input'), [file]);
    
    await waitFor(() => {
      expect(screen.getByText('customers.csv')).toBeInTheDocument();
      expect(screen.getByText('1,500 rows')).toBeInTheDocument();
      expect(screen.getByText('3 columns')).toBeInTheDocument();
      expect(screen.getByText('Potential keys: customer_id, email')).toBeInTheDocument();
    });
  });

  // RED TEST 4: Reject non-CSV files
  test('should reject non-CSV files', async () => {
    const user = userEvent.setup();
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const input = screen.getByTestId('file-input');
    const nonCsvFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
    
    await user.upload(input, [nonCsvFile]);
    
    expect(screen.getByText('Only CSV files are allowed')).toBeInTheDocument();
    expect(mockStageFile).not.toHaveBeenCalled();
  });

  // RED TEST 5: Handle upload errors
  test('should handle upload errors gracefully', async () => {
    const user = userEvent.setup();
    
    mockStageFile.mockRejectedValueOnce(new Error('Upload failed'));
    
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('file-input'), [file]);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to upload test.csv')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  // RED TEST 6: Drag and drop support
  test('should support drag and drop file upload', async () => {
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const dropZone = screen.getByTestId('drop-zone');
    const file = new File(['test'], 'dragdrop.csv', { type: 'text/csv' });
    
    // Simulate drag over
    fireEvent.dragOver(dropZone);
    expect(dropZone).toHaveClass('drag-over');
    
    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    await waitFor(() => {
      expect(mockStageFile).toHaveBeenCalledWith(mockSessionId, file);
    });
  });

  // RED TEST 7: Remove staged files
  test('should allow removing staged files', async () => {
    const user = userEvent.setup();
    const onFileRemoved = vi.fn();
    
    mockStageFile.mockResolvedValueOnce({
      fileId: 'file-123',
      filename: 'test.csv',
      rowCount: 100,
      columns: []
    });
    
    render(<MultiFileUpload sessionId={mockSessionId} onFileRemoved={onFileRemoved} />);
    
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('file-input'), [file]);
    
    await waitFor(() => {
      const removeButton = screen.getByRole('button', { name: 'Remove test.csv' });
      fireEvent.click(removeButton);
    });
    
    expect(screen.queryByText('test.csv')).not.toBeInTheDocument();
    expect(onFileRemoved).toHaveBeenCalledWith('file-123');
  });

  // RED TEST 8: Batch upload with individual progress
  test('should show individual progress for batch uploads', async () => {
    const user = userEvent.setup();
    
    // Mock different upload times
    mockStageFile
      .mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          fileId: 'file-1',
          filename: 'file1.csv',
          rowCount: 100,
          columns: []
        }), 300))
      )
      .mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          fileId: 'file-2',
          filename: 'file2.csv',
          rowCount: 200,
          columns: []
        }), 600))
      );
    
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const files = [
      new File(['test1'], 'file1.csv', { type: 'text/csv' }),
      new File(['test2'], 'file2.csv', { type: 'text/csv' })
    ];
    
    await user.upload(screen.getByTestId('file-input'), files);
    
    // Both files should show progress
    expect(screen.getByTestId('progress-file1.csv')).toBeInTheDocument();
    expect(screen.getByTestId('progress-file2.csv')).toBeInTheDocument();
  });

  // RED TEST 9: File size validation
  test('should validate file size limits', async () => {
    const user = userEvent.setup();
    render(<MultiFileUpload sessionId={mockSessionId} maxSizeMB={10} />);
    
    // Create a large file (mock)
    const largeContent = new Array(11 * 1024 * 1024).join('x'); // 11MB
    const largeFile = new File([largeContent], 'large.csv', { type: 'text/csv' });
    
    await user.upload(screen.getByTestId('file-input'), [largeFile]);
    
    expect(screen.getByText('File size exceeds 10MB limit')).toBeInTheDocument();
    expect(mockStageFile).not.toHaveBeenCalled();
  });

  // RED TEST 10: Display column preview
  test('should display column preview after upload', async () => {
    const user = userEvent.setup();
    
    mockStageFile.mockResolvedValueOnce({
      fileId: 'file-123',
      filename: 'detailed.csv',
      rowCount: 500,
      columns: [
        { name: 'id', dataType: 'integer', uniqueness: 1.0, nullCount: 0 },
        { name: 'name', dataType: 'string', uniqueness: 0.8, nullCount: 5 },
        { name: 'email', dataType: 'email', uniqueness: 0.98, nullCount: 10 }
      ],
      potentialKeys: ['id', 'email']
    });
    
    render(<MultiFileUpload sessionId={mockSessionId} />);
    
    const file = new File(['test'], 'detailed.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('file-input'), [file]);
    
    // Click to expand column details
    await waitFor(() => {
      const expandButton = screen.getByRole('button', { name: 'Show columns' });
      fireEvent.click(expandButton);
    });
    
    expect(screen.getByText('id (integer)')).toBeInTheDocument();
    expect(screen.getByText('100% unique')).toBeInTheDocument();
    expect(screen.getByText('name (string)')).toBeInTheDocument();
    expect(screen.getByText('80% unique')).toBeInTheDocument();
  });
});