import { EventEmitter } from 'events';
import { getSQLiteConnection } from '../database/sqlite-refactored';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analysis Audit Service
 * Captures and logs decision-making processes across the data analysis pipeline
 * Provides transparency into how the system makes analysis decisions
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
    safe_samples: string[]; // Anonymized versions for logging
    pattern_matches: string[];
  };
  finalConfidence: number;
  decision_factors: string[];
}

export interface PIIMaskingDecision {
  fieldName: string;
  piiType: string;
  patterns: {
    pattern_id: string;
    pattern_regex: string;
    matches_found: number;
    confidence: number;
  }[];
  maskingStrategy: {
    type: 'full' | 'partial' | 'tokenize' | 'hash';
    parameters: Record<string, any>;
    reasoning: string;
  };
  maskExamples: {
    original_sample: string; // Safely anonymized
    masked_result: string;
  }[];
  totalMaskCount: number;
  riskAssessment: {
    sensitivity_level: 'low' | 'medium' | 'high' | 'critical';
    compliance_frameworks: string[];
    recommendations: string[];
  };
}

export interface SentimentAnalysisDecision {
  textSample: string; // Anonymized
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

export class AnalysisAuditService extends EventEmitter {
  private db: any;
  private currentSessionId: string;

  constructor() {
    super();
    this.currentSessionId = uuidv4();
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      this.db = await getSQLiteConnection();
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize analysis audit database:', error);
    }
  }

  private async createTables() {
    const createDecisionLogsTable = `
      CREATE TABLE IF NOT EXISTS decision_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        component TEXT NOT NULL,
        stage TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        input TEXT,
        output TEXT,
        reasoning TEXT,
        confidence REAL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createFieldDetectionTable = `
      CREATE TABLE IF NOT EXISTS field_detection_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        detected_type TEXT NOT NULL,
        heuristic_scores TEXT NOT NULL,
        gpt_enhancement TEXT,
        sample_tokens TEXT,
        final_confidence REAL,
        decision_factors TEXT,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createPIIMaskingTable = `
      CREATE TABLE IF NOT EXISTS pii_masking_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        pii_type TEXT NOT NULL,
        patterns TEXT NOT NULL,
        masking_strategy TEXT NOT NULL,
        mask_examples TEXT,
        total_mask_count INTEGER,
        risk_assessment TEXT,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createSentimentAnalysisTable = `
      CREATE TABLE IF NOT EXISTS sentiment_analysis_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text_sample TEXT,
        model_selection TEXT NOT NULL,
        prompt_template TEXT NOT NULL,
        token_usage TEXT NOT NULL,
        confidence_factors TEXT,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createConfidenceTrackingTable = `
      CREATE TABLE IF NOT EXISTS confidence_tracking (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        overall_confidence REAL NOT NULL,
        component_confidences TEXT NOT NULL,
        confidence_factors TEXT NOT NULL,
        thresholds TEXT NOT NULL,
        aggregation_method TEXT,
        reliability_score REAL,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.exec(createDecisionLogsTable);
    await this.db.exec(createFieldDetectionTable);
    await this.db.exec(createPIIMaskingTable);
    await this.db.exec(createSentimentAnalysisTable);
    await this.db.exec(createConfidenceTrackingTable);
  }

  // Field Detection Decision Logging
  async logFieldDetectionDecision(decision: FieldDetectionDecision): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    // Log general decision
    await this.logDecision({
      id,
      sessionId: this.currentSessionId,
      component: 'field_detection',
      stage: 'type_detection',
      timestamp,
      input: { fieldName: decision.fieldName },
      output: { detectedType: decision.detectedType, confidence: decision.finalConfidence },
      reasoning: decision.decision_factors.join('; '),
      confidence: decision.finalConfidence,
      metadata: {
        heuristic_scores: decision.heuristicScores,
        gpt_used: decision.gptEnhancement.used
      }
    });

    // Log detailed field detection decision
    const query = `
      INSERT INTO field_detection_decisions 
      (id, session_id, field_name, detected_type, heuristic_scores, gpt_enhancement, 
       sample_tokens, final_confidence, decision_factors, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      this.currentSessionId,
      decision.fieldName,
      decision.detectedType,
      JSON.stringify(decision.heuristicScores),
      JSON.stringify(decision.gptEnhancement),
      JSON.stringify(decision.sampleTokens),
      decision.finalConfidence,
      JSON.stringify(decision.decision_factors),
      timestamp
    ]);

