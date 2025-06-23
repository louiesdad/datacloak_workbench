import { TrajectoryPatternGenerator } from '../trajectory-pattern-generator';

describe('TrajectoryPatternGenerator', () => {
  describe('generateHistoricalSentimentSeries', () => {
    it('should generate 50000 records for 1000 customers over 50 weeks', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      expect(dataset.metadata.recordCount).toBe(50000);
      expect(dataset.metadata.uniqueCustomers).toBe(1000);
      expect(dataset.metadata.timePeriods).toBe(50);
      expect(dataset.metadata.filename).toBe('test_sentiment_history_50k.csv');
    });

    it('should include all required trajectory pattern types', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Count pattern types
      const patternTypes = new Set<string>();
      dataset.records.forEach(record => {
        patternTypes.add(record.pattern_type);
      });

      // Should have all pattern types
      expect(patternTypes.has('linear_decline')).toBe(true);
      expect(patternTypes.has('seasonal')).toBe(true);
      expect(patternTypes.has('volatile_stable')).toBe(true);
      expect(patternTypes.has('recovery')).toBe(true);
      expect(patternTypes.has('cliff_drop')).toBe(true);
    });

    it('should generate linear decline patterns correctly', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Find linear decline customers
      const declineCustomers = new Set<string>();
      dataset.records.forEach(record => {
        if (record.pattern_type === 'linear_decline') {
          declineCustomers.add(record.customer_id);
        }
      });

      // Check that decline customers show consistent decline
      declineCustomers.forEach(customerId => {
        const customerRecords = dataset.records
          .filter(r => r.customer_id === customerId)
          .sort((a, b) => a.week_number - b.week_number);

        // Should show overall decline trend
        const firstQuarter = customerRecords.slice(0, 12);
        const lastQuarter = customerRecords.slice(-12);
        
        const avgFirst = firstQuarter.reduce((sum, r) => sum + r.sentiment_score, 0) / firstQuarter.length;
        const avgLast = lastQuarter.reduce((sum, r) => sum + r.sentiment_score, 0) / lastQuarter.length;
        
        expect(avgFirst - avgLast).toBeGreaterThan(20); // At least 20 point decline
      });
    });

    it('should generate seasonal patterns correctly', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Find seasonal customers
      const seasonalCustomers = new Set<string>();
      dataset.records.forEach(record => {
        if (record.pattern_type === 'seasonal') {
          seasonalCustomers.add(record.customer_id);
        }
      });

      // Check for seasonal variation (at least one customer)
      expect(seasonalCustomers.size).toBeGreaterThan(0);
      
      // Check seasonal pattern has variation but stable average
      const firstCustomer = Array.from(seasonalCustomers)[0];
      const customerRecords = dataset.records
        .filter(r => r.customer_id === firstCustomer)
        .sort((a, b) => a.week_number - b.week_number);

      const sentiments = customerRecords.map(r => r.sentiment_score);
      const max = Math.max(...sentiments);
      const min = Math.min(...sentiments);
      
      // Should have significant variation (seasonal peaks and valleys)
      expect(max - min).toBeGreaterThan(15);
    });

    it('should generate volatile but stable patterns correctly', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Find volatile stable customers
      const volatileCustomers = new Set<string>();
      dataset.records.forEach(record => {
        if (record.pattern_type === 'volatile_stable') {
          volatileCustomers.add(record.customer_id);
        }
      });

      expect(volatileCustomers.size).toBeGreaterThan(0);
      
      // Check high week-to-week variance but stable long-term average
      const firstCustomer = Array.from(volatileCustomers)[0];
      const customerRecords = dataset.records
        .filter(r => r.customer_id === firstCustomer)
        .sort((a, b) => a.week_number - b.week_number);

      // Calculate week-to-week changes
      let totalVariance = 0;
      for (let i = 1; i < customerRecords.length; i++) {
        const change = Math.abs(customerRecords[i].sentiment_score - customerRecords[i-1].sentiment_score);
        totalVariance += change;
      }
      const avgVariance = totalVariance / (customerRecords.length - 1);
      
      // Should have high variance
      expect(avgVariance).toBeGreaterThan(5);
    });

    it('should have proper confidence and data points', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Check confidence values are between 0.5 and 1.0
      dataset.records.forEach(record => {
        expect(record.confidence).toBeGreaterThanOrEqual(0.5);
        expect(record.confidence).toBeLessThanOrEqual(1.0);
      });

      // Check data points are reasonable
      dataset.records.forEach(record => {
        expect(record.data_points).toBeGreaterThan(0);
        expect(record.data_points).toBeLessThanOrEqual(50);
      });
    });

    it('should include major events flags', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateHistoricalSentimentSeries();
      
      // Should have some major events
      const eventsCount = dataset.records.filter(r => r.major_events.length > 0).length;
      expect(eventsCount).toBeGreaterThan(0);
      
      // Check event types are valid
      const validEvents = ['product_launch', 'outage', 'holiday', 'promotion'];
      dataset.records.forEach(record => {
        record.major_events.forEach(event => {
          expect(validEvents.includes(event)).toBe(true);
        });
      });
    });
  });

  describe('generateFutureValidationSet', () => {
    it('should generate 10000 records for 200 customers over 50 weeks', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateFutureValidationSet();
      
      expect(dataset.metadata.recordCount).toBe(10000);
      expect(dataset.metadata.uniqueCustomers).toBe(200);
      expect(dataset.metadata.timePeriods).toBe(50);
      expect(dataset.metadata.filename).toBe('test_future_outcomes_10k.csv');
    });

    it('should have training and validation split', () => {
      const generator = new TrajectoryPatternGenerator(42);
      const dataset = generator.generateFutureValidationSet();
      
      const trainingWeeks = dataset.records.filter(r => r.week_number <= 35);
      const validationWeeks = dataset.records.filter(r => r.week_number > 35);
      
      expect(trainingWeeks.length).toBeGreaterThan(0);
      expect(validationWeeks.length).toBeGreaterThan(0);
      
      // Validation should be weeks 36-50 (15 weeks)
      expect(validationWeeks.length).toBe(200 * 15); // 200 customers × 15 weeks
    });
  });
});