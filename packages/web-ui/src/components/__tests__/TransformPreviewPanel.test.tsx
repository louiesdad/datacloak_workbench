import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransformPreviewPanel } from '../TransformPreviewPanel';
import type { TransformPreview, TransformValidation } from '../../types/transforms';

const mockPreview: TransformPreview = {
  originalData: [
    { id: 1, name: 'Alice', email: 'alice@test.com', created_at: '2024-01-01' },
    { id: 2, name: 'Bob', email: 'bob@test.com', created_at: '2024-01-02' },
    { id: 3, name: 'Charlie', email: 'charlie@test.com', created_at: '2024-01-03' }
  ],
  transformedData: [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
    { id: 3, name: 'Charlie', email: 'charlie@test.com' }
  ],
  affectedRows: 3,
  totalRows: 1000,
  executionTime: 125.6
};

const mockValidation: TransformValidation = {
  valid: true,
  errors: []
};

const mockValidationWithErrors: TransformValidation = {
  valid: false,
  errors: [
    {
      operationId: 'op1',
      field: 'email',
      message: 'Invalid field reference',
      severity: 'error'
    },
    {
      operationId: 'op2',
      message: 'Missing required parameter',
      severity: 'warning'
    }
  ]
};

describe('TransformPreviewPanel', () => {
  const mockProps = {
    preview: null,
    isLoading: false,
    validation: null,
    onRefreshPreview: vi.fn()
  };

  it('renders with no preview state', () => {
    render(<TransformPreviewPanel {...mockProps} />);
    
    expect(screen.getByText('No Preview Available')).toBeInTheDocument();
    expect(screen.getByText('Click the "Preview" button to see the results of your transform operations.')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<TransformPreviewPanel {...mockProps} isLoading={true} />);
    
    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument(); // spinner
  });

  it('displays preview tabs with correct counts', () => {
    render(<TransformPreviewPanel {...mockProps} preview={mockPreview} />);
    
    expect(screen.getByText('Preview (3)')).toBeInTheDocument();
    expect(screen.getByText('Original (3)')).toBeInTheDocument();
    expect(screen.getByText('Validation (0)')).toBeInTheDocument();
  });

  it('displays validation tab with error count when validation has errors', () => {
    render(<TransformPreviewPanel {...mockProps} validation={mockValidationWithErrors} />);
    
    expect(screen.getByText('Validation (2)')).toBeInTheDocument();
    
    const validationTab = screen.getByText('Validation (2)');
    expect(validationTab).toHaveClass('has-errors');
  });

  it('shows preview statistics', () => {
    render(<TransformPreviewPanel {...mockProps} preview={mockPreview} />);
    
    expect(screen.getByText('Affected: 3')).toBeInTheDocument();
    expect(screen.getByText('Total: 1,000')).toBeInTheDocument();
    expect(screen.getByText('Time: 125.60ms')).toBeInTheDocument();
  });

  it('renders data table correctly', () => {
    render(<TransformPreviewPanel {...mockProps} preview={mockPreview} />);
    
    // Check table headers
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    
    // Check some data
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('can switch between preview and original tabs', () => {
    render(<TransformPreviewPanel {...mockProps} preview={mockPreview} />);
    
    // Initially on preview tab
    expect(screen.getByText('Preview (3)')).toHaveClass('active');
    
    // Switch to original tab
    fireEvent.click(screen.getByText('Original (3)'));
    expect(screen.getByText('Original (3)')).toHaveClass('active');
    
    // Original data should include created_at column that was removed in transform
    expect(screen.getByText('created_at')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });

  it('displays validation results correctly', () => {
    render(
      <TransformPreviewPanel 
        {...mockProps} 
        validation={mockValidationWithErrors} 
      />
    );
    
    // Switch to validation tab
    fireEvent.click(screen.getByText('Validation (2)'));
    
    expect(screen.getByText('2 validation issues found')).toBeInTheDocument();
    expect(screen.getByText('Invalid field reference')).toBeInTheDocument();
    expect(screen.getByText('Missing required parameter')).toBeInTheDocument();
  });

  it('shows valid status when validation passes', () => {
    render(
      <TransformPreviewPanel 
        {...mockProps} 
        validation={mockValidation} 
      />
    );
    
    // Switch to validation tab
    fireEvent.click(screen.getByText('Validation (0)'));
    
    expect(screen.getByText('Pipeline is valid')).toBeInTheDocument();
  });

  it('can refresh preview', () => {
    const onRefreshPreview = vi.fn();
    render(
      <TransformPreviewPanel 
        {...mockProps} 
        preview={mockPreview}
        onRefreshPreview={onRefreshPreview}
      />
    );
    
    const refreshButton = screen.getByTitle('Refresh preview');
    fireEvent.click(refreshButton);
    
    expect(onRefreshPreview).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button when loading', () => {
    render(
      <TransformPreviewPanel 
        {...mockProps} 
        preview={mockPreview}
        isLoading={true}
      />
    );
    
    const refreshButton = screen.getByTitle('Refresh preview');
    expect(refreshButton).toBeDisabled();
  });

  it('handles empty data gracefully', () => {
    const emptyPreview: TransformPreview = {
      originalData: [],
      transformedData: [],
      affectedRows: 0,
      totalRows: 0,
      executionTime: 0
    };
    
    render(<TransformPreviewPanel {...mockProps} preview={emptyPreview} />);
    
    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  it('displays preview errors when present', () => {
    const previewWithErrors: TransformPreview = {
      ...mockPreview,
      errors: ['SQL syntax error', 'Invalid column reference']
    };
    
    render(<TransformPreviewPanel {...mockProps} preview={previewWithErrors} />);
    
    expect(screen.getByText('Execution Errors:')).toBeInTheDocument();
    expect(screen.getByText('SQL syntax error')).toBeInTheDocument();
    expect(screen.getByText('Invalid column reference')).toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    // Create data that would span multiple pages
    const largePreview: TransformPreview = {
      originalData: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`
      })),
      transformedData: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`
      })),
      affectedRows: 25,
      totalRows: 25,
      executionTime: 50
    };
    
    render(<TransformPreviewPanel {...mockProps} preview={largePreview} />);
    
    // Should show pagination controls
    expect(screen.getByText('Page 1 of 3 (25 rows)')).toBeInTheDocument();
    
    // Should show next/previous buttons
    expect(screen.getByText('⟩')).toBeInTheDocument();
    expect(screen.getByText('⟨')).toBeInTheDocument();
    
    // First page should show User 1-10
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 10')).toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();
  });

  it('can navigate pagination', () => {
    const largePreview: TransformPreview = {
      originalData: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`
      })),
      transformedData: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@test.com`
      })),
      affectedRows: 25,
      totalRows: 25,
      executionTime: 50
    };
    
    render(<TransformPreviewPanel {...mockProps} preview={largePreview} />);
    
    // Click next page
    fireEvent.click(screen.getByText('⟩'));
    
    // Should now show page 2
    expect(screen.getByText('Page 2 of 3 (25 rows)')).toBeInTheDocument();
    expect(screen.getByText('User 11')).toBeInTheDocument();
    expect(screen.queryByText('User 1')).not.toBeInTheDocument();
  });
});