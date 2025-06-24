import { BusinessEventService } from './business-event.service';
import logger from '../config/logger';

export interface ClassificationResult {
  primaryType: string;
  confidence: number;
  alternatives?: Array<{ type: string; confidence: number }>;
  suggestedCustomType?: string;
  keywords?: string[];
  overridden?: boolean;
  overrideReason?: string;
  reason?: string;
}

export interface ClassificationOptions {
  includeAlternatives?: boolean;
  minConfidence?: number;
  continueOnError?: boolean;
}

export interface CustomPattern {
  name: string;
  patterns: RegExp[];
  keywords: string[];
  confidence: number;
  priority?: number;
}

export interface ClassificationStats {
  totalClassifications: number;
  typeDistribution: Record<string, number>;
  averageConfidence: number;
}

export interface EventTypeSuggestion {
  suggestedType: string;
  confidence: number;
  alternatives: Array<{ type: string; confidence: number }>;
  keywords: string[];
}

export interface ConsistencyValidation {
  isConsistent: boolean;
  suggestedType?: string;
  confidence?: number;
  warning?: string;
}

interface BatchClassificationResult {
  id: string;
  classification?: ClassificationResult;
  error?: { message: string };
}

// Default classification patterns
const DEFAULT_PATTERNS: Record<string, CustomPattern> = {
  price_change: {
    name: 'price_change',
    patterns: [
      /price\s*(increase|decrease|change|adjustment|reduction|reduced)/i,
      /(reduce|reduced|increase|increased)\s*price/i,
      /cost\s*(adjustment|change)/i,
      /pricing\s*(tier|update|change|new)/i,
      /discount|sale|offer/i,
      /\d+%\s*(off|increase|decrease|for|across)/i,
      /price.*\d+%/i,
      /\d+%.*price/i,
      /summer\s+sale/i,
      /prices?\s+(will\s+be\s+)?(adjusted|changed)/i
    ],
    keywords: ['price', 'prices', 'cost', 'pricing', 'discount', 'sale', 'increase', 'decrease', 'adjustment', 'reduced', 'inflation', 'adjusted'],
    confidence: 0.85
  },
  system_outage: {
    name: 'system_outage',
    patterns: [
      /(complete|major)?\s*system\s+(outage|down|offline|unavailable)/i,
      /service\s+(downtime|disruption|outage)/i,
      /platform\s+(unavailable|offline)/i,
      /(website|api|service)\s+(offline|down|experiencing)/i,
      /maintenance\s+(window|scheduled|due)/i,
      /emergency\s+(maintenance|repairs)/i,
      /(technical|connection)\s+issues/i,
      /offline\s+for/i,
      /intermittent\s+failures/i,
      /system\s+upgrade/i,
      /service.*interrupted/i,
      /affecting.*services?/i
    ],
    keywords: ['outage', 'downtime', 'offline', 'unavailable', 'maintenance', 'disruption', 'system', 'technical', 'failures', 'upgrade', 'interrupted', 'affecting', 'services'],
    confidence: 0.85
  },
  feature_launch: {
    name: 'feature_launch',
    patterns: [
      /new\s+.*(feature|functionality|capability|dashboard)/i,
      /(launched|launching|introducing|release|added)/i,
      /(beta|alpha)\s+release/i,
      /product\s+update/i,
      /enhanced?\s+(feature|functionality|security)/i,
      /added\s+new/i,
      /now\s+available/i,
      /analytics\s+capabilities/i,
      /reporting\s+functionality/i
    ],
    keywords: ['launch', 'launched', 'new', 'feature', 'release', 'introducing', 'update', 'beta', 'enhanced', 'analytics', 'functionality', 'dashboard', 'added'],
    confidence: 0.85
  },
  policy_change: {
    name: 'policy_change',
    patterns: [
      /policy\s+(change|update|new|updated)/i,
      /terms\s+(of\s+service|and\s+conditions)/i,
      /new\s+(terms|policy|guidelines|refund)/i,
      /updated?\s+(policy|terms|privacy)/i,
      /changes?\s+to\s+.*(policy|terms)/i,
      /modified\s+.*(agreement|terms)/i,
      /effective\s+(immediately|next)/i
    ],
    keywords: ['policy', 'terms', 'conditions', 'guidelines', 'service', 'privacy', 'refund', 'agreement'],
    confidence: 0.8
  },
  service_disruption: {
    name: 'service_disruption',
    patterns: [
      /service\s+(disruption|interruption|issue|may\s+be)/i,
      /experiencing\s+(issues|problems|difficulties)/i,
      /degraded\s+performance/i,
      /disruption\s+(alert|notice)/i,
      /partial\s+(outage|disruption)/i,
      /minor\s+(issues|problems)/i
    ],
    keywords: ['disruption', 'interruption', 'issue', 'problem', 'degraded', 'alert', 'partial', 'minor'],
    confidence: 0.75
  }
};

