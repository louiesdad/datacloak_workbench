import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalysisAuditBrowser } from '../AnalysisAuditBrowser';
import { analysisAuditService } from '../../services/analysisAuditService';

// Mock the audit service
vi.mock('../../services/analysisAuditService', () => ({
  analysisAuditService: {
    getDecisionHistory: vi.fn(),
    getSessionSummary: vi.fn(),
    getFieldDetectionDecisions: vi.fn(),
    getPIIMaskingDecisions: vi.fn(),
    getSentimentAnalysisDecisions: vi.fn(),
    getConfidenceTracking: vi.fn(),
  }
}));

// Mock the error handler hook
vi.mock('../../hooks/useApiErrorHandler', () => ({
  useApiErrorHandler: () => ({
    handleApiError: vi.fn()
  })
}));

const mockDecisions = [
  {
    id: '1',
    sessionId: 'test-session',
    component: 'field_detection' as const,
    stage: 'type_detection',
    timestamp: '2024-01-01T10:00:00Z',
    input: { fieldName: 'email' },
    output: { detectedType: 'email', confidence: 0.95 },
    reasoning: 'Strong pattern match for email',
    confidence: 0.95,
    metadata: {}
  },
  {
    id: '2',
    sessionId: 'test-session',
    component: 'pii_masking' as const,
    stage: 'masking_strategy',
    timestamp: '2024-01-01T10:01:00Z',
    input: { fieldName: 'ssn', piiType: 'SSN' },
    output: { maskingStrategy: 'full', maskCount: 5 },
    reasoning: 'SSN detected, full masking applied',
    confidence: 0.98,
    metadata: {}
  }
];

const mockSessionSummary = {
  sessionId: 'test-session',
  totalDecisions: 10,
  components: {
    field_detection: 4,
    pii_masking: 3,
    sentiment_analysis: 2,
    confidence_tracking: 1
  },
  averageConfidence: 0.85,
  lowConfidenceCount: 2,
  highConfidenceCount: 6
};

const mockFieldDetectionDetails = {
  fieldName: 'email',
  detectedType: 'email',
  heuristicScores: {
    pattern_match: 0.95,
    sample_analysis: 0.8,
    statistical_features: 0.7,
    gpt_enhancement: 0
  },
  gptEnhancement: {
    used: false,
    prompt: '',
    response: '',
    tokens_used: 0,
    reasoning: ''
  },
  sampleTokens: {
    analyzed_samples: ['test@example.com'],
    safe_samples: ['[EMAIL]'],
    pattern_matches: ['test@example.com']
  },
  finalConfidence: 0.95,
  decision_factors: ['Strong pattern match for email', 'High sample uniqueness']
};

describe('AnalysisAuditBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (analysisAuditService.getDecisionHistory as any).mockResolvedValue(mockDecisions);
    (analysisAuditService.getSessionSummary as any).mockResolvedValue(mockSessionSummary);
    (analysisAuditService.getFieldDetectionDecisions as any).mockResolvedValue([mockFieldDetectionDetails]);
  });

  it('renders loading state initially', () => {
    render(<AnalysisAuditBrowser />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays session summary after loading', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Analysis Session Summary')).toBeInTheDocument();
    });
    
    expect(screen.getByText('10')).toBeInTheDocument(); // Total decisions
    expect(screen.getByText('85.0%')).toBeInTheDocument(); // Average confidence
    expect(screen.getByText('2')).toBeInTheDocument(); // Low confidence count
    expect(screen.getByText('6')).toBeInTheDocument(); // High confidence count
  });

  it('displays decision history', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Strong pattern match for email')).toBeInTheDocument();
    expect(screen.getByText('SSN detected, full masking applied')).toBeInTheDocument();
  });

  it('filters decisions by component', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    // Click on Fields filter
    const fieldsButton = screen.getByRole('button', { name: /fields/i });
    fireEvent.click(fieldsButton);
    
    // Should only show field detection decisions
    expect(screen.getByText('Strong pattern match for email')).toBeInTheDocument();
    expect(screen.queryByText('SSN detected, full masking applied')).not.toBeInTheDocument();
  });

  it('searches decisions', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search decisions...');
    fireEvent.change(searchInput, { target: { value: 'email' } });
    
    // Should only show decisions containing "email"
    expect(screen.getByText('Strong pattern match for email')).toBeInTheDocument();
    expect(screen.queryByText('SSN detected, full masking applied')).not.toBeInTheDocument();
  });

  it('expands decision to show details', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    // Click on the first decision to expand it
    const firstDecision = screen.getByText('Strong pattern match for email').closest('div[class*="cursor-pointer"]');
    if (firstDecision) {
      fireEvent.click(firstDecision);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Heuristic Scores')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Decision Factors')).toBeInTheDocument();
    expect(screen.getByText('High sample uniqueness')).toBeInTheDocument();
  });

  it('handles question decision action', async () => {
    const mockOnQuestion = vi.fn();
    window.prompt = vi.fn().mockReturnValue('Why was this field detected as email?');
    
    render(<AnalysisAuditBrowser onQuestionDecision={mockOnQuestion} />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    // Find and click the question button
    const questionButtons = screen.getAllByTitle('Question this decision');
    fireEvent.click(questionButtons[0]);
    
    expect(window.prompt).toHaveBeenCalledWith('What would you like to know about this decision?');
    expect(mockOnQuestion).toHaveBeenCalledWith('1', 'Why was this field detected as email?');
  });

  it('displays different component icons', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    // Check for component-specific elements
    expect(screen.getByText('field detection')).toBeInTheDocument();
    expect(screen.getByText('pii masking')).toBeInTheDocument();
  });

  it('shows confidence with appropriate colors', async () => {
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Decision History')).toBeInTheDocument();
    });
    
    // High confidence should have green color class
    const highConfidence = screen.getByText('95.0%');
    expect(highConfidence.className).toContain('green');
    
    const veryHighConfidence = screen.getByText('98.0%');
    expect(veryHighConfidence.className).toContain('green');
  });

  it('handles empty decision list', async () => {
    (analysisAuditService.getDecisionHistory as any).mockResolvedValue([]);
    (analysisAuditService.getSessionSummary as any).mockResolvedValue({
      ...mockSessionSummary,
      totalDecisions: 0
    });
    
    render(<AnalysisAuditBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('No decisions found matching your criteria')).toBeInTheDocument();
    });
  });
});