import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunWizard } from '../RunWizard';
import type { Dataset } from '../../../../../shared/contracts/api';

// Mock the platform bridge
Object.defineProperty(window, 'platformBridge', {
  value: {
    backend: {
      estimateCost: vi.fn().mockResolvedValue({
        success: true,
        data: {
          estimatedCost: 5.50,
          currency: 'USD',
          breakdown: {
            tokens: 1000,
            requests: 10,
            processingTime: 30,
            unitCost: 0.55
          }
        }
      }),
      auditSecurity: vi.fn().mockResolvedValue({ success: true }),
      inferFields: vi.fn().mockResolvedValue({ success: true }),
      batchAnalyzeSentiment: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      exportData: vi.fn().mockResolvedValue({ success: true })
    }
  },
  writable: true
});

const mockDatasets: Dataset[] = [
  {
    id: 'dataset-1',
    name: 'Customer Reviews',
    filename: 'reviews.csv',
    size: 1024 * 1024,
    rowCount: 1000,
    columnCount: 5,
    uploadedAt: '2024-01-01T00:00:00Z',
    lastModified: '2024-01-01T00:00:00Z',
    fileType: 'csv',
    status: 'ready',
    metadata: {
      hasHeader: true,
      columns: [
        {
          name: 'review_text',
          type: 'string',
          confidence: 0.95,
          nullable: false,
          unique: false,
          hasPII: false,
          piiTypes: []
        },
        {
          name: 'rating',
          type: 'integer',
          confidence: 0.98,
          nullable: false,
          unique: false,
          hasPII: false,
          piiTypes: []
        }
      ],
      preview: []
    }
  }
];

describe('RunWizard', () => {
  const mockOnRunComplete = vi.fn();
  const mockOnCancel = vi.fn();

  it('renders the first step correctly', () => {
    render(
      <RunWizard
        datasets={mockDatasets}
        onRunComplete={mockOnRunComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Sentiment Analysis Wizard')).toBeInTheDocument();
    expect(screen.getByText('Select Dataset')).toBeInTheDocument();
    expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
    expect(screen.getByText('1000 rows')).toBeInTheDocument();
  });

  it('allows dataset selection and navigation', () => {
    render(
      <RunWizard
        datasets={mockDatasets}
        onRunComplete={mockOnRunComplete}
        onCancel={mockOnCancel}
      />
    );

    // Click on dataset
    fireEvent.click(screen.getByText('Customer Reviews'));
    
    // Should enable next button
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
    
    // Click next
    fireEvent.click(nextButton);
    
    // Should navigate to step 2
    expect(screen.getByText('Configure Analysis')).toBeInTheDocument();
    expect(screen.getByText('Text Column')).toBeInTheDocument();
  });

  it('shows configuration options in step 2', () => {
    render(
      <RunWizard
        datasets={mockDatasets}
        onRunComplete={mockOnRunComplete}
        onCancel={mockOnCancel}
      />
    );

    // Navigate to step 2
    fireEvent.click(screen.getByText('Customer Reviews'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Text Column')).toBeInTheDocument();
    expect(screen.getByText('Sentiment Model')).toBeInTheDocument();
    expect(screen.getByText('Extract keywords')).toBeInTheDocument();
    expect(screen.getByText('Analyze emotions')).toBeInTheDocument();
  });

  it('handles cancel correctly', () => {
    render(
      <RunWizard
        datasets={mockDatasets}
        onRunComplete={mockOnRunComplete}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });
});