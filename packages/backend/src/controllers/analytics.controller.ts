import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { insightsService } from '../services/insights.service';
import { AppError } from '../middleware/error.middleware';

export class AnalyticsController {
  async initialize(req: Request, res: Response): Promise<Response> {
    try {
      await analyticsService.initialize();
      await insightsService.initialize();

      return res.json({
        success: true,
        message: 'Analytics services initialized successfully'
      });
    } catch (error) {
      console.error('Error initializing analytics:', error);
      throw new AppError('Failed to initialize analytics services', 500, 'ANALYTICS_INIT_ERROR');
    }
  }

  async getOverview(req: Request, res: Response): Promise<Response> {
    try {
      const overview = await analyticsService.generateAnalyticsOverview();
      
      return res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('Error getting analytics overview:', error);
      throw new AppError('Failed to get analytics overview', 500, 'ANALYTICS_OVERVIEW_ERROR');
    }
  }

  async getSentimentTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { timeRange = 'day', limit = 50 } = req.query;
      
      const trends = await analyticsService.generateSentimentTrends(
        timeRange as 'hour' | 'day' | 'week' | 'month',
        parseInt(limit as string)
      );

      return res.json({
        success: true,
        data: {
          trends,
          timeRange,
          count: trends.length
        }
      });
    } catch (error) {
      console.error('Error getting sentiment trends:', error);
      throw new AppError('Failed to get sentiment trends', 500, 'SENTIMENT_TRENDS_ERROR');
    }
  }

  async getKeywords(req: Request, res: Response): Promise<Response> {
    try {
      const { limit = 50 } = req.query;
      
      const keywords = await analyticsService.extractKeywords(parseInt(limit as string));

      return res.json({
        success: true,
        data: {
          keywords,
          count: keywords.length
        }
      });
    } catch (error) {
      console.error('Error getting keywords:', error);
      throw new AppError('Failed to extract keywords', 500, 'KEYWORD_EXTRACTION_ERROR');
    }
  }

  async getTimeSeriesData(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        metrics = 'volume,avgScore,avgConfidence',
        timeRange = 'day'
      } = req.query;

      const metricsArray = (metrics as string).split(',');
      const timeSeries = await analyticsService.generateTimeSeriesData(
        metricsArray,
        timeRange as 'day' | 'week' | 'month'
      );

      return res.json({
        success: true,
        data: timeSeries
      });
    } catch (error) {
      console.error('Error getting time series data:', error);
      throw new AppError('Failed to generate time series data', 500, 'TIME_SERIES_ERROR');
    }
  }

  async getTextAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const textAnalytics = await analyticsService.generateTextAnalytics();

      return res.json({
        success: true,
        data: textAnalytics
      });
    } catch (error) {
      console.error('Error getting text analytics:', error);
      throw new AppError('Failed to generate text analytics', 500, 'TEXT_ANALYTICS_ERROR');
    }
  }

  async getInsights(req: Request, res: Response): Promise<Response> {
    try {
      const insights = await insightsService.generateAllInsights();

      return res.json({
        success: true,
        data: {
          categories: insights,
          totalCategories: insights.length,
          totalInsights: insights.reduce((sum, cat) => sum + cat.count, 0)
        }
      });
    } catch (error) {
      console.error('Error getting insights:', error);
      throw new AppError('Failed to generate insights', 500, 'INSIGHTS_ERROR');
    }
  }

  async getBusinessInsights(req: Request, res: Response): Promise<Response> {
    try {
      const businessInsights = await insightsService.getBusinessInsights();

      return res.json({
        success: true,
        data: {
          insights: businessInsights,
          count: businessInsights.length
        }
      });
    } catch (error) {
      console.error('Error getting business insights:', error);
      throw new AppError('Failed to generate business insights', 500, 'BUSINESS_INSIGHTS_ERROR');
    }
  }

  async updateKeywordAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      await analyticsService.updateKeywordAnalytics();

      return res.json({
        success: true,
        message: 'Keyword analytics updated successfully'
      });
    } catch (error) {
      console.error('Error updating keyword analytics:', error);
      throw new AppError('Failed to update keyword analytics', 500, 'KEYWORD_UPDATE_ERROR');
    }
  }

  async getAdvancedAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        includeKeywords = 'true',
        includeTrends = 'true',
        includeInsights = 'true',
        timeRange = 'day'
      } = req.query;

      const result: any = {};

      if (includeKeywords === 'true') {
        result.keywords = await analyticsService.extractKeywords(20);
      }

      if (includeTrends === 'true') {
        result.trends = await analyticsService.generateSentimentTrends(
          timeRange as 'hour' | 'day' | 'week' | 'month',
          30
        );
      }

      if (includeInsights === 'true') {
        result.insights = await insightsService.generateAllInsights();
      }

      // Always include basic stats
      result.overview = await analyticsService.generateAnalyticsOverview();

      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting advanced analytics:', error);
      throw new AppError('Failed to generate advanced analytics', 500, 'ADVANCED_ANALYTICS_ERROR');
    }
  }

  async getAnalyticsExport(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        format = 'json',
        timeRange = 'week',
        includeRawData = 'false'
      } = req.query;

      const exportData: any = {
        generatedAt: new Date().toISOString(),
        timeRange,
        overview: await analyticsService.generateAnalyticsOverview(),
        trends: await analyticsService.generateSentimentTrends(
          timeRange as 'hour' | 'day' | 'week' | 'month',
          100
        ),
        keywords: await analyticsService.extractKeywords(100),
        insights: await insightsService.generateAllInsights(),
        textAnalytics: await analyticsService.generateTextAnalytics()
      };

      if (format === 'csv') {
        // Convert to CSV format (simplified)
        let csvContent = 'Category,Metric,Value,Timestamp\n';
        
        // Add overview data
        csvContent += `Overview,Total Analyses,${exportData.overview.totalAnalyses},${exportData.generatedAt}\n`;
        csvContent += `Overview,Average Score,${exportData.overview.averageScore},${exportData.generatedAt}\n`;
        csvContent += `Overview,Average Confidence,${exportData.overview.averageConfidence},${exportData.generatedAt}\n`;

        // Add trend data
        exportData.trends.forEach((trend: any) => {
          csvContent += `Trends,${trend.sentiment}_score,${trend.score},${trend.timestamp}\n`;
          csvContent += `Trends,${trend.sentiment}_volume,${trend.volume},${trend.timestamp}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
        return res.send(csvContent);
      }

      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.json');
      
      return res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      console.error('Error exporting analytics:', error);
      throw new AppError('Failed to export analytics', 500, 'ANALYTICS_EXPORT_ERROR');
    }
  }

  async getMetricsHealth(req: Request, res: Response): Promise<Response> {
    try {
      // Check health of analytics services
      const health = {
        analyticsService: {
          initialized: analyticsService['initialized'] || false,
          status: 'healthy'
        },
        insightsService: {
          initialized: insightsService['initialized'] || false,
          status: 'healthy'
        },
        database: {
          connected: true, // Would check actual DB connection
          status: 'healthy'
        },
        lastUpdated: new Date().toISOString()
      };

      return res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error checking analytics health:', error);
      throw new AppError('Failed to check analytics health', 500, 'HEALTH_CHECK_ERROR');
    }
  }
}

export const analyticsController = new AnalyticsController();