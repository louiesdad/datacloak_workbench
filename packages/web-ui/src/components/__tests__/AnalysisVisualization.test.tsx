import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DecisionFlowChart } from '../DecisionFlowChart';
import { ConfidenceTimeline } from '../ConfidenceTimeline';
import { DecisionComparison } from '../DecisionComparison';
import { QuestionDecisionModal } from '../QuestionDecisionModal';

const mockDecisions = [
  {
    id: '1',
    sessionId: 'test-session',
    component: 'field_detection',
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
    component: 'field_detection',
    stage: 'type_detection',
    timestamp: '2024-01-01T10:05:00Z',
    input: { fieldName: 'phone' },
    output: { detectedType: 'phone', confidence: 0.85 },
    reasoning: 'Pattern match for phone number',
    confidence: 0.85,
    metadata: {}
  },
  {
    id: '3',
    sessionId: 'test-session',
    component: 'pii_masking',
    stage: 'masking_strategy',
    timestamp: '2024-01-01T10:10:00Z',
    input: { fieldName: 'ssn', piiType: 'SSN' },
    output: { maskingStrategy: 'full', maskCount: 5 },
    reasoning: 'SSN detected, full masking applied',
    confidence: 0.98,
    metadata: {}
  },
  {
    id: '4',
    sessionId: 'test-session',
    component: 'sentiment_analysis',
    stage: 'analysis',
    timestamp: '2024-01-01T10:15:00Z',
    input: { text: 'sample text' },
    output: { sentiment: 'positive', score: 0.8 },
    reasoning: 'Positive sentiment detected',
    confidence: 0.75,
    metadata: {}
  }
];

describe('DecisionFlowChart', () => {
  it('renders flow chart with grouped decisions', () => {
    render(<DecisionFlowChart decisions={mockDecisions} />);
    
    expect(screen.getByText('Decision Flow Visualization')).toBeInTheDocument();
    expect(screen.getByText('Field Detection')).toBeInTheDocument();
    expect(screen.getByText('Pii Masking')).toBeInTheDocument();
    expect(screen.getByText('Sentiment Analysis')).toBeInTheDocument();
  });

  it('shows decision counts for each component', () => {
    render(<DecisionFlowChart decisions={mockDecisions} />);
    
    expect(screen.getByText('2 decisions')).toBeInTheDocument(); // Field detection
    expect(screen.getByText('1 decisions')).toBeInTheDocument(); // PII masking
  });

  it('displays average confidence for each component', () => {
    render(<DecisionFlowChart decisions={mockDecisions} />);
    
    // Field detection avg: (0.95 + 0.85) / 2 = 0.9 = 90%
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    // PII masking: 0.98 = 98%
    expect(screen.getByText('98.0%')).toBeInTheDocument();
  });

  it('handles node click', () => {
    const onNodeClick = vi.fn();
    render(<DecisionFlowChart decisions={mockDecisions} onNodeClick={onNodeClick} />);
    
    const fieldDetectionNode = screen.getByText('Field Detection').closest('div[class*="cursor-pointer"]');
    if (fieldDetectionNode) {
      fireEvent.click(fieldDetectionNode);
      expect(onNodeClick).toHaveBeenCalledWith('field_detection-parent');
    }
  });
});

describe('ConfidenceTimeline', () => {
  it('renders timeline with statistics', () => {
    render(<ConfidenceTimeline decisions={mockDecisions} />);
    
    expect(screen.getByText('Confidence Over Time')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('High Confidence')).toBeInTheDocument();
    expect(screen.getByText('Low Confidence')).toBeInTheDocument();
  });

  it('calculates statistics correctly', () => {
    render(<ConfidenceTimeline decisions={mockDecisions} />);
    
    // Average: (0.95 + 0.85 + 0.98 + 0.75) / 4 = 0.8825 = 88.3%
    expect(screen.getByText('88.3%')).toBeInTheDocument();
    
    // High confidence (>= 0.9): 2 decisions
    expect(screen.getByText('2')).toBeInTheDocument();
    
    // Low confidence (< 0.7): 0 decisions
    const lowConfidenceElements = screen.getAllByText('0');
    expect(lowConfidenceElements.length).toBeGreaterThan(0);
  });

  it('shows decision count badge', () => {
    render(<ConfidenceTimeline decisions={mockDecisions} />);
    
    expect(screen.getByText('4 decisions')).toBeInTheDocument();
  });

  it('displays thresholds info', () => {
    render(<ConfidenceTimeline decisions={mockDecisions} />);
    
    expect(screen.getByText('≥ 90%')).toBeInTheDocument(); // High threshold
    expect(screen.getByText('< 70%')).toBeInTheDocument(); // Medium threshold
  });
});

