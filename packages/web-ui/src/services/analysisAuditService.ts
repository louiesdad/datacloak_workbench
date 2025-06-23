/**
 * Analysis Audit Service
 * API client for interacting with the analysis audit endpoints and causal analysis
 */

export interface DecisionLog {
  id: string;
  sessionId: string;
  component: 'field_detection' | 'pii_masking' | 'sentiment_analysis' | 'confidence_tracking';
  stage: string;
  timestamp: string;
  input: any;
  output: any;
  reasoning: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface FieldDetectionDecision {
  fieldName: string;
  detectedType: string;
  heuristicScores: {
    pattern_match: number;
    sample_analysis: number;
    statistical_features: number;
    gpt_enhancement: number;
  };
  gptEnhancement: {
    used: boolean;
    prompt: string;
    response: string;
    tokens_used: number;
    reasoning: string;
  };
  sampleTokens: {
    analyzed_samples: string[];
    safe_samples: string[];
    pattern_matches: string[];
  };
  finalConfidence: number;
  decision_factors: string[];
}

export interface PIIMaskingDecision {
  fieldName: string;
  piiType: string;
  patterns: Array<{
    pattern_id: string;
    pattern_regex: string;
    matches_found: number;
    confidence: number;
  }>;
  maskingStrategy: {
    type: 'full' | 'partial' | 'tokenize' | 'hash';
    parameters: Record<string, any>;
    reasoning: string;
  };
  maskExamples: Array<{
    original_sample: string;
    masked_result: string;
  }>;
  totalMaskCount: number;
  riskAssessment: {
    sensitivity_level: 'low' | 'medium' | 'high' | 'critical';
    compliance_frameworks: string[];
    recommendations: string[];
  };
}

export interface SentimentAnalysisDecision {
  textSample: string;
  modelSelection: {
    selected_model: string;
    available_models: string[];
    selection_reasoning: string;
    performance_factors: {
      accuracy: number;
      speed: number;
      cost: number;
      context_length: number;
    };
  };
  promptTemplate: {
    template_id: string;
    template_content: string;
    parameters: Record<string, any>;
    reasoning: string;
  };
  tokenUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost: number;
  };
  confidenceFactors: {
    text_clarity: number;
    context_adequacy: number;
    model_certainty: number;
    historical_accuracy: number;
  };
}

export interface ConfidenceTracking {
  overall_confidence: number;
  component_confidences: {
    field_detection: number;
    pii_detection: number;
    sentiment_analysis: number;
    data_quality: number;
  };
  confidence_factors: {
    data_quality: number;
    sample_size: number;
    model_performance: number;
    validation_results: number;
  };
  thresholds: {
    minimum_confidence: number;
    warning_threshold: number;
    review_threshold: number;
  };
  aggregation_method: string;
  reliability_score: number;
}

export interface SessionSummary {
  sessionId: string;
  totalDecisions: number;
  components: {
    field_detection: number;
    pii_masking: number;
    sentiment_analysis: number;
    confidence_tracking: number;
  };
  averageConfidence: number;
  lowConfidenceCount: number;
  highConfidenceCount: number;
}

// Causal Analysis interfaces
export interface EventImpact {
  eventId: string;
  eventType: string;
  eventDate: string;
  description: string;
  impact: number;
  percentageChange: number;
  isSignificant: boolean;
  confidence: number;
  customersAffected: number;
  pValue?: number;
  sentimentBefore?: number;
  sentimentAfter?: number;
}

export interface BusinessEvent {
  id: string;
  eventType: string;
  eventDate: string;
  description: string;
  affectedCustomers: string[] | 'all';
  createdAt: string;
  updatedAt?: string;
}

class AnalysisAuditService {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private async fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Get all decision logs for a session
  async getDecisionHistory(sessionId?: string): Promise<DecisionLog[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/decisions${params}`);
  }

  // Get field detection decisions
  async getFieldDetectionDecisions(sessionId?: string): Promise<FieldDetectionDecision[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/field-detections${params}`);
  }

  // Get PII masking decisions
  async getPIIMaskingDecisions(sessionId?: string): Promise<PIIMaskingDecision[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/pii-masking${params}`);
  }

  // Get sentiment analysis decisions
  async getSentimentAnalysisDecisions(sessionId?: string): Promise<SentimentAnalysisDecision[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/sentiment-analysis${params}`);
  }

  // Get confidence tracking
  async getConfidenceTracking(sessionId?: string): Promise<ConfidenceTracking[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/confidence-tracking${params}`);
  }

  // Get session summary
  async getSessionSummary(sessionId?: string): Promise<SessionSummary> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.fetchAPI(`/api/v1/audit/session-summary${params}`);
  }

  // Start a new audit session
  async startNewSession(): Promise<{ sessionId: string }> {
    return this.fetchAPI('/api/v1/audit/session/new', {
      method: 'POST',
    });
  }

  // Question a specific decision
  async questionDecision(decisionId: string, question: string): Promise<{
    decisionId: string;
    question: string;
    explanation: string;
    additionalContext: any;
  }> {
    return this.fetchAPI(`/api/v1/audit/question/${decisionId}`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }

  // Causal Analysis API methods
  async getEventImpacts(startDate: string, endDate: string): Promise<EventImpact[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    return this.fetchAPI(`/api/v1/causal-analysis/event-impacts?${params}`);
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<BusinessEvent[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    return this.fetchAPI(`/api/v1/causal-analysis/events?${params}`);
  }

  async createBusinessEvent(event: Omit<BusinessEvent, 'id' | 'createdAt'>): Promise<BusinessEvent> {
    return this.fetchAPI('/api/v1/causal-analysis/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateBusinessEvent(eventId: string, updates: Partial<BusinessEvent>): Promise<BusinessEvent> {
    return this.fetchAPI(`/api/v1/causal-analysis/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteBusinessEvent(eventId: string): Promise<void> {
    return this.fetchAPI(`/api/v1/causal-analysis/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async calculateEventImpact(eventId: string, options?: {
    beforeDays?: number;
    afterDays?: number;
    customerSegment?: string;
  }): Promise<EventImpact> {
    const params = new URLSearchParams();
    if (options?.beforeDays) params.set('beforeDays', options.beforeDays.toString());
    if (options?.afterDays) params.set('afterDays', options.afterDays.toString());
    if (options?.customerSegment) params.set('customerSegment', options.customerSegment);
    
    const queryString = params.toString();
    const url = `/api/v1/causal-analysis/events/${eventId}/impact${queryString ? `?${queryString}` : ''}`;
    
    return this.fetchAPI(url, {
      method: 'POST',
    });
  }
}

export const analysisAuditService = new AnalysisAuditService();