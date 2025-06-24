import { DatabaseService } from '../database/sqlite';
import logger from '../config/logger';

export interface CustomerRecord {
  id: string;
  name: string;
  active: boolean;
  status?: string;
  segment?: string;
  region?: string;
  tier?: string;
  permissions?: string[];
}

export interface CustomerResolutionCriteria {
  segment?: string;
  regions?: string[];
  subscriptionTiers?: string[];
  combineWith?: 'AND' | 'OR';
}

export interface CustomerResolutionOptions {
  includeInactive?: boolean;
  statusFilter?: string[];
  requirePermissions?: string[];
}

export interface DataIntegrityIssue {
  customerId?: string;
  issue: string;
  field: string;
  value: any;
}

export interface PerformanceMetrics {
  queryTime: number;
  batchSize?: number;
  cacheHitRate?: number;
}

export interface CustomerResolutionResult {
  scope: 'all' | 'specific' | 'segment' | 'geographic' | 'subscription' | 'combined';
  customerIds: string[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  validIds?: string[];
  invalidIds?: string[];
  segmentName?: string;
  regionBreakdown?: Record<string, number>;
  tierBreakdown?: Record<string, number>;
  appliedCriteria?: string[];
  filteredCount?: number;
  excludedCount?: number;
  authorizedIds?: string[];
  unauthorizedIds?: string[];
  accessControlApplied?: boolean;
  dataIntegrityIssues?: DataIntegrityIssue[];
  malformedRecords?: any[];
  warnings?: string[];
  batchedQueries?: number;
  performanceMetrics?: PerformanceMetrics;
  fromCache?: boolean;
  concurrentRequestId?: string;
}

export class CustomerResolverService {
  private cache: Map<string, CustomerResolutionResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private batchSize = 10000;
  private concurrentRequests: Map<string, Promise<CustomerResolutionResult>> = new Map();

  private generateCacheKey(criteria: any): string {
    return JSON.stringify(criteria);
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private setCacheEntry(key: string, result: CustomerResolutionResult): void {
    this.cache.set(key, { ...result, fromCache: false });
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
    
    // Limit cache size
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheExpiry.delete(oldestKey);
    }
  }

