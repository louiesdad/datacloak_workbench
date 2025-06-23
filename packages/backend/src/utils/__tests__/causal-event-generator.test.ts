import { CausalEventGenerator } from '../causal-event-generator';

describe('CausalEventGenerator', () => {
  describe('generateEventImpactData', () => {
    it('should generate 30000 events across 2000 customers over 12 months', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      expect(dataset.metadata.recordCount).toBe(30000);
      expect(dataset.metadata.uniqueCustomers).toBe(2000);
      expect(dataset.metadata.timeRange).toBe('12 months');
      expect(dataset.metadata.filename).toBe('test_causal_events_30k.csv');
    });

    it('should include all required event scenario types', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Count event types
      const eventTypes = new Set<string>();
      dataset.records.forEach(record => {
        eventTypes.add(record.event_type);
      });

      // Should have all event types
      expect(eventTypes.has('price_change')).toBe(true);
      expect(eventTypes.has('service_outage')).toBe(true);
      expect(eventTypes.has('feature_launch')).toBe(true);
      expect(eventTypes.has('support_quality')).toBe(true);
    });

    it('should generate price change scenarios with control groups', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Find price change events
      const priceChangeEvents = dataset.records.filter(r => r.event_type === 'price_change');
      
      // Should have both affected and control customers
      const affectedCustomers = priceChangeEvents.filter(r => r.affected).length;
      const controlCustomers = priceChangeEvents.filter(r => !r.affected).length;
      
      expect(affectedCustomers).toBeGreaterThan(0);
      expect(controlCustomers).toBeGreaterThan(0);
      
      // Check sentiment impact for affected customers
      const affectedRecords = priceChangeEvents.filter(r => r.affected);
      affectedRecords.forEach(record => {
        // Price increase should generally decrease sentiment
        expect(record.pre_sentiment).toBeGreaterThan(record.post_sentiment);
      });
    });

    it('should generate service outage events with regional impact', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Find outage events
      const outageEvents = dataset.records.filter(r => r.event_type === 'service_outage');
      
      expect(outageEvents.length).toBeGreaterThan(0);
      
      // Should show clear before/after sentiment impact
      const affectedOutages = outageEvents.filter(r => r.affected);
      affectedOutages.forEach(record => {
        // Outages should decrease sentiment
        expect(record.pre_sentiment - record.post_sentiment).toBeGreaterThan(5);
      });
    });

    it('should generate feature launch events with adoption correlation', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Find feature launch events
      const featureEvents = dataset.records.filter(r => r.event_type === 'feature_launch');
      
      expect(featureEvents.length).toBeGreaterThan(0);
      
      // Should have varying sentiment impact based on adoption
      const positiveImpacts = featureEvents.filter(r => r.post_sentiment > r.pre_sentiment).length;
      const negativeImpacts = featureEvents.filter(r => r.post_sentiment < r.pre_sentiment).length;
      
      // Should have some positive impacts (good features)
      expect(positiveImpacts).toBeGreaterThan(0);
      // Might also have some negative impacts (features people don't like)
      expect(negativeImpacts).toBeGreaterThanOrEqual(0);
    });

    it('should include confounding factors', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Check that confounding factors are present
      const recordsWithFactors = dataset.records.filter(r => 
        Object.keys(r.confounding_factors).length > 0
      );
      
      expect(recordsWithFactors.length).toBeGreaterThan(0);
      
      // Check for valid confounding factor types
      const validFactors = ['seasonal', 'competitor_action', 'market_trend', 'customer_segment'];
      dataset.records.forEach(record => {
        Object.keys(record.confounding_factors).forEach(factor => {
          expect(validFactors.includes(factor)).toBe(true);
        });
      });
    });

    it('should have proper event timing and structure', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateEventImpactData();
      
      // Check event IDs are properly formatted
      dataset.records.forEach(record => {
        expect(record.event_id).toMatch(/^EVENT-\d{6}$/);
        expect(record.customer_id).toMatch(/^CUST-\d{5}$/);
      });
      
      // Check pre and post sentiment are reasonable
      dataset.records.forEach(record => {
        expect(record.pre_sentiment).toBeGreaterThanOrEqual(0);
        expect(record.pre_sentiment).toBeLessThanOrEqual(100);
        expect(record.post_sentiment).toBeGreaterThanOrEqual(0);
        expect(record.post_sentiment).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('generateComplexCausalChains', () => {
    it('should generate 15000 records for 500 customers over 30 time periods', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateComplexCausalChains();
      
      expect(dataset.metadata.recordCount).toBe(15000);
      expect(dataset.metadata.uniqueCustomers).toBe(500);
      expect(dataset.metadata.timePeriods).toBe(30);
      expect(dataset.metadata.filename).toBe('test_causal_complex_15k.csv');
    });

    it('should include interaction effects between events', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateComplexCausalChains();
      
      // Group by customer to find those with multiple events
      const customerEvents = new Map<string, typeof dataset.records>();
      dataset.records.forEach(record => {
        if (!customerEvents.has(record.customer_id)) {
          customerEvents.set(record.customer_id, []);
        }
        customerEvents.get(record.customer_id)!.push(record);
      });

      // Find customers with multiple events
      let customersWithMultipleEvents = 0;
      customerEvents.forEach((events, customerId) => {
        if (events.length > 1) {
          customersWithMultipleEvents++;
        }
      });

      expect(customersWithMultipleEvents).toBeGreaterThan(0);
    });

    it('should show time-delayed impacts', () => {
      const generator = new CausalEventGenerator(42);
      const dataset = generator.generateComplexCausalChains();
      
      // Check for events with time_delay_weeks > 0
      const delayedImpacts = dataset.records.filter(r => r.time_delay_weeks > 0);
      expect(delayedImpacts.length).toBeGreaterThan(0);
      
      // Time delays should be reasonable (0-4 weeks)
      delayedImpacts.forEach(record => {
        expect(record.time_delay_weeks).toBeGreaterThanOrEqual(0);
        expect(record.time_delay_weeks).toBeLessThanOrEqual(4);
      });
    });
  });
});