import { getCacheService, ICacheService, CacheOptions } from './cache.service';
import { enhancedDatabaseService } from './enhanced-database.service';
import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * Enhanced Cache Service for DataCloak
 * TASK-203: Advanced Caching & Performance
 * 
 * Specialized caching for pattern validation, risk assessment results,
 * and performance optimization with cache warming and invalidation strategies.
 */

export interface PatternCacheEntry {
  patternId: string;
  regex: string;
  testResults: PatternTestResult[];
  validationResults: any;
  performance: PatternPerformanceMetrics;
  lastUsed: string;
  hitCount: number;
}

export interface PatternTestResult {
  input: string;
  matches: boolean;
  confidence: number;
  processingTime: number;
}

export interface PatternPerformanceMetrics {
  avgProcessingTime: number;
  accuracy: number;
  falsePositiveRate: number;
  totalTests: number;
  lastBenchmark: string;
}

export interface RiskAssessmentCacheEntry {
  assessmentId: string;
  dataHash: string; // Hash of input data to detect changes
  frameworkId: string;
  riskScore: number;
  riskLevel: string;
  analysisResults: any;
  generatedAt: string;
  expiresAt: string;
}

export interface CacheWarmingStrategy {
  strategy: 'frequency' | 'priority' | 'schedule' | 'on_demand';
  threshold?: number;
  schedule?: string; // Cron expression
  patterns?: string[]; // Specific pattern IDs to warm
}

export interface CacheInvalidationPolicy {
  trigger: 'pattern_update' | 'framework_change' | 'schedule' | 'manual';
  scope: 'pattern' | 'framework' | 'global';
  cascade: boolean; // Whether to invalidate related cache entries
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  totalRequests: number;
  cacheSize: number;
  warmingEfficiency: number;
  evictionRate: number;
}

export class EnhancedCacheService extends EventEmitter {
  private cacheService: ICacheService;
  private warmingStrategies: Map<string, CacheWarmingStrategy> = new Map();
  private invalidationPolicies: CacheInvalidationPolicy[] = [];
  private performanceMetrics: CachePerformanceMetrics = {
    hitRate: 0,
    missRate: 0,
    avgResponseTime: 0,
    totalRequests: 0,
    cacheSize: 0,
    warmingEfficiency: 0,
    evictionRate: 0
  };
  private warmingJobs: Map<string, NodeJS.Timeout> = new Map();

  // Cache key prefixes
  private readonly PATTERN_PREFIX = 'pattern:';
  private readonly RISK_ASSESSMENT_PREFIX = 'risk:';
  private readonly PERFORMANCE_PREFIX = 'perf:';
  private readonly WARMING_PREFIX = 'warm:';

  constructor() {
    super();
    this.cacheService = getCacheService();
    this.initializeDefaultStrategies();
    this.startPerformanceMonitoring();
  }

  // ==============================================
  // PATTERN CACHING OPERATIONS
  // ==============================================