export class EventClassifierService {
  private businessEventService: BusinessEventService;
  private customPatterns: Map<string, CustomPattern> = new Map();
  private overrides: Map<string, string> = new Map();
  private overrideReasons: Map<string, string> = new Map();
  private classificationHistory: ClassificationResult[] = [];

  constructor(businessEventService: BusinessEventService) {
    this.businessEventService = businessEventService;
  }

  async classifyEventType(
    description: string, 
    options: ClassificationOptions = {}
  ): Promise<ClassificationResult> {
    try {
      // Check for manual overrides first
      if (this.overrides.has(description)) {
        const overriddenType = this.overrides.get(description)!;
        const overrideReason = this.overrideReasons.get(description) || 'Manual override applied';
        return {
          primaryType: overriddenType,
          confidence: 1.0,
          overridden: true,
          overrideReason
        };
      }

      // Normalize description
      const normalizedDesc = description.toLowerCase();
      
      // Score all patterns
      const scores: Array<{ type: string; confidence: number; pattern: CustomPattern }> = [];
      
      // Check custom patterns first (higher priority)
      for (const [type, pattern] of this.customPatterns) {
        const score = this.scorePattern(normalizedDesc, pattern);
        if (score > 0) {
          scores.push({ type, confidence: score, pattern });
        }
      }
      
      // Check default patterns
      for (const [type, pattern] of Object.entries(DEFAULT_PATTERNS)) {
        const score = this.scorePattern(normalizedDesc, pattern);
        if (score > 0) {
          scores.push({ type, confidence: score, pattern });
        }
      }
      
      // Sort by confidence and priority
      scores.sort((a, b) => {
        // First by priority if exists
        const priorityA = a.pattern.priority || 0;
        const priorityB = b.pattern.priority || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        // Then by confidence
        return b.confidence - a.confidence;
      });
      
      const minConfidence = options.minConfidence || 0.3;
      
      if (scores.length === 0 || scores[0].confidence < minConfidence) {
        const result: ClassificationResult = {
          primaryType: 'other',
          confidence: scores.length > 0 ? scores[0].confidence : 0.0,
          suggestedCustomType: this.suggestCustomType(normalizedDesc),
          keywords: this.extractKeywords(normalizedDesc)
        };
        
        if (scores[0]?.confidence < minConfidence) {
          result.reason = `confidence (${scores[0].confidence.toFixed(2)}) below threshold (${minConfidence})`;
        }
        
        this.recordClassification(result);
        return result;
      }
      
      const result: ClassificationResult = {
        primaryType: scores[0].type,
        confidence: scores[0].confidence,
        keywords: this.extractKeywords(normalizedDesc)
      };
      
      if (options.includeAlternatives) {
        // Include all other scoring patterns as alternatives
        result.alternatives = scores.slice(1)
          .filter(s => s.confidence > 0.3) // Only include reasonable alternatives
          .map(s => ({
            type: s.type,
            confidence: s.confidence
          }));
      }
      
      this.recordClassification(result);
      return result;
    } catch (error) {
      logger.error('Failed to classify event type', {
        component: 'event-classifier',
        error: error instanceof Error ? error.message : error,
        description: description.substring(0, 100)
      });
      throw error;
    }
  }