  async resolveAffectedCustomers(
    criteria: 'all' | string[] | CustomerResolutionCriteria,
    options: CustomerResolutionOptions = {}
  ): Promise<CustomerResolutionResult> {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey({ criteria, options });
      if (this.isCacheValid(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        return { ...cached, fromCache: true, concurrentRequestId: requestId };
      }

      // Check for concurrent request
      if (this.concurrentRequests.has(cacheKey)) {
        const result = await this.concurrentRequests.get(cacheKey)!;
        return { ...result, concurrentRequestId: requestId };
      }

      // Create new request promise
      const requestPromise = this.performResolution(criteria, options, requestId);
      this.concurrentRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        this.setCacheEntry(cacheKey, result);
        return result;
      } finally {
        this.concurrentRequests.delete(cacheKey);
      }
    } catch (error) {
      logger.error('Failed to resolve affected customers', {
        component: 'customer-resolver',
        error: error instanceof Error ? error.message : error,
        criteria: JSON.stringify(criteria).substring(0, 200)
      });
      throw new Error(`Failed to resolve affected customers: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async performResolution(
    criteria: 'all' | string[] | CustomerResolutionCriteria,
    options: CustomerResolutionOptions,
    requestId: string
  ): Promise<CustomerResolutionResult> {
    const startTime = Date.now();
    const db = DatabaseService.getInstance();

    if (criteria === 'all') {
      return this.resolveAllCustomers(options, startTime, requestId);
    } else if (Array.isArray(criteria)) {
      return this.resolveSpecificCustomers(criteria, options, startTime, requestId);
    } else {
      return this.resolveCustomersByCriteria(criteria, options, startTime, requestId);
    }
  }

  private async resolveAllCustomers(
    options: CustomerResolutionOptions,
    startTime: number,
    requestId: string
  ): Promise<CustomerResolutionResult> {
    const db = DatabaseService.getInstance();
    let query = 'SELECT id, name, active, status, segment, region, tier, permissions FROM customers';
    const params: any[] = [];

    // Add filters
    const conditions: string[] = [];
    if (!options.includeInactive) {
      conditions.push('active = ?');
      params.push(true);
    }

    if (options.statusFilter && options.statusFilter.length > 0) {
      const placeholders = options.statusFilter.map(() => '?').join(',');
      conditions.push(`status IN (${placeholders})`);
      params.push(...options.statusFilter);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const customers = await db.all(query, params);
    const processedCustomers = this.processCustomerData(customers, options);
    const queryTime = Date.now() - startTime;

    // Apply additional filtering after data processing
    let filteredCustomers = processedCustomers.validCustomers;
    if (options.statusFilter && options.statusFilter.length > 0) {
      const originalCount = filteredCustomers.length;
      filteredCustomers = filteredCustomers.filter(c => 
        !c.status || options.statusFilter!.includes(c.status)
      );
    }

    const validIds = filteredCustomers.map(c => c.id);
    
    const result: CustomerResolutionResult = {
      scope: 'all',
      customerIds: validIds,
      totalCount: filteredCustomers.length,
      activeCount: filteredCustomers.filter(c => c.active).length,
      inactiveCount: filteredCustomers.filter(c => !c.active).length,
      validIds: validIds,
      filteredCount: options.statusFilter ? filteredCustomers.length : undefined,
      excludedCount: options.statusFilter ? processedCustomers.validCustomers.length - filteredCustomers.length : undefined,
      dataIntegrityIssues: processedCustomers.integrityIssues,
      malformedRecords: processedCustomers.malformedRecords,
      warnings: this.generateWarnings(processedCustomers),
      performanceMetrics: { queryTime },
      concurrentRequestId: requestId,
      fromCache: false
    };

    if (options.requirePermissions) {
      this.applyAccessControl(result, filteredCustomers, options.requirePermissions);
    }

    return result;
  }

  private async resolveSpecificCustomers(
    customerIds: string[],
    options: CustomerResolutionOptions,
    startTime: number,
    requestId: string
  ): Promise<CustomerResolutionResult> {
    const db = DatabaseService.getInstance();
    const batchedQueries = Math.ceil(customerIds.length / this.batchSize);
    const allCustomers: CustomerRecord[] = [];

    // Process in batches for large sets
    for (let i = 0; i < customerIds.length; i += this.batchSize) {
      const batch = customerIds.slice(i, i + this.batchSize);
      const placeholders = batch.map(() => '?').join(',');
      let query = `SELECT id, name, active, status, segment, region, tier, permissions 
                   FROM customers WHERE id IN (${placeholders})`;
      
      const params: any[] = [...batch];

      if (!options.includeInactive) {
        query += ' AND active = ?';
        params.push(true);
      }

      const batchCustomers = await db.all(query, params);
      allCustomers.push(...batchCustomers);
    }

    const processedCustomers = this.processCustomerData(allCustomers, options);
    const foundIds = processedCustomers.validCustomers.map(c => c.id);
    const invalidIds = customerIds.filter(id => !foundIds.includes(id));
    const queryTime = Date.now() - startTime;

    const result: CustomerResolutionResult = {
      scope: 'specific',
      customerIds: foundIds,
      totalCount: foundIds.length,
      activeCount: processedCustomers.validCustomers.filter(c => c.active).length,
      inactiveCount: processedCustomers.validCustomers.filter(c => !c.active).length,
      validIds: foundIds,
      invalidIds,
      dataIntegrityIssues: processedCustomers.integrityIssues,
      malformedRecords: processedCustomers.malformedRecords,
      warnings: this.generateWarnings(processedCustomers, { originalRequestCount: customerIds.length }),
      batchedQueries: batchedQueries > 1 ? batchedQueries : undefined,
      performanceMetrics: { 
        queryTime,
        batchSize: batchedQueries > 1 ? this.batchSize : undefined
      },
      concurrentRequestId: requestId,
      fromCache: false
    };

    if (options.requirePermissions) {
      this.applyAccessControl(result, processedCustomers.validCustomers, options.requirePermissions);
    }

    return result;
  }

  private async resolveCustomersByCriteria(
    criteria: CustomerResolutionCriteria,
    options: CustomerResolutionOptions,
    startTime: number,
    requestId: string
  ): Promise<CustomerResolutionResult> {
    const db = DatabaseService.getInstance();
    let query = 'SELECT id, name, active, status, segment, region, tier, permissions FROM customers';
    const params: any[] = [];
    const conditions: string[] = [];

    // Build query based on criteria
    if (criteria.segment) {
      conditions.push('segment = ?');
      params.push(criteria.segment);
    }

    if (criteria.regions && criteria.regions.length > 0) {
      const placeholders = criteria.regions.map(() => '?').join(',');
      conditions.push(`region IN (${placeholders})`);
      params.push(...criteria.regions);
    }

    if (criteria.subscriptionTiers && criteria.subscriptionTiers.length > 0) {
      const placeholders = criteria.subscriptionTiers.map(() => '?').join(',');
      conditions.push(`tier IN (${placeholders})`);
      params.push(...criteria.subscriptionTiers);
    }

    if (!options.includeInactive) {
      conditions.push('active = ?');
      params.push(true);
    }

    if (conditions.length > 0) {
      const operator = criteria.combineWith === 'OR' ? ' OR ' : ' AND ';
      query += ' WHERE ' + conditions.join(operator);
    }

    const customers = await db.all(query, params);
    const processedCustomers = this.processCustomerData(customers, options);
    const queryTime = Date.now() - startTime;

    // Determine scope
    let scope: CustomerResolutionResult['scope'] = 'combined';
    if (criteria.segment && !criteria.regions && !criteria.subscriptionTiers) scope = 'segment';
    else if (criteria.regions && !criteria.segment && !criteria.subscriptionTiers) scope = 'geographic';
    else if (criteria.subscriptionTiers && !criteria.segment && !criteria.regions) scope = 'subscription';

    const result: CustomerResolutionResult = {
      scope,
      customerIds: processedCustomers.validCustomers.map(c => c.id),
      totalCount: processedCustomers.validCustomers.length,
      activeCount: processedCustomers.validCustomers.filter(c => c.active).length,
      inactiveCount: processedCustomers.validCustomers.filter(c => !c.active).length,
      segmentName: criteria.segment,
      regionBreakdown: criteria.regions ? this.calculateRegionBreakdown(processedCustomers.validCustomers) : undefined,
      tierBreakdown: criteria.subscriptionTiers ? this.calculateTierBreakdown(processedCustomers.validCustomers) : undefined,
      appliedCriteria: this.getAppliedCriteria(criteria),
      dataIntegrityIssues: processedCustomers.integrityIssues,
      malformedRecords: processedCustomers.malformedRecords,
      warnings: this.generateWarnings(processedCustomers),
      performanceMetrics: { queryTime },
      concurrentRequestId: requestId,
      fromCache: false
    };

    if (options.requirePermissions) {
      this.applyAccessControl(result, processedCustomers.validCustomers, options.requirePermissions);
    }

    return result;
  }

  private processCustomerData(customers: any[], options: CustomerResolutionOptions) {
    const validCustomers: CustomerRecord[] = [];
    const integrityIssues: DataIntegrityIssue[] = [];
    const malformedRecords: any[] = [];

    for (const customer of customers) {
      // Check for malformed data
      if (!customer.id || typeof customer.id !== 'string') {
        malformedRecords.push(customer);
        integrityIssues.push({
          customerId: customer.id || 'unknown',
          issue: 'Missing customer ID',
          field: 'id',
          value: customer.id
        });
        continue;
      }

      if (!customer.name || typeof customer.name !== 'string' || customer.name.trim() === '') {
        integrityIssues.push({
          customerId: customer.id,
          issue: 'Missing customer name',
          field: 'name',
          value: customer.name
        });
      }

      if (customer.active === null || customer.active === undefined || typeof customer.active !== 'boolean') {
        integrityIssues.push({
          customerId: customer.id,
          issue: 'Invalid active status',
          field: 'active',
          value: customer.active
        });
      }

      // Only add to valid customers if basic fields are present and valid
      if (customer.id && 
          typeof customer.active === 'boolean' && 
          customer.name && 
          typeof customer.name === 'string' && 
          customer.name.trim() !== '') {
        // Parse permissions if it's a JSON string
        if (typeof customer.permissions === 'string') {
          try {
            customer.permissions = JSON.parse(customer.permissions);
          } catch {
            customer.permissions = [];
          }
        }

        validCustomers.push(customer as CustomerRecord);
      } else {
        malformedRecords.push(customer);
      }
    }

    return { validCustomers, integrityIssues, malformedRecords };
  }

  private applyAccessControl(
    result: CustomerResolutionResult,
    customers: CustomerRecord[],
    requiredPermissions: string[]
  ): void {
    const authorizedIds: string[] = [];
    const unauthorizedIds: string[] = [];

    for (const customer of customers) {
      const customerPermissions = customer.permissions || [];
      const hasRequiredPermissions = requiredPermissions.every(perm => 
        customerPermissions.includes(perm)
      );

      if (hasRequiredPermissions) {
        authorizedIds.push(customer.id);
      } else {
        unauthorizedIds.push(customer.id);
      }
    }

    result.authorizedIds = authorizedIds;
    result.unauthorizedIds = unauthorizedIds;
    result.accessControlApplied = true;
  }

  private calculateRegionBreakdown(customers: CustomerRecord[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const customer of customers) {
      if (customer.region) {
        breakdown[customer.region] = (breakdown[customer.region] || 0) + 1;
      }
    }
    return breakdown;
  }

  private calculateTierBreakdown(customers: CustomerRecord[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const customer of customers) {
      if (customer.tier) {
        breakdown[customer.tier] = (breakdown[customer.tier] || 0) + 1;
      }
    }
    return breakdown;
  }

  private getAppliedCriteria(criteria: CustomerResolutionCriteria): string[] {
    const applied: string[] = [];
    if (criteria.segment) applied.push('segment');
    if (criteria.regions) applied.push('regions');
    if (criteria.subscriptionTiers) applied.push('subscriptionTiers');
    return applied;
  }

  private generateWarnings(processedCustomers: any, context?: { originalRequestCount?: number }): string[] {
    const warnings: string[] = [];
    
    // If we had an original request but no valid customers found
    if (context?.originalRequestCount && context.originalRequestCount > 0 && processedCustomers.validCustomers.length === 0) {
      warnings.push('No valid customer IDs found');
    } else if (processedCustomers.validCustomers.length === 0) {
      warnings.push('No customers found in database');
    }
    
    if (processedCustomers.malformedRecords.length > 0) {
      warnings.push('Found malformed customer records');
    }
    
    if (processedCustomers.integrityIssues.length > 0) {
      warnings.push(`Found ${processedCustomers.integrityIssues.length} data integrity issues`);
    }
    
    return warnings;
  }
}

export default CustomerResolverService;