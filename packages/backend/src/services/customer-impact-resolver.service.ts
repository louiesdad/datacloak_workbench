import { DatabaseService } from '../database/sqlite';
import { BusinessEventService, BusinessEvent } from './business-event.service';
import logger from '../config/logger';

export interface CustomerScopeResult {
  eventId: string;
  scopeType: 'specific' | 'all';
  affectedCustomers: string[] | 'all';
  totalAffectedCount: number;
  isAllCustomers: boolean;
  percentageOfTotal: number;
  validatedCustomers?: string[];
  invalidCustomers?: string[];
  validationWarnings?: string[];
  fromCache?: boolean;
  processingMetrics?: {
    batchCount: number;
    processingTime: number;
    cacheHit: boolean;
  };
}

export interface CustomerDetails {
  customerId: string;
  name: string;
  email: string;
  segment: string;
  createdAt: string;
}

export interface SegmentDistribution {
  [segment: string]: {
    count: number;
    percentage: number;
  };
}

export interface ImpactMetrics {
  eventId: string;
  totalCustomers: number;
  affectedCustomers: number;
  impactPercentage: number;
  impactScope: 'limited' | 'moderate' | 'significant' | 'universal';
  customerSegments: SegmentDistribution;
  estimatedReach: number;
}

export interface ImpactScopeClassification {
  scope: 'limited' | 'moderate' | 'significant' | 'universal';
  description: string;
  percentage: number;
}

export interface CustomerReachEstimate {
  directlyAffected: number;
  estimatedSecondaryReach: number;
  totalEstimatedReach: number;
  confidenceLevel: number;
  methodology: string;
}

export interface ActivityGrouping {
  high_activity: string[];
  medium_activity: string[];
  low_activity: string[];
}

export interface VipAnalysis {
  vipCustomers: string[];
  vipCount: number;
  vipPercentage: number;
  totalVipValue: number;
  averageVipValue: number;
}

export interface ResolverOptions {
  validateCustomers?: boolean;
  batchSize?: number;
  parallel?: boolean;
  useCache?: boolean;
  cacheTimeout?: number;
}

export class CustomerImpactResolverService {
  private databaseService: DatabaseService;
  private businessEventService: BusinessEventService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
  private readonly DEFAULT_BATCH_SIZE = 1000;

  constructor(databaseService: DatabaseService, businessEventService: BusinessEventService) {
    this.databaseService = databaseService;
    this.businessEventService = businessEventService;
  }

