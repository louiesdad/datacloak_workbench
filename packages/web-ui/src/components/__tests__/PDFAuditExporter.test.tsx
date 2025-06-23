import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PDFAuditExporter } from '../PDFAuditExporter';
import type { SentimentResult } from '../../../../shared/contracts/api';

// Mock jsPDF
jest.mock('jspdf', () => {
  const mockDoc = {
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    setDrawColor: jest.fn(),
    text: jest.fn(),
    rect: jest.fn(),
    roundedRect: jest.fn(),
    addPage: jest.fn(),
    setPage: jest.fn(),
    output: jest.fn(() => new Blob(['mock pdf'], { type: 'application/pdf' })),
    internal: {
      pageSize: { width: 210, height: 297 },
      getNumberOfPages: jest.fn(() => 5)
    },
    splitTextToSize: jest.fn((text) => [text])
  };

  return {
    jsPDF: jest.fn(() => mockDoc)
  };
});

jest.mock('jspdf-autotable');

describe('PDFAuditExporter', () => {
  const mockResults: SentimentResult[] = [
    {
      id: '1',
      text: 'Great product!',
      sentiment: 'positive',
      score: 0.8,
      confidence: 0.95,
      createdAt: new Date('2024-01-01').toISOString(),
      keywords: ['great', 'product']
    },
    {
      id: '2',
      text: 'Not satisfied',
      sentiment: 'negative',
      score: -0.7,
      confidence: 0.85,
      createdAt: new Date('2024-01-02').toISOString(),
      keywords: ['not', 'satisfied']
    },
    {
      id: '3',
      text: 'It is okay',
      sentiment: 'neutral',
      score: 0.05,
      confidence: 0.75,
      createdAt: new Date('2024-01-03').toISOString(),
      keywords: ['okay']
    }
  ];

  const mockMetadata = {
    projectName: 'Test Project',
    author: 'Test Author',
    organization: 'Test Org',
    description: 'Test Description'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  test('renders export button', () => {
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  test('disables button when no results', () => {
    render(<PDFAuditExporter results={[]} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    expect(button).toBeDisabled();
  });

  test('shows progress during export', async () => {
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    // Should show generating text
    await waitFor(() => {
      expect(screen.getByText(/Generating PDF/i)).toBeInTheDocument();
    });
  });

  test('generates PDF with metadata', async () => {
    const onExportComplete = jest.fn();
    
    render(
      <PDFAuditExporter 
        results={mockResults}
        metadata={mockMetadata}
        onExportComplete={onExportComplete}
      />
    );
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onExportComplete).toHaveBeenCalledWith(
        expect.any(Blob)
      );
    });
    
    // Verify the blob is a PDF
    const blob = onExportComplete.mock.calls[0][0];
    expect(blob.type).toBe('application/pdf');
  });

  test('handles export errors', async () => {
    const onError = jest.fn();
    
    // Mock jsPDF to throw error
    const { jsPDF } = require('jspdf');
    jsPDF.mockImplementationOnce(() => {
      throw new Error('PDF generation failed');
    });
    
    render(
      <PDFAuditExporter 
        results={mockResults}
        onError={onError}
      />
    );
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF generation failed'
        })
      );
    });
  });

  test('calculates statistics correctly', async () => {
    const { jsPDF } = require('jspdf');
    const mockDoc = new jsPDF();
    
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      // Check that statistics are calculated and added to PDF
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.stringContaining('33.3%'),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });
  });

  test('generates all report sections', async () => {
    const { jsPDF } = require('jspdf');
    const mockDoc = new jsPDF();
    
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      // Verify all sections are added
      expect(mockDoc.text).toHaveBeenCalledWith('Sentiment Analysis', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockDoc.text).toHaveBeenCalledWith('Executive Summary', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Statistical Analysis', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Sentiment Timeline', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Key Findings', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Compliance & Risk Assessment', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Detailed Results Sample', expect.any(Number), expect.any(Number));
      expect(mockDoc.text).toHaveBeenCalledWith('Methodology', expect.any(Number), expect.any(Number));
    });
  });

  test('auto-downloads when no callback provided', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
    
    // Verify download link attributes
    const link = createElementSpy.mock.results[0].value;
    expect(link.href).toBe('blob:mock-url');
    expect(link.download).toMatch(/sentiment-audit-report-\d{4}-\d{2}-\d{2}\.pdf/);
  });

  test('groups results by date correctly', async () => {
    const resultsWithDates: SentimentResult[] = [
      ...mockResults,
      {
        id: '4',
        text: 'Another positive',
        sentiment: 'positive',
        score: 0.9,
        confidence: 0.9,
        createdAt: new Date('2024-01-01').toISOString(),
        keywords: []
      }
    ];
    
    render(<PDFAuditExporter results={resultsWithDates} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      const { jsPDF } = require('jspdf');
      const mockDoc = new jsPDF();
      
      // Should show date grouping in timeline
      expect(mockDoc.autoTable).toHaveBeenCalledWith(
        expect.objectContaining({
          head: [['Date', 'Positive', 'Negative', 'Neutral', 'Avg Score']],
          body: expect.any(Array)
        })
      );
    });
  });

  test('identifies key findings', async () => {
    const highPositiveResults: SentimentResult[] = Array(70).fill(null).map((_, i) => ({
      id: `pos-${i}`,
      text: 'Positive text',
      sentiment: 'positive' as const,
      score: 0.8,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
      keywords: []
    }));
    
    render(<PDFAuditExporter results={highPositiveResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      const { jsPDF } = require('jspdf');
      const mockDoc = new jsPDF();
      
      // Should identify strong positive trend
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.stringContaining('Strong positive sentiment trend'),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  test('calculates risk metrics', async () => {
    const lowConfidenceResults: SentimentResult[] = mockResults.map(r => ({
      ...r,
      confidence: 0.5
    }));
    
    render(<PDFAuditExporter results={lowConfidenceResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      const { jsPDF } = require('jspdf');
      const mockDoc = new jsPDF();
      
      // Should show risk assessment
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.stringMatching(/Overall Risk Level: (LOW|MEDIUM|HIGH)/),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });
  });

  test('shows export progress updates', async () => {
    render(<PDFAuditExporter results={mockResults} />);
    
    const button = screen.getByText(/Generate PDF Audit Report/i);
    fireEvent.click(button);
    
    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar', { hidden: true });
      expect(progressBar).toBeInTheDocument();
    });
  });
});