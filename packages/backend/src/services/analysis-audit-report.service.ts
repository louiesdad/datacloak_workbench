import { 
  AnalysisAuditReport, 
  DecisionLogEntry, 
  TimeRange,
  ReportSummary,
  PerformanceReport,
  QualityMetricsReport,
  DecisionLogValidator,
  DecisionLogSerializer
} from '../schemas/decision-log.schema';
import { withSQLiteConnection } from '../database/sqlite-refactored';
import { dualLogger } from '../config/dual-logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportGenerationOptions {
  includeDetailedPerformance?: boolean;
  includeQualityMetrics?: boolean;
  maxSlowDecisions?: number;
  maxLowConfidenceDecisions?: number;
  maxInconsistentPatterns?: number;
  confidenceThreshold?: number; // Below this threshold, decisions are considered "low confidence"
}

export interface ReportFilters {
  decisionTypes?: string[];
  datasetIds?: string[];
  userIds?: string[];
  minConfidence?: number;
  maxConfidence?: number;
  algorithms?: string[];
}

export class AnalysisAuditReportService {
  private logDir: string;
  private auditLogPath: string;

  constructor() {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.auditLogPath = path.join(this.logDir, 'analysis-audit.log');
  }

  /**
   * Generate a comprehensive analysis audit report for a given time range
   */
  async generateReport(
    timeRange: TimeRange,
    options: ReportGenerationOptions = {},
    filters: ReportFilters = {}
  ): Promise<AnalysisAuditReport> {
    const reportId = uuidv4();
    const startTime = Date.now();

    dualLogger.info('Starting audit report generation', {
      component: 'audit-report',
      reportId,
      timeRange,
      options,
      filters
    });

    try {
      // Load decision entries from the time range
      const decisions = await this.loadDecisionEntries(timeRange, filters);
      
      dualLogger.info(`Loaded ${decisions.length} decision entries for analysis`, {
        component: 'audit-report',
        reportId,
        decisionCount: decisions.length
      });

      // Generate report sections
      const summary = this.generateSummary(decisions);
      const performance = options.includeDetailedPerformance 
        ? await this.generatePerformanceReport(decisions, options)
        : this.generateBasicPerformanceReport(decisions);
      const qualityMetrics = options.includeQualityMetrics
        ? this.generateQualityMetricsReport(decisions, options)
        : this.generateBasicQualityMetrics(decisions);
      const recommendations = this.generateRecommendations(decisions, summary, performance, qualityMetrics);

      const report: AnalysisAuditReport = {
        reportId,
        generatedAt: new Date().toISOString(),
        timeRange,
        summary,
        performance,
        qualityMetrics,
        recommendations
      };

      // Validate the generated report
      const validatedReport = DecisionLogValidator.validateAuditReport(report);

      // Store report summary in database
      await this.storeReportSummary(validatedReport);

      const duration = Date.now() - startTime;
      dualLogger.performance('Audit report generation completed', startTime, {
        component: 'audit-report',
        reportId,
        decisionCount: decisions.length,
        duration
      });

      return validatedReport;

    } catch (error) {
      dualLogger.error('Failed to generate audit report', {
        component: 'audit-report',
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange
      });
      throw error;
    }
  }

