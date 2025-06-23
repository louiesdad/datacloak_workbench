/**
 * Analysis Audit Service
 * API client for interacting with the analysis audit endpoints
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
}

export const analysisAuditService = new AnalysisAuditService();