  private scorePattern(text: string, pattern: CustomPattern): number {
    let matchCount = 0;
    let totalPatterns = pattern.patterns.length;
    
    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        matchCount++;
      }
    }
    
    // Check keywords
    let keywordMatches = 0;
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }
    
    // If neither patterns nor keywords match, return 0
    if (matchCount === 0 && keywordMatches === 0) {
      return 0;
    }
    
    // Calculate base score using a more generous formula
    let score = 0;
    
    if (matchCount > 0) {
      // Pattern matches get strong weight
      // Even a single strong pattern match should give good confidence
      const patternScore = Math.max(0.6, Math.min(1.0, matchCount / Math.max(1, totalPatterns - 4)));
      score = patternScore * pattern.confidence;
      
      // Boost for keyword support
      if (keywordMatches > 0) {
        const keywordBonus = Math.min(0.3, (keywordMatches / pattern.keywords.length) * 0.4);
        score += keywordBonus;
      }
      
      // Boost for multiple pattern matches
      if (matchCount > 1) {
        score += 0.15;
      }
    } else if (keywordMatches > 0) {
      // Keyword-only matches get lower but still meaningful confidence
      const keywordRatio = keywordMatches / pattern.keywords.length;
      score = Math.max(0.4, keywordRatio) * pattern.confidence * 0.7;
      
      // Boost for high keyword density
      if (keywordRatio > 0.3) {
        score += 0.2;
      }
    }
    
    // Ensure score doesn't exceed pattern confidence + reasonable bonus
    score = Math.min(score, pattern.confidence + 0.2);
    
    return score;
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const normalizedText = text.toLowerCase();
    
    // Extract keywords from all patterns
    const allPatterns = [...this.customPatterns.values(), ...Object.values(DEFAULT_PATTERNS)];
    
    for (const pattern of allPatterns) {
      for (const keyword of pattern.keywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          keywords.push(keyword);
        }
      }
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  private suggestCustomType(text: string): string {
    // Simple heuristic to suggest a custom type based on common words
    const words = text.split(/\s+/).filter(w => w.length > 4);
    if (words.length > 0) {
      return words[0].replace(/[^a-z]/gi, '') + '_event';
    }
    return 'custom_event';
  }

  async overrideClassification(
    description: string, 
    newType: string, 
    metadata: { reason?: string; userId?: string }
  ): Promise<void> {
    this.overrides.set(description, newType);
    if (metadata.reason) {
      this.overrideReasons.set(description, metadata.reason);
    }
    
    logger.info('Event classification overridden', {
      component: 'event-classifier',
      originalDescription: description.substring(0, 100),
      newType,
      reason: metadata.reason,
      userId: metadata.userId
    });
  }

  async addCustomPattern(pattern: CustomPattern): Promise<void> {
    this.customPatterns.set(pattern.name, pattern);
    
    logger.info('Custom pattern added', {
      component: 'event-classifier',
      patternName: pattern.name,
      patternCount: pattern.patterns.length,
      keywordCount: pattern.keywords.length
    });
  }

  async getClassificationStats(): Promise<ClassificationStats> {
    const typeDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    
    for (const classification of this.classificationHistory) {
      typeDistribution[classification.primaryType] = 
        (typeDistribution[classification.primaryType] || 0) + 1;
      totalConfidence += classification.confidence;
    }
    
    return {
      totalClassifications: this.classificationHistory.length,
      typeDistribution,
      averageConfidence: this.classificationHistory.length > 0 
        ? totalConfidence / this.classificationHistory.length 
        : 0
    };
  }

  async classifyBatch(
    events: Array<{ id: string; description: string }>,
    options: ClassificationOptions = {}
  ): Promise<BatchClassificationResult[]> {
    const results: BatchClassificationResult[] = [];
    
    for (const event of events) {
      try {
        if (!event.description || typeof event.description !== 'string') {
          results.push({
            id: event.id,
            error: { message: 'Invalid description: must be a non-empty string' }
          });
          continue;
        }
        
        const classification = await this.classifyEventType(event.description, options);
        results.push({
          id: event.id,
          classification
        });
      } catch (error) {
        if (options.continueOnError) {
          results.push({
            id: event.id,
            error: { 
              message: error instanceof Error ? error.message : 'Classification failed' 
            }
          });
        } else {
          throw error;
        }
      }
    }
    
    return results;
  }

  async suggestEventType(eventData: Partial<{ description: string }>): Promise<EventTypeSuggestion> {
    if (!eventData.description) {
      throw new Error('Description is required for event type suggestion');
    }
    
    const classification = await this.classifyEventType(eventData.description, {
      includeAlternatives: true
    });
    
    return {
      suggestedType: classification.primaryType,
      confidence: classification.confidence,
      alternatives: classification.alternatives || [],
      keywords: classification.keywords || []
    };
  }

  async validateEventTypeConsistency(
    eventType: string, 
    description: string
  ): Promise<ConsistencyValidation> {
    const classification = await this.classifyEventType(description);
    
    const isConsistent = classification.primaryType === eventType || 
                        classification.confidence < 0.5;
    
    if (!isConsistent) {
      return {
        isConsistent: false,
        suggestedType: classification.primaryType,
        confidence: classification.confidence,
        warning: `Description suggests ${classification.primaryType} but event type is ${eventType}`
      };
    }
    
    return { isConsistent: true };
  }

  private recordClassification(result: ClassificationResult): void {
    this.classificationHistory.push(result);
    
    // Keep only last 1000 classifications to prevent memory issues
    if (this.classificationHistory.length > 1000) {
      this.classificationHistory = this.classificationHistory.slice(-1000);
    }
  }
}

export default EventClassifierService;