  /**
   * Cache pattern validation results
   */
  async cachePatternValidation(
    patternId: string,
    testData: string[],
    results: PatternTestResult[]
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const pattern = await enhancedDatabaseService.getCustomPatternById(patternId);
      if (!pattern) return false;

      const cacheEntry: PatternCacheEntry = {
        patternId,
        regex: pattern.regex_pattern,
        testResults: results,
        validationResults: {
          totalTests: results.length,
          successfulTests: results.filter(r => r.matches).length,
          avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
          avgProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
        },
        performance: {
          avgProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
          accuracy: pattern.accuracy_rate || 0,
          falsePositiveRate: pattern.false_positive_rate || 0,
          totalTests: results.length,
          lastBenchmark: new Date().toISOString()
        },
        lastUsed: new Date().toISOString(),
        hitCount: 0
      };

      const cacheKey = this.getPatternCacheKey(patternId);
      const success = await this.cacheService.set(cacheKey, cacheEntry, {
        ttl: 3600, // 1 hour default
        serialize: true
      });

      this.recordCacheOperation('set', Date.now() - startTime, success);
      
      if (success) {
        this.emit('pattern:cached', { patternId, testsCount: results.length });
      }

      return success;
    } catch (error) {
      this.emit('cache:error', { operation: 'cachePatternValidation', patternId, error });
      return false;
    }
  }

  /**
   * Get cached pattern validation results
   */
  async getCachedPatternValidation(patternId: string): Promise<PatternCacheEntry | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.getPatternCacheKey(patternId);
      const entry = await this.cacheService.get<PatternCacheEntry>(cacheKey);
      
      const isHit = entry !== null;
      this.recordCacheOperation('get', Date.now() - startTime, isHit);

      if (entry) {
        // Update hit count and last used timestamp
        entry.hitCount++;
        entry.lastUsed = new Date().toISOString();
        
        // Update cache with new metrics (fire and forget)
        this.cacheService.set(cacheKey, entry, { ttl: 3600 });
        
        this.emit('pattern:cache_hit', { patternId });
      } else {
        this.emit('pattern:cache_miss', { patternId });
      }

      return entry;
    } catch (error) {
      this.emit('cache:error', { operation: 'getCachedPatternValidation', patternId, error });
      return null;
    }
  }

  /**
   * Test pattern against cached data with fallback to computation
   */
  async testPatternWithCache(
    patternId: string,
    testData: string[]
  ): Promise<PatternTestResult[]> {
    // Check cache first
    const cached = await this.getCachedPatternValidation(patternId);
    
    if (cached) {
      // Check if we have results for all test data
      const cachedDataHash = this.generateDataHash(testData);
      const existingDataHash = this.generateDataHash(cached.testResults.map(r => r.input));
      
      if (cachedDataHash === existingDataHash) {
        return cached.testResults;
      }
    }

    // Compute results and cache them
    const pattern = await enhancedDatabaseService.getCustomPatternById(patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    const regex = new RegExp(pattern.regex_pattern);
    const results: PatternTestResult[] = testData.map(input => {
      const startTime = performance.now();
      const matches = regex.test(input);
      const processingTime = performance.now() - startTime;
      
      return {
        input,
        matches,
        confidence: matches ? Math.random() * 0.3 + 0.7 : Math.random() * 0.3, // Mock confidence
        processingTime
      };
    });

    // Cache the results
    await this.cachePatternValidation(patternId, testData, results);
    
    return results;
  }

  // ==============================================
  // RISK ASSESSMENT CACHING
  // ==============================================

  /**
   * Cache risk assessment results
   */
  async cacheRiskAssessment(
    assessmentId: string,
    inputData: any,
    frameworkId: string,
    results: any
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const dataHash = this.generateDataHash(inputData);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      const cacheEntry: RiskAssessmentCacheEntry = {
        assessmentId,
        dataHash,
        frameworkId,
        riskScore: results.overall_risk_score,
        riskLevel: results.risk_level,
        analysisResults: results,
        generatedAt: new Date().toISOString(),
        expiresAt
      };

      const cacheKey = this.getRiskAssessmentCacheKey(assessmentId);
      const success = await this.cacheService.set(cacheKey, cacheEntry, {
        ttl: 86400, // 24 hours
        serialize: true
      });

      this.recordCacheOperation('set', Date.now() - startTime, success);
      
      if (success) {
        this.emit('risk_assessment:cached', { assessmentId, frameworkId });
      }

      return success;
    } catch (error) {
      this.emit('cache:error', { operation: 'cacheRiskAssessment', assessmentId, error });
      return false;
    }
  }

  /**
   * Get cached risk assessment results
   */
  async getCachedRiskAssessment(
    assessmentId: string,
    inputDataHash?: string
  ): Promise<RiskAssessmentCacheEntry | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.getRiskAssessmentCacheKey(assessmentId);
      const entry = await this.cacheService.get<RiskAssessmentCacheEntry>(cacheKey);
      
      const isHit = entry !== null;
      this.recordCacheOperation('get', Date.now() - startTime, isHit);

      if (entry) {
        // Check if data has changed
        if (inputDataHash && entry.dataHash !== inputDataHash) {
          // Data has changed, invalidate cache
          await this.invalidateRiskAssessment(assessmentId);
          this.emit('risk_assessment:cache_invalidated', { assessmentId, reason: 'data_changed' });
          return null;
        }

        // Check if expired
        if (new Date(entry.expiresAt) < new Date()) {
          await this.invalidateRiskAssessment(assessmentId);
          this.emit('risk_assessment:cache_expired', { assessmentId });
          return null;
        }

        this.emit('risk_assessment:cache_hit', { assessmentId });
        return entry;
      } else {
        this.emit('risk_assessment:cache_miss', { assessmentId });
        return null;
      }
    } catch (error) {
      this.emit('cache:error', { operation: 'getCachedRiskAssessment', assessmentId, error });
      return null;
    }
  }

  // ==============================================
  // CACHE WARMING STRATEGIES
  // ==============================================

  /**
   * Implement cache warming for frequently used patterns
   */
  async warmFrequentlyUsedPatterns(): Promise<void> {
    try {
      const patterns = await enhancedDatabaseService.getCustomPatterns({
        enabled: true,
        limit: 50
      });

      // Sort by usage frequency and priority
      const sortedPatterns = patterns
        .filter(p => p.times_used && p.times_used > 10)
        .sort((a, b) => {
          const scoreA = (a.times_used || 0) * (11 - a.priority);
          const scoreB = (b.times_used || 0) * (11 - b.priority);
          return scoreB - scoreA;
        })
        .slice(0, 20); // Top 20 patterns

      for (const pattern of sortedPatterns) {
        await this.warmPatternCache(pattern.id);
      }

      this.emit('cache:warming_completed', {
        strategy: 'frequency',
        patternsWarmed: sortedPatterns.length
      });
    } catch (error) {
      this.emit('cache:error', { operation: 'warmFrequentlyUsedPatterns', error });
    }
  }

  /**
   * Warm cache for a specific pattern
   */
  async warmPatternCache(patternId: string): Promise<boolean> {
    try {
      const pattern = await enhancedDatabaseService.getCustomPatternById(patternId);
      if (!pattern || !pattern.test_cases) return false;

      const testData = [...pattern.test_cases];
      if (pattern.invalid_cases) {
        testData.push(...pattern.invalid_cases);
      }

      // Add some common test variations
      const commonTestData = this.generateCommonTestData(pattern.category);
      testData.push(...commonTestData);

      await this.testPatternWithCache(patternId, testData);
      
      this.emit('pattern:warmed', { patternId, testDataCount: testData.length });
      return true;
    } catch (error) {
      this.emit('cache:error', { operation: 'warmPatternCache', patternId, error });
      return false;
    }
  }

  /**
   * Schedule automatic cache warming
   */
  scheduleWarming(strategy: CacheWarmingStrategy): void {
    const jobId = `warming-${strategy.strategy}-${Date.now()}`;
    
    let interval: number;
    switch (strategy.strategy) {
      case 'frequency':
        interval = 15 * 60 * 1000; // Every 15 minutes
        break;
      case 'priority':
        interval = 30 * 60 * 1000; // Every 30 minutes
        break;
      case 'schedule':
        // For simplicity, using fixed intervals instead of cron
        interval = 60 * 60 * 1000; // Every hour
        break;
      default:
        return;
    }

    const job = setInterval(async () => {
      switch (strategy.strategy) {
        case 'frequency':
          await this.warmFrequentlyUsedPatterns();
          break;
        case 'priority':
          await this.warmHighPriorityPatterns();
          break;
        case 'schedule':
          if (strategy.patterns) {
            for (const patternId of strategy.patterns) {
              await this.warmPatternCache(patternId);
            }
          }
          break;
      }
    }, interval);

    this.warmingJobs.set(jobId, job);
    this.warmingStrategies.set(jobId, strategy);
    
    this.emit('warming:scheduled', { jobId, strategy });
  }

  /**
   * Warm high priority patterns
   */
  async warmHighPriorityPatterns(): Promise<void> {
    try {
      const patterns = await enhancedDatabaseService.getCustomPatterns({
        enabled: true,
        limit: 30
      });

      // Get top priority patterns (priority 1-3)
      const highPriorityPatterns = patterns
        .filter(p => p.priority <= 3)
        .sort((a, b) => a.priority - b.priority);

      for (const pattern of highPriorityPatterns) {
        await this.warmPatternCache(pattern.id);
      }

      this.emit('cache:warming_completed', {
        strategy: 'priority',
        patternsWarmed: highPriorityPatterns.length
      });
    } catch (error) {
      this.emit('cache:error', { operation: 'warmHighPriorityPatterns', error });
    }
  }

  // ==============================================
  // CACHE INVALIDATION POLICIES
  // ==============================================

  /**
   * Invalidate pattern cache when pattern is updated
   */
  async invalidatePatternCache(patternId: string): Promise<boolean> {
    try {
      const cacheKey = this.getPatternCacheKey(patternId);
      const success = await this.cacheService.del(cacheKey);
      
      if (success) {
        this.emit('pattern:cache_invalidated', { patternId });
      }
      
      return success;
    } catch (error) {
      this.emit('cache:error', { operation: 'invalidatePatternCache', patternId, error });
      return false;
    }
  }

  /**
   * Invalidate risk assessment cache
   */
  async invalidateRiskAssessment(assessmentId: string): Promise<boolean> {
    try {
      const cacheKey = this.getRiskAssessmentCacheKey(assessmentId);
      const success = await this.cacheService.del(cacheKey);
      
      if (success) {
        this.emit('risk_assessment:cache_invalidated', { assessmentId });
      }
      
      return success;
    } catch (error) {
      this.emit('cache:error', { operation: 'invalidateRiskAssessment', assessmentId, error });
      return false;
    }
  }

  /**
   * Invalidate all caches for a specific framework
   */
  async invalidateFrameworkCaches(frameworkId: string): Promise<number> {
    try {
      const riskAssessmentKeys = await this.cacheService.keys(`${this.RISK_ASSESSMENT_PREFIX}*`);
      let invalidatedCount = 0;

      for (const key of riskAssessmentKeys) {
        const entry = await this.cacheService.get<RiskAssessmentCacheEntry>(key);
        if (entry && entry.frameworkId === frameworkId) {
          await this.cacheService.del(key);
          invalidatedCount++;
        }
      }

      this.emit('framework:caches_invalidated', { frameworkId, count: invalidatedCount });
      return invalidatedCount;
    } catch (error) {
      this.emit('cache:error', { operation: 'invalidateFrameworkCaches', frameworkId, error });
      return 0;
    }
  }

  // ==============================================
  // PERFORMANCE MONITORING
  // ==============================================

  /**
   * Get comprehensive cache performance metrics
   */
  getPerformanceMetrics(): CachePerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get cache statistics from underlying cache service
   */
  async getCacheStatistics(): Promise<any> {
    const stats = this.cacheService.getStats();
    const keys = await this.cacheService.keys('*');
    
    return {
      ...stats,
      keyCount: keys.length,
      patterns: {
        cached: keys.filter(k => k.startsWith(this.PATTERN_PREFIX)).length,
        total: await this.getTotalPatternCount()
      },
      riskAssessments: {
        cached: keys.filter(k => k.startsWith(this.RISK_ASSESSMENT_PREFIX)).length
      },
      warmingJobs: this.warmingJobs.size,
      strategies: this.warmingStrategies.size
    };
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  private getPatternCacheKey(patternId: string): string {
    return `${this.PATTERN_PREFIX}${patternId}`;
  }

  private getRiskAssessmentCacheKey(assessmentId: string): string {
    return `${this.RISK_ASSESSMENT_PREFIX}${assessmentId}`;
  }

  private generateDataHash(data: any): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private generateCommonTestData(category: string): string[] {
    const commonData: { [key: string]: string[] } = {
      personal: [
        'john.doe@example.com',
        '(555) 123-4567',
        '123-45-6789',
        'test@domain.com'
      ],
      financial: [
        '4111111111111111',
        '5555555555554444',
        '123-45-6789',
        'ACCT123456789'
      ],
      medical: [
        'MRN12345678',
        'PATIENT-001',
        'DOC123456',
        'RX987654'
      ],
      identifier: [
        'ID-123456',
        'USR-001',
        'EMP-12345',
        'CUST-789'
      ]
    };

    return commonData[category] || commonData.identifier;
  }

  private recordCacheOperation(operation: string, responseTime: number, success: boolean): void {
    this.performanceMetrics.totalRequests++;
    
    if (operation === 'get') {
      if (success) {
        this.performanceMetrics.hitRate = 
          (this.performanceMetrics.hitRate * (this.performanceMetrics.totalRequests - 1) + 1) 
          / this.performanceMetrics.totalRequests;
      } else {
        this.performanceMetrics.missRate = 
          (this.performanceMetrics.missRate * (this.performanceMetrics.totalRequests - 1) + 1) 
          / this.performanceMetrics.totalRequests;
      }
    }

    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime) 
      / this.performanceMetrics.totalRequests;
  }

  private async getTotalPatternCount(): Promise<number> {
    try {
      const patterns = await enhancedDatabaseService.getCustomPatterns({ enabled: true });
      return patterns.length;
    } catch {
      return 0;
    }
  }

  private initializeDefaultStrategies(): void {
    // Set up default warming strategies
    this.scheduleWarming({
      strategy: 'frequency',
      threshold: 10
    });

    this.scheduleWarming({
      strategy: 'priority'
    });
  }

  private startPerformanceMonitoring(): void {
    // Update performance metrics every 5 minutes
    setInterval(async () => {
      try {
        const keys = await this.cacheService.keys('*');
        this.performanceMetrics.cacheSize = keys.length;
        
        // Emit performance update
        this.emit('performance:updated', this.performanceMetrics);
      } catch (error) {
        this.emit('cache:error', { operation: 'performanceMonitoring', error });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    // Stop all warming jobs
    for (const [jobId, job] of this.warmingJobs.entries()) {
      clearInterval(job);
      this.warmingJobs.delete(jobId);
    }

    // Clear strategies
    this.warmingStrategies.clear();

    this.emit('cache:closed');
  }
}

// Export singleton instance
export const enhancedCacheService = new EnhancedCacheService();