    this.emit('field_detection_logged', { id, decision });
    return id;
  }

  // PII Masking Decision Logging
  async logPIIMaskingDecision(decision: PIIMaskingDecision): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    // Log general decision
    await this.logDecision({
      id,
      sessionId: this.currentSessionId,
      component: 'pii_masking',
      stage: 'masking_strategy',
      timestamp,
      input: { fieldName: decision.fieldName, piiType: decision.piiType },
      output: { maskingStrategy: decision.maskingStrategy.type, maskCount: decision.totalMaskCount },
      reasoning: decision.maskingStrategy.reasoning,
      confidence: Math.min(...decision.patterns.map(p => p.confidence)),
      metadata: {
        patterns_count: decision.patterns.length,
        risk_level: decision.riskAssessment.sensitivity_level
      }
    });

    // Log detailed PII masking decision
    const query = `
      INSERT INTO pii_masking_decisions 
      (id, session_id, field_name, pii_type, patterns, masking_strategy, 
       mask_examples, total_mask_count, risk_assessment, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      this.currentSessionId,
      decision.fieldName,
      decision.piiType,
      JSON.stringify(decision.patterns),
      JSON.stringify(decision.maskingStrategy),
      JSON.stringify(decision.maskExamples),
      decision.totalMaskCount,
      JSON.stringify(decision.riskAssessment),
      timestamp
    ]);

    this.emit('pii_masking_logged', { id, decision });
    return id;
  }

  // Sentiment Analysis Decision Logging
  async logSentimentAnalysisDecision(decision: SentimentAnalysisDecision): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    // Log general decision
    await this.logDecision({
      id,
      sessionId: this.currentSessionId,
      component: 'sentiment_analysis',
      stage: 'model_analysis',
      timestamp,
      input: { textSample: decision.textSample },
      output: { 
        model: decision.modelSelection.selected_model,
        tokens: decision.tokenUsage.total_tokens,
        cost: decision.tokenUsage.estimated_cost
      },
      reasoning: decision.modelSelection.selection_reasoning,
      confidence: Object.values(decision.confidenceFactors).reduce((a, b) => a + b, 0) / 4,
      metadata: {
        prompt_template: decision.promptTemplate.template_id,
        token_efficiency: decision.tokenUsage.total_tokens / decision.textSample.length
      }
    });

    // Log detailed sentiment analysis decision
    const query = `
      INSERT INTO sentiment_analysis_decisions 
      (id, session_id, text_sample, model_selection, prompt_template, 
       token_usage, confidence_factors, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      this.currentSessionId,
      decision.textSample,
      JSON.stringify(decision.modelSelection),
      JSON.stringify(decision.promptTemplate),
      JSON.stringify(decision.tokenUsage),
      JSON.stringify(decision.confidenceFactors),
      timestamp
    ]);

    this.emit('sentiment_analysis_logged', { id, decision });
    return id;
  }

  // Confidence Tracking
  async logConfidenceTracking(tracking: ConfidenceTracking): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    // Log general decision
    await this.logDecision({
      id,
      sessionId: this.currentSessionId,
      component: 'confidence_tracking',
      stage: 'confidence_calculation',
      timestamp,
      input: tracking.component_confidences,
      output: { 
        overall_confidence: tracking.overall_confidence,
        reliability_score: tracking.reliability_score
      },
      reasoning: `Aggregated using ${tracking.aggregation_method} method`,
      confidence: tracking.overall_confidence,
      metadata: {
        thresholds: tracking.thresholds,
        factors: tracking.confidence_factors
      }
    });

    // Log detailed confidence tracking
    const query = `
      INSERT INTO confidence_tracking 
      (id, session_id, overall_confidence, component_confidences, confidence_factors, 
       thresholds, aggregation_method, reliability_score, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      this.currentSessionId,
      tracking.overall_confidence,
      JSON.stringify(tracking.component_confidences),
      JSON.stringify(tracking.confidence_factors),
      JSON.stringify(tracking.thresholds),
      tracking.aggregation_method,
      tracking.reliability_score,
      timestamp
    ]);

    this.emit('confidence_tracking_logged', { id, tracking });
    return id;
  }

  // General Decision Logging
  private async logDecision(decision: DecisionLog): Promise<void> {
    const query = `
      INSERT INTO decision_logs 
      (id, session_id, component, stage, timestamp, input, output, reasoning, confidence, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      decision.id,
      decision.sessionId,
      decision.component,
      decision.stage,
      decision.timestamp,
      JSON.stringify(decision.input),
      JSON.stringify(decision.output),
      decision.reasoning,
      decision.confidence,
      JSON.stringify(decision.metadata)
    ]);
  }

  // Retrieval Methods
  async getDecisionHistory(sessionId?: string): Promise<DecisionLog[]> {
    const sid = sessionId || this.currentSessionId;
    const query = `
      SELECT * FROM decision_logs 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.db.all(query, [sid]);
    return rows.map(row => ({
      ...row,
      input: JSON.parse(row.input),
      output: JSON.parse(row.output),
      metadata: JSON.parse(row.metadata)
    }));
  }

  async getFieldDetectionDecisions(sessionId?: string): Promise<FieldDetectionDecision[]> {
    const sid = sessionId || this.currentSessionId;
    const query = `
      SELECT * FROM field_detection_decisions 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.db.all(query, [sid]);
    return rows.map(row => ({
      fieldName: row.field_name,
      detectedType: row.detected_type,
      heuristicScores: JSON.parse(row.heuristic_scores),
      gptEnhancement: JSON.parse(row.gpt_enhancement),
      sampleTokens: JSON.parse(row.sample_tokens),
      finalConfidence: row.final_confidence,
      decision_factors: JSON.parse(row.decision_factors)
    }));
  }

  async getPIIMaskingDecisions(sessionId?: string): Promise<PIIMaskingDecision[]> {
    const sid = sessionId || this.currentSessionId;
    const query = `
      SELECT * FROM pii_masking_decisions 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.db.all(query, [sid]);
    return rows.map(row => ({
      fieldName: row.field_name,
      piiType: row.pii_type,
      patterns: JSON.parse(row.patterns),
      maskingStrategy: JSON.parse(row.masking_strategy),
      maskExamples: JSON.parse(row.mask_examples),
      totalMaskCount: row.total_mask_count,
      riskAssessment: JSON.parse(row.risk_assessment)
    }));
  }

  async getSentimentAnalysisDecisions(sessionId?: string): Promise<SentimentAnalysisDecision[]> {
    const sid = sessionId || this.currentSessionId;
    const query = `
      SELECT * FROM sentiment_analysis_decisions 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.db.all(query, [sid]);
    return rows.map(row => ({
      textSample: row.text_sample,
      modelSelection: JSON.parse(row.model_selection),
      promptTemplate: JSON.parse(row.prompt_template),
      tokenUsage: JSON.parse(row.token_usage),
      confidenceFactors: JSON.parse(row.confidence_factors)
    }));
  }

  async getConfidenceTracking(sessionId?: string): Promise<ConfidenceTracking[]> {
    const sid = sessionId || this.currentSessionId;
    const query = `
      SELECT * FROM confidence_tracking 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `;
    
    const rows = await this.db.all(query, [sid]);
    return rows.map(row => ({
      overall_confidence: row.overall_confidence,
      component_confidences: JSON.parse(row.component_confidences),
      confidence_factors: JSON.parse(row.confidence_factors),
      thresholds: JSON.parse(row.thresholds),
      aggregation_method: row.aggregation_method,
      reliability_score: row.reliability_score
    }));
  }

  // Session Management
  startNewSession(): string {
    this.currentSessionId = uuidv4();
    this.emit('session_started', { sessionId: this.currentSessionId });
    return this.currentSessionId;
  }

  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  // Analytics
  async getSessionSummary(sessionId?: string): Promise<any> {
    const sid = sessionId || this.currentSessionId;
    
    const summary = {
      sessionId: sid,
      totalDecisions: 0,
      components: {
        field_detection: 0,
        pii_masking: 0,
        sentiment_analysis: 0,
        confidence_tracking: 0
      },
      averageConfidence: 0,
      lowConfidenceCount: 0,
      highConfidenceCount: 0
    };

    const decisions = await this.getDecisionHistory(sid);
    summary.totalDecisions = decisions.length;
    
    if (decisions.length > 0) {
      // Count by component
      decisions.forEach(decision => {
        summary.components[decision.component]++;
      });

      // Calculate confidence metrics
      const confidences = decisions.map(d => d.confidence).filter(c => c !== null);
      if (confidences.length > 0) {
        summary.averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        summary.lowConfidenceCount = confidences.filter(c => c < 0.7).length;
        summary.highConfidenceCount = confidences.filter(c => c >= 0.9).length;
      }
    }

    return summary;
  }

  // Utility Methods
  anonymizeText(text: string): string {
    // Basic anonymization for logging
    return text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD]')
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]');
  }

  async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    let deletedCount = 0;
    const tables = ['decision_logs', 'field_detection_decisions', 'pii_masking_decisions', 
                   'sentiment_analysis_decisions', 'confidence_tracking'];

    for (const table of tables) {
      const result = await this.db.run(
        `DELETE FROM ${table} WHERE timestamp < ?`,
        [cutoffIso]
      );
      deletedCount += result.changes || 0;
    }

    this.emit('cleanup_completed', { deletedCount, cutoffDate });
    return deletedCount;
  }
}

// Export singleton instance
export const analysisAuditService = new AnalysisAuditService();