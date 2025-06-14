import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransformDesigner } from '../TransformDesigner';
import type { TableSchema, TransformPreview, TransformValidation } from '../../types/transforms';

const mockTableSchema: TableSchema = {
  name: 'test_table',
  fields: [
    { name: 'id', type: 'number', nullable: false, samples: [1, 2, 3] },
    { name: 'name', type: 'string', nullable: false, samples: ['Alice', 'Bob', 'Charlie'] },
    { name: 'email', type: 'string', nullable: true, samples: ['alice@test.com', 'bob@test.com', null] },
    { name: 'created_at', type: 'date', nullable: false, samples: ['2024-01-01', '2024-01-02', '2024-01-03'] }
  ],
  rowCount: 1000
};

const mockPreview: TransformPreview = {
  originalData: [
    { id: 1, name: 'Alice', email: 'alice@test.com', created_at: '2024-01-01' },
    { id: 2, name: 'Bob', email: 'bob@test.com', created_at: '2024-01-02' }
  ],
  transformedData: [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' }
  ],
  affectedRows: 2,
  totalRows: 1000,
  executionTime: 45.2
};

const mockValidation: TransformValidation = {
  valid: true,
  errors: []
};

describe('TransformDesigner', () => {
  const mockProps = {
    sourceSchema: mockTableSchema,
    onPipelineChange: vi.fn(),
    onPreviewRequested: vi.fn().mockResolvedValue(mockPreview),
    onValidationRequested: vi.fn().mockResolvedValue(mockValidation)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with source table information', () => {
    render(<TransformDesigner {...mockProps} />);
    
    expect(screen.getByText('Transform Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Source: test_table')).toBeInTheDocument();
    expect(screen.getByText('0 operations')).toBeInTheDocument();
  });

  it('shows empty state when no operations', () => {
    render(<TransformDesigner {...mockProps} />);
    
    expect(screen.getByText('No operations added yet')).toBeInTheDocument();
    expect(screen.getByText('Add an operation to start transforming your data')).toBeInTheDocument();
  });

  it('can add operations through dropdown', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      expect(screen.getByText('Filter Operation')).toBeInTheDocument();
      expect(screen.getByText('1 operations')).toBeInTheDocument();
    });
  });

  it('displays operation types correctly', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    const dropdown = screen.getByDisplayValue('');
    
    // Add a filter operation
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      expect(screen.getByText('filter')).toBeInTheDocument();
    });
  });

  it('can select and deselect operations', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    // Add an operation
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'sort' } });
    
    await waitFor(() => {
      const operationItem = screen.getByText('Sort Operation').closest('.operation-item');
      expect(operationItem).not.toHaveClass('selected');
      
      // Click to select
      fireEvent.click(operationItem!);
      expect(operationItem).toHaveClass('selected');
    });
  });

  it('shows undo/redo buttons', () => {
    render(<TransformDesigner {...mockProps} />);
    
    expect(screen.getByText('↶ Undo')).toBeInTheDocument();
    expect(screen.getByText('↷ Redo')).toBeInTheDocument();
  });

  it('undo button is disabled initially', () => {
    render(<TransformDesigner {...mockProps} />);
    
    const undoButton = screen.getByText('↶ Undo');
    expect(undoButton).toBeDisabled();
  });

  it('redo button is disabled initially', () => {
    render(<TransformDesigner {...mockProps} />);
    
    const redoButton = screen.getByText('↷ Redo');
    expect(redoButton).toBeDisabled();
  });

  it('can request preview', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    // Add an operation first
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      const previewButton = screen.getByText('👁 Preview');
      expect(previewButton).not.toBeDisabled();
      
      fireEvent.click(previewButton);
      expect(mockProps.onPreviewRequested).toHaveBeenCalled();
    });
  });

  it('preview button is disabled when no operations', () => {
    render(<TransformDesigner {...mockProps} />);
    
    const previewButton = screen.getByText('👁 Preview');
    expect(previewButton).toBeDisabled();
  });

  it('calls onPipelineChange when operations are added', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      expect(mockProps.onPipelineChange).toHaveBeenCalled();
    });
  });

  it('can disable and enable operations', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    // Add an operation
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      const toggleButton = screen.getByTitle('Disable');
      expect(toggleButton).toBeInTheDocument();
      
      fireEvent.click(toggleButton);
      
      const operationItem = screen.getByText('Filter Operation').closest('.operation-item');
      expect(operationItem).toHaveClass('disabled');
    });
  });

  it('can delete operations', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    // Add an operation
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      expect(screen.getByText('Filter Operation')).toBeInTheDocument();
      
      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);
      
      expect(screen.queryByText('Filter Operation')).not.toBeInTheDocument();
      expect(screen.getByText('0 operations')).toBeInTheDocument();
    });
  });

  it('can move operations up and down', async () => {
    render(<TransformDesigner {...mockProps} />);
    
    // Add two operations
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      fireEvent.change(dropdown, { target: { value: 'sort' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('2 operations')).toBeInTheDocument();
      
      // Test move buttons exist
      const moveUpButtons = screen.getAllByTitle('Move up');
      const moveDownButtons = screen.getAllByTitle('Move down');
      
      expect(moveUpButtons).toHaveLength(2);
      expect(moveDownButtons).toHaveLength(2);
      
      // First operation's up button should be disabled
      expect(moveUpButtons[0]).toBeDisabled();
      // Last operation's down button should be disabled
      expect(moveDownButtons[1]).toBeDisabled();
    });
  });

  it('shows no operation selected state initially', () => {
    render(<TransformDesigner {...mockProps} />);
    
    expect(screen.getByText('No Operation Selected')).toBeInTheDocument();
    expect(screen.getByText('Select an operation from the left panel to configure it, or add a new operation to get started.')).toBeInTheDocument();
  });

  it('handles validation errors correctly', async () => {
    const mockValidationWithErrors: TransformValidation = {
      valid: false,
      errors: [
        {
          operationId: 'test-op-id',
          field: 'test-field',
          message: 'Test validation error',
          severity: 'error'
        }
      ]
    };

    const propsWithValidationErrors = {
      ...mockProps,
      onValidationRequested: vi.fn().mockResolvedValue(mockValidationWithErrors)
    };

    render(<TransformDesigner {...propsWithValidationErrors} />);
    
    // Add an operation to trigger validation
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      expect(propsWithValidationErrors.onValidationRequested).toHaveBeenCalled();
    });
  });

  it('shows loading state when preview is loading', async () => {
    const slowPreview = new Promise(resolve => setTimeout(() => resolve(mockPreview), 1000));
    const propsWithSlowPreview = {
      ...mockProps,
      onPreviewRequested: vi.fn().mockReturnValue(slowPreview)
    };

    render(<TransformDesigner {...propsWithSlowPreview} />);
    
    // Add an operation
    const dropdown = screen.getByDisplayValue('');
    fireEvent.change(dropdown, { target: { value: 'filter' } });
    
    await waitFor(() => {
      const previewButton = screen.getByText('👁 Preview');
      fireEvent.click(previewButton);
      
      expect(screen.getByText('⟳ Loading...')).toBeInTheDocument();
    });
  });
});