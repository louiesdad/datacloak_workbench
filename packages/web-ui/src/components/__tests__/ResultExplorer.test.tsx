import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultExplorer } from '../ResultExplorer';
import type { SentimentResult } from '../../../../../shared/contracts/api';

const mockResults: SentimentResult[] = [
  {
    id: 'result-1',
    text: 'This product is amazing! I love it.',
    sentiment: 'positive',
    confidence: 0.95,
    score: 0.8,
    keywords: ['amazing', 'love'],
    emotions: {
      joy: 0.8,
      sadness: 0.1,
      anger: 0.05,
      fear: 0.02,
      surprise: 0.02,
      disgust: 0.01
    },
    processingTime: 150,
    createdAt: '2024-01-01T12:00:00Z'
  },
  {
    id: 'result-2',
    text: 'Terrible service, would not recommend.',
    sentiment: 'negative',
    confidence: 0.92,
    score: -0.7,
    keywords: ['terrible', 'recommend'],
    emotions: {
      joy: 0.1,
      sadness: 0.3,
      anger: 0.5,
      fear: 0.05,
      surprise: 0.03,
      disgust: 0.02
    },
    processingTime: 140,
    createdAt: '2024-01-01T13:00:00Z'
  },
  {
    id: 'result-3',
    text: 'It\'s okay, nothing special.',
    sentiment: 'neutral',
    confidence: 0.78,
    score: 0.05,
    keywords: ['okay'],
    processingTime: 120,
    createdAt: '2024-01-01T14:00:00Z'
  }
];

describe('ResultExplorer', () => {
  const mockOnExport = vi.fn();
  const mockOnClose = vi.fn();

  it('renders overview tab with statistics', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Sentiment Analysis Results')).toBeInTheDocument();
    expect(screen.getByText('3 total results')).toBeInTheDocument();
    expect(screen.getByText('Total Results')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('switches between tabs correctly', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('3 results')).toBeInTheDocument();

    // Switch to charts tab
    fireEvent.click(screen.getByText('Charts'));
    expect(screen.getByText('Sentiment Distribution')).toBeInTheDocument();
    expect(screen.getByText('Score Distribution')).toBeInTheDocument();

    // Switch to export tab
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export Options')).toBeInTheDocument();
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
  });

  it('filters results correctly', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByText('Details'));

    // Initially shows all results
    expect(screen.getByText('3 results')).toBeInTheDocument();

    // Filter by positive sentiment
    const sentimentFilter = screen.getByDisplayValue('all');
    fireEvent.change(sentimentFilter, { target: { value: 'positive' } });

    // Should show only 1 result
    expect(screen.getByText('1 results')).toBeInTheDocument();
  });

  it('shows result details in details tab', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByText('Details'));

    // Check if results are displayed
    expect(screen.getByText('This product is amazing! I love it.')).toBeInTheDocument();
    expect(screen.getByText('Terrible service, would not recommend.')).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('negative')).toBeInTheDocument();
  });

  it('handles result selection', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByText('Details'));

    // Select first result
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Should show selection count
    expect(screen.getByText('3 results (1 selected)')).toBeInTheDocument();
  });

  it('handles search filtering', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByText('Details'));

    // Search for 'amazing'
    const searchInput = screen.getByPlaceholderText('Search in text...');
    fireEvent.change(searchInput, { target: { value: 'amazing' } });

    // Should show only 1 result
    expect(screen.getByText('1 results')).toBeInTheDocument();
    expect(screen.getByText('This product is amazing! I love it.')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ResultExplorer
        results={mockResults}
        onExport={mockOnExport}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('×'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});