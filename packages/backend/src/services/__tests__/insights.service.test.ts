import { InsightsService } from '../insights.service';
import { getSQLiteConnection } from '../../database/sqlite-refactored';
import { analyticsService } from '../analytics.service';

// Mock dependencies
jest.mock('../../database/sqlite-refactored');
jest.mock('../analytics.service', () => ({
  analyticsService: {
    getPerformanceMetrics: jest.fn()
  }
}));

const mockDb = {
  prepare: jest.fn().mockReturnThis(),
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  exec: jest.fn(),
  close: jest.fn()
};

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSQLiteConnection as jest.Mock).mockReturnValue(mockDb);
    service = new InsightsService();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service['initialized']).toBe(true);
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();
      expect(service['initialized']).toBe(true);
    });
  });

  describe('generateAllInsights', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should generate insights from all categories', async () => {
      // Mock sentiment trends data
      mockDb.all.mockResolvedValueOnce([
        { date: '2023-01-01', avg_score: 0.7 },
        { date: '2023-01-02', avg_score: 0.8 },
        { date: '2023-01-03', avg_score: 0.6 },
        { date: '2023-01-04', avg_score: 0.4 },
        { date: '2023-01-05', avg_score: 0.3 }
      ]);

      // Mock volume patterns data
      mockDb.all.mockResolvedValueOnce([
        { date: '2023-01-01', count: 100 },
        { date: '2023-01-02', count: 150 },
        { date: '2023-01-03', count: 200 },
        { date: '2023-01-04', count: 300 },
        { date: '2023-01-05', count: 500 }
      ]);

      // Mock keyword data
      mockDb.all.mockResolvedValueOnce([
        { keyword: 'bug', count: 50, avg_sentiment: -0.8 },
        { keyword: 'error', count: 40, avg_sentiment: -0.7 },
        { keyword: 'crash', count: 30, avg_sentiment: -0.9 }
      ]);

      // Mock performance metrics
      (analyticsService.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        apiResponseTime: { avg: 250, p95: 400, p99: 600 },
        throughput: { current: 100, capacity: 1000 },
        errorRate: 0.02,
        cacheHitRate: 0.85
      });

      // Mock business metrics - current week
      mockDb.all.mockResolvedValueOnce([
        { total_analyses: 1000, positive: 300, negative: 200, neutral: 500 }
      ]);
      
      // Mock business metrics - previous week
      mockDb.all.mockResolvedValueOnce([
        { total_analyses: 800, positive: 240, negative: 160, neutral: 400 }
      ]);

      const insights = await service.generateAllInsights();

      expect(insights).toHaveLength(5);
      expect(insights[0].category).toBe('Sentiment Trends');
      expect(insights[1].category).toBe('Volume Patterns');
      expect(insights[2].category).toBe('Keyword Anomalies');
      expect(insights[3].category).toBe('Performance Insights');
      expect(insights[4].category).toBe('Business Recommendations');
    });

    it('should handle errors gracefully', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));
      
      const insights = await service.generateAllInsights();
      
      expect(insights).toEqual([]);
    });
  });

  describe('getInsightsByType', () => {
    it('should filter insights by type', async () => {
      const mockInsights = [
        { type: 'trend', title: 'Trend 1' },
        { type: 'anomaly', title: 'Anomaly 1' },
        { type: 'trend', title: 'Trend 2' }
      ];

      jest.spyOn(service, 'generateAllInsights').mockResolvedValue([
        {
          category: 'Test',
          insights: mockInsights as any,
          summary: 'Test summary',
          count: 3
        }
      ]);

      const trends = await service.getInsightsByType('trend');
      
      expect(trends).toHaveLength(2);
      expect(trends[0].title).toBe('Trend 1');
      expect(trends[1].title).toBe('Trend 2');
    });
  });

  describe('getHighPriorityInsights', () => {
    it('should return only high severity insights', async () => {
      const mockInsights = [
        { severity: 'high', title: 'High 1' },
        { severity: 'low', title: 'Low 1' },
        { severity: 'high', title: 'High 2' },
        { severity: 'medium', title: 'Medium 1' }
      ];

      jest.spyOn(service, 'generateAllInsights').mockResolvedValue([
        {
          category: 'Test',
          insights: mockInsights as any,
          summary: 'Test summary',
          count: 4
        }
      ]);

      const highPriority = await service.getHighPriorityInsights();
      
      expect(highPriority).toHaveLength(2);
      expect(highPriority[0].title).toBe('High 1');
      expect(highPriority[1].title).toBe('High 2');
    });
  });

  describe('getActionableInsights', () => {
    it('should return only actionable insights', async () => {
      const mockInsights = [
        { actionable: true, title: 'Action 1' },
        { actionable: false, title: 'No Action' },
        { actionable: true, title: 'Action 2' }
      ];

      jest.spyOn(service, 'generateAllInsights').mockResolvedValue([
        {
          category: 'Test',
          insights: mockInsights as any,
          summary: 'Test summary',
          count: 3
        }
      ]);

      const actionable = await service.getActionableInsights();
      
      expect(actionable).toHaveLength(2);
      expect(actionable[0].title).toBe('Action 1');
      expect(actionable[1].title).toBe('Action 2');
    });
  });

  describe('getBusinessInsights', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should generate business insights', async () => {
      // Mock current week data
      mockDb.all.mockResolvedValueOnce([
        { total_analyses: 1000, positive: 400, negative: 200, neutral: 400 }
      ]);
      
      // Mock previous week data
      mockDb.all.mockResolvedValueOnce([
        { total_analyses: 800, positive: 300, negative: 200, neutral: 300 }
      ]);

      const insights = await service.getBusinessInsights();

      expect(insights).toHaveLength(4);
      expect(insights[0].metric).toBe('Total Analyses');
      expect(insights[0].current).toBe(1000);
      expect(insights[0].previous).toBe(800);
      expect(insights[0].change).toBe(25);
      expect(insights[0].trend).toBe('up');
    });

    it('should handle no data gracefully', async () => {
      mockDb.all.mockResolvedValue([]);
      
      const insights = await service.getBusinessInsights();
      
      expect(insights).toEqual([]);
    });
  });

  describe('getInsightHistory', () => {
    it('should retrieve insight history', async () => {
      const mockHistory = [
        {
          id: '1',
          type: 'trend',
          title: 'Historical Insight',
          timestamp: '2023-01-01T00:00:00Z'
        }
      ];

      mockDb.all.mockResolvedValue(mockHistory);

      const history = await service.getInsightHistory(7);

      expect(history).toEqual(mockHistory);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC')
      );
    });
  });

  describe('markInsightAsViewed', () => {
    it('should mark insight as viewed', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await service.markInsightAsViewed('test-id');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE insights SET viewed = 1')
      );
    });

    it('should throw error if insight not found', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(service.markInsightAsViewed('non-existent'))
        .rejects.toThrow('Insight not found');
    });
  });

  describe('dismissInsight', () => {
    it('should dismiss insight', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await service.dismissInsight('test-id');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE insights SET dismissed = 1')
      );
    });
  });

  describe('private methods', () => {
    it('should format category names correctly', () => {
      const formatted = service['formatCategoryName']('sentiment_trends_analysis');
      expect(formatted).toBe('Sentiment Trends Analysis');
    });

    it('should generate category summary for high severity insights', () => {
      const insights = [
        { severity: 'high', actionable: true },
        { severity: 'high', actionable: false },
        { severity: 'low', actionable: true }
      ] as any;

      const summary = service['generateCategorySummary'](insights);
      expect(summary).toBe('2 high-priority insights requiring attention');
    });

    it('should generate category summary for actionable insights', () => {
      const insights = [
        { severity: 'medium', actionable: true },
        { severity: 'low', actionable: true },
        { severity: 'low', actionable: false }
      ] as any;

      const summary = service['generateCategorySummary'](insights);
      expect(summary).toBe('2 actionable recommendations available');
    });

    it('should generate category summary for monitoring insights', () => {
      const insights = [
        { severity: 'low', actionable: false },
        { severity: 'low', actionable: false }
      ] as any;

      const summary = service['generateCategorySummary'](insights);
      expect(summary).toBe('2 insights for monitoring and analysis');
    });
  });

  describe('sentiment trend insights', () => {
    it('should detect negative sentiment trends', async () => {
      await service.initialize();
      
      mockDb.all.mockResolvedValue([
        { date: '2023-01-01', avg_score: 0.8 },
        { date: '2023-01-02', avg_score: 0.6 },
        { date: '2023-01-03', avg_score: 0.4 },
        { date: '2023-01-04', avg_score: 0.2 },
        { date: '2023-01-05', avg_score: 0.1 }
      ]);

      const insights = await service['generateSentimentTrendInsights']();

      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe('trend');
      expect(insights[0].title).toContain('Declining Sentiment Detected');
      expect(insights[0].severity).toBe('high');
    });

    it('should detect positive sentiment recovery', async () => {
      await service.initialize();
      
      mockDb.all.mockResolvedValue([
        { date: '2023-01-01', avg_score: -0.8 },
        { date: '2023-01-02', avg_score: -0.4 },
        { date: '2023-01-03', avg_score: 0.0 },
        { date: '2023-01-04', avg_score: 0.4 },
        { date: '2023-01-05', avg_score: 0.7 }
      ]);

      const insights = await service['generateSentimentTrendInsights']();

      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe('trend');
      expect(insights[0].title).toContain('Sentiment Recovery in Progress');
      expect(insights[0].severity).toBe('low');
    });
  });

  describe('volume pattern insights', () => {
    it('should detect volume spikes', async () => {
      await service.initialize();
      
      mockDb.all.mockResolvedValue([
        { date: '2023-01-01', count: 100 },
        { date: '2023-01-02', count: 120 },
        { date: '2023-01-03', count: 110 },
        { date: '2023-01-04', count: 500 }, // Spike
        { date: '2023-01-05', count: 480 }
      ]);

      const insights = await service['generateVolumePatternInsights']();

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].type).toBe('anomaly');
      expect(insights[0].title).toContain('Unusual Activity Spike');
    });
  });

  describe('keyword anomaly insights', () => {
    it('should detect negative keyword trends', async () => {
      await service.initialize();
      
      mockDb.all.mockResolvedValue([
        { keyword: 'bug', count: 50, avg_sentiment: -0.8 },
        { keyword: 'error', count: 45, avg_sentiment: -0.7 },
        { keyword: 'crash', count: 40, avg_sentiment: -0.9 },
        { keyword: 'issue', count: 35, avg_sentiment: -0.6 }
      ]);

      const insights = await service['generateKeywordAnomalyInsights']();

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].type).toBe('pattern');
      expect(insights[0].severity).toBe('high');
    });
  });

  describe('performance insights', () => {
    it('should detect high response times', async () => {
      await service.initialize();
      
      (analyticsService.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        apiResponseTime: { avg: 500, p95: 1200, p99: 2000 },
        throughput: { current: 100, capacity: 1000 },
        errorRate: 0.001,
        cacheHitRate: 0.9
      });

      const insights = await service['generatePerformanceInsights']();

      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(i => i.title.includes('Response Time'))).toBe(true);
    });

    it('should detect low cache hit rate', async () => {
      await service.initialize();
      
      (analyticsService.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        apiResponseTime: { avg: 100, p95: 200, p99: 300 },
        throughput: { current: 100, capacity: 1000 },
        errorRate: 0.001,
        cacheHitRate: 0.5
      });

      const insights = await service['generatePerformanceInsights']();

      expect(insights.some(i => i.title.includes('Cache Performance'))).toBe(true);
    });

    it('should detect high error rate', async () => {
      await service.initialize();
      
      (analyticsService.getPerformanceMetrics as jest.Mock).mockResolvedValue({
        apiResponseTime: { avg: 100, p95: 200, p99: 300 },
        throughput: { current: 100, capacity: 1000 },
        errorRate: 0.06,
        cacheHitRate: 0.9
      });

      const insights = await service['generatePerformanceInsights']();

      expect(insights.some(i => i.title.includes('Error Rate'))).toBe(true);
      expect(insights.find(i => i.title.includes('Error Rate'))?.severity).toBe('high');
    });
  });
});