  /**
   * Load decision entries from audit log within time range
   */
  private async loadDecisionEntries(timeRange: TimeRange, filters: ReportFilters): Promise<DecisionLogEntry[]> {
    const decisions: DecisionLogEntry[] = [];
    
    // Try to read from file first
    if (fs.existsSync(this.auditLogPath)) {
      try {
        const logContent = fs.readFileSync(this.auditLogPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const entry = DecisionLogSerializer.fromJSON(line);
            
            // Check time range
            const entryTime = new Date(entry.timestamp);
            const startTime = new Date(timeRange.startTime);
            const endTime = new Date(timeRange.endTime);
            
            if (entryTime >= startTime && entryTime <= endTime) {
              // Apply filters
              if (this.passesFilters(entry, filters)) {
                decisions.push(entry);
              }
            }
          } catch (error) {
            // Skip invalid log entries
            dualLogger.warn('Skipped invalid decision log entry', {
              component: 'audit-report',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      } catch (error) {
        dualLogger.warn('Failed to read audit log file, falling back to database', {
          component: 'audit-report',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Fallback to database if file reading failed or no file exists
    if (decisions.length === 0) {
      return this.loadDecisionEntriesFromDatabase(timeRange, filters);
    }

    return decisions;
  }

  /**
   * Load decision entries from database as fallback
   */
  private async loadDecisionEntriesFromDatabase(timeRange: TimeRange, filters: ReportFilters): Promise<DecisionLogEntry[]> {
    return withSQLiteConnection(async (db) => {
      let query = `
        SELECT trace_id, decision_type, step_count, average_confidence, total_duration, dataset_id, created_at
        FROM analysis_decision_summaries 
        WHERE created_at BETWEEN ? AND ?
      `;
      const params: any[] = [timeRange.startTime, timeRange.endTime];

      // Apply filters
      if (filters.decisionTypes && filters.decisionTypes.length > 0) {
        query += ` AND decision_type IN (${filters.decisionTypes.map(() => '?').join(',')})`;
        params.push(...filters.decisionTypes);
      }

      if (filters.datasetIds && filters.datasetIds.length > 0) {
        query += ` AND dataset_id IN (${filters.datasetIds.map(() => '?').join(',')})`;
        params.push(...filters.datasetIds);
      }

      if (filters.minConfidence !== undefined) {
        query += ` AND average_confidence >= ?`;
        params.push(filters.minConfidence);
      }

      if (filters.maxConfidence !== undefined) {
        query += ` AND average_confidence <= ?`;
        params.push(filters.maxConfidence);
      }

      query += ` ORDER BY created_at DESC`;

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];

      // Convert database rows to decision entries (simplified format)
      return rows.map(row => ({
        traceId: row.trace_id,
        timestamp: row.created_at,
        decisionType: row.decision_type,
        stepName: 'database_summary',
        reasoning: {
          algorithm: 'aggregated',
          confidence: row.average_confidence,
          factors: { stepCount: row.step_count }
        },
        input: {
          datasetId: row.dataset_id
        },
        output: {
          result: { summary: true },
          performance: { duration: row.total_duration }
        },
        context: {
          environment: process.env.NODE_ENV || 'unknown',
          version: process.env.npm_package_version || 'unknown'
        }
      } as DecisionLogEntry));
    });
  }

  /**
   * Check if a decision entry passes the given filters
   */
  private passesFilters(entry: DecisionLogEntry, filters: ReportFilters): boolean {
    if (filters.decisionTypes && !filters.decisionTypes.includes(entry.decisionType)) {
      return false;
    }

    if (filters.datasetIds && entry.input.datasetId && !filters.datasetIds.includes(entry.input.datasetId)) {
      return false;
    }

    if (filters.userIds && entry.context.userId && !filters.userIds.includes(entry.context.userId)) {
      return false;
    }

    if (filters.minConfidence !== undefined && entry.reasoning.confidence < filters.minConfidence) {
      return false;
    }

    if (filters.maxConfidence !== undefined && entry.reasoning.confidence > filters.maxConfidence) {
      return false;
    }

    if (filters.algorithms && !filters.algorithms.includes(entry.reasoning.algorithm)) {
      return false;
    }

    return true;
  }

  /**
   * Generate summary statistics from decision entries
   */
  private generateSummary(decisions: DecisionLogEntry[]): ReportSummary {
    const decisionsByType: Record<string, number> = {};
    const datasetIds = new Set<string>();
    const fieldNames = new Set<string>();
    let totalConfidence = 0;
    let piiDecisions = 0;

    for (const decision of decisions) {
      // Count by type
      decisionsByType[decision.decisionType] = (decisionsByType[decision.decisionType] || 0) + 1;

      // Track datasets and fields
      if (decision.input.datasetId) {
        datasetIds.add(decision.input.datasetId);
      }
      if (decision.input.fieldName) {
        fieldNames.add(decision.input.fieldName);
      }

      // Accumulate confidence
      totalConfidence += decision.reasoning.confidence;

      // Count PII-related decisions
      if (decision.decisionType === 'pii_masking' || 
          (decision.output.metadata && decision.output.metadata.piiDetected)) {
        piiDecisions++;
      }
    }

    const averageConfidence = decisions.length > 0 ? totalConfidence / decisions.length : 0;
    const piiDetectionRate = decisions.length > 0 ? piiDecisions / decisions.length : 0;

    return {
      totalDecisions: decisions.length,
      decisionsByType,
      averageConfidence,
      totalDatasets: datasetIds.size,
      totalFields: fieldNames.size,
      piiDetectionRate
    };
  }

  /**
   * Generate detailed performance report
   */
  private async generatePerformanceReport(decisions: DecisionLogEntry[], options: ReportGenerationOptions): Promise<PerformanceReport> {
    const durations: number[] = [];
    const slowDecisions: Array<{ traceId: string; stepName: string; duration: number }> = [];
    const memoryUsageTrends: Array<{ timestamp: string; usage: number }> = [];

    for (const decision of decisions) {
      const duration = decision.output.performance?.duration;
      if (duration !== undefined) {
        durations.push(duration);

        // Track slow decisions
        slowDecisions.push({
          traceId: decision.traceId,
          stepName: decision.stepName,
          duration
        });

        // Track memory usage if available
        const memoryUsage = decision.output.performance?.memoryUsage;
        if (memoryUsage !== undefined) {
          memoryUsageTrends.push({
            timestamp: decision.timestamp,
            usage: memoryUsage
          });
        }
      }
    }

    // Calculate average decision time
    const averageDecisionTime = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;

    // Get slowest decisions
    const maxSlowDecisions = options.maxSlowDecisions || 10;
    const sortedSlowDecisions = slowDecisions
      .sort((a, b) => b.duration - a.duration)
      .slice(0, maxSlowDecisions);

    // Sort memory usage trends by timestamp
    memoryUsageTrends.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      averageDecisionTime,
      slowestDecisions: sortedSlowDecisions,
      memoryUsageTrends
    };
  }

  /**
   * Generate basic performance report (lighter computation)
   */
  private generateBasicPerformanceReport(decisions: DecisionLogEntry[]): PerformanceReport {
    const durations = decisions
      .map(d => d.output.performance?.duration)
      .filter((duration): duration is number => duration !== undefined);

    const averageDecisionTime = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;

    return {
      averageDecisionTime,
      slowestDecisions: [],
      memoryUsageTrends: []
    };
  }

  /**
   * Generate quality metrics report
   */
  private generateQualityMetricsReport(decisions: DecisionLogEntry[], options: ReportGenerationOptions): QualityMetricsReport {
    const confidenceThreshold = options.confidenceThreshold || 0.7;
    const lowConfidenceDecisions: Array<{
      traceId: string;
      decisionType: string;
      confidence: number;
      reasoning: string;
    }> = [];

    const algorithmDecisions: Record<string, DecisionLogEntry[]> = {};
    const inconsistentDecisions: Array<{
      pattern: string;
      occurrences: number;
      examples: string[];
    }> = [];

    // Analyze decisions for quality issues
    for (const decision of decisions) {
      // Track low confidence decisions
      if (decision.reasoning.confidence < confidenceThreshold) {
        lowConfidenceDecisions.push({
          traceId: decision.traceId,
          decisionType: decision.decisionType,
          confidence: decision.reasoning.confidence,
          reasoning: decision.reasoning.algorithm
        });
      }

      // Group by algorithm for inconsistency analysis
      const algorithm = decision.reasoning.algorithm;
      if (!algorithmDecisions[algorithm]) {
        algorithmDecisions[algorithm] = [];
      }
      algorithmDecisions[algorithm].push(decision);
    }

    // Detect inconsistent decisions (same input, different output)
    for (const [algorithm, algorithmSpecificDecisions] of Object.entries(algorithmDecisions)) {
      const inputOutputMap: Record<string, Set<string>> = {};

      for (const decision of algorithmSpecificDecisions) {
        const inputKey = this.generateInputKey(decision);
        const outputKey = this.generateOutputKey(decision);

        if (!inputOutputMap[inputKey]) {
          inputOutputMap[inputKey] = new Set();
        }
        inputOutputMap[inputKey].add(outputKey);
      }

      // Find inputs with multiple different outputs
      for (const [inputKey, outputs] of Object.entries(inputOutputMap)) {
        if (outputs.size > 1) {
          inconsistentDecisions.push({
            pattern: `${algorithm} algorithm inconsistency`,
            occurrences: outputs.size,
            examples: Array.from(outputs).slice(0, 5)
          });
        }
      }
    }

    // Limit results
    const maxLowConfidence = options.maxLowConfidenceDecisions || 20;
    const maxInconsistent = options.maxInconsistentPatterns || 10;

    return {
      lowConfidenceDecisions: lowConfidenceDecisions
        .sort((a, b) => a.confidence - b.confidence)
        .slice(0, maxLowConfidence),
      inconsistentDecisions: inconsistentDecisions
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, maxInconsistent)
    };
  }

  /**
   * Generate basic quality metrics (lighter computation)
   */
  private generateBasicQualityMetrics(decisions: DecisionLogEntry[]): QualityMetricsReport {
    const lowConfidenceDecisions = decisions
      .filter(d => d.reasoning.confidence < 0.7)
      .slice(0, 10)
      .map(d => ({
        traceId: d.traceId,
        decisionType: d.decisionType,
        confidence: d.reasoning.confidence,
        reasoning: d.reasoning.algorithm
      }));

    return {
      lowConfidenceDecisions,
      inconsistentDecisions: []
    };
  }

  /**
   * Generate recommendations based on report data
   */
  private generateRecommendations(
    decisions: DecisionLogEntry[],
    summary: ReportSummary,
    performance: PerformanceReport,
    qualityMetrics: QualityMetricsReport
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (performance.averageDecisionTime > 1000) {
      recommendations.push('Consider optimizing algorithms as average decision time exceeds 1 second');
    }

    if (performance.slowestDecisions.length > 0) {
      const slowestDuration = performance.slowestDecisions[0].duration;
      if (slowestDuration > 5000) {
        recommendations.push(`Review ${performance.slowestDecisions[0].stepName} step - taking ${slowestDuration}ms`);
      }
    }

    // Quality recommendations
    if (summary.averageConfidence < 0.8) {
      recommendations.push('Average confidence is below 80% - consider reviewing algorithm parameters');
    }

    if (qualityMetrics.lowConfidenceDecisions.length > summary.totalDecisions * 0.1) {
      recommendations.push('More than 10% of decisions have low confidence - investigate algorithm tuning');
    }

    if (qualityMetrics.inconsistentDecisions.length > 0) {
      recommendations.push('Inconsistent decisions detected - review algorithm determinism');
    }

    // Data coverage recommendations
    if (summary.totalDatasets < 5) {
      recommendations.push('Limited dataset coverage - consider testing with more diverse data');
    }

    // PII recommendations
    if (summary.piiDetectionRate > 0.5) {
      recommendations.push('High PII detection rate - ensure proper masking and compliance measures');
    } else if (summary.piiDetectionRate < 0.1 && summary.totalDecisions > 100) {
      recommendations.push('Low PII detection rate - verify PII detection algorithms are working correctly');
    }

    // Memory usage recommendations
    if (performance.memoryUsageTrends.length > 0) {
      const maxMemory = Math.max(...performance.memoryUsageTrends.map(t => t.usage));
      if (maxMemory > 500 * 1024 * 1024) { // 500MB
        recommendations.push('High memory usage detected - consider implementing streaming or chunked processing');
      }
    }

    return recommendations.slice(0, 20); // Limit to 20 recommendations
  }

  /**
   * Store report summary in database for future reference
   */
  private async storeReportSummary(report: AnalysisAuditReport): Promise<void> {
    try {
      await withSQLiteConnection(async (db) => {
        const stmt = db.prepare(`
          INSERT INTO analysis_audit_reports 
          (report_id, generated_at, time_range_start, time_range_end, total_decisions, 
           average_confidence, total_datasets, average_decision_time, recommendations_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          report.reportId,
          report.generatedAt,
          report.timeRange.startTime,
          report.timeRange.endTime,
          report.summary.totalDecisions,
          report.summary.averageConfidence,
          report.summary.totalDatasets,
          report.performance.averageDecisionTime,
          report.recommendations.length
        );
      });

      dualLogger.info('Audit report summary stored in database', {
        component: 'audit-report',
        reportId: report.reportId
      });
    } catch (error) {
      dualLogger.warn('Failed to store audit report summary', {
        component: 'audit-report',
        reportId: report.reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate a unique key for decision input (for inconsistency detection)
   */
  private generateInputKey(decision: DecisionLogEntry): string {
    const input = decision.input;
    return `${decision.decisionType}-${input.fieldName || 'no-field'}-${JSON.stringify(input.sampleData)}`;
  }

  /**
   * Generate a unique key for decision output (for inconsistency detection)
   */
  private generateOutputKey(decision: DecisionLogEntry): string {
    const result = decision.output.result;
    return JSON.stringify(result);
  }

  /**
   * Get recent audit reports from database
   */
  async getRecentReports(limit: number = 10): Promise<Array<{
    reportId: string;
    generatedAt: string;
    totalDecisions: number;
    averageConfidence: number;
    timeRange: { startTime: string; endTime: string };
  }>> {
    return withSQLiteConnection(async (db) => {
      const stmt = db.prepare(`
        SELECT report_id, generated_at, time_range_start, time_range_end, 
               total_decisions, average_confidence
        FROM analysis_audit_reports 
        ORDER BY generated_at DESC 
        LIMIT ?
      `);

      const rows = stmt.all(limit) as any[];
      
      return rows.map(row => ({
        reportId: row.report_id,
        generatedAt: row.generated_at,
        totalDecisions: row.total_decisions,
        averageConfidence: row.average_confidence,
        timeRange: {
          startTime: row.time_range_start,
          endTime: row.time_range_end
        }
      }));
    });
  }
}

// Create singleton instance
export const analysisAuditReportService = new AnalysisAuditReportService();

export default AnalysisAuditReportService;