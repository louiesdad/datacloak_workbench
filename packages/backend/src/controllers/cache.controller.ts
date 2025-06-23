import { Request, Response, NextFunction } from 'express';
import { getCacheService, ICacheService } from '../services/cache.service';
import { SentimentService } from '../services/sentiment.service';
import { SecurityService } from '../services/security.service';
import { AppError } from '../middleware/error.middleware';

export class CacheController {
  private cacheService: ICacheService;
  private sentimentService: SentimentService;
  private securityService: SecurityService;

  constructor() {
    this.cacheService = getCacheService();
    this.sentimentService = new SentimentService();
    this.securityService = new SecurityService();
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      const config = this.cacheService.getConfig();
      
      // Get memory usage for memory cache
      let memoryUsage: any = {};
      if (config.type === 'memory') {
        const keys = await this.cacheService.keys();
        memoryUsage = {
          totalKeys: keys.length,
          estimatedSize: `${Math.round(keys.length * 0.5)}KB` // Rough estimate
        };
      }

      res.json({
        success: true,
        data: {
          ...stats,
          cacheType: config.type,
          enabled: config.enabled,
          memoryUsage,
          performance: {
            hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
            totalOperations: stats.totalOperations,
            efficiency: stats.totalOperations > 0 ? 'Good' : 'No data'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = this.cacheService.getConfig();
      
      res.json({
        success: true,
        data: {
          enabled: config.enabled,
          type: config.type,
          defaultTTL: config.defaultTTL,
          maxMemoryUsage: config.maxMemoryUsage,
          compressionThreshold: config.compressionThreshold,
          redis: config.redis ? {
            host: config.redis.host,
            port: config.redis.port,
            db: config.redis.db,
            keyPrefix: config.redis.keyPrefix
          } : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern = '*' } = req.query;
      const keys = await this.cacheService.keys(pattern as string);
      
      // Group keys by type for better organization
      const keysByType = {
        sentiment: keys.filter(key => key.startsWith('sentiment:')),
        pii: keys.filter(key => key.startsWith('pii:')),
        other: keys.filter(key => !key.startsWith('sentiment:') && !key.startsWith('pii:'))
      };

      res.json({
        success: true,
        data: {
          total: keys.length,
          pattern,
          keys,
          groupedKeys: keysByType
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const value = await this.cacheService.get(key);
      
      if (value === null) {
        throw new AppError('Cache key not found', 404, 'CACHE_KEY_NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          key,
          value,
          type: typeof value,
          size: JSON.stringify(value).length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async setValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, value, ttl } = req.body;
      const options = ttl ? { ttl } : {};
      
      const success = await this.cacheService.set(key, value, options);
      
      if (!success) {
        throw new AppError('Failed to set cache value', 500, 'CACHE_SET_FAILED');
      }

      res.json({
        success: true,
        message: 'Cache value set successfully',
        data: { key, ttl: ttl || 'default' }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const deleted = await this.cacheService.del(key);
      
      if (!deleted) {
        throw new AppError('Cache key not found', 404, 'CACHE_KEY_NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Cache key deleted successfully',
        data: { key }
      });
    } catch (error) {
      next(error);
    }
  }

  async keyExists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const exists = await this.cacheService.has(key);
      
      if (exists) {
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    } catch (error) {
      next(error);
    }
  }

  async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cleared = await this.cacheService.clear();
      
      if (!cleared) {
        throw new AppError('Failed to clear cache', 500, 'CACHE_CLEAR_FAILED');
      }

      res.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async cleanup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern, olderThanMinutes } = req.body;
      let removedCount = 0;

      if (pattern) {
        // Remove keys matching pattern
        const keys = await this.cacheService.keys(pattern);
        for (const key of keys) {
          await this.cacheService.del(key);
          removedCount++;
        }
      } else if (olderThanMinutes) {
        // For memory cache, we can't determine age without additional metadata
        // This would need to be implemented in the cache service
        throw new AppError('Time-based cleanup not implemented for current cache type', 400, 'CLEANUP_NOT_SUPPORTED');
      } else {
        throw new AppError('Either pattern or olderThanMinutes must be specified', 400, 'INVALID_CLEANUP_PARAMS');
      }

      res.json({
        success: true,
        message: `Cache cleanup completed. Removed ${removedCount} keys.`,
        data: { removedCount, pattern }
      });
    } catch (error) {
      next(error);
    }
  }

  async getPerformanceMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      const config = this.cacheService.getConfig();
      
      // Calculate performance metrics
      const hitRate = stats.totalOperations > 0 ? stats.hits / stats.totalOperations : 0;
      const missRate = stats.totalOperations > 0 ? stats.misses / stats.totalOperations : 0;
      
      // Performance evaluation
      let performanceGrade = 'A';
      if (hitRate < 0.5) performanceGrade = 'D';
      else if (hitRate < 0.7) performanceGrade = 'C';
      else if (hitRate < 0.85) performanceGrade = 'B';

      const recommendations: string[] = [];
      if (hitRate < 0.7) {
        recommendations.push('Consider increasing cache TTL for frequently accessed data');
      }
      if (stats.errors > stats.totalOperations * 0.01) {
        recommendations.push('High error rate detected - check cache service health');
      }
      if (config.type === 'memory' && !config.enabled) {
        recommendations.push('Enable caching to improve performance');
      }

      res.json({
        success: true,
        data: {
          overall: {
            grade: performanceGrade,
            hitRate: `${(hitRate * 100).toFixed(2)}%`,
            missRate: `${(missRate * 100).toFixed(2)}%`,
            errorRate: `${(stats.errors / Math.max(stats.totalOperations, 1) * 100).toFixed(2)}%`
          },
          operations: {
            hits: stats.hits,
            misses: stats.misses,
            sets: stats.sets,
            deletes: stats.deletes,
            errors: stats.errors,
            total: stats.totalOperations
          },
          recommendations,
          cacheType: config.type,
          enabled: config.enabled
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      const keys = await this.cacheService.keys();
      
      // Analyze key patterns
      const keyAnalysis = {
        sentimentKeys: keys.filter(k => k.startsWith('sentiment:')).length,
        piiKeys: keys.filter(k => k.startsWith('pii:')).length,
        otherKeys: keys.filter(k => !k.startsWith('sentiment:') && !k.startsWith('pii:')).length
      };

      // Calculate trends (mock data for now)
      const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        hits: Math.floor(Math.random() * 100),
        misses: Math.floor(Math.random() * 50),
        sets: Math.floor(Math.random() * 30)
      }));

      const topQueries = [
        { type: 'sentiment', count: Math.floor(stats.hits * 0.4), hitRate: 0.85 },
        { type: 'pii_detection', count: Math.floor(stats.hits * 0.35), hitRate: 0.92 },
        { type: 'masking', count: Math.floor(stats.hits * 0.25), hitRate: 0.78 }
      ];

      res.json({
        success: true,
        data: {
          summary: {
            totalKeys: keys.length,
            hitRate: stats.hitRate,
            totalOperations: stats.totalOperations
          },
          keyAnalysis,
          hourlyTrends: hourlyStats,
          topQueries,
          efficiency: {
            cacheUtilization: Math.min(100, (keys.length / 1000) * 100), // Assume 1000 is optimal
            avgResponseTime: '12ms', // Mock data
            memoryEfficiency: '85%' // Mock data
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async invalidatePattern(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern, reason } = req.body;
      const keys = await this.cacheService.keys(pattern);
      
      let invalidatedCount = 0;
      for (const key of keys) {
        const deleted = await this.cacheService.del(key);
        if (deleted) invalidatedCount++;
      }

      // Log invalidation event
      console.log(`Cache invalidation: ${invalidatedCount} keys matching '${pattern}' ${reason ? `(${reason})` : ''}`);

      res.json({
        success: true,
        message: `Invalidated ${invalidatedCount} cache entries`,
        data: {
          pattern,
          invalidatedCount,
          reason: reason || 'Manual invalidation',
          keys: keys.slice(0, 10) // Show first 10 keys for reference
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async warmupCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { queries } = req.body;
      const results: Array<{
        type: any;
        status: string;
        cached?: boolean;
        error?: string;
      }> = [];

      for (const query of queries) {
        try {
          let result;
          
          switch (query.type) {
            case 'sentiment':
              result = await this.sentimentService.analyzeSentiment(
                query.data.text,
                query.data.enablePIIMasking !== false,
                query.data.model || 'basic'
              );
              break;
              
            case 'pii_detection':
              result = await this.securityService.detectPII(query.data.text);
              break;
              
            case 'masking':
              result = await this.securityService.maskText(
                query.data.text,
                query.data.options
              );
              break;
              
            default:
              throw new Error(`Unsupported query type: ${query.type}`);
          }

          results.push({
            type: query.type,
            status: 'success',
            cached: true
          });
        } catch (error) {
          results.push({
            type: query.type,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      
      res.json({
        success: true,
        message: `Cache warmup completed. ${successCount}/${queries.length} queries successful.`,
        data: {
          total: queries.length,
          successful: successCount,
          failed: queries.length - successCount,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }
}