  async resolveCustomerScope(eventId: string, options: ResolverOptions = {}): Promise<CustomerScopeResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `scope:${eventId}:${JSON.stringify(options)}`;
      if (options.useCache !== false) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          cached.fromCache = true;
          return cached;
        }
      }

      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      let result: CustomerScopeResult;

      if (event.affectedCustomers === 'all') {
        result = await this.resolveAllCustomers(eventId);
      } else if (Array.isArray(event.affectedCustomers)) {
        result = await this.resolveSpecificCustomers(eventId, event.affectedCustomers, options);
      } else {
        throw new Error(`Invalid affectedCustomers format for event: ${eventId}`);
      }

      // Add processing metrics
      const processingTime = Date.now() - startTime;
      result.processingMetrics = {
        batchCount: Math.ceil((result.totalAffectedCount || 0) / (options.batchSize || this.DEFAULT_BATCH_SIZE)),
        processingTime,
        cacheHit: false
      };

      // Cache the result
      if (options.useCache !== false) {
        this.setCache(cacheKey, result, options.cacheTimeout || this.DEFAULT_CACHE_TTL);
      }

      logger.info('Customer scope resolved successfully', {
        component: 'customer-impact-resolver',
        eventId,
        scopeType: result.scopeType,
        affectedCount: result.totalAffectedCount,
        processingTime
      });

      return result;
    } catch (error) {
      logger.error('Failed to resolve customer scope', {
        component: 'customer-impact-resolver',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private async resolveAllCustomers(eventId: string): Promise<CustomerScopeResult> {
    // Get total customer count
    const countResult = await this.databaseService.query(
      'SELECT COUNT(*) as total FROM customers WHERE deleted_at IS NULL',
      []
    );
    
    const totalCount = countResult[0]?.total || 0;

    return {
      eventId,
      scopeType: 'all',
      affectedCustomers: 'all',
      totalAffectedCount: totalCount,
      isAllCustomers: true,
      percentageOfTotal: 100.0
    };
  }

  private async resolveSpecificCustomers(
    eventId: string, 
    customerIds: string[], 
    options: ResolverOptions
  ): Promise<CustomerScopeResult> {
    let validatedCustomers = customerIds;
    let invalidCustomers: string[] = [];
    let validationWarnings: string[] = [];

    // Validate customers if requested
    if (options.validateCustomers) {
      const validation = await this.validateCustomerIds(customerIds);
      validatedCustomers = validation.valid;
      invalidCustomers = validation.invalid;
      
      if (invalidCustomers.length > 0) {
        validationWarnings.push(`${invalidCustomers.length} customer ID(s) not found in database`);
      }
    }

    // Get total customer count for percentage calculation
    const totalCountResult = await this.databaseService.query(
      'SELECT COUNT(*) as total FROM customers WHERE deleted_at IS NULL',
      []
    );
    const totalCustomers = totalCountResult[0]?.total || 0;
    
    const affectedCount = validatedCustomers.length;
    const percentage = totalCustomers > 0 ? (affectedCount / totalCustomers) * 100 : 0;

    const result: CustomerScopeResult = {
      eventId,
      scopeType: 'specific',
      affectedCustomers: customerIds,
      totalAffectedCount: affectedCount,
      isAllCustomers: false,
      percentageOfTotal: parseFloat(percentage.toFixed(2))
    };

    if (options.validateCustomers) {
      result.validatedCustomers = validatedCustomers;
      result.invalidCustomers = invalidCustomers;
      result.validationWarnings = validationWarnings;
    }

    return result;
  }

  private async validateCustomerIds(customerIds: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    if (customerIds.length === 0) {
      return { valid: [], invalid: [] };
    }

    const placeholders = customerIds.map(() => '?').join(',');
    const sql = `SELECT customer_id FROM customers WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL`;
    
    const existingCustomers = await this.databaseService.query(sql, customerIds);
    const existingIds = existingCustomers.map((row: any) => row.customer_id);
    
    const invalid = customerIds.filter(id => !existingIds.includes(id));
    
    return {
      valid: existingIds,
      invalid
    };
  }

  async getCustomerDetails(customerIds: string[]): Promise<CustomerDetails[]> {
    if (customerIds.length === 0) {
      return [];
    }

    try {
      const placeholders = customerIds.map(() => '?').join(',');
      const sql = `
        SELECT customer_id, name, email, segment, created_at 
        FROM customers 
        WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL
        ORDER BY customer_id
      `;

      const customers = await this.databaseService.query(sql, customerIds);
      
      return customers.map((customer: any) => ({
        customerId: customer.customer_id,
        name: customer.name,
        email: customer.email,
        segment: customer.segment,
        createdAt: customer.created_at
      }));
    } catch (error) {
      logger.error('Failed to get customer details', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async getSegmentDistribution(customerIds: string[]): Promise<SegmentDistribution> {
    if (customerIds.length === 0) {
      return {};
    }

    try {
      const placeholders = customerIds.map(() => '?').join(',');
      const sql = `
        SELECT segment, COUNT(*) as count 
        FROM customers 
        WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL
        GROUP BY segment
      `;

      const segments = await this.databaseService.query(sql, customerIds);
      const total = customerIds.length;
      
      const distribution: SegmentDistribution = {};
      
      for (const segment of segments) {
        const percentage = total > 0 ? (segment.count / total) * 100 : 0;
        distribution[segment.segment] = {
          count: segment.count,
          percentage: parseFloat(percentage.toFixed(2))
        };
      }

      return distribution;
    } catch (error) {
      logger.error('Failed to get segment distribution', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async calculateImpactMetrics(eventId: string): Promise<ImpactMetrics> {
    try {
      const scope = await this.resolveCustomerScope(eventId);
      
      // Get total customer count
      const totalCountResult = await this.databaseService.query(
        'SELECT COUNT(*) as total FROM customers WHERE deleted_at IS NULL',
        []
      );
      const totalCustomers = totalCountResult[0]?.total || 0;

      let affectedCount: number;
      let customerSegments: SegmentDistribution = {};

      if (scope.scopeType === 'all') {
        affectedCount = totalCustomers;
        // Get all segments distribution
        const allSegments = await this.databaseService.query(
          'SELECT segment, COUNT(*) as count FROM customers WHERE deleted_at IS NULL GROUP BY segment',
          []
        );
        for (const segment of allSegments) {
          const percentage = totalCustomers > 0 ? (segment.count / totalCustomers) * 100 : 0;
          customerSegments[segment.segment] = {
            count: segment.count,
            percentage: parseFloat(percentage.toFixed(2))
          };
        }
      } else {
        affectedCount = scope.totalAffectedCount;
        customerSegments = await this.getSegmentDistribution(scope.affectedCustomers as string[]);
      }

      const impactPercentage = totalCustomers > 0 ? (affectedCount / totalCustomers) * 100 : 0;
      const impactScope = this.determineImpactScope(impactPercentage);

      // Estimate reach (simple multiplier for now)
      const estimatedReach = Math.round(affectedCount * 1.2); // 20% additional reach through referrals

      return {
        eventId,
        totalCustomers,
        affectedCustomers: affectedCount,
        impactPercentage: parseFloat(impactPercentage.toFixed(2)),
        impactScope,
        customerSegments,
        estimatedReach
      };
    } catch (error) {
      logger.error('Failed to calculate impact metrics', {
        component: 'customer-impact-resolver',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private determineImpactScope(percentage: number): 'limited' | 'moderate' | 'significant' | 'universal' {
    if (percentage >= 100) return 'universal';
    if (percentage > 25) return 'significant';
    if (percentage > 5) return 'moderate';
    return 'limited';
  }

  async classifyImpactScope(affectedCount: number | 'all', totalCustomers: number): Promise<ImpactScopeClassification> {
    if (affectedCount === 'all') {
      return {
        scope: 'universal',
        description: 'Universal impact affecting all customers',
        percentage: 100.0
      };
    }

    const percentage = totalCustomers > 0 ? (affectedCount / totalCustomers) * 100 : 0;
    const scope = this.determineImpactScope(percentage);

    const descriptions = {
      limited: 'Limited impact affecting a small subset of customers',
      moderate: 'Moderate impact affecting a notable portion of customers',
      significant: 'Significant impact affecting a large portion of customers',
      universal: 'Universal impact affecting all customers'
    };

    return {
      scope,
      description: descriptions[scope],
      percentage: parseFloat(percentage.toFixed(2))
    };
  }

  async estimateCustomerReach(customerIds: string[]): Promise<CustomerReachEstimate> {
    try {
      if (customerIds.length === 0) {
        return {
          directlyAffected: 0,
          estimatedSecondaryReach: 0,
          totalEstimatedReach: 0,
          confidenceLevel: 1.0,
          methodology: 'interaction_based'
        };
      }

      // Get historical interaction data
      const placeholders = customerIds.map(() => '?').join(',');
      const sql = `
        SELECT customer_id, 
               COALESCE(avg_monthly_interactions, 5) as avg_monthly_interactions
        FROM customers 
        WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL
      `;

      const interactions = await this.databaseService.query(sql, customerIds);
      
      const directlyAffected = customerIds.length;
      
      // Calculate secondary reach based on interaction patterns
      const totalInteractions = interactions.reduce((sum: number, customer: any) => 
        sum + customer.avg_monthly_interactions, 0);
      const avgInteractions = totalInteractions / Math.max(interactions.length, 1);
      
      // Estimate secondary reach (people influenced by affected customers)
      const reachMultiplier = Math.min(2.5, 1 + (avgInteractions / 20)); // Max 2.5x reach
      const estimatedSecondaryReach = Math.round(directlyAffected * (reachMultiplier - 1));
      
      const totalEstimatedReach = directlyAffected + estimatedSecondaryReach;
      
      // Confidence based on data quality
      const confidenceLevel = Math.min(0.95, 0.5 + (interactions.length / customerIds.length) * 0.45);

      return {
        directlyAffected,
        estimatedSecondaryReach,
        totalEstimatedReach,
        confidenceLevel: parseFloat(confidenceLevel.toFixed(2)),
        methodology: 'interaction_based'
      };
    } catch (error) {
      logger.error('Failed to estimate customer reach', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async filterCustomersBySegment(customerIds: string[], segments: string[]): Promise<string[]> {
    if (customerIds.length === 0 || segments.length === 0) {
      return [];
    }

    try {
      const customerPlaceholders = customerIds.map(() => '?').join(',');
      const segmentPlaceholders = segments.map(() => '?').join(',');
      
      const sql = `
        SELECT customer_id 
        FROM customers 
        WHERE customer_id IN (${customerPlaceholders}) 
          AND segment IN (${segmentPlaceholders})
          AND deleted_at IS NULL
        ORDER BY customer_id
      `;

      const filteredCustomers = await this.databaseService.query(sql, [...customerIds, ...segments]);
      return filteredCustomers.map((customer: any) => customer.customer_id);
    } catch (error) {
      logger.error('Failed to filter customers by segment', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        segments: segments.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async groupCustomersByActivity(customerIds: string[]): Promise<ActivityGrouping> {
    if (customerIds.length === 0) {
      return {
        high_activity: [],
        medium_activity: [],
        low_activity: []
      };
    }

    try {
      const placeholders = customerIds.map(() => '?').join(',');
      const sql = `
        SELECT customer_id, 
               last_activity, 
               COALESCE(activity_score, 0) as activity_score
        FROM customers 
        WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL
      `;

      const customers = await this.databaseService.query(sql, customerIds);
      
      const grouping: ActivityGrouping = {
        high_activity: [],
        medium_activity: [],
        low_activity: []
      };

      for (const customer of customers) {
        const score = customer.activity_score;
        if (score >= 75) {
          grouping.high_activity.push(customer.customer_id);
        } else if (score >= 50) {
          grouping.medium_activity.push(customer.customer_id);
        } else {
          grouping.low_activity.push(customer.customer_id);
        }
      }

      return grouping;
    } catch (error) {
      logger.error('Failed to group customers by activity', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async identifyVipCustomers(customerIds: string[]): Promise<VipAnalysis> {
    if (customerIds.length === 0) {
      return {
        vipCustomers: [],
        vipCount: 0,
        vipPercentage: 0,
        totalVipValue: 0,
        averageVipValue: 0
      };
    }

    try {
      const placeholders = customerIds.map(() => '?').join(',');
      const sql = `
        SELECT customer_id, 
               is_vip, 
               COALESCE(lifetime_value, 0) as lifetime_value
        FROM customers 
        WHERE customer_id IN (${placeholders}) AND deleted_at IS NULL
      `;

      const customers = await this.databaseService.query(sql, customerIds);
      
      const vipCustomers = customers
        .filter((customer: any) => customer.is_vip)
        .map((customer: any) => customer.customer_id);
      
      const vipCount = vipCustomers.length;
      const vipPercentage = customerIds.length > 0 ? (vipCount / customerIds.length) * 100 : 0;
      
      const totalVipValue = customers
        .filter((customer: any) => customer.is_vip)
        .reduce((sum: number, customer: any) => sum + customer.lifetime_value, 0);
      
      const averageVipValue = vipCount > 0 ? totalVipValue / vipCount : 0;

      return {
        vipCustomers,
        vipCount,
        vipPercentage: parseFloat(vipPercentage.toFixed(2)),
        totalVipValue,
        averageVipValue: parseFloat(averageVipValue.toFixed(2))
      };
    } catch (error) {
      logger.error('Failed to identify VIP customers', {
        component: 'customer-impact-resolver',
        customerCount: customerIds.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async invalidateCache(eventId?: string): Promise<void> {
    if (eventId) {
      // Invalidate specific event cache entries
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(eventId));
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      
      logger.debug('Cache invalidated for event', {
        component: 'customer-impact-resolver',
        eventId,
        invalidatedKeys: keysToDelete.length
      });
    } else {
      // Clear all cache
      this.cache.clear();
      
      logger.debug('All cache cleared', {
        component: 'customer-impact-resolver'
      });
    }
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.timestamp + cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
}

export default CustomerImpactResolverService;