describe('DecisionComparison', () => {
  it('renders comparison controls', () => {
    render(<DecisionComparison decisions={mockDecisions} />);
    
    expect(screen.getByText('Decision Comparison')).toBeInTheDocument();
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('allows selecting decisions for comparison', () => {
    render(<DecisionComparison decisions={mockDecisions} />);
    
    // Expand field_detection section
    const fieldDetectionSection = screen.getByText('field_detection');
    fireEvent.click(fieldDetectionSection);
    
    // Click on first decision
    const firstDecision = screen.getByText('Strong pattern match for email');
    fireEvent.click(firstDecision);
    
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();
  });

  it('limits selection to 3 decisions', () => {
    render(<DecisionComparison decisions={mockDecisions} />);
    
    // Expand all sections and select 4 decisions
    const sections = ['field_detection', 'pii_masking', 'sentiment_analysis'];
    sections.forEach(section => {
      const sectionElement = screen.getByText(section);
      fireEvent.click(sectionElement);
    });
    
    // Try to select all 4 decisions
    mockDecisions.forEach(decision => {
      const decisionElement = screen.getByText(decision.reasoning);
      fireEvent.click(decisionElement);
    });
    
    // Should only show 3 selected
    expect(screen.getByText('3/3 selected')).toBeInTheDocument();
  });

  it('toggles between comparison modes', () => {
    render(<DecisionComparison decisions={mockDecisions} />);
    
    const toggleButton = screen.getByText('Overlay');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Side by Side')).toBeInTheDocument();
  });
});

describe('QuestionDecisionModal', () => {
  const mockDecision = {
    id: '1',
    component: 'field_detection',
    reasoning: 'Strong pattern match for email',
    confidence: 0.95,
    timestamp: '2024-01-01T10:00:00Z',
    input: { fieldName: 'email' },
    output: { detectedType: 'email' }
  };

  const mockOnSubmitQuestion = vi.fn().mockResolvedValue({
    explanation: 'The field was detected as email due to pattern matching.',
    additionalContext: {}
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <QuestionDecisionModal
        isOpen={true}
        onClose={() => {}}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    expect(screen.getByText('Question This Decision')).toBeInTheDocument();
    expect(screen.getByText('Strong pattern match for email')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QuestionDecisionModal
        isOpen={false}
        onClose={() => {}}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    expect(screen.queryByText('Question This Decision')).not.toBeInTheDocument();
  });

  it('shows suggested questions', () => {
    render(
      <QuestionDecisionModal
        isOpen={true}
        onClose={() => {}}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    expect(screen.getByText('Why was this confidence level assigned?')).toBeInTheDocument();
    expect(screen.getByText('What factors influenced this decision?')).toBeInTheDocument();
    expect(screen.getByText('How can I improve the accuracy?')).toBeInTheDocument();
  });

  it('handles question submission', async () => {
    render(
      <QuestionDecisionModal
        isOpen={true}
        onClose={() => {}}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    const input = screen.getByPlaceholderText('Ask a question about this decision...');
    const submitButton = screen.getByText('Ask');
    
    fireEvent.change(input, { target: { value: 'Why was this detected as email?' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmitQuestion).toHaveBeenCalledWith('1', 'Why was this detected as email?');
    });
  });

  it('handles close action', () => {
    const onClose = vi.fn();
    render(
      <QuestionDecisionModal
        isOpen={true}
        onClose={onClose}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('populates question from suggestion', () => {
    render(
      <QuestionDecisionModal
        isOpen={true}
        onClose={() => {}}
        decision={mockDecision}
        onSubmitQuestion={mockOnSubmitQuestion}
      />
    );
    
    const suggestion = screen.getByText('Why was this confidence level assigned?');
    fireEvent.click(suggestion);
    
    const input = screen.getByPlaceholderText('Ask a question about this decision...');
    expect(input).toHaveValue('Why was this confidence level assigned?